"""Full request capture + longer waits to get CashExpress price."""
import asyncio, sys, json, re
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
    await asyncio.sleep(1)
    option = page.locator(f".ss-content[data-id='{data_id}'] .ss-option").filter(has_text=option_text)
    if await option.count() == 0:
        await ss_main.click(force=True)
        return False
    await option.first.click(force=True)
    await asyncio.sleep(2)
    return True


async def click_radio(page, name, value):
    await page.evaluate(f"""
        () => {{
            const r = document.querySelector('input[name="{name}"][value="{value}"]');
            if (r) {{ const l = document.querySelector('label[for="'+r.id+'"]'); if(l) l.click(); else {{ r.checked=true; r.dispatchEvent(new Event('change',{{bubbles:true}})); }} }}
        }}
    """)
    await asyncio.sleep(1.5)


async def run_one(model_value, capacity_value, screen, back):
    from playwright.async_api import async_playwright

    calc_requests = []
    calc_responses = []

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
            if 'calculateGrade' in req.url:
                try:
                    calc_requests.append(req.post_data or "")
                except Exception:
                    pass

        async def on_response(resp):
            if 'calculateGrade' in resp.url:
                try:
                    body = await resp.text()
                    calc_responses.append(body)
                except Exception:
                    pass

        page.on("request", on_request)
        page.on("response", on_response)

        await page.goto(CE_URL, wait_until="domcontentloaded", timeout=30000)
        await asyncio.sleep(3)

        for t in ["Continuer sans accepter", "Refuser tout"]:
            try:
                b = page.get_by_text(t, exact=True)
                if await b.count() > 0:
                    await b.first.click()
                    await asyncio.sleep(1)
            except Exception:
                pass

        await click_radio(page, "step1_fields[functional]", "1")
        await click_radio(page, "step1_fields[operator_commitment]", "1")

        model_label = model_value.title().replace(" 5G", " 5G")
        await ss_select(page, "step2_fields[brand]", "Apple")
        # Find exact model label
        model_opts = await page.evaluate("""
            () => Array.from(document.querySelectorAll('select[name="step2_fields[model]"] option'))
                .map(o => o.text.trim())
        """)
        model_label = next((t for t in model_opts if model_value in t.upper()), None)
        if not model_label:
            await browser.close()
            return None
        await ss_select(page, "step2_fields[model]", model_label)

        cap_opts = await page.evaluate("""
            () => Array.from(document.querySelectorAll('select[name="step2_fields[capacity]"] option'))
                .map(o => ({value: o.value, text: o.text.trim()}))
        """)
        cap_label = next((o['text'] for o in cap_opts if capacity_value.replace("Go", "").strip() in o['text']), None)
        if not cap_label:
            await browser.close()
            return None
        await ss_select(page, "step2_fields[capacity]", cap_label)

        # Step 3 conditions
        await click_radio(page, "step3_fields[screen_state]", screen)
        await click_radio(page, "step3_fields[back_case_state]", back)
        await click_radio(page, "step3_fields[buy_condition]", "used")
        await asyncio.sleep(3)  # Wait for auto-advance or final calculateGrade

        # Check if we advanced to step 4
        body = await page.evaluate("() => document.body.innerText.substring(0, 3000)")
        step4 = "4/4" in body
        price_in_body = re.findall(r'(\d+(?:[,\.]\d+)?)\s*€', body)

        await browser.close()

    return {
        "model": model_value,
        "capacity": capacity_value,
        "screen": screen,
        "back": back,
        "calc_requests_count": len(calc_requests),
        "last_request": calc_requests[-1][:2000] if calc_requests else "",
        "calc_responses": [json.loads(r) if r.startswith('{') else r for r in calc_responses],
        "step4": step4,
        "body_prices": price_in_body,
    }


async def main():
    tests = [
        ("IPHONE 14 PRO 5G", "128Go", "intact", "intact"),
        ("IPHONE 14 PRO 5G", "128Go", "scratches", "scratches"),
        ("IPHONE 11", "64Go", "intact", "intact"),
        ("IPHONE 12 5G", "64Go", "intact", "intact"),
    ]
    for args in tests:
        print(f"\n=== Testing {args[0]} {args[1]} screen={args[2]} ===")
        result = await run_one(*args)
        if result:
            print(f"  calc requests: {result['calc_requests_count']}")
            print(f"  last request (full):\n{result['last_request']}")
            print(f"  calc responses: {result['calc_responses']}")
            print(f"  step4: {result['step4']}")
            print(f"  body prices: {result['body_prices']}")
        else:
            print("  FAILED (model/capacity not found)")


import threading
def run():
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(main())
    finally:
        loop.close()

t = threading.Thread(target=run, daemon=True)
t.start()
t.join(timeout=180)
if t.is_alive():
    print("TIMED OUT")
