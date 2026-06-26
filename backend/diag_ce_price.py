"""Complete CashExpress flow: click through all conditions to get price + find the price API."""
import asyncio, sys, re, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

CE_BASE = "https://www.cashexpress.fr"
CE_SELL = f"{CE_BASE}/revendre/smartphone"

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
        await ss_main.click(force=True)  # close
        return False
    await option.first.click(force=True)
    await asyncio.sleep(1.5)
    return True


async def click_radio_label(page, name: str, value: str) -> bool:
    """Click the label associated with a radio[name][value]."""
    result = await page.evaluate(f"""
        () => {{
            const r = document.querySelector('input[name="{name}"][value="{value}"]');
            if (!r) return false;
            const lbl = document.querySelector('label[for="'+r.id+'"]');
            if (lbl) {{ lbl.click(); return true; }}
            r.checked = true;
            r.dispatchEvent(new Event('change', {{bubbles: true}}));
            return true;
        }}
    """)
    await asyncio.sleep(0.5)
    return bool(result)


async def click_visible_label_text(page, text: str) -> bool:
    """Click the first VISIBLE label whose text matches."""
    labels = page.locator("label.form-check-label, label.btn").filter(has_text=text)
    for i in range(await labels.count()):
        lbl = labels.nth(i)
        try:
            bb = await lbl.bounding_box()
            if bb and bb['width'] > 0 and bb['height'] > 0:
                await lbl.click(force=True)
                await asyncio.sleep(0.5)
                return True
        except Exception:
            pass
    return False


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
            if resp.status == 200 and ('json' in ct or 'html' in ct):
                try:
                    body = await resp.text()
                    api_calls.append({'url': resp.url, 'status': resp.status, 'body': body[:800]})
                except Exception:
                    pass

        page.on("response", on_response)

        await page.goto(CE_SELL, wait_until="domcontentloaded", timeout=30000)
        await asyncio.sleep(3)

        for t in ["Continuer sans accepter"]:
            try:
                b = page.get_by_text(t, exact=True)
                if await b.count() > 0:
                    await b.first.click()
                    await asyncio.sleep(1)
            except Exception:
                pass

        # Step 1
        await click_radio_label(page, "step1_fields[functional]", "1")
        await click_radio_label(page, "step1_fields[operator_commitment]", "1")
        await asyncio.sleep(1)

        # Step 2
        await ss_select(page, "step2_fields[brand]", "Apple")
        await asyncio.sleep(1)

        model_opts = await page.evaluate("""
            () => Array.from(document.querySelectorAll('select[name="step2_fields[model]"] option'))
                .map(o => ({value: o.value, text: o.text.trim()}))
        """)
        # Find iPhone 14 Pro (exact)
        target = next((o for o in model_opts if 'IPHONE 14 PRO 5G' == o['value']), None)
        print(f"iPhone 14 Pro option: {target}")
        if not target:
            matching = [o for o in model_opts if 'iphone 14 pro' in o['text'].lower() and '14 pro m' not in o['text'].lower()]
            print(f"iPhone 14 Pro alternatives: {matching}")
            target = matching[0] if matching else None

        if target:
            await ss_select(page, "step2_fields[model]", target['text'])
            await asyncio.sleep(1)

            cap_opts = await page.evaluate("""
                () => Array.from(document.querySelectorAll('select[name="step2_fields[capacity]"] option'))
                    .map(o => ({value: o.value, text: o.text.trim()}))
            """)
            cap_128 = next((o for o in cap_opts if '128' in o['text']), None)
            print(f"128Go option: {cap_128}")
            if cap_128:
                await ss_select(page, "step2_fields[capacity]", cap_128['text'])
                await asyncio.sleep(1)

                # Step 3: click conditions one by one (step-by-step form)
                print("\n=== Step 3: clicking conditions ===")
                for _ in range(10):  # max 10 condition clicks
                    body_text = await page.evaluate("() => document.body.innerText")
                    # Check what step we're on
                    step_match = re.search(r'(\d+)/4', body_text)
                    step = int(step_match.group(1)) if step_match else 0
                    print(f"Current step: {step}")

                    if step >= 4:
                        break

                    # Click first visible condition label (Intact/D'occasion/Non)
                    clicked = False
                    for cond_text in ["Intact", "D'occasion", "Non"]:
                        if await click_visible_label_text(page, cond_text):
                            print(f"  Clicked: {cond_text}")
                            clicked = True
                            await asyncio.sleep(0.8)
                            break
                    if not clicked:
                        print("  No condition to click, clicking submit")
                        await page.evaluate("() => { const b = document.querySelector('button[type=\"submit\"]'); if(b) b.click(); }")
                        await asyncio.sleep(1.5)
                        break

                # Final body
                body4 = await page.evaluate("() => document.body.innerText.substring(0, 3000)")
                print(f"\n--- Final body ---\n{body4[:2000]}")

                # Find prices
                prices = re.findall(r'([\d]+(?:[\.,][\d]+)?)\s*€', body4)
                print(f"\nPrices found: {prices}")

        # Price API calls
        print(f"\n=== All API calls mentioning 'prix' or price actions ===")
        for c in api_calls:
            if any(x in c['url'].lower() or x in c['body'].lower()
                   for x in ['prix', 'price', 'offer', 'offre', 'getprice', 'getquote', 'quote']):
                print(f"  {c['url']}")
                print(f"    {c['body'][:400]}")

        print(f"\n=== All CashExpress API calls ===")
        for c in api_calls:
            if 'cashexpress.fr' in c['url']:
                print(f"  {c['url'][:150]}")
                if 'action' in c['url']:
                    print(f"    body: {c['body'][:300]}")

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
