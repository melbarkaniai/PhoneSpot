"""Intercept all requests made by the CashExpress form to find the AJAX format."""
import asyncio, sys, json
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

CE_URL = "https://www.cashexpress.fr/revendre/smartphone"


async def ss_select(page, select_name: str, option_text: str) -> bool:
    data_id = await page.evaluate(f"""
        () => {{ const s = document.querySelector('select[name="{select_name}"]');
                 return s ? s.getAttribute('data-id') : null; }}
    """)
    if not data_id:
        return False
    ss_main = page.locator(f".ss-main[data-id='{data_id}']")
    if await ss_main.count() == 0:
        return False
    await ss_main.click(force=True)
    await asyncio.sleep(0.8)
    option = page.locator(f".ss-content[data-id='{data_id}'] .ss-option").filter(has_text=option_text)
    if await option.count() == 0:
        await ss_main.click(force=True)
        return False
    await option.first.click(force=True)
    await asyncio.sleep(2)
    return True


async def check():
    from playwright.async_api import async_playwright

    requests_log = []
    responses_log = []

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

        async def on_request(req):
            if 'cashexpress.fr/revendre' in req.url:
                try:
                    post_data = req.post_data or ""
                    requests_log.append({
                        'method': req.method,
                        'url': req.url,
                        'post_data': post_data[:600],
                        'headers': dict(req.headers),
                    })
                except Exception:
                    pass

        async def on_response(resp):
            if 'cashexpress.fr/revendre' in resp.url and 'action=' in resp.url:
                try:
                    body = await resp.text()
                    responses_log.append({'url': resp.url, 'body': body[:400]})
                except Exception:
                    pass

        page.on("request", on_request)
        page.on("response", on_response)

        await page.goto(CE_URL, wait_until="domcontentloaded", timeout=30000)
        await asyncio.sleep(3)

        # Dismiss cookie banner
        for t in ["Continuer sans accepter", "Refuser tout"]:
            try:
                b = page.get_by_text(t, exact=True)
                if await b.count() > 0:
                    await b.first.click()
                    await asyncio.sleep(1)
            except Exception:
                pass

        # Click step1 Oui labels
        await page.evaluate("""
            () => {
                const r = document.querySelector('input[name="step1_fields[functional]"][value="1"]');
                if (r) { const l = document.querySelector('label[for="'+r.id+'"]'); if(l) l.click(); }
            }
        """)
        await asyncio.sleep(0.5)
        await page.evaluate("""
            () => {
                const r = document.querySelector('input[name="step1_fields[operator_commitment]"][value="1"]');
                if (r) { const l = document.querySelector('label[for="'+r.id+'"]'); if(l) l.click(); }
            }
        """)
        await asyncio.sleep(1)

        # Select Apple brand
        print("Selecting Apple brand...")
        ok = await ss_select(page, "step2_fields[brand]", "Apple")
        print(f"  Apple selected: {ok}")

        # Select iPhone 14 Pro 5G
        print("Selecting iPhone 14 Pro 5G...")
        ok2 = await ss_select(page, "step2_fields[model]", "iPhone 14 Pro 5G")
        print(f"  Model selected: {ok2}")

        # Select 128 Go capacity
        print("Selecting 128 Go capacity...")
        ok3 = await ss_select(page, "step2_fields[capacity]", "128 Go")
        print(f"  Capacity selected: {ok3}")

        await asyncio.sleep(1)

        # Print all captured requests
        print(f"\n=== ALL REQUESTS TO cashexpress ({len(requests_log)}) ===")
        for r in requests_log:
            print(f"\n  {r['method']} {r['url']}")
            if r['post_data']:
                print(f"  POST_DATA: {r['post_data']}")
            xhr = r['headers'].get('x-requested-with', '')
            ct = r['headers'].get('content-type', '')
            print(f"  X-Requested-With: {xhr}, Content-Type: {ct}")

        print(f"\n=== ALL ACTION RESPONSES ({len(responses_log)}) ===")
        for r in responses_log:
            print(f"\n  {r['url']}")
            print(f"  {r['body']}")

        # Now try clicking condition labels to trigger calculateGrade
        print("\n\n=== STEP 3: Click condition ===")
        # Click the first visible "Intact" label specifically for screen_state
        await page.evaluate("""
            () => {
                const r = document.querySelector('input[name="step3_fields[screen_state]"][value="intact"]');
                if (r) { const l = document.querySelector('label[for="'+r.id+'"]'); if(l) { console.log('clicking screen intact label:', l.textContent); l.click(); } }
            }
        """)
        await asyncio.sleep(1.5)

        await page.evaluate("""
            () => {
                const r = document.querySelector('input[name="step3_fields[back_case_state]"][value="intact"]');
                if (r) { const l = document.querySelector('label[for="'+r.id+'"]'); if(l) { console.log('clicking back intact label:', l.textContent); l.click(); } }
            }
        """)
        await asyncio.sleep(1.5)

        await page.evaluate("""
            () => {
                const r = document.querySelector('input[name="step3_fields[buy_condition]"][value="used"]');
                if (r) { const l = document.querySelector('label[for="'+r.id+'"]'); if(l) l.click(); }
            }
        """)
        await asyncio.sleep(1)

        await page.evaluate("""
            () => {
                const r = document.querySelector('input[name="step3_fields[has_invoice_less_6_months]"][value="0"]');
                if (r) { const l = document.querySelector('label[for="'+r.id+'"]'); if(l) l.click(); }
            }
        """)
        await asyncio.sleep(2)

        # Print new requests
        print(f"\n=== NEW REQUESTS (all {len(requests_log)}) ===")
        for r in requests_log:
            if 'action=calculateGrade' in r['url'] or 'action=getAttributes' in r['url']:
                print(f"\n  {r['method']} {r['url']}")
                if r['post_data']:
                    print(f"  POST_DATA: {r['post_data']}")

        print(f"\n=== NEW ACTION RESPONSES ===")
        for r in responses_log:
            if 'calculateGrade' in r['url']:
                print(f"\n  {r['url']}")
                print(f"  {r['body']}")

        # Body at end
        final_body = await page.evaluate("() => document.body.innerText.substring(0, 2000)")
        print(f"\n--- Final page body ---\n{final_body[:1000]}")

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
