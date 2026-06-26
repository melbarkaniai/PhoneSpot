"""Use JS to set select values and get price from CashExpress."""
import asyncio, sys, re, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

MODEL_TARGET = "iPhone 14 Pro"
STORAGE_TARGET = "128"

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

        def js_set_select(name, value):
            return f"""
                () => {{
                    const sel = document.querySelector('select[name="{name}"]');
                    if (!sel) return 'NOT_FOUND';
                    sel.value = '{value}';
                    sel.dispatchEvent(new Event('change', {{bubbles: true}}));
                    sel.dispatchEvent(new Event('input', {{bubbles: true}}));
                    // Try Tom Select / Choices API
                    if (sel.tomselect) {{
                        sel.tomselect.setValue('{value}');
                        return 'tomselect';
                    }}
                    if (sel.choices) {{
                        sel.choices.setChoiceByValue('{value}');
                        return 'choices';
                    }}
                    // Try triggering on custom wrapper
                    const parent = sel.closest('.ts-wrapper, .choices');
                    if (parent) {{
                        const customSel = parent.querySelector('[data-value="{value}"]');
                        if (customSel) customSel.click();
                        return 'custom-click';
                    }}
                    return 'native-change';
                }}
            """

        def js_get_select_options(name):
            return f"""
                () => {{
                    const sel = document.querySelector('select[name="{name}"]');
                    if (!sel) return [];
                    return Array.from(sel.options).map(o => ({{value: o.value, text: o.text.trim()}}));
                }}
            """

        # Step 1: functional=1 (Oui)
        await page.evaluate("""
            () => {
                const r = document.querySelector('input[name="step1_fields[functional]"][value="1"]');
                if (r) { r.checked = true; r.dispatchEvent(new Event('change', {bubbles: true})); }
                // Also click the label
                const lbl = document.querySelector('label[for="' + (r ? r.id : '') + '"]');
                if (lbl) lbl.click();
            }
        """)
        await asyncio.sleep(0.5)

        # Also click visible "Oui" label
        try:
            oui_lbl = page.locator("label.form-check-label").filter(has_text="Oui").first
            if await oui_lbl.count() > 0:
                await oui_lbl.click(force=True)
        except Exception:
            pass
        await asyncio.sleep(0.5)

        # Step 1: operator_commitment=0 (Non)
        await page.evaluate("""
            () => {
                const r = document.querySelector('input[name="step1_fields[operator_commitment]"][value="0"]');
                if (r) { r.checked = true; r.dispatchEvent(new Event('change', {bubbles: true})); }
                const lbl = document.querySelector('label[for="' + (r ? r.id : '') + '"]');
                if (lbl) lbl.click();
            }
        """)
        await asyncio.sleep(1)

        # Check what's now visible on the page
        body1 = await page.evaluate("() => document.body.innerText.substring(0, 1000)")
        print(f"After step1:\n{body1[:500]}\n")

        # Try to find the brand custom select wrapper and click it
        # The custom select widget might be a .ts-wrapper (Tom Select)
        custom_sel = await page.evaluate("""
            () => {
                // Look for Tom Select wrapper
                const wrapper = document.querySelector('.ts-wrapper');
                if (wrapper) return 'tom-select found';
                // Look for Choices wrapper
                const ch = document.querySelector('.choices');
                if (ch) return 'choices found';
                // Look for the custom select container
                const ss = document.querySelector('.ss-content');
                if (ss) return 'simple-select found';
                return Array.from(document.querySelectorAll('[class*="select"]'))
                    .map(e => e.className).join(', ');
            }
        """)
        print(f"Custom select type: {custom_sel}")

        # Try to find any clickable brand option
        brand_options = await page.evaluate("""
            () => {
                // Try to find the custom select control and options
                const allEls = Array.from(document.querySelectorAll('[data-value], [data-id]'));
                return allEls.map(e => ({
                    tag: e.tagName, class: e.className.substring(0, 60),
                    dataValue: e.getAttribute('data-value'), dataId: e.getAttribute('data-id'),
                    text: (e.textContent || '').trim().substring(0, 40)
                })).slice(0, 20);
            }
        """)
        print(f"\nElements with data-value/data-id: {brand_options}")

        # Try to find the Tom Select API
        ts_info = await page.evaluate("""
            () => {
                const sel = document.querySelector('select[name="step2_fields[brand]"]');
                if (!sel) return 'no select';
                return {
                    hasTomSelect: !!sel.tomselect,
                    hasChoices: !!window.Choices,
                    classList: sel.className,
                    dataId: sel.getAttribute('data-id'),
                    dataAttribute: sel.getAttribute('data-attribute'),
                };
            }
        """)
        print(f"\nTom Select info: {ts_info}")

        # Try the global Tom Select instance
        result = await page.evaluate("""
            () => {
                // Try to find and trigger the Tom Select control
                const sel = document.querySelector('select[name="step2_fields[brand]"]');
                if (!sel) return 'no select found';

                // Try various Tom Select approaches
                if (sel.tomselect) {
                    sel.tomselect.setValue('APPLE');
                    return 'set via tomselect.setValue';
                }

                // Look for the control in the global window object
                const ts = window.TomSelect;
                if (ts) return 'TomSelect constructor found';

                // Click the control element (ts-control)
                const tsWrapper = sel.nextElementSibling;
                if (tsWrapper && tsWrapper.classList.contains('ts-wrapper')) {
                    const control = tsWrapper.querySelector('.ts-control');
                    if (control) {
                        control.click();
                        return 'clicked ts-control';
                    }
                }

                return 'no method worked';
            }
        """)
        print(f"\nSet brand result: {result}")
        await asyncio.sleep(2)

        # Try clicking the ts-control to open the dropdown
        ts_control = page.locator(".ts-control, .ts-wrapper .ts-control").first
        if await ts_control.count() > 0:
            print(f"\nFound ts-control, clicking...")
            await ts_control.click(force=True)
            await asyncio.sleep(1)

            # Look for APPLE option in the dropdown
            apple_option = page.locator(".ts-dropdown .option", has_text="Apple")
            if await apple_option.count() > 0:
                print(f"Found Apple option in ts-dropdown, clicking...")
                await apple_option.first.click(force=True)
                await asyncio.sleep(2)
            else:
                # Try typing to filter
                ts_input = page.locator(".ts-control input").first
                if await ts_input.count() > 0:
                    await ts_input.fill("Apple")
                    await asyncio.sleep(1)
                    apple_opt2 = page.locator(".ts-dropdown .option", has_text="Apple")
                    if await apple_opt2.count() > 0:
                        await apple_opt2.first.click(force=True)
                        await asyncio.sleep(2)

        # Check current page state
        body2 = await page.evaluate("() => document.body.innerText.substring(0, 2000)")
        print(f"\n--- After brand select ---\n{body2[:1000]}")

        model_opts = await page.evaluate(js_get_select_options("step2_fields[model]"))
        print(f"\nModel options now: {model_opts[:10]}")

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
