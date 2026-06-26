"""Diagnose CertiDeal page structure — fetch rendered HTML and print capacity-related sections."""
import asyncio, sys, re, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

async def check_curl():
    from curl_cffi.requests import AsyncSession as CurlSession
    url = "https://certideal.com/vendre-mon-smartphone?category=iphone-14-pro"
    hdrs = {"Accept": "text/html,*/*", "Accept-Language": "fr-FR,fr;q=0.9",
            "Referer": "https://certideal.com/vendre-mon-smartphone"}
    async with CurlSession(impersonate="chrome124") as s:
        r = await s.get(url, headers=hdrs, timeout=20)
    print(f"curl_cffi status: {r.status_code}")
    html = r.text
    # Find any href containing 'capacity'
    caps = re.findall(r'capacity[^"]{0,100}', html)
    print(f"'capacity' occurrences: {len(caps)}")
    for c in caps[:10]:
        print(f"  {c}")
    # Find storage labels
    go_matches = re.findall(r'[\d]+\s*[Gg][Oo]', html)
    print(f"Go storage labels found: {set(go_matches)}")

async def check_playwright():
    from playwright.async_api import async_playwright
    url = "https://certideal.com/vendre-mon-smartphone?category=iphone-14-pro"
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True,
            args=["--no-sandbox", "--disable-blink-features=AutomationControlled"])
        ctx = await browser.new_context(
            viewport={"width": 1440, "height": 900}, locale="fr-FR",
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            timezone_id="Europe/Paris")
        await ctx.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined});")
        page = await ctx.new_page()
        await page.goto(url, wait_until="domcontentloaded", timeout=30000)
        await asyncio.sleep(3)

        # Dismiss cookie banners
        for t in ["OK pour moi", "Accepter", "Tout accepter", "Fermer"]:
            try:
                b = page.get_by_text(t, exact=True)
                if await b.count() > 0:
                    await b.first.click()
                    await asyncio.sleep(0.5)
                    break
            except Exception:
                pass

        await asyncio.sleep(2)
        html = await page.content()

        # Find capacity-related content
        caps = re.findall(r'capacity[^"]{0,150}', html)
        print(f"\nPlaywright - 'capacity' occurrences: {len(caps)}")
        for c in caps[:10]:
            print(f"  {c}")

        # Find storage labels in rendered HTML
        go_matches = re.findall(r'[\d]+\s*[Gg][Oo]', html)
        print(f"Go storage labels found: {set(go_matches)}")

        # Find all links with 'capacity' in href
        links = await page.evaluate("""
            () => Array.from(document.querySelectorAll('a[href*="capacity"]'))
                .map(a => ({href: a.href, text: (a.textContent||'').trim().substring(0, 50)}))
                .slice(0, 20)
        """)
        print(f"Links with capacity= in href: {len(links)}")
        for l in links:
            print(f"  {l}")

        # Find ALL anchor hrefs containing 'capacity'
        all_caps = await page.evaluate("""
            () => Array.from(document.querySelectorAll('[href*="capacity"],[data-capacity]'))
                .map(e => e.outerHTML.substring(0, 200))
                .slice(0, 10)
        """)
        print(f"Elements with capacity attr: {len(all_caps)}")
        for e in all_caps:
            print(f"  {e}")

        # What's on the page at all — print top-level buttons/selects
        buttons = await page.evaluate("""
            () => Array.from(document.querySelectorAll('button,select,a.btn'))
                .filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; })
                .map(e => (e.textContent||'').trim().substring(0, 80))
                .filter(t => t.length > 0)
                .slice(0, 20)
        """)
        print(f"Visible buttons/selects: {buttons}")

        # Print a snippet of the body text to understand page state
        body_text = await page.evaluate("() => document.body.innerText.substring(0, 2000)")
        print(f"\nPage body text (first 2000 chars):\n{body_text}")

        await browser.close()

print("=== curl_cffi check ===")
asyncio.run(check_curl())

print("\n=== Playwright check ===")
import threading

def run_pw():
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(check_playwright())
    finally:
        loop.close()

t = threading.Thread(target=run_pw, daemon=True)
t.start()
t.join(timeout=120)
if t.is_alive():
    print("Playwright check timed out")
