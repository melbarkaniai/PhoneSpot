"""Trace the complete new CashExpress flow for iPhone 14 Pro 128GB."""
import asyncio, sys, re, os
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
            ct = resp.headers.get('content-type', '')
            if ('json' in ct or 'html' in ct) and resp.status in (200, 302):
                api_calls.append({'url': resp.url[:150], 'status': resp.status, 'ct': ct[:30]})

        page.on("response", on_response)

        def print_body_snippet(label):
            pass  # async can't be called from sync, handle below

        await page.goto("https://www.cashexpress.fr/revendre/smartphone", wait_until="domcontentloaded", timeout=30000)
        await asyncio.sleep(3)

        for t in ["Continuer sans accepter"]:
            try:
                b = page.get_by_text(t, exact=True)
                if await b.count() > 0:
                    await b.first.click()
                    await asyncio.sleep(1)
            except Exception:
                pass

        print("=== STEP 1: Click Oui (functional) ===")
        # Find the "Oui" label (Bootstrap btn-check pattern: label wraps or is for= the radio)
        labels = await page.evaluate("""
            () => Array.from(document.querySelectorAll('label, button'))
                .filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; })
                .map(e => ({tag: e.tagName, text: (e.textContent||'').trim().substring(0,40),
                           for_: e.htmlFor || '', classes: e.className.substring(0,60)}))
                .filter(l => l.text.length > 0)
                .slice(0, 30)
        """)
        print("Labels/buttons:", labels)

        # Click "Oui" label for functional
        oui = page.locator("label").filter(has_text="Oui").first
        if await oui.count() > 0:
            await oui.click(force=True)
            await asyncio.sleep(0.5)
            print("Clicked Oui")

        # Also look for radio buttons
        radios = await page.evaluate("""
            () => Array.from(document.querySelectorAll('input[type="radio"]'))
                .map(r => ({id: r.id, name: r.name, value: r.value, checked: r.checked}))
        """)
        print("Radios:", radios)

        print("\n=== STEP 1 → Apple brand ===")
        # Click Apple in the brand list
        apple_link = page.get_by_text("Apple", exact=True)
        if await apple_link.count() > 0:
            print(f"Found {await apple_link.count()} Apple elements")
            await apple_link.first.click(force=True)
            await asyncio.sleep(2)
            print(f"After Apple click URL: {page.url}")

        body = await page.evaluate("() => document.body.innerText.substring(0, 2000)")
        print(f"\n--- Body after Apple click ---\n{body}")

        # Find visible inputs
        inputs_after = await page.evaluate("""
            () => Array.from(document.querySelectorAll('input, select, label, a'))
                .filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; })
                .map(e => ({tag: e.tagName, type: e.type||'', text: (e.textContent||'').trim().substring(0,40),
                           href: e.href||'', for_: e.htmlFor||'', name: e.name||''}))
                .filter(e => e.text || e.href)
                .slice(0, 30)
        """)
        print("\nElements after Apple click:", inputs_after)

        print(f"\n=== API calls so far: {len(api_calls)} ===")
        for c in api_calls[-10:]:
            print(f"  {c['status']} {c['url']}")

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
