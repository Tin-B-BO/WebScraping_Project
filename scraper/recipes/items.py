# scraper/recipes/items.py
import scrapy

class RecipeItem(scrapy.Item):
    url = scrapy.Field()
    source = scrapy.Field()

    title = scrapy.Field()

    prep_time = scrapy.Field()
    cook_time = scrapy.Field()
    total_time = scrapy.Field()
    servings = scrapy.Field()

    image_url = scrapy.Field()

    ingredients_raw = scrapy.Field()
    instructions_raw = scrapy.Field()
