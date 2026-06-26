"""Test calling CashExpress calculateGrade via curl_cffi with multipart form data."""
import asyncio, sys, re
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

CE_URL = "https://www.cashexpress.fr/revendre/smartphone"

CE_HEADERS = {
    "Accept": "*/*",
    "Accept-Language": "fr-FR,fr;q=0.9",
    "Referer": CE_URL,
    "Origin": "https://www.cashexpress.fr",
    "X-Requested-With": "XMLHttpRequest",
}


def make_multipart(fields: dict):
    """Convert dict to CurlMime multipart object."""
    from curl_cffi import CurlMime
    m = CurlMime()
    for k, v in fields.items():
        m.addpart(name=k, data=str(v))
    return m


async def test():
    from curl_cffi.requests import AsyncSession as CurlSession

    async with CurlSession(impersonate="chrome124") as s:
        # Load the page first (get PHPSESSID)
        r0 = await s.get(CE_URL, headers={**CE_HEADERS, "Accept": "text/html,*/*"}, timeout=15)
        print(f"Page loaded: {r0.status_code}, cookies: {dict(s.cookies)}")

        # Step 1: Load getModels (stores brand in session)
        r1 = await s.post(
            CE_URL,
            params={"action": "getModels"},
            multipart=make_multipart({"slug": "smartphone", "brand": "APPLE"}),
            headers={**CE_HEADERS, "Accept": "application/json"},
            timeout=15,
        )
        print(f"\ngetModels: {r1.status_code}")
        models_data = r1.json() if r1.text.startswith('{') else {}
        models = models_data.get("models", [])
        iphone14pro = next((m for m in models if "14 PRO 5G" in m.get("value", "")), None)
        print(f"iPhone 14 Pro 5G: {iphone14pro}")

        # Step 2: Load getAttributes (stores model in session)
        r2 = await s.post(
            CE_URL,
            params={"action": "getAttributes"},
            multipart=make_multipart({"slug": "smartphone", "brand": "APPLE",
                                  "model": "IPHONE 14 PRO 5G", "search": "Memoire interne"}),
            headers={**CE_HEADERS, "Accept": "application/json"},
            timeout=15,
        )
        print(f"\ngetAttributes: {r2.status_code}")
        print(f"  {r2.text[:300]}")

        # Step 3: Call calculateGrade
        conditions = [
            ("intact", "intact", "Parfait"),
            ("scratches", "scratches", "Très bon état"),
            ("shock", "shock", "Bon état"),
            ("broken", "broken", "Cassé"),
        ]
        for screen, back, label in conditions:
            r3 = await s.post(
                CE_URL,
                params={"action": "calculateGrade"},
                multipart=make_multipart({
                    "formAction": "purchase",
                    "category_slug": "smartphone",
                    "step1_fields[functional]": "1",
                    "step1_fields[operator_commitment]": "1",
                    "step2_fields[brand]": "APPLE",
                    "step2_fields[model]": "IPHONE 14 PRO 5G",
                    "step2_fields[capacity]": "128Go",
                    "step3_fields[screen_state]": screen,
                    "step3_fields[back_case_state]": back,
                    "step3_fields[buy_condition]": "used",
                    "slug": "smartphone",
                    "attributes[0][label]": "Memoire interne",
                    "attributes[0][value]": "128Go",
                }),
                headers={**CE_HEADERS, "Accept": "application/json"},
                timeout=15,
            )
            body = r3.text
            # Extract price
            price_match = re.search(r'"price":\s*"(\d+)', body)
            price = price_match.group(1) if price_match else "null"
            print(f"\n  [{label}] Status={r3.status_code} Price={price}€")
            print(f"  Body: {body[:300]}")


asyncio.run(test())
