# Define here the models for your scraped items
#
# See documentation in:
# https://docs.scrapy.org/en/latest/topics/items.html

import scrapy

class RecipeItem(scrapy.Item):
    url = scrapy.Field()
    source = scrapy.Field()
    scraped_at = scrapy.Field()

    title = scrapy.Field()

    ingredients_raw = scrapy.Field()     # list[str]
    instructions_raw = scrapy.Field()    # list[str]

    prep_time = scrapy.Field()
    cook_time = scrapy.Field()
    total_time = scrapy.Field()
    servings = scrapy.Field()



