import asyncio
from scraper import search, SWAPPIE_MODELS

async def main():
    for i, model in enumerate(SWAPPIE_MODELS, 1):
        print(f"[{i}/{len(SWAPPIE_MODELS)}] {model}...")
        try:
            data = await search(model, force_refresh=True)
            count = len(data.get("raw", []))
            sources = data.get("sources", [])
            print(f"  ✓ {count} prix — {', '.join(sources)}")
        except Exception as e:
            print(f"  ✗ Erreur: {e}")
        await asyncio.sleep(1)

asyncio.run(main())
