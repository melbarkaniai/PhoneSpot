"""Audit v2: test all scrapers after fixes."""
import asyncio, sys, os, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from scraper import search

MODELS = [
    "iPhone 14 Pro",
    "iPhone 13",
    "iPhone 15 Pro Max",
]

async def audit_one(model):
    t0 = time.time()
    data = await search(model, storages=["128GB"], force_refresh=True)
    elapsed = time.time() - t0
    sources = sorted(set(r["source"] for r in data.get("raw", [])))
    return model, sources, elapsed

async def main():
    for model in MODELS:
        print(f"\n{'='*60}")
        print(f"Model: {model}")
        model, sources, elapsed = await audit_one(model)
        print(f"Sources ({len(sources)}, {elapsed:.1f}s): {sources}")
        if len(sources) < 5:
            print("  ⚠️  LOW SOURCE COUNT")

asyncio.run(main())
