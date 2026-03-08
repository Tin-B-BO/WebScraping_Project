# scraper/recipes/settings.py
import os
from pathlib import Path
import sys

BOT_NAME = "recipes"

SPIDER_MODULES = ["recipes.spiders"]
NEWSPIDER_MODULE = "recipes.spiders"

# Respect robots.txt? For coursework testing you can keep False, but True is more "ethical".
# NOTE: AllRecipes may block heavy crawling. Keep requests small and polite.
ROBOTSTXT_OBEY = False

# Identify your crawler (good practice)
USER_AGENT = "UniversityProject (recipe.project.uni@gmail.com)"

# Polite crawling
DOWNLOAD_DELAY = 0.5
RANDOMIZE_DOWNLOAD_DELAY = True
CONCURRENT_REQUESTS = 8
CONCURRENT_REQUESTS_PER_DOMAIN = 4

# Avoid retry storms
RETRY_ENABLED = True
RETRY_TIMES = 2
RETRY_HTTP_CODES = [429, 500, 502, 503, 504, 522, 524]

# Timeout protection
DOWNLOAD_TIMEOUT = 25

# Cookies can cause weird session behaviour; generally safe off for recipe scraping
COOKIES_ENABLED = False

# Default request headers
DEFAULT_REQUEST_HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en",
}

# Pipelines are optional. If you don’t need them, keep empty.

ITEM_PIPELINES = {"recipes.pipelines.PostgresRecipePipeline": 300}


# AutoThrottle helps avoid bans when you scale up (optional but useful)
AUTOTHROTTLE_ENABLED = True
AUTOTHROTTLE_START_DELAY = 0.5
AUTOTHROTTLE_MAX_DELAY = 10.0
AUTOTHROTTLE_TARGET_CONCURRENCY = 2.0

# Reduce noise in terminal (you can set INFO during debugging)
LOG_LEVEL = "ERROR"

# Enable HTTP caching while developing (optional)
HTTPCACHE_ENABLED = False
# HTTPCACHE_EXPIRATION_SECS = 0
# HTTPCACHE_DIR = "httpcache"
# HTTPCACHE_IGNORE_HTTP_CODES = []
# HTTPCACHE_STORAGE = "scrapy.extensions.httpcache.FilesystemCacheStorage"

# Twisted reactor (Scrapy 2.7+ sometimes sets automatically; safe to omit)
# TWISTED_REACTOR = "twisted.internet.asyncioreactor.AsyncioSelectorReactor"

# Feed exports (we’re using stdout:json from runner, so no need to set FEEDS)
# ensure project root is on sys.path so pipelines can import services/
PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.append(str(PROJECT_ROOT))

# Database URL shared with FastAPI
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+psycopg2://postgres:admin123@127.0.0.1:5432/recipe_db"
)

