"""Test CertiDeal scraper directly to diagnose capacity issue."""
import asyncio, sys, os, threading
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from scraper import scrape_certideal, _certideal_get_capacity_map, _run_in_new_loop

async def main():
    print("=== Testing _certideal_get_capacity_map directly ===")
    cap_map = await _certideal_get_capacity_map("iphone-14-pro")
    print(f"  cap_map: {cap_map}")

    print("\n=== Testing scrape_certideal for iPhone 14 Pro (128GB only) ===")
    results = await scrape_certideal(None, "iPhone 14 Pro", ["128GB"])
    print(f"  results ({len(results)}): {results}")

# On Windows, scrape_certideal uses _run_in_new_loop for Playwright
# Test both direct call and the _run_in_new_loop path
print("=== Direct async call (no _run_in_new_loop) ===")
def run_direct():
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(main())
    finally:
        loop.close()

t = threading.Thread(target=run_direct, daemon=True)
t.start()
t.join(timeout=180)
if t.is_alive():
    print("TIMED OUT")
