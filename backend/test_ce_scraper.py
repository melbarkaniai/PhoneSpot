"""Quick test of the new CashExpress scraper."""
import asyncio, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from scraper import scrape_cashexpress

async def main():
    print("Testing CashExpress scraper for iPhone 14 Pro...")
    results = await scrape_cashexpress(None, "iPhone 14 Pro", ["128GB", "256GB"])
    print(f"\nResults ({len(results)} entries):")
    for r in results:
        print(f"  {r['storage']} {r['condition']}: {r['price']}€ (raw={r['raw_condition']})")

    print("\nTesting iPhone 12...")
    results2 = await scrape_cashexpress(None, "iPhone 12", ["64GB", "128GB"])
    print(f"Results ({len(results2)} entries):")
    for r in results2:
        print(f"  {r['storage']} {r['condition']}: {r['price']}€")

asyncio.run(main())
