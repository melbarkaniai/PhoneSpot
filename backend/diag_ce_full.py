"""Trace complete new CashExpress form: functional → operator → brand → model → storage → condition → price."""
import asyncio, sys, re, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

MODEL_TARGET = "iPhone 14 Pro"
STORAGE_TARGET = "128"  # in GB

async def check():
    from playwright.async_api import async_playwright

    http_log = []

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
            if resp.status in (200, 302):
                try:
                    body = await resp.text()
                    http_log.append({'url': resp.url[:150], 'status': resp.status, 'body': body[:600]})
                except Exception:
                    pass

        page.on("response", on_response)

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

        # Print all SELECT options to understand the form
        selects = await page.evaluate("""
            () => Array.from(document.querySelectorAll('select'))
                .map(s => ({
                    name: s.name, id: s.id,
                    options: Array.from(s.options).map(o => ({value: o.value, text: o.text.trim()})).slice(0, 30)
                }))
        """)
        print("=== ALL SELECTS ===")
        for s in selects:
            print(f"  SELECT name={s['name']} id={s['id']}")
            print(f"    Options: {s['options'][:10]}")

        # Step 1: Functional = Oui (value=1)
        await page.evaluate("""
            () => {
                const radio = document.querySelector('input[name="step1_fields[functional]"][value="1"]');
                if (radio) { radio.checked = true; radio.dispatchEvent(new Event('change', {bubbles: true})); }
            }
        """)
        await asyncio.sleep(0.5)

        # Step 1: Operator commitment = Non (value=0)
        await page.evaluate("""
            () => {
                const radio = document.querySelector('input[name="step1_fields[operator_commitment]"][value="0"]');
                if (radio) { radio.checked = true; radio.dispatchEvent(new Event('change', {bubbles: true})); }
            }
        """)
        await asyncio.sleep(0.5)

        # Select brand: APPLE
        brand_sel = page.locator("select").filter(has_text="Apple").first
        if await brand_sel.count() > 0:
            await brand_sel.select_option(value="APPLE")
            await asyncio.sleep(2)
            print("\n=== After APPLE brand select ===")
        else:
            # Try by name
            await page.select_option("select[name*='brand'], select[name*='marque']", value="APPLE")
            await asyncio.sleep(2)

        # What selects are now visible?
        selects2 = await page.evaluate("""
            () => Array.from(document.querySelectorAll('select'))
                .filter(s => { const r = s.getBoundingClientRect(); return r.width > 0 && r.height > 0; })
                .map(s => ({
                    name: s.name, id: s.id,
                    options: Array.from(s.options).map(o => ({value: o.value, text: o.text.trim()})).slice(0, 5)
                }))
        """)
        print("Visible selects after brand:", selects2)

        # Look for iPhone model select
        model_opts = await page.evaluate(f"""
            () => {{
                const selects = Array.from(document.querySelectorAll('select'));
                for (const sel of selects) {{
                    const opts = Array.from(sel.options).map(o => o.text.trim());
                    if (opts.some(t => t.includes('iPhone'))) {{
                        return {{name: sel.name, options: opts.slice(0, 50)}};
                    }}
                }}
                return null;
            }}
        """)
        print(f"\nModel select: {model_opts}")

        if model_opts:
            # Find the option matching our target model
            opts = model_opts.get('options', [])
            matching = [o for o in opts if MODEL_TARGET.lower() in o.lower()]
            print(f"Matching options for '{MODEL_TARGET}': {matching}")

            if matching:
                sel_name = model_opts['name']
                # Select by matching text
                target_opt = matching[0]
                await page.select_option(f"select[name='{sel_name}']", label=target_opt)
                await asyncio.sleep(2)
                print(f"\n=== After model select ({target_opt}) ===")

                # Look for storage select
                storage_opts = await page.evaluate("""
                    () => {
                        const selects = Array.from(document.querySelectorAll('select'));
                        for (const sel of selects) {
                            const opts = Array.from(sel.options).map(o => o.text.trim());
                            if (opts.some(t => /\d+\s*[Gg][Oo]|[Tt][Oo]/.test(t))) {
                                return {name: sel.name, options: opts.slice(0, 20)};
                            }
                        }
                        return null;
                    }
                """)
                print(f"Storage select: {storage_opts}")

                if storage_opts:
                    stor_opts = storage_opts.get('options', [])
                    stor_match = [o for o in stor_opts if STORAGE_TARGET in o]
                    print(f"Storage options matching {STORAGE_TARGET}GB: {stor_match}")

                    if stor_match:
                        stor_name = storage_opts['name']
                        await page.select_option(f"select[name='{stor_name}']", label=stor_match[0])
                        await asyncio.sleep(2)
                        print(f"\n=== After storage select ({stor_match[0]}) ===")

                        # Set condition: screen=intact, back_case=intact, buy_condition=used, has_invoice=0
                        await page.evaluate("""
                            () => {
                                const sets = [
                                    ['input[name="step3_fields[screen_state]"][value="intact"]', 'intact'],
                                    ['input[name="step3_fields[back_case_state]"][value="intact"]', 'intact'],
                                    ['input[name="step3_fields[buy_condition]"][value="used"]', 'used'],
                                    ['input[name="step3_fields[has_invoice_less_6_months]"][value="0"]', '0']
                                ];
                                for (const [sel, val] of sets) {
                                    const r = document.querySelector(sel);
                                    if (r) { r.checked = true; r.dispatchEvent(new Event('change', {bubbles: true})); }
                                }
                            }
                        """)
                        await asyncio.sleep(0.5)

                        # Submit the form or look for a submit button
                        submit_btns = await page.evaluate("""
                            () => Array.from(document.querySelectorAll('button[type="submit"], input[type="submit"]'))
                                .filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; })
                                .map(e => ({tag: e.tagName, text: (e.textContent||e.value||'').trim().substring(0,50),
                                           classes: e.className.substring(0,60)}))
                        """)
                        print(f"Submit buttons: {submit_btns}")

                        if submit_btns:
                            await page.locator("button[type='submit'], input[type='submit']").first.click()
                            await asyncio.sleep(3)
                            print(f"\nAfter submit URL: {page.url}")
                            final_body = await page.evaluate("() => document.body.innerText.substring(0, 2000)")
                            print(f"\n--- Final body ---\n{final_body}")

        # Log recent API calls
        print(f"\n=== Recent HTTP responses: ===")
        for c in http_log[-15:]:
            if 'json' in c.get('body', '').lower()[:100] or 'prix' in c.get('body', '').lower()[:100]:
                print(f"  {c['status']} {c['url']}")
                print(f"    {c['body'][:300]}")

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
