"""Test calling CashExpress calculateGrade API directly via curl_cffi."""
import asyncio, sys
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

CE_URL = "https://www.cashexpress.fr/revendre/smartphone"
CE_HEADERS = {
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
    "Referer": CE_URL,
    "Origin": "https://www.cashexpress.fr",
    "X-Requested-With": "XMLHttpRequest",
}


async def test_api():
    from curl_cffi.requests import AsyncSession as CurlSession

    async with CurlSession(impersonate="chrome124") as s:
        # First, get a session cookie by loading the page
        print("Loading page to get cookies...")
        r0 = await s.get(CE_URL, headers=CE_HEADERS, timeout=15)
        print(f"  Status: {r0.status_code}, Cookies: {dict(s.cookies)}")

        # Test calculateGrade with all params
        print("\nCalling calculateGrade with all params...")
        conditions = [
            ("intact", "Parfait"),
            ("scratches", "Très bon état"),
            ("shock", "Bon état"),
            ("broken", "Cassé"),
        ]
        for ce_cond, our_cond in conditions:
            data = {
                "step1_fields[functional]": "1",
                "step1_fields[operator_commitment]": "1",
                "step2_fields[brand]": "APPLE",
                "step2_fields[model]": "IPHONE 14 PRO 5G",
                "step2_fields[capacity]": "128Go",
                "step3_fields[screen_state]": ce_cond,
                "step3_fields[back_case_state]": ce_cond,
                "step3_fields[buy_condition]": "used",
                "step3_fields[has_invoice_less_6_months]": "0",
            }
            r = await s.post(
                CE_URL,
                params={"action": "calculateGrade"},
                data=data,
                headers=CE_HEADERS,
                timeout=15,
            )
            print(f"  [{our_cond}] Status={r.status_code} Body={r.text[:300]}")

        # Test getModels
        print("\nCalling getModels for APPLE...")
        r2 = await s.get(
            CE_URL,
            params={"action": "getModels", "brand": "APPLE"},
            headers=CE_HEADERS,
            timeout=15,
        )
        import json
        models = r2.json().get("models", [])
        print(f"  Models count: {len(models)}")
        iphone_14 = [m for m in models if "14 PRO" in m.get("value", "")]
        print(f"  iPhone 14 Pro models: {iphone_14}")

        # Test getAttributes for iPhone 14 Pro 5G
        print("\nCalling getAttributes for IPHONE 14 PRO 5G...")
        r3 = await s.get(
            CE_URL,
            params={"action": "getAttributes", "brand": "APPLE", "model": "IPHONE 14 PRO 5G"},
            headers=CE_HEADERS,
            timeout=15,
        )
        attrs = r3.json()
        print(f"  Attributes: {attrs}")


asyncio.run(test_api())
