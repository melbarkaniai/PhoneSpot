"""Test CashExpress API with correct POST format and session state."""
import asyncio, sys, json
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

CE_URL = "https://www.cashexpress.fr/revendre/smartphone"


async def test_api():
    import re
    from curl_cffi.requests import AsyncSession as CurlSession

    async with CurlSession(impersonate="chrome124") as s:
        headers = {
            "Accept": "*/*",
            "Accept-Language": "fr-FR,fr;q=0.9",
            "Referer": CE_URL,
            "Origin": "https://www.cashexpress.fr",
            "X-Requested-With": "XMLHttpRequest",
        }

        # Load page
        r0 = await s.get(CE_URL, headers={**headers, "Accept": "text/html"}, timeout=15)
        print(f"Page status: {r0.status_code}, cookies: {dict(s.cookies)}")

        # Extract hidden inputs via regex
        hidden_inputs = {}
        for m in re.finditer(r'<input[^>]+type=["\']hidden["\'][^>]*>', r0.text):
            inp = m.group(0)
            name_m = re.search(r'name=["\']([^"\']+)["\']', inp)
            val_m = re.search(r'value=["\']([^"\']*)["\']', inp)
            if name_m:
                hidden_inputs[name_m.group(1)] = val_m.group(1) if val_m else ""
        print(f"Hidden inputs: {hidden_inputs}")

        print("\n=== Test POST to getModels ===")
        r1 = await s.post(
            CE_URL,
            params={"action": "getModels"},
            data={"step2_fields[brand]": "APPLE", **hidden_inputs},
            headers=headers,
            timeout=15,
        )
        print(f"Status: {r1.status_code}")
        print(f"Body: {r1.text[:500]}")

        print("\n=== Test GET to getModels with brand param ===")
        r2 = await s.get(
            CE_URL,
            params={"action": "getModels", "brand": "APPLE"},
            headers=headers,
            timeout=15,
        )
        print(f"Status: {r2.status_code}")
        print(f"Body: {r2.text[:500]}")

        print("\n=== Test POST to calculateGrade (all fields) ===")
        calc_data = {
            "step1_fields[functional]": "1",
            "step1_fields[operator_commitment]": "1",
            "step2_fields[brand]": "APPLE",
            "step2_fields[model]": "IPHONE 14 PRO 5G",
            "step2_fields[capacity]": "128Go",
            "step3_fields[screen_state]": "intact",
            "step3_fields[back_case_state]": "intact",
            "step3_fields[buy_condition]": "used",
            "step3_fields[has_invoice_less_6_months]": "0",
            **hidden_inputs,
        }
        r3 = await s.post(
            CE_URL,
            params={"action": "calculateGrade"},
            data=calc_data,
            headers=headers,
            timeout=15,
        )
        print(f"Status: {r3.status_code}")
        print(f"Body: {r3.text[:500]}")

        print("\n=== Test GET to calculateGrade ===")
        r4 = await s.get(
            CE_URL,
            params={"action": "calculateGrade", **calc_data},
            headers=headers,
            timeout=15,
        )
        print(f"Status: {r4.status_code}")
        print(f"Body: {r4.text[:500]}")

        # Check if there's a different endpoint for the final price step
        print("\n=== Try step 1 first (simulate full form flow) ===")
        # Step 1
        r_s1 = await s.post(
            CE_URL,
            params={"action": "validateStep"},
            data={
                "step": "1",
                "step1_fields[functional]": "1",
                "step1_fields[operator_commitment]": "1",
                **hidden_inputs,
            },
            headers=headers,
            timeout=15,
        )
        print(f"validateStep 1: {r_s1.status_code} {r_s1.text[:300]}")

asyncio.run(test_api())
