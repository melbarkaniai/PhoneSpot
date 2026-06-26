"""Debug CertiDeal capacity map extraction."""
import asyncio, sys, re, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

CD_BASE = "https://certideal.com"
URL = f"{CD_BASE}/vendre-mon-smartphone?category=iphone-14-pro"

async def check():
    from curl_cffi.requests import AsyncSession as CurlSession

    print("=== curl_cffi GET ===")
    async with CurlSession(impersonate="chrome124") as s:
        r = await s.get(URL, headers={
            "Accept": "text/html,application/xhtml+xml,*/*",
            "Accept-Language": "fr-FR,fr;q=0.9",
            "Referer": f"{CD_BASE}/vendre-mon-smartphone",
        }, timeout=15)
        html = r.text
        print(f"Status: {r.status_code}, Length: {len(html)}")
        # Search for capacity
        caps_raw = re.findall(r'capacity=\d+', html)
        print(f"capacity= occurrences: {caps_raw[:20]}")
        # Try the regex
        matches = re.findall(r'capacity=(\d+)[^>]*>([^<]*)<', html)
        print(f"Regex matches: {matches[:10]}")
        # Show snippet around first capacity
        idx = html.find('capacity=')
        if idx >= 0:
            print(f"Snippet: {html[max(0,idx-100):idx+200]}")
        else:
            print("No 'capacity=' found in curl_cffi response")
            # Check if page has any content
            print(f"First 500 chars: {html[:500]}")

    print("\n=== Playwright GET ===")
    from playwright.async_api import async_playwright
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-blink-features=AutomationControlled"]
        )
        ctx = await browser.new_context(
            viewport={"width": 1440, "height": 900},
            locale="fr-FR",
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            timezone_id="Europe/Paris",
            extra_http_headers={"Accept-Language": "fr-FR,fr;q=0.9"},
        )
        await ctx.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined});")
        page = await ctx.new_page()
        await page.goto(URL, wait_until="domcontentloaded", timeout=30000)
        await asyncio.sleep(3)

        html_pw = await page.content()
        print(f"Page content length: {len(html_pw)}")

        caps_raw = re.findall(r'capacity=\d+', html_pw)
        print(f"capacity= occurrences: {caps_raw[:20]}")

        matches_pw = re.findall(r'capacity=(\d+)[^>]*>([^<]*)<', html_pw)
        print(f"Regex matches: {matches_pw[:10]}")

        # Try JS DOM
        items = await page.evaluate("""
            () => {
                const results = [];
                document.querySelectorAll('a[href*="capacity="]').forEach(a => {
                    const m = (a.href || '').match(/capacity=(\\d+)/);
                    const txt = (a.textContent || '').trim();
                    if (m && txt) results.push({cap: m[1], text: txt});
                });
                return results;
            }
        """)
        print(f"JS DOM items: {items}")

        # Show body text
        body_text = await page.evaluate("() => document.body.innerText.substring(0, 1000)")
        print(f"Body text: {body_text[:500]}")

        await browser.close()

import threading
def run():
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(check())
    finally:
        loop.close()

t = threading.Thread(target=run, daemon=True)
t.start()
t.join(timeout=120)
if t.is_alive():
    print("TIMED OUT")
