import html
import json
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


def format_iso_duration(iso_str):
    """convert iso durations to lower-case hour/min text"""
    if not iso_str or not isinstance(iso_str, str) or "PT" not in iso_str:
        return (iso_str or "").lower()

    # extract hour and minute parts
    hours_match = re.search(r"(\d+)H", iso_str)
    mins_match = re.search(r"(\d+)M", iso_str)
    total_hrs = int(hours_match.group(1)) if hours_match else 0
    total_mins = int(mins_match.group(1)) if mins_match else 0

    # convert large minute values to hours
    if total_mins >= 60:
        total_hrs += total_mins // 60
        total_mins = total_mins % 60

    parts = []
    if total_hrs > 0:
        parts.append(f"{total_hrs} {'hr' if total_hrs == 1 else 'hrs'}")
    if total_mins > 0:
        parts.append(f"{total_mins} {'min' if total_mins == 1 else 'mins'}")

    return " ".join(parts) if parts else iso_str


def _first_nonempty(values):
    for value in values or []:
        value = (value or "").strip()
        if value:
            return value.lower()
    return None


def _normalize_step(text: str) -> str:
    normalized_text = html.unescape(text or "")
    normalized_text = re.sub(r"<[^>]+>", " ", normalized_text)
    normalized_text = " ".join(normalized_text.split()).strip().lower()
    # remove leading step numbers like 1. or 1)
    normalized_text = re.sub(r"^\d+\s*[\.\)]\s*", "", normalized_text)
    return normalized_text


def _extract_instructions_from_ld(recipe_ld):
    # output instruction steps parsed from json-ld
    instructions = []
    if not isinstance(recipe_ld, dict):
        return instructions

    # read recipeInstructions from recipe json-ld
    raw_instructions = recipe_ld.get("recipeInstructions")
    if not raw_instructions:
        return instructions

    # normalize and append one step if non-empty
    def add_step(step_text):
        step = _normalize_step(step_text)
        if step:
            instructions.append(step)

    # handle plain text instructions split by lines
    if isinstance(raw_instructions, str):
        for part in raw_instructions.splitlines():
            add_step(part)
        return instructions

    # handle list instructions as strings or howtostep objects
    if isinstance(raw_instructions, list):
        for node in raw_instructions:
            if isinstance(node, str):
                add_step(node)
                continue
            if isinstance(node, dict):
                # howtostep nodes usually keep text in text or name
                add_step(node.get("text") or node.get("name"))
        return instructions

    # unknown instruction format
    return instructions


def _extract_instructions_from_method_h2(response):
    # find the first h2 section that contains method
    heading = response.xpath(
        "//h2[contains(translate(normalize-space(.), "
        "'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'method')][1]"
    )
    if not heading:
        return []

    # collect normalized steps under the method section
    instructions = []
    for sibling in heading.xpath("following-sibling::*"):
        tag = (sibling.root.tag or "").lower() if getattr(sibling, "root", None) is not None else ""
        # stop when a new section heading starts
        if tag in {"h1", "h2"}:
            break

        # prefer ordered or unordered list items as instruction steps
        list_items = sibling.xpath(".//li")
        if list_items:
            for list_item in list_items:
                step = _normalize_step(" ".join(list_item.xpath(".//text()").getall()))
                if step:
                    instructions.append(step)
            continue

        # otherwise use paragraph text in that section block
        paragraphs = sibling.xpath(".//p")
        if paragraphs:
            for paragraph in paragraphs:
                step = _normalize_step(" ".join(paragraph.xpath(".//text()").getall()))
                if step:
                    instructions.append(step)

    # return all extracted method steps
    return instructions


def _find_recipe_obj(ld_data):
    # normalize json-ld into a list of objects
    objects = []
    if isinstance(ld_data, list):
        objects = ld_data
    elif isinstance(ld_data, dict):
        # handle @graph wrapper when present
        if isinstance(ld_data.get("@graph"), list):
            objects = ld_data["@graph"]
        else:
            objects = [ld_data]

    # return the first object with recipe type
    for obj in objects:
        if not isinstance(obj, dict):
            continue
        obj_type = obj.get("@type")
        if isinstance(obj_type, list) and "Recipe" in obj_type:
            return obj
        if isinstance(obj_type, str) and obj_type.lower() == "recipe":
            return obj

    # no recipe object found in this json-ld block
    return None


class FoodNetworkSpider(scrapy.Spider):
    name = "foodnetwork_search"
    allowed_domains = ["foodnetwork.co.uk"]
    base_search_url = "https://foodnetwork.co.uk/search?q={query}"

    custom_settings = {
        "USER_AGENT": "universityproject (recipe.project.uni@gmail.com)",
        "DOWNLOAD_DELAY": 0.3,
        "CONCURRENT_REQUESTS": 16,
        "DEPTH_LIMIT": 1,
        "DOWNLOAD_TIMEOUT": 12,
        "RETRY_ENABLED": True,
        "RETRY_TIMES": 2,
        "LOG_ENABLED": True,
        "LOG_LEVEL": "ERROR",
        "TELNETCONSOLE_ENABLED": False,
        "AUTOTHROTTLE_ENABLED": True,
        "ROBOTSTXT_OBEY": True,
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.seen_recipe_urls = set()
        self.query_raw = str(getattr(self, "query", "") or "").strip().lower()

        try:
            max_items = int(getattr(self, "max_items", 0) or 0)
            if max_items > 0:
                self.custom_settings["CLOSESPIDER_ITEMCOUNT"] = max_items
        except Exception:
            pass

    def start_requests(self):
        if not self.query_raw:
            return

        yield scrapy.Request(
            self.base_search_url.format(query=quote_plus(self.query_raw)),
            callback=self.parse_search,
            priority=1000,
        )

    def parse_search(self, response):
        # collect recipe links from search cards
        links = response.css("a.block.group[href*='/recipes/']::attr(href)").getall()

        ordered_urls = []
        seen = set()
        for href in links:
            if not href:
                continue
            url = response.urljoin(href)
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
        item = RecipeItem()
        item["url"] = response.url
        item["source"] = "foodnetwork"

        # extract title
        item["title"] = response.css("h1.p-name::text").get(default="").strip().lower()

        # apply query-title match gate
        if not matches_query_rules(item["title"], self.query_raw):
            return

        # extract image url from srcset or src
        srcset = response.css("img.u-photo::attr(srcset)").get()
        if srcset:
            item["image_url"] = srcset.split(",")[0].split(" ")[0].strip()
        else:
            item["image_url"] = response.css("img.u-photo::attr(src)").get()

        # initialize metadata fields
        item["prep_time"] = None
        item["cook_time"] = None
        item["total_time"] = None
        item["servings"] = None

        # parse json-ld blocks and pick recipe object
        recipe_ld = None
        ld_texts = response.xpath("//script[@type='application/ld+json']/text()").getall()
        for raw_ld in ld_texts:
            raw_ld = (raw_ld or "").strip()
            if not raw_ld:
                continue
            try:
                ld_data = json.loads(raw_ld)
            except Exception:
                continue
            recipe_obj = _find_recipe_obj(ld_data)
            if recipe_obj:
                recipe_ld = recipe_obj
                break

        if recipe_ld:
            # map json-ld time and servings
            raw_duration = recipe_ld.get("totalTime") or recipe_ld.get("cookTime") or recipe_ld.get("prepTime")
            item["total_time"] = format_iso_duration(raw_duration)
            item["servings"] = str(recipe_ld.get("recipeYield") or "").lower()

        # use html text fields when json-ld values are missing
        if not item["total_time"]:
            item["total_time"] = _first_nonempty(
                response.css("span.dt-duration::text").getall()
                + response.css("span.dt-duration *::text").getall()
            )
        if not item["servings"]:
            item["servings"] = _first_nonempty(
                response.css("span.p-yield::text").getall()
                + response.css("span.p-yield *::text").getall()
            )

        # extract ingredients and normalize spacing
        ingredients = []
        for ingredient_node in response.css("label.p-ingredient"):
            ingredient_text = " ".join(ingredient_node.xpath(".//text()").getall()).strip().lower()
            if ingredient_text:
                ingredients.append(" ".join(ingredient_text.split()))
        item["ingredients_raw"] = ingredients

        # extract instructions by priority json-ld then method section then legacy block
        instructions = _extract_instructions_from_ld(recipe_ld)
        if not instructions:
            instructions = _extract_instructions_from_method_h2(response)

        if not instructions:
            for paragraph in response.css(".e-instructions p"):
                step = _normalize_step(" ".join(paragraph.xpath(".//text()").getall()))
                if not step:
                    continue
                if "copyright" in step or "rights reserved" in step:
                    continue
                if "recipe courtesy of" in step or "inspiration.sainsburys" in step:
                    continue
                instructions.append(step)

        item["instructions_raw"] = instructions

        # keep only records with at least one ingredient
        if len(item["ingredients_raw"]) < 1:
            self.logger.error(
                "[CN][foodnetwork][quality_filter] url=%s title=%r ingredients_count=%s",
                response.url,
                item.get("title"),
                len(item["ingredients_raw"]),
            )
            return

        yield item
