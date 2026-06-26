"""Test Simple Select (ss-*) approach on CashExpress, trace to price."""
import asyncio, sys, re, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

MODEL_TARGET = "iPhone 14 Pro"
STORAGE_TARGET_GB = "128"

async def ss_select(page, select_name: str, option_text: str) -> bool:
    """Click the Simple Select (ss-*) custom dropdown and pick an option by text."""
    # Get the data-id of the select
    data_id = await page.evaluate(f"""
        () => {{
            const sel = document.querySelector('select[name="{select_name}"]');
            return sel ? sel.getAttribute('data-id') : null;
        }}
    """)
    if not data_id:
        print(f"  ss_select: no select with name={select_name}")
        return False

    # Click .ss-main[data-id=...] to open dropdown
    ss_main = page.locator(f".ss-main[data-id='{data_id}']")
    if await ss_main.count() == 0:
        print(f"  ss_select: no .ss-main for data-id={data_id}")
        return False
    await ss_main.click(force=True)
    await asyncio.sleep(0.8)

    # Find and click the .ss-option with the matching text
    ss_content = page.locator(f".ss-content[data-id='{data_id}']")
    option = ss_content.locator(".ss-option").filter(has_text=option_text)
    if await option.count() == 0:
        # Try partial text match
        all_opts = await page.evaluate(f"""
            () => Array.from(document.querySelectorAll('.ss-content[data-id="{data_id}"] .ss-option'))
                .map(e => (e.textContent || '').trim())
        """)
        print(f"  Options available for {select_name}: {all_opts[:15]}")
        # Close dropdown
        await ss_main.click(force=True)
        return False
    await option.first.click(force=True)
    await asyncio.sleep(1.5)  # wait for AJAX to reload
    return True


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
            if resp.status == 200 and 'json' in ct:
                try:
                    body = await resp.text()
                    api_calls.append({'url': resp.url[:150], 'body': body[:500]})
                except Exception:
                    pass

        page.on("response", on_response)

        await page.goto("https://www.cashexpress.fr/revendre/smartphone",
                        wait_until="domcontentloaded", timeout=30000)
        await asyncio.sleep(3)

        for t in ["Continuer sans accepter"]:
            try:
                b = page.get_by_text(t, exact=True)
                if await b.count() > 0:
                    await b.first.click()
                    await asyncio.sleep(1)
            except Exception:
                pass

        print("=== Step 1: Functional=Oui ===")
        # Click label for "Oui" on functional question
        await page.evaluate("""
            () => {
                const r = document.querySelector('input[name="step1_fields[functional]"][value="1"]');
                if (r) { const lbl = document.querySelector('label[for="'+r.id+'"]'); if(lbl) lbl.click(); }
            }
        """)
        await asyncio.sleep(0.5)

        print("=== Step 1: Operator commitment=Oui (no engagement) ===")
        await page.evaluate("""
            () => {
                const r = document.querySelector('input[name="step1_fields[operator_commitment]"][value="1"]');
                if (r) { const lbl = document.querySelector('label[for="'+r.id+'"]'); if(lbl) lbl.click(); }
            }
        """)
        await asyncio.sleep(1)

        # Check what step2 looks like
        body = await page.evaluate("() => document.body.innerText.substring(0, 500)")
        print(f"After step1: {body[:300]}")

        print("\n=== Step 2: Select brand = Apple ===")
        ok = await ss_select(page, "step2_fields[brand]", "Apple")
        print(f"Brand Apple selected: {ok}")

        # Check model options
        model_opts = await page.evaluate("""
            () => Array.from(document.querySelectorAll('select[name="step2_fields[model]"] option'))
                .map(o => ({value: o.value, text: o.text.trim()}))
        """)
        print(f"Model options ({len(model_opts)}): {model_opts[:10]}")

        print("\n=== Step 2: Select model ===")
        # Find the exact option text for iPhone 14 Pro
        matching_model = next((o['text'] for o in model_opts if MODEL_TARGET.lower() in o['text'].lower()), None)
        print(f"Matching model option: {matching_model}")

        if matching_model:
            ok2 = await ss_select(page, "step2_fields[model]", matching_model)
            print(f"Model selected: {ok2}")

            cap_opts = await page.evaluate("""
                () => Array.from(document.querySelectorAll('select[name="step2_fields[capacity]"] option'))
                    .map(o => ({value: o.value, text: o.text.trim()}))
            """)
            print(f"Capacity options ({len(cap_opts)}): {cap_opts}")

            # Find 128GB option
            matching_cap = next((o['text'] for o in cap_opts if STORAGE_TARGET_GB in o['text']), None)
            print(f"Matching capacity: {matching_cap}")

            if matching_cap:
                ok3 = await ss_select(page, "step2_fields[capacity]", matching_cap)
                print(f"Capacity selected: {ok3}")

                # Check what step 3 looks like
                body3 = await page.evaluate("() => document.body.innerText.substring(0, 2000)")
                print(f"\n--- After capacity select ---\n{body3[:1000]}")

                # Set condition: screen=intact, back=intact, buy_condition=used, has_invoice=0
                await page.evaluate("""
                    () => {
                        const pairs = [
                            ['input[name="step3_fields[screen_state]"][value="intact"]'],
                            ['input[name="step3_fields[back_case_state]"][value="intact"]'],
                            ['input[name="step3_fields[buy_condition]"][value="used"]'],
                            ['input[name="step3_fields[has_invoice_less_6_months]"][value="0"]'],
                        ];
                        for (const [sel] of pairs) {
                            const r = document.querySelector(sel);
                            if (r) {
                                r.checked = true;
                                const lbl = document.querySelector('label[for="'+r.id+'"]');
                                if (lbl) lbl.click();
                                r.dispatchEvent(new Event('change', {bubbles: true}));
                            }
                        }
                    }
                """)
                await asyncio.sleep(0.5)

                # Click submit
                await page.evaluate("""
                    () => {
                        const btn = document.querySelector('button[type="submit"]');
                        if (btn) btn.click();
                    }
                """)
                await asyncio.sleep(3)

                print(f"\nAfter submit URL: {page.url}")
                final_body = await page.evaluate("() => document.body.innerText.substring(0, 3000)")
                print(f"\n--- Final page ---\n{final_body}")

                # Look for a price
                prices = re.findall(r'[\d]+[,\.][\d]+\s*€|€\s*[\d]+', final_body)
                print(f"\nPrices found: {prices}")

        # API calls
        print(f"\n=== JSON API calls: {len(api_calls)} ===")
        for c in api_calls[:10]:
            print(f"  {c['url']}")
            print(f"    {c['body'][:200]}")

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
