import scrapy, re
from datetime import datetime
from ..items import RecipeItem

class AllRecipesSpider(scrapy.Spider):
    name = "allrecipes"
    allowed_domains = ["allrecipes.com"]
    # For this early stage we just start from the main recipes page
    start_urls = ["https://www.allrecipes.com/recipes/"]
    # Limit how much we crawl while testing
    custom_settings = {
        "USER_AGENT": "AllergenResearchBot/0.1 (+student@example.com)",
        "DOWNLOAD_DELAY": 0.5,
        "CLOSESPIDER_ITEMCOUNT": 10,  # stop after 10 recipes for testing
    }

    def parse(self, response):
        for href in response.css("a::attr(href)").getall():
            if self.is_recipe_url(href):
                yield response.follow(href, callback=self.parse_recipe)

    # ---------- URL helper ----------
    def is_recipe_url(self, url: str) -> bool:

        if not url:
            return False
        # normalise "protocol-relative" links, just in case
        if url.startswith("//"):
            url = "https:" + url
        # only consider Allrecipes links
        if "allrecipes.com" not in url:
            return False
        pattern = r"/recipe/|[-/]recipe-\d+"
        return bool(re.search(pattern, url))

    def parse_recipe(self, response):
        item = RecipeItem()
        item["url"] = response.url
        item["source"] = "allrecipes"
        item["scraped_at"] = datetime.utcnow().isoformat()
        # --- Title ---
        item["title"] = response.css("h1.article-heading::text").get(default="").strip()
        # --- Meta Data ---
        meta_items = response.css("div.mm-recipes-details__item")
        item["prep_time"] = item["cook_time"] = item["total_time"] = item["servings"] = None
        for m in meta_items:
            label = m.css("div.mm-recipes-details__label::text").get(default="").strip().lower()
            value = m.css("div.mm-recipes-details__value::text").get(default="").strip()

            if "prep" in label:
                item["prep_time"] = value
            elif "cook" in label:
                item["cook_time"] = value
            elif "total" in label:
                item["total_time"] = value
            elif "servings" in label:
                item["servings"] = value
        # --- Ingredients ---
        ingredients = []
        for li in response.css("ul.mm-recipes-structured-ingredients__list li"):
            text = " ".join(li.css("::text").getall()).strip()
            if text:
                ingredients.append(" ".join(text.split()))
        item["ingredients_raw"] = ingredients
        # --- Instructions ---
        instructions = []
        for li in response.css("ol.mntl-sc-block-group--OL > li"):
            text_parts = li.css("p.mntl-sc-block-html::text").getall()
            step = " ".join(t.strip() for t in text_parts if t.strip())
            if step:
                instructions.append(step)
        item["instructions_raw"] = instructions

        yield item

