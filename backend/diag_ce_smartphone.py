"""Navigate to the new CashExpress smartphone sell page and trace the flow."""
import asyncio, sys, re, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

async def check():
    from playwright.async_api import async_playwright

    api_calls = []

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True,
            args=["--no-sandbox", "--disable-blink-features=AutomationControlled"])
        ctx = await browser.new_context(
            viewport={"width": 1440, "height": 900}, locale="fr-FR",
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            timezone_id="Europe/Paris",
            extra_http_headers={"Accept-Language": "fr-FR,fr;q=0.9"})
        await ctx.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined});")
        page = await ctx.new_page()

        async def on_response(resp):
            url = resp.url
            ct = resp.headers.get('content-type', '')
            if 'json' in ct and resp.status == 200:
                try:
                    body = await resp.text()
                    api_calls.append({'url': url[:120], 'body': body[:400]})
                except Exception:
                    pass

        page.on("response", on_response)

        await page.goto("https://www.cashexpress.fr/revendre/smartphone", wait_until="domcontentloaded", timeout=30000)
        await asyncio.sleep(3)

        for t in ["Continuer sans accepter", "Tout accepter", "Accepter"]:
            try:
                b = page.get_by_text(t, exact=True)
                if await b.count() > 0:
                    await b.first.click()
                    await asyncio.sleep(1)
                    break
            except Exception:
                pass

        await asyncio.sleep(2)
        print(f"URL: {page.url}")

        body = await page.evaluate("() => document.body.innerText.substring(0, 3000)")
        print(f"\n--- Body ---\n{body}")

        # Find inputs and selects
        inputs = await page.evaluate("""
            () => Array.from(document.querySelectorAll('input, select'))
                .filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; })
                .map(e => ({tag: e.tagName, type: e.type, placeholder: e.placeholder,
                           name: e.name, id: e.id, classes: e.className.substring(0, 50)}))
                .slice(0, 20)
        """)
        print(f"\n--- Inputs ---")
        for i in inputs: print(f"  {i}")

        # Try to type iPhone 14 Pro in the search box and see what happens
        search = page.locator("input[type='search'], input[placeholder*='arque'], input[placeholder*='roduit']").first
        if await search.count() > 0:
            print("\n--- Typing 'iPhone 14 Pro' in search ---")
            await search.click()
            await search.fill("iPhone 14 Pro")
            await asyncio.sleep(2)

            # Look for autocomplete results
            suggestions = await page.evaluate("""
                () => Array.from(document.querySelectorAll('[class*="suggest"], [class*="autocomplete"], [class*="dropdown"] *'))
                    .filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && e.children.length === 0; })
                    .map(e => (e.textContent||'').trim())
                    .filter(t => t.length > 0)
                    .slice(0, 20)
            """)
            print(f"Suggestions: {suggestions}")

        print(f"\n--- API calls captured: {len(api_calls)} ---")
        for c in api_calls[:15]:
            print(f"  {c['url']}")
            print(f"    {c['body'][:200]}")

        # Look for product estimation links
        links = await page.evaluate("""
            () => Array.from(document.querySelectorAll('a'))
                .filter(e => /revend|reprise|estim|vend/i.test(e.href || '') && e.href)
                .map(e => ({href: e.href, text: (e.textContent||'').trim().substring(0, 60)}))
                .slice(0, 15)
        """)
        print(f"\n--- Relevant links ---")
        for l in links: print(f"  {l}")

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
    print("Timed out")
