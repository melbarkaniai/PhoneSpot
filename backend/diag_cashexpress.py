"""Diagnose CashExpress page structure to identify changed selectors."""
import asyncio, sys, re, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

_CE_START = "https://revendre.cashexpress.fr/revente/smartphones/choisissez_votre_modele,1.html"

async def check():
    from playwright.async_api import async_playwright
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

        print(f"Navigating to {_CE_START}")
        await page.goto(_CE_START, wait_until="domcontentloaded", timeout=30000)
        await asyncio.sleep(3)
        print(f"Current URL: {page.url}")
        print(f"Page title: {await page.title()}")

        # Print first 3000 chars of body text to understand the page
        body = await page.evaluate("() => document.body.innerText.substring(0, 3000)")
        print(f"\n--- Page body text ---\n{body}")

        # Find all labels with 'for' attribute (the scraper clicks label[for='oui_etape_0'])
        labels = await page.evaluate("""
            () => Array.from(document.querySelectorAll('label[for]'))
                .map(l => ({for_attr: l.getAttribute('for'), text: (l.textContent||'').trim().substring(0,50)}))
                .slice(0, 30)
        """)
        print(f"\n--- Labels with for= ---")
        for l in labels:
            print(f"  {l}")

        # Find all data-value attributes
        data_vals = await page.evaluate("""
            () => Array.from(document.querySelectorAll('[data-value]'))
                .map(e => ({tag: e.tagName, data_value: e.getAttribute('data-value'), text: (e.textContent||'').trim().substring(0,30)}))
                .slice(0, 30)
        """)
        print(f"\n--- Elements with data-value ---")
        for d in data_vals:
            print(f"  {d}")

        # Check what the HTML looks like for step 0
        html_snippet = await page.evaluate("""
            () => {
                const forms = document.querySelectorAll('form, .form-group, .etape, [class*="step"], [class*="etape"]');
                return Array.from(forms).map(f => f.outerHTML.substring(0, 500)).slice(0, 5).join('\\n---\\n');
            }
        """)
        print(f"\n--- Form/step elements HTML ---\n{html_snippet}")

        # Print all visible buttons
        buttons = await page.evaluate("""
            () => Array.from(document.querySelectorAll('button, input[type="submit"], a.btn, .btn'))
                .filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; })
                .map(e => ({tag: e.tagName, text: (e.textContent||e.value||'').trim().substring(0,50), classes: e.className}))
                .slice(0, 20)
        """)
        print(f"\n--- Visible buttons ---")
        for b in buttons:
            print(f"  {b}")

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
