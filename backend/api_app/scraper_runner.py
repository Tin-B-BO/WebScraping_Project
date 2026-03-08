from pathlib import Path
import subprocess
import sys

# Absolute path to the Scrapy project directory
SCRAPY_DIR = Path(__file__).resolve().parents[2] / "scraper"

def run_all_spiders(query: str, max_items: int = 180) -> None:
    # Normalize query, return early if query is empty or max_items is not positive
    q = (query or "").strip()
    if not q or max_items <= 0:
        return

    # Run the multi-spider launcher as a Python module
    cmd = [
        sys.executable,
        "-m",
        "recipes.run_multi_spiders",
        "--query", q,
        "--max-items", str(max_items),
    ]

    # Use scraper as working directory
    subprocess.Popen(cmd, cwd=str(SCRAPY_DIR))
