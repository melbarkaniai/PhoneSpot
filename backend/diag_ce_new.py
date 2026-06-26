"""Trace the new CashExpress sell funnel to find the correct URL and API."""
import asyncio, sys, re, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

async def check():
    from playwright.async_api import async_playwright

    captured_requests = []
    captured_responses = []

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

        # Intercept API calls
        async def on_response(resp):
            url = resp.url
            if 'api' in url.lower() or 'json' in (resp.headers.get('content-type', '')):
                try:
                    body = await resp.text()
                    captured_responses.append({'url': url, 'status': resp.status, 'body': body[:500]})
                except Exception:
                    pass

        page.on("response", on_response)

        # Navigate to main revendre page
        print("=== Navigating to sell page ===")
        await page.goto("https://www.cashexpress.fr/revendre", wait_until="domcontentloaded", timeout=30000)
        await asyncio.sleep(3)

        # Dismiss cookie banner
        for t in ["Continuer sans accepter", "Tout accepter", "Accepter"]:
            try:
                b = page.get_by_text(t, exact=True)
                if await b.count() > 0:
                    await b.first.click()
                    await asyncio.sleep(1)
                    break
            except Exception:
                pass

        print(f"Current URL: {page.url}")

        # Find and click "Revendre mon Smartphone"
        smartphone_links = await page.evaluate("""
            () => Array.from(document.querySelectorAll('a, button'))
                .filter(e => (e.textContent || '').includes('Smartphone'))
                .map(e => ({text: (e.textContent||'').trim(), href: e.href || '', tag: e.tagName}))
                .slice(0, 10)
        """)
        print(f"\nSmartphone links: {smartphone_links}")

        # Try clicking the smartphone sell button
        for link_info in smartphone_links:
            if 'Smartphone' in link_info.get('text', ''):
                if link_info.get('href'):
                    print(f"\nNavigating to: {link_info['href']}")
                    await page.goto(link_info['href'], wait_until="domcontentloaded", timeout=30000)
                    await asyncio.sleep(3)
                    break
                else:
                    try:
                        btn = page.get_by_text(link_info['text'], exact=True)
                        if await btn.count() > 0:
                            await btn.first.click()
                            await asyncio.sleep(3)
                            break
                    except Exception:
                        pass

        print(f"\nAfter click URL: {page.url}")
        body = await page.evaluate("() => document.body.innerText.substring(0, 2000)")
        print(f"\n--- Page body ---\n{body}")

        # Look for any input fields, selects, or product search
        inputs = await page.evaluate("""
            () => Array.from(document.querySelectorAll('input, select, textarea'))
                .filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; })
                .map(e => ({tag: e.tagName, type: e.type, placeholder: e.placeholder, name: e.name, id: e.id}))
                .slice(0, 20)
        """)
        print(f"\n--- Inputs ---")
        for i in inputs:
            print(f"  {i}")

        # Check captured API responses
        print(f"\n--- API responses captured: {len(captured_responses)} ---")
        for r in captured_responses[:10]:
            print(f"  {r['url'][:100]} (status={r['status']})")
            if r['body']:
                print(f"    body: {r['body'][:200]}")

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
