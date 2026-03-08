import re
from urllib.parse import quote_plus

import scrapy

from ..items import RecipeItem


def matches_query_rules(title: str, query: str) -> bool:
    """match all keywords for one or two keyword queries, and at least two keywords for longer queries"""
    # normalize title
    normalized_title = re.sub(r"[^a-z0-9]+", " ", (title or "").lower()).strip()
    # tokenize query and apply stemming for common word variants
    suffix_pattern = r"(ies$|ing$|ed$|es$|s$|'s$)"  # strips plural, tense, and possessive endings
    raw_keywords = re.findall(r"[a-z0-9]+", (query or "").lower())  # split query into words
    keywords = [re.sub(suffix_pattern, "", word) for word in raw_keywords if len(word) >= 2]

    # if query has no usable keywords, allow the match
    if not keywords:
        return True
    # if title is empty, nothing can match
    if not normalized_title:
        return False

    # short queries need full keyword match, long queries need minimum 2 matches
    keyword_count = len(keywords)
    required_matches = keyword_count if keyword_count <= 2 else 2

    match_count = 0
    for keyword in keywords:
        # match full words and allow common endings
        pattern = rf"\b{re.escape(keyword)}(y|ied|ies|ing|ed|es|s|'s)?\b"
        # count how many query keywords are found in the title
        if re.search(pattern, normalized_title):
            match_count += 1

    # pass only when matched keywords meet the required threshold
    return match_count >= required_matches


def _pick_largest_from_srcset(srcset: str) -> str | None:
    # parse srcset and return the largest width 
    if not srcset:
        return None

    best_url = None
    best_width = -1
    for candidate in [part.strip() for part in srcset.split(",") if part.strip()]:
        parts = candidate.split()
        if not parts:
            continue

        url = parts[0].strip()
        try:
            width = int(parts[1].replace("w", "").strip()) if len(parts) > 1 and parts[1].endswith("w") else -1
        except Exception:
            width = -1

        if width > best_width:
            best_width = width
            best_url = url

    return best_url


class SeriousEatsSpider(scrapy.Spider):
    name = "seriouseats_search"
    allowed_domains = ["seriouseats.com"]
    search_url = "https://www.seriouseats.com/search?q={query}"

    custom_settings = {
        "USER_AGENT": "UniversityProject (recipe.project.uni@gmail.com)",
        "DOWNLOAD_DELAY": 0.1,
        "CONCURRENT_REQUESTS": 16,
        "DEPTH_LIMIT": 1,
        "DOWNLOAD_TIMEOUT": 12,
        "RETRY_ENABLED": True,
        "RETRY_TIMES": 2,
        "LOG_ENABLED": True,
        "LOG_LEVEL": "ERROR",
        "CLOSESPIDER_ITEMCOUNT": 0,
        "TELNETCONSOLE_ENABLED": False,
        "AUTOTHROTTLE_ENABLED": True,
        "ROBOTSTXT_OBEY": True,
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.seen_recipe_urls = set()

        # allow runner to cap items per spider
        try:
            max_items = int(getattr(self, "max_items", 0) or 0)
            if max_items > 0:
                self.custom_settings["CLOSESPIDER_ITEMCOUNT"] = max_items
        except Exception:
            pass

        self.query_raw = str(getattr(self, "query", "") or "").strip()

    def start_requests(self):
        if not self.query_raw:
            return

        # stem query terms before building search query
        raw_terms = re.findall(r"[a-z0-9]+", self.query_raw.lower())
        suffix_pattern = r"(ies$|ing$|ed$|es$|s$|'s$)"
        stemmed_terms = [re.sub(suffix_pattern, "", term) for term in raw_terms if len(term) >= 2]
        search_query = " ".join(stemmed_terms) if stemmed_terms else self.query_raw

        yield scrapy.Request(
            self.search_url.format(query=quote_plus(search_query)),
            callback=self.parse_search,
            priority=1000,
        )

    def parse_search(self, response):
        # collect recipe links from search cards
        links = response.css("a.card[href*='seriouseats.com/']::attr(href)").getall()

        candidate_urls = []
        for href in links:
            if not href or "/search" in href or "/privacy" in href:
                continue
            candidate_urls.append(href)

        # keep first-seen order while removing duplicates
        ordered_urls = []
        seen = set()
        for url in candidate_urls:
            if url in seen:
                continue
            seen.add(url)
            ordered_urls.append(url)

        # follow more links because strict keyword filtering removes some matches
        item_cap = int(self.custom_settings.get("CLOSESPIDER_ITEMCOUNT", 0) or 30)
        max_follow = max(30, item_cap * 3)

        for url in ordered_urls[:max_follow]:
            if url in self.seen_recipe_urls:
                continue
            self.seen_recipe_urls.add(url)
            yield response.follow(url, callback=self.parse_recipe, priority=100)

    def parse_recipe(self, response):
        # require expected recipe structure before extracting fields
        has_recipe_block = bool(response.xpath("//div[contains(@class,'recipe-decision-block')]").get())
        has_ingredients_block = bool(response.xpath("//div[contains(@class,'structured-ingredients')]").get())
        has_instructions_block = bool(response.xpath("//section[starts-with(@id,'section--instructions')]").get())
        if not (has_ingredients_block and has_instructions_block) and not has_recipe_block:
            return

        item = RecipeItem()
        item["url"] = response.url
        item["source"] = "seriouseats"

        # extract title with selector backup
        title_text = response.xpath("//h2[contains(@class,'recipe-decision-block__title')]/text()").get()
        if not title_text:
            title_text = response.xpath("//h1[contains(@class,'heading__title')]/text()").get()
        item["title"] = re.sub(r"\s+", " ", (title_text or "").strip())

        # apply query-title match gate
        if not matches_query_rules(item["title"], self.query_raw):
            return

        # resolve image url from primary image then figure fallback
        image_url = (
            response.xpath("//img[contains(@class,'primary-image__image')]/@data-hi-res-src").get()
            or response.xpath("//img[contains(@class,'primary-image__image')]/@data-src").get()
            or response.xpath("//img[contains(@class,'primary-image__image')]/@src").get()
        )
        if not image_url:
            image_url = _pick_largest_from_srcset(
                response.xpath("//img[contains(@class,'primary-image__image')]/@srcset").get()
            )

        if not image_url:
            image_url = (
                response.xpath("//figure[@id='mntl-sc-block_4-0']//img/@data-hi-res-src").get()
                or response.xpath("//figure[@id='mntl-sc-block_4-0']//img/@data-src").get()
                or response.xpath("//figure[@id='mntl-sc-block_4-0']//img/@src").get()
            )
            if not image_url:
                image_url = _pick_largest_from_srcset(
                    response.xpath("//figure[@id='mntl-sc-block_4-0']//img/@srcset").get()
                )
        item["image_url"] = image_url

        # extract metadata
        prep_time = None
        cook_time = None
        total_time = None
        servings = None
        meta_nodes = response.xpath("//div[contains(@class,'recipe-decision-block')]//span[contains(@class,'meta-text')]")
        for meta_node in meta_nodes:
            label = meta_node.xpath(".//span[contains(@class,'meta-text__label')]/text()").get(default="").strip().lower()
            value = meta_node.xpath(".//span[contains(@class,'meta-text__data')]/text()").get(default="").strip()
            if "prep" in label:
                prep_time = value
            elif "cook" in label:
                cook_time = value
            elif "total" in label:
                total_time = value
            elif "serve" in label or "yield" in label:
                servings = value

        item["prep_time"] = prep_time
        item["cook_time"] = cook_time
        item["total_time"] = total_time
        item["servings"] = servings

        # extract ingredients and normalize spacing
        ingredients = []
        ingredient_nodes = response.xpath(
            "//div[contains(@class,'structured-ingredients')]//li[contains(@class,'structured-ingredients__list-item')]"
        )
        for ingredient_node in ingredient_nodes:
            text_value = " ".join(ingredient_node.xpath(".//text()").getall()).strip()
            clean_text = re.sub(r"\s+", " ", text_value).replace(" ,", ",").strip()
            if clean_text:
                ingredients.append(clean_text)
        item["ingredients_raw"] = ingredients

        # extract instructions and normalize spacing
        instructions = []
        instruction_nodes = response.xpath("//section[starts-with(@id,'section--instructions')]//ol/li")
        for instruction_node in instruction_nodes:
            text_value = " ".join(
                instruction_node.xpath(".//p[contains(@class,'mntl-sc-block-html')]//text()").getall()
            ).strip()
            clean_text = re.sub(r"\s+", " ", text_value).strip()
            if clean_text:
                instructions.append(clean_text)
        item["instructions_raw"] = instructions

        # keep only records with at least one ingredient
        if len(item["ingredients_raw"]) < 1:
            return

        yield item
