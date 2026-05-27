"""
Background price refresh scheduler.
Refreshes all models 2x per day: at 07:00 and 19:00 Paris time.
Integrated into main.py via start_scheduler() called in the lifespan handler.
"""

import sys
import asyncio
import logging
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "scrapper"))

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from scraper import search, SWAPPIE_MODELS
from cache_manager import cache_write

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("scheduler")


async def refresh_all_models() -> None:
    """Scrapes all models and writes to cache. Runs sequentially to avoid overload."""
    logger.info(f"[{datetime.now()}] Starting full cache refresh...")
    success = 0
    errors = 0
    for model in SWAPPIE_MODELS:
        try:
            logger.info(f"  Scraping {model}...")
            data = await search(model, force_refresh=True)
            cache_write(data)
            success += 1
            await asyncio.sleep(2)  # be polite between requests
        except Exception as e:
            logger.error(f"  ERROR {model}: {e}")
            errors += 1
    logger.info(f"Cache refresh done. {success} OK, {errors} errors.")


def start_scheduler() -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler(timezone="Europe/Paris")
    scheduler.add_job(refresh_all_models, "cron", hour="7,19", minute=0)
    scheduler.start()
    logger.info("Scheduler started. Next refresh at 07:00 or 19:00 (Paris).")
    return scheduler
