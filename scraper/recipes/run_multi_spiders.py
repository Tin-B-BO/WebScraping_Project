# root/scraper/recipes/run_multi_spiders.py

from __future__ import annotations

import argparse
from typing import List, Type
from scrapy.crawler import CrawlerProcess
from scrapy.utils.project import get_project_settings
# import active spiders for multi-source scraping
from recipes.spiders.allrecipes_search import AllRecipesSpider
from recipes.spiders.foodnetwork_search import FoodNetworkSpider
from recipes.spiders.seriouseats_search import SeriousEatsSpider

def _split_total(total: int, num_spiders: int) -> List[int]:
    # split total target across spiders and put remainder on the last spider
    total = max(0, int(total))
    num_spiders = max(1, int(num_spiders))
    if total <= 0:
        return [0] * num_spiders
    base_allocation = total // num_spiders
    remainder = total - base_allocation * num_spiders
    allocations = [base_allocation] * num_spiders
    allocations[-1] += remainder
    return allocations

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--query", required=True)
    parser.add_argument("--max-items", type=int, required=True)
    args = parser.parse_args()
    query = args.query.strip()
    max_items = max(1, int(args.max_items))
    # start crawler process with project settings
    settings = get_project_settings()
    process = CrawlerProcess(settings)

    # keep the list in desired scheduling order
    spiders: List[Type] = [
        AllRecipesSpider,
        FoodNetworkSpider,
        SeriousEatsSpider,
    ]

    # split target items across spiders and launch each crawl
    allocations = _split_total(max_items, len(spiders))
    for spider_cls, allocated_items in zip(spiders, allocations):
        if allocated_items <= 0:
            continue
        process.crawl(spider_cls, query=query, max_items=allocated_items)
    process.start()

if __name__ == "__main__":
    main()
