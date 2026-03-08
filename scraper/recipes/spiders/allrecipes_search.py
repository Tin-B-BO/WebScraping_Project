import re
from urllib.parse import quote_plus

import scrapy

from ..items import RecipeItem


def matches_query_rules(title: str, query: str) -> bool:
    """match all keywords for one or two keyword queries, and at least two keywords for longer queries"""
    # normalize title 
    normalized_title = re.sub(r"[^a-z0-9]+", " ", (title or "").lower()).strip()
    # tokenize query and apply stemming for common word variants.
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
    if keyword_count <= 2:
        required_matches = keyword_count
    else:
        required_matches = 2

    match_count = 0
    for keyword in keywords:
        # match full words and allow common endings
        pattern = rf"\b{re.escape(keyword)}(y|ied|ies|ing|ed|es|s|'s)?\b"
        # count how many query keywords are found in the title
        if re.search(pattern, normalized_title):
            match_count += 1
    # pass only when matched keywords meet the required threshold
    return match_count >= required_matches


class AllRecipesSpider(scrapy.Spider):
    name = "allrecipes_search"
    allowed_domains = ["allrecipes.com"]
    base_search_url = "https://www.allrecipes.com/search?q={query}"

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

        # Optional runner override: stop spider after collecting N items.
        try:
            max_items = int(getattr(self, "max_items", 0) or 0)
            if max_items > 0:
                self.custom_settings["CLOSESPIDER_ITEMCOUNT"] = max_items
        except Exception:
            pass

        # Keep the original query for strict title filtering later.
        self.query_raw = str(getattr(self, "query", "") or "").strip()

    def start_requests(self):
        if not self.query_raw:
            return

        yield scrapy.Request(
            self.base_search_url.format(query=quote_plus(self.query_raw)),
            callback=self.parse_search,
            priority=1000,
        )

    def parse_search(self, response):
        # use recipe card links first, then a backup selector if layout changes
        links = response.css("a.mntl-card-list-items[href*='/recipe/']::attr(href)").getall()
        if not links:
            links = response.xpath("//a[contains(@href, '/recipe/')]/@href").getall()

        # keep only recipe-page links
        cleaned_links = []
        for href in links:
            if not href or "/recipe/" not in href:
                continue
            if href.startswith("http") and "allrecipes.com/recipe/" not in href:
                continue
            cleaned_links.append(href)

        # remove duplicates and keep first-seen order
        ordered_links = []
        seen = set()
        for url in cleaned_links:
            if url in seen:
                continue
            seen.add(url)
            ordered_links.append(url)

        # follow more links because strict keyword filtering removes some matches
        item_cap = int(self.custom_settings.get("CLOSESPIDER_ITEMCOUNT", 0) or 30)  # target item count
        max_follow = max(30, item_cap * 3)  # crawl buffer to hit target after filtering

        # follow recipe links up to the crawl cap
        for href in ordered_links[:max_follow]:
            # skip urls already scheduled to avoid duplicate requests
            if href in self.seen_recipe_urls:
                continue
            self.seen_recipe_urls.add(href)
            # queue recipe page for detailed extraction
            yield response.follow(href, callback=self.parse_recipe, priority=100)

    def parse_recipe(self, response):
        item = RecipeItem()
        item["url"] = response.url
        item["source"] = "allrecipes"
        # extract title with a secondary selector for layout changes
        title = response.xpath("//h1[contains(@class, 'article-heading')]//text()").get(default="").strip()
        if not title:
            title = response.xpath("//h1//text()").get(default="").strip()
        item["title"] = title

        # apply keyword match gate to avoid unrelated recipes
        if not matches_query_rules(item["title"], self.query_raw):
            self.logger.info("Filtered out: '%s' did not match query '%s'", item["title"], self.query_raw)
            return

        # extract image url using primary selector then secondary options
        item["image_url"] = (
            response.xpath("//img[contains(@class,'primary-image__image')]/@src").get()
            or response.xpath("//img[contains(@class,'primary-image__image')]/@data-src").get()
            or response.xpath("//meta[@property='og:image']/@content").get()
        )

        # extract recipe metadata fields
        item["prep_time"] = None
        item["cook_time"] = None
        item["total_time"] = None
        item["servings"] = None
        for meta_row in response.xpath("//div[@class='mm-recipes-details__item']"):
            label = meta_row.xpath("./div[@class='mm-recipes-details__label']/text()").get(default="").strip().lower()
            value = meta_row.xpath("./div[@class='mm-recipes-details__value']/text()").get(default="").strip()

            if "prep time" in label:
                item["prep_time"] = value
            elif "cook time" in label:
                item["cook_time"] = value
            elif "total time" in label:
                item["total_time"] = value
            elif "servings" in label:
                item["servings"] = value

        # extract ingredients as clean single-line text
        ingredients = []
        for node in response.xpath("//ul[contains(@class, 'mm-recipes-structured-ingredients__list')]/li"):
            ingredient_text = " ".join(node.xpath(".//text()").getall()).strip()
            if ingredient_text:
                ingredients.append(" ".join(ingredient_text.split()))
        item["ingredients_raw"] = ingredients

        # extract instructions from step text, then broader step content if needed
        instructions = []
        for node in response.xpath("//ol[contains(@class, 'mntl-sc-block-group--OL')]/li"):
            instruction_text = node.xpath("./p[contains(@class, 'mntl-sc-block-html')]/text()").getall()
            if not instruction_text:
                instruction_text = node.xpath(".//text()").getall()
            step = " ".join(text.strip() for text in instruction_text if text.strip())
            if step:
                instructions.append(step)
        item["instructions_raw"] = instructions

        # keep only usable recipes.
        if len(item["ingredients_raw"]) < 1:
            return

        yield item
