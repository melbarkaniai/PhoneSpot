#!/usr/bin/env python3
"""
iPhone Resale Price Scraper
============================
Scrape les prix de rachat en temps réel depuis 3 sites :
  - Swappie    : API REST via curl_cffi
  - BackMarket : API REST via curl_cffi
  - Recommerce : via Playwright (SPA Vue.js avec détection headless)

Conditions normalisées : Parfait | Très bon état | Bon état | Cassé

Usage CLI :
  python scraper.py "iPhone 15 Pro"
  python scraper.py "iPhone 15 Pro" --storage 128GB 256GB
  python scraper.py "iPhone 15 Pro" --no-cache    # ignore le cache, force le scraping
  python scraper.py --list-models
  python scraper.py --warm-cache                  # pré-calcule le cache de tous les modèles

Intégration web (FastAPI / Flask) :
  from scraper import search

  @app.get("/prices/{model}")
  async def prices(model: str):
      return await search(model)          # <100ms si cache valide, sinon scrape

Pour ajouter un nouveau site :
  1. Créer une fonction scrape_SITE(client, model, storages) → list[dict]
  2. Chaque dict doit avoir : source, model, storage, condition, raw_condition,
     price, currency, url
  3. L'ajouter dans SCRAPERS ci-dessous
"""

import httpx
import json
import asyncio
import re
import sys
import os
import warnings
import html as html_module
import random
import threading
import concurrent.futures
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlencode, quote, unquote
from rich.console import Console
from rich.table import Table
from rich import box
from curl_cffi.requests import AsyncSession as CurlSession
from playwright.async_api import async_playwright

# Force UTF-8 on Windows to handle accented characters in Rich output
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# Suppress curl_cffi ProactorEventLoop / Curlm warnings on Windows
warnings.filterwarnings("ignore", module="curl_cffi.*")
warnings.filterwarnings("ignore", message=r".*Proactor event loop.*", category=RuntimeWarning)
warnings.filterwarnings("ignore", message=r".*Curlm alread closed.*", category=UserWarning)

console = Console()


def _run_sync(coro):
    """
    Run a Playwright coroutine in the current thread's own event loop.
    On Windows, uses ProactorEventLoop explicitly so Playwright can spawn
    subprocesses even when the caller lives in a ProactorEventLoop thread.
    """
    if sys.platform == "win32":
        loop = asyncio.ProactorEventLoop()
    else:
        loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()
        asyncio.set_event_loop(None)


def _run_in_new_loop(coro):
    """
    Run an async coroutine in a brand new event loop in a separate thread.
    Bypasses the Windows ProactorEventLoop subprocess limitation.
    Returns the result or raises the exception.
    """
    result = None
    exception = None

    def thread_target():
        nonlocal result, exception
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(coro)
        except Exception as e:
            exception = e
        finally:
            loop.close()

    thread = threading.Thread(target=thread_target, daemon=True)
    thread.start()
    thread.join(timeout=180)

    if thread.is_alive():
        console.print("[yellow]  Playwright timeout (180s)[/yellow]")
        return []
    if exception:
        raise exception
    return result or []


# ─── CONDITIONS STANDARDISÉES ──────────────────────────────────────────────────
# Référentiel commun à tous les sites — toujours dans cet ordre
STANDARD_CONDITIONS = ["Parfait", "Très bon état", "Bon état", "Cassé"]

# Mapping libellé brut (par site) → condition standardisée
CONDITION_NORMALIZE: dict[str, str] = {
    # Swappie
    "Neuf scellé":   "Parfait",
    "Comme neuf":    "Parfait",
    "Quasi neuf":    "Très bon état",
    "Bon état":      "Bon état",
    "État correct":  "Bon état",
    # BackMarket
    "Parfait état":  "Parfait",
    "Très bon état": "Très bon état",
    "Cassé":         "Cassé",
    # Recommerce
    "Parfait": "Parfait",
    "Bon":     "Bon état",
    "Abimé":   "Cassé",
    # EasyCash
    "Parfait état (A)":  "Parfait",
    "Bon état (B)":      "Très bon état",
    "État correct (C)":  "Bon état",
    # Cash Express
    "Excellent état (A+)": "Parfait",
    "Très bon état (A)":   "Très bon état",
    "Bon état (B)":        "Bon état",
    "Correct (C)":         "Bon état",
    # Greendid / Fnac reprise
    "Comme neuf":    "Parfait",
    "Très bon état": "Très bon état",
    "Bon état":      "Bon état",
    "Correct":       "Bon état",
    "Endommagé":     "Cassé",
    # eRecycle
    "Intact":            "Parfait",
    "Rayé / Abimé":      "Bon état",
    "Écran cassé":       "Cassé",
    # MagicRecycle
    "Comme Neuf":                "Parfait",
    "Fonctionnel comme Neuf":    "Parfait",
    "Fonctionnel":               "Très bon état",
    "Fonctionnel Petite Panne":  "Bon état",
    "Appareil fissuré":          "Cassé",
    # CertiDeal
    "Parfait état":              "Parfait",
    "Acceptable":                "Bon état",
    # Asgoodasnew
    "Grade A+":   "Parfait",
    "Grade A":    "Très bon état",
    "Grade B":    "Bon état",
    "Grade C":    "Cassé",
    "Abîmé":      "Cassé",
}

def normalize(raw: str) -> str:
    return CONDITION_NORMALIZE.get(raw, raw)


# ─── MODÈLES & STOCKAGES SWAPPIE ───────────────────────────────────────────────
SWAPPIE_MODELS = [
    "iPhone 12",       "iPhone 12 mini",    "iPhone 12 Pro",    "iPhone 12 Pro Max",
    "iPhone 13",       "iPhone 13 mini",    "iPhone 13 Pro",    "iPhone 13 Pro Max",
    "iPhone 14",       "iPhone 14 Plus",    "iPhone 14 Pro",    "iPhone 14 Pro Max",
    "iPhone 15",       "iPhone 15 Plus",    "iPhone 15 Pro",    "iPhone 15 Pro Max",
    "iPhone 16",       "iPhone 16 Plus",    "iPhone 16 Pro",    "iPhone 16 Pro Max",
    "iPhone 17",       "iPhone 17 Plus",    "iPhone 17 Pro",    "iPhone 17 Pro Max",
]

SWAPPIE_STORAGES: dict[str, list[str]] = {
    "iPhone 12":         ["64GB", "128GB", "256GB"],
    "iPhone 12 mini":    ["64GB", "128GB", "256GB"],
    "iPhone 12 Pro":     ["128GB", "256GB", "512GB"],
    "iPhone 12 Pro Max": ["128GB", "256GB", "512GB"],
    "iPhone 13":         ["128GB", "256GB", "512GB"],
    "iPhone 13 mini":    ["128GB", "256GB", "512GB"],
    "iPhone 13 Pro":     ["128GB", "256GB", "512GB", "1024GB"],
    "iPhone 13 Pro Max": ["128GB", "256GB", "512GB", "1024GB"],
    "iPhone 14":         ["128GB", "256GB", "512GB"],
    "iPhone 14 Plus":    ["128GB", "256GB", "512GB"],
    "iPhone 14 Pro":     ["128GB", "256GB", "512GB", "1024GB"],
    "iPhone 14 Pro Max": ["128GB", "256GB", "512GB", "1024GB"],
    "iPhone 15":         ["128GB", "256GB", "512GB"],
    "iPhone 15 Plus":    ["128GB", "256GB", "512GB"],
    "iPhone 15 Pro":     ["128GB", "256GB", "512GB", "1024GB"],
    "iPhone 15 Pro Max": ["256GB", "512GB", "1024GB"],
    "iPhone 16":         ["128GB", "256GB", "512GB"],
    "iPhone 16 Plus":    ["128GB", "256GB", "512GB"],
    "iPhone 16 Pro":     ["128GB", "256GB", "512GB", "1024GB"],
    "iPhone 16 Pro Max": ["256GB", "512GB", "1024GB"],
    "iPhone 17":         ["128GB", "256GB", "512GB"],
    "iPhone 17 Plus":    ["128GB", "256GB", "512GB"],
    "iPhone 17 Pro":     ["256GB", "512GB", "1024GB"],
    "iPhone 17 Pro Max": ["256GB", "512GB", "1024GB"],
}

SWAPPIE_VISUAL: dict[str, str] = {
    "SEALED_BOX": "Neuf scellé",
    "LIKE_NEW":   "Comme neuf",
    "ALMOST_NEW": "Quasi neuf",
    "GOOD":       "Bon état",
    "MODERATE":   "État correct",
}


# ─── SCRAPER : SWAPPIE ─────────────────────────────────────────────────────────
async def scrape_swappie(
    _client,
    model: str,
    storages: Optional[list[str]] = None,
) -> list[dict]:
    """
    API : GET https://swappie.com/api/sell/api/v3/prices/
    Retourne toutes les conditions visuelles × fonctionnelles.
    On filtre : functional_condition vide = appareil 100% fonctionnel.
    Swappie ne rachète pas les appareils cassés → pas de condition "Cassé".
    """
    if storages is None:
        storages = SWAPPIE_STORAGES.get(model, ["128GB", "256GB", "512GB"])

    url = "https://swappie.com/api/sell/api/v3/prices/?" + urlencode({
        "model_name": model,
        "country": "FR",
        "storages": json.dumps(storages),
    })
    cookies = {
        "i18next": "fr-FR",
        "mammaLocale": "fr",
        "OptanonAlertBoxClosed": "2026-05-04T18:12:35.744Z",
        "OptanonConsent": (
            "isGpcEnabled=0&datestamp=Thu+May+07+2026+17%3A10%3A47+GMT%2B0200"
            "+(heure+d%E2%80%99%C3%A9t%C3%A9+d%E2%80%99Europe+centrale)"
            "&version=202411.2.0&browserGpcFlag=0&isIABGlobal=false&hosts="
            "&consentId=494c29d8-dac9-47be-9cc3-d1d6aab621c5&interactionCount=2"
            "&isAnonUser=1&landingPath=NotLandingPage&AwaitingReconsent=false"
            "&groups=C0003%3A1%2CC0004%3A1%2CC0002%3A1%2CC0001%3A1"
            "&fclco=&intType=1&geolocation=FR%3BOCC"
        ),
        "swappie_exp_ab_c2b_reject_price_change_relaunch_2f497a3f": "0",
    }
    headers = {
        "Referer": "https://swappie.com/fr/revendre/iphone/model/",
        "Accept-Language": "fr-FR,fr;q=0.9",
    }

    try:
        async with CurlSession(impersonate="chrome124") as s:
            r = await s.get(url, headers=headers, cookies=cookies, timeout=15)
        if r.status_code != 200:
            console.print(f"[yellow]  Swappie HTTP {r.status_code}[/yellow]")
            return []

        results = []
        for item in r.json().get("results", []):
            vc = item.get("visual_condition", "")
            if vc == "SEALED_BOX":                 # exclure Neuf scellé (irréaliste)
                continue
            if item.get("functional_condition"):   # fonctionnel uniquement
                continue
            raw_cond = SWAPPIE_VISUAL.get(vc, vc)
            mn = item.get("model_name", "")
            storage = next(
                (s for s in ["64GB", "128GB", "256GB", "512GB", "1024GB"] if s in mn), ""
            )
            price = float(item.get("price", {}).get("price", 0))
            if price <= 0 or not storage:
                continue
            results.append({
                "source":        "Swappie",
                "model":         model,
                "storage":       storage,
                "condition":     normalize(raw_cond),
                "raw_condition": raw_cond,
                "price":         price,
                "currency":      "EUR",
                "url":           "https://swappie.com/fr/revendre/iphone/model/",
            })
        return results

    except Exception as e:
        console.print(f"[red]  Swappie erreur: {e}[/red]")
        return []


# ─── SCRAPER : BACKMARKET ──────────────────────────────────────────────────────
# state_screen / state_body : 1=Parfait état  2=Très bon état  3=État correct  4=Cassé
# state_functional          : 1=Oui (fonctionnel)
BM_CONDITIONS: list[tuple[int, int, str]] = [
    (1, 1, "Parfait état"),    # → Parfait
    (2, 2, "Très bon état"),   # → Très bon état
    (3, 3, "État correct"),    # → Bon état
    (4, 1, "Cassé"),           # → Cassé  (écran cassé, coque parfaite, fonctionnel)
]

_BM_BASE = "https://www.backmarket.fr"
_BM_HEADERS = {
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "fr-FR,fr;q=0.9",
    "Referer": f"{_BM_BASE}/fr-fr/buyback-funnel/device/smartphone/smartphone?brand=Apple",
}


async def discover_models_backmarket() -> list[str]:
    """Auto-détecte tous les modèles Apple disponibles sur BackMarket."""
    q_url = (
        f"{_BM_BASE}/buyback-funnel/api/v1/funnel/regular/questions"
        f"?brand=Apple&category=smartphone&nextStep=true&embedded=true"
    )
    try:
        async with CurlSession(impersonate="chrome124") as s:
            r = await s.get(q_url, headers=_BM_HEADERS, timeout=12)
            if r.status_code == 200:
                for step in r.json().get("funnel", []):
                    for q in step.get("questions", []):
                        if q.get("key") == "model":
                            return [o["value"] for o in q.get("options", [])]
    except Exception:
        pass
    return SWAPPIE_MODELS


async def scrape_backmarket(
    _client,
    model: str,
    storages: Optional[list[str]] = None,
) -> list[dict]:
    """
    Étape 1 : questions?model=X → liste des stockages disponibles
    Étape 2 : offer?storage=X&state_screen=Y&state_body=Y&state_functional=1 → prix
    Itère sur 4 conditions (Parfait / Très bon / Correct / Cassé).
    """
    try:
        async with CurlSession(impersonate="chrome124") as s:
            # Stockages disponibles
            q_url = (
                f"{_BM_BASE}/buyback-funnel/api/v1/funnel/regular/questions"
                f"?brand=Apple&category=smartphone&model={quote(model)}"
                f"&nextStep=true&embedded=true"
            )
            r = None
            for attempt in range(3):
                r = await s.get(q_url, headers=_BM_HEADERS, timeout=12)
                if r.status_code == 200:
                    break
                console.print(
                    f"[yellow]  BackMarket HTTP {r.status_code} (tentative {attempt + 1}/3)[/yellow]"
                )
                await asyncio.sleep(10 * (attempt + 1) + random.uniform(0, 5))
            if r is None or r.status_code != 200:
                return []

            storage_vals: list[str] = []
            for step in r.json().get("funnel", []):
                for q in step.get("questions", []):
                    if q.get("key") == "storage":
                        storage_vals = [o["value"] for o in q.get("options", [])]
            if not storage_vals:
                console.print("[yellow]  BackMarket: aucun stockage trouvé[/yellow]")
                return []

            # Prix par stockage × condition
            results = []
            for sv in storage_vals:
                storage_label = "1024GB" if sv == "1000" else f"{sv}GB"
                if storages and storage_label not in storages:
                    continue
                for screen, body, raw_cond in BM_CONDITIONS:
                    offer_url = (
                        f"{_BM_BASE}/buyback-funnel/api/v1/funnel/regular/offer"
                        f"?brand=Apple&category=smartphone&model={quote(model)}"
                        f"&storage={sv}&state_screen={screen}&state_body={body}"
                        f"&state_functional=1&embedded=true"
                    )
                    ro = await s.get(offer_url, headers=_BM_HEADERS, timeout=12)
                    if ro.status_code != 200:
                        continue
                    price = float(
                        ro.json().get("listing", {}).get("price", {}).get("amount", 0)
                    )
                    if price <= 0:
                        continue
                    results.append({
                        "source":        "BackMarket",
                        "model":         model,
                        "storage":       storage_label,
                        "condition":     normalize(raw_cond),
                        "raw_condition": raw_cond,
                        "price":         price,
                        "currency":      "EUR",
                        "url": f"{_BM_BASE}/fr-fr/buyback-funnel/device/smartphone/smartphone?brand=Apple",
                    })
            return results

    except Exception as e:
        console.print(f"[red]  BackMarket erreur: {e}[/red]")
        return []


# ─── SCRAPER : RECOMMERCE ──────────────────────────────────────────────────────
_REC_CHANNEL = "recommerce-fr"
_REC_AUTH    = "UumIqAoBz6yuAMjtUnxET8GVyUE2uy6h"
_REC_API     = "https://live-buyback-order-api.live-api.recommerce.cloud"

# tag Recommerce → (libellé brut, condition normalisée)
_REC_HOUSING: dict[str, tuple[str, str]] = {
    "housing_flawless": ("Parfait", "Parfait"),
    "housing_good":     ("Bon",     "Bon état"),
    "housing_cracked":  ("Abimé",   "Cassé"),
}


async def _recommerce_browser_search(
    model: str,
) -> tuple[Optional[dict], dict[int, dict]]:
    """
    Lance un vrai navigateur Chromium (invisible) pour passer la détection headless.
    - Utilise expect_response enregistré AVANT le clic pour capturer la réponse search.
    - Récupère les détails produit (quotes par condition) via fetch() dans le contexte navigateur.
    """
    search_data: Optional[dict] = None
    product_details: dict[int, dict] = {}

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-blink-features=AutomationControlled"],
        )
        context = await browser.new_context(
            viewport={"width": 1440, "height": 900},
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
            ),
            locale="fr-FR",
            extra_http_headers={
                "sec-ch-ua": '"Not/A)Brand";v="8", "Chromium";v="124", "Google Chrome";v="124"',
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": '"Windows"',
            },
        )
        await context.add_init_script(
            "Object.defineProperty(navigator, 'webdriver', {get: () => undefined});"
        )
        page = await context.new_page()

        # Intercept ALL API responses — search + product details
        async def _on_resp(resp):
            nonlocal search_data
            ct = resp.headers.get("content-type", "")
            if ("json" in ct or "hal" in ct) and resp.status == 200:
                try:
                    if "recommerce.cloud/v4/product" in resp.url and "search=" in resp.url:
                        search_data = await resp.json()
                    elif re.search(r"recommerce\.cloud/v4/product/\d+$", resp.url):
                        pid = int(resp.url.rsplit("/", 1)[-1])
                        product_details[pid] = await resp.json()
                except Exception:
                    pass

        page.on("response", _on_resp)

        await page.goto(
            f"https://tradein.recommerce.com/#/{_REC_CHANNEL}/fr/",
            wait_until="domcontentloaded",
            timeout=30000,
        )
        await asyncio.sleep(3)

        # Accepter les cookies si présents
        for btn_text in ["Accepter", "Tout accepter", "J'accepte"]:
            try:
                btn = page.get_by_role("button", name=btn_text)
                if await btn.count() > 0:
                    await btn.first.click(timeout=2000)
                    await asyncio.sleep(1)
                    break
            except Exception:
                pass

        # Click Téléphone category (try multiple text variants)
        clicked_cat = False
        for cat_text in ["Téléphone", "Téléphones", "Smartphone", "Smartphones"]:
            try:
                btn = page.get_by_text(cat_text, exact=True).first
                if await btn.count() > 0:
                    await btn.click(timeout=5000)
                    clicked_cat = True
                    break
            except Exception:
                pass

        if not clicked_cat:
            # Fallback: click first category item
            try:
                await page.locator("[class*='category'], [class*='product-type']").first.click(timeout=5000)
                clicked_cat = True
            except Exception:
                pass

        if clicked_cat:
            await asyncio.sleep(1.5)
            try:
                inp = page.locator("input[type='text'], input[placeholder*='odel'], input[placeholder*='arque']").first
                if await inp.count() == 0:
                    inp = page.locator("input").first
                await inp.click()
                await asyncio.sleep(0.3)
                await inp.fill(model)
                await asyncio.sleep(0.5)
            except Exception:
                pass

        # Wait up to 20s for the search response to be captured by the handler
        for _ in range(40):
            if search_data is not None:
                break
            await asyncio.sleep(0.5)

        await asyncio.sleep(0.5)

        # Fetch product details for any products not already captured by the handler
        if search_data:
            for prod in search_data.get("_embedded", {}).get("product", []):
                pid = prod["id"]
                if pid in product_details:
                    continue
                detail = await page.evaluate(f"""
                    async () => {{
                        try {{
                            const r = await fetch(
                                '{_REC_API}/v4/product/{pid}',
                                {{headers: {{
                                    'Authorization': '{_REC_AUTH}',
                                    'Accept': 'application/hal+json'
                                }}}}
                            );
                            return r.ok ? await r.json() : null;
                        }} catch(e) {{ return null; }}
                    }}
                """)
                if detail:
                    product_details[pid] = detail

        await browser.close()

    return search_data, product_details


def _parse_recommerce_quotes(detail: dict) -> list[tuple[str, str, float]]:
    """
    Parse les quotes Recommerce et retourne [(raw_cond, norm_cond, prix)]
    uniquement pour les combinaisons où l'appareil est entièrement fonctionnel
    (working_ok + buttons_ok + ios_lock_unlocked).
    """
    housing_ids: dict[str, int] = {}
    required_ok: set[int] = set()

    for q in detail.get("questions", []):
        tag = q.get("tag", "")
        for a in q.get("answers", []):
            atag, aid = a.get("tag", ""), a["id"]
            if tag == "housing" and atag in _REC_HOUSING:
                housing_ids[atag] = aid
            elif atag in ("working_ok", "buttons_ok", "ios_lock_unlocked"):
                required_ok.add(aid)

    results: list[tuple[str, str, float]] = []
    for atag, (raw, norm) in _REC_HOUSING.items():
        h_id = housing_ids.get(atag)
        if h_id is None:
            continue
        target = required_ok | {h_id}
        for q in detail.get("quotes", []):
            if set(q["answers"]) == target and q["value"] > 0:
                results.append((raw, norm, float(q["value"])))
                break
    return results


async def _scrape_recommerce_impl(
    _client,
    model: str,
    storages: Optional[list[str]] = None,
) -> list[dict]:
    """
    Utilise Playwright pour contourner la détection headless de Recommerce.
    Récupère les prix pour 3 conditions cosmétiques (Parfait / Bon / Abimé).
    Recommerce n'a pas d'équivalent "Très bon état".
    """
    search_data: Optional[dict] = None
    product_details: dict[int, dict] = {}

    for attempt in range(3):
        try:
            search_data, product_details = await _recommerce_browser_search(model)
        except Exception as e:
            console.print(f"[red]  Recommerce erreur (tentative {attempt + 1}/3): {e}[/red]")
        if search_data is not None:
            break
        if attempt < 2:
            console.print(f"[yellow]  Recommerce: aucune réponse capturée, nouvelle tentative...[/yellow]")
            await asyncio.sleep(5)

    if search_data is None:
        console.print("[yellow]  Recommerce: aucune réponse search capturée[/yellow]")
        return []

    prefix = model + " "
    results: list[dict] = []

    for product in search_data.get("_embedded", {}).get("product", []):
        name = product.get("name", "")
        if not name.startswith(prefix):
            continue
        remainder = name[len(prefix):]
        if not re.match(r"^\d+(GB|TB)$", remainder):
            continue
        storage = "1024GB" if remainder == "1TB" else remainder
        if storages and storage not in storages:
            continue

        detail = product_details.get(product["id"])
        if detail:
            for raw, norm, price in _parse_recommerce_quotes(detail):
                results.append({
                    "source":        "Recommerce",
                    "model":         model,
                    "storage":       storage,
                    "condition":     norm,
                    "raw_condition": raw,
                    "price":         price,
                    "currency":      "EUR",
                    "url":           "https://tradein.recommerce.com/#/recommerce-fr/fr/",
                })
        else:
            # Fallback : maxPrice = Parfait état uniquement
            max_price = float(product.get("maxPrice", 0))
            if max_price > 0:
                results.append({
                    "source":        "Recommerce",
                    "model":         model,
                    "storage":       storage,
                    "condition":     "Parfait",
                    "raw_condition": "Parfait",
                    "price":         max_price,
                    "currency":      "EUR",
                    "url":           "https://tradein.recommerce.com/#/recommerce-fr/fr/",
                })

    return results


async def scrape_recommerce(
    client,
    model: str,
    storages: Optional[list[str]] = None,
) -> list[dict]:
    if sys.platform == "win32":
        try:
            loop = asyncio.get_event_loop()
            return await loop.run_in_executor(
                None,
                lambda: _run_in_new_loop(
                    _scrape_recommerce_impl(client, model, storages)
                )
            )
        except Exception as e:
            console.print(f"[red]  Recommerce erreur: {e}[/red]")
            return []
    return await _scrape_recommerce_impl(client, model, storages)


# ─── SCRAPER : EASYCASH ────────────────────────────────────────────────────────
_EC_BASE   = "https://prix.easycash.fr"
_EC_GRADES = {
    "A": ("Parfait état (A)",  "Parfait"),
    "B": ("Bon état (B)",      "Très bon état"),
    "C": ("État correct (C)",  "Bon état"),
}
_EC_HDRS = {
    "Accept":          "text/html, */*",
    "Accept-Language": "fr-FR,fr;q=0.9",
    "HX-Request":      "true",
    "Referer":         f"{_EC_BASE}/vendez/Smartphones/APPLE",
}


def _ec_parse_hrefs(hrefs: list[str], model_filter: str = "") -> dict[str, dict]:
    """Parse autocomplete hrefs into {storage_GB: info_dict}."""
    storage_map: dict[str, dict] = {}
    for href in hrefs:
        m = re.match(
            r'.*/vendez/grade/[^/]+/[^/]+/([^/]+)/([^/]+)/([^?]+)\?id=([^&]+)',
            href,
        )
        if not m:
            continue
        model_seg, color_seg, storage_seg, prod_id = m.groups()
        # Skip results from wrong models (e.g. "iPhone 16 Pro Max" when querying "iPhone 16 Pro")
        if model_filter and unquote(model_seg).lower() != model_filter.lower():
            continue
        raw = unquote(storage_seg)
        # Collapse narrow no-break space (U+202F) and other Unicode spaces to ASCII space
        raw_norm = re.sub(r"[\u00a0\u202f\u2009\u2007]+", " ", raw).strip()
        if "To" in raw_norm or re.search(r"1\s*0{3}", raw_norm):
            storage_gb = "1024GB"
        elif raw_norm.endswith(" Go"):
            num = raw_norm[:-3].strip().replace(" ", "")
            if not num.isdigit():
                continue
            storage_gb = num + "GB"
        else:
            continue
        if storage_gb not in storage_map:
            storage_map[storage_gb] = {
                "model_seg":   model_seg,
                "color_seg":   color_seg,
                "storage_seg": storage_seg,
                "prod_id":     prod_id,
            }
    return storage_map


async def _ec_autocomplete_query(s, query: str) -> list[str]:
    """Single autocomplete call, returns list of grade hrefs."""
    url = f"{_EC_BASE}/catalog/search/autocomplete/sell/{quote(query, safe='')}"
    for attempt in range(3):
        try:
            r = await s.get(url, headers=_EC_HDRS, timeout=15)
            if r.status_code == 200:
                hrefs = re.findall(
                    r'href="(https://prix\.easycash\.fr/vendez/grade/[^"]+)"', r.text
                )
                if hrefs:
                    return hrefs
        except Exception:
            pass
        if attempt < 2:
            await asyncio.sleep(3 + attempt * 2)
    return []


async def _easycash_autocomplete(s, model: str) -> dict[str, dict]:
    """Return {storage_GB: info_dict} using base query + storage-suffix fallback queries."""
    storage_map: dict[str, dict] = {}

    # Base query first — filter out wrong models (e.g. Pro Max when querying Pro)
    hrefs = await _ec_autocomplete_query(s, model)
    storage_map.update(_ec_parse_hrefs(hrefs, model_filter=model))

    # Suffix queries to find storages missed by the 6-result autocomplete cap
    missing_suffixes = [
        ("128GB",  f"{model} 128 Go"),
        ("256GB",  f"{model} 256 Go"),
        ("512GB",  f"{model} 512 Go"),
        ("1024GB", f"{model} 1 To"),
    ]
    for storage_gb, query in missing_suffixes:
        if storage_gb in storage_map:
            continue
        await asyncio.sleep(0.5)
        hrefs = await _ec_autocomplete_query(s, query)
        new = _ec_parse_hrefs(hrefs, model_filter=model)
        for k, v in new.items():
            if k not in storage_map:
                storage_map[k] = v

    return storage_map


def _easycash_parse_price(html: str) -> float:
    m = re.search(r'class="sell-price--price">\s*([\d]+[,\.][\d]+)', html)
    if m:
        return float(m.group(1).replace(",", "."))
    return 0.0


async def scrape_easycash(
    _client,
    model: str,
    storages: Optional[list[str]] = None,
) -> list[dict]:
    """
    API : GET /catalog/search/autocomplete/sell/{model}  → URLs grade par stockage
    Pour chaque stockage × 3 grades (A/B/C) → GET /vendez/fiche-produit/… → prix.
    Pas besoin de Playwright : curl_cffi suffit (les pages modèle ne sont pas bloquées).
    """
    try:
        async with CurlSession(impersonate="chrome124") as s:
            storage_map = await _easycash_autocomplete(s, model)
            if not storage_map:
                console.print("[yellow]  EasyCash: autocomplete vide[/yellow]")
                return []

            results = []
            fiche_hdrs = {
                "Accept":          "text/html",
                "Accept-Language": "fr-FR,fr;q=0.9",
                "Referer":         f"{_EC_BASE}/vendez/Smartphones/APPLE",
            }

            for storage_gb, info in storage_map.items():
                if storages and storage_gb not in storages:
                    continue
                m_seg = info["model_seg"]
                c_seg = info["color_seg"]
                s_seg = info["storage_seg"]
                pid   = info["prod_id"]

                for grade, (raw_cond, norm_cond) in _EC_GRADES.items():
                    fiche_url = (
                        f"{_EC_BASE}/vendez/fiche-produit/Smartphones/APPLE"
                        f"/{m_seg}/{c_seg}/{s_seg}?id={pid}&grade={grade}"
                    )
                    price = 0.0
                    for _att in range(3):
                        try:
                            r = await s.get(fiche_url, headers=fiche_hdrs, timeout=15)
                            if r.status_code == 200:
                                price = _easycash_parse_price(r.text)
                                break
                        except Exception:
                            pass
                        await asyncio.sleep(2)
                    if price <= 0:
                        continue
                    results.append({
                        "source":        "EasyCash",
                        "model":         model,
                        "storage":       storage_gb,
                        "condition":     norm_cond,
                        "raw_condition": raw_cond,
                        "price":         price,
                        "currency":      "EUR",
                        "url":           f"{_EC_BASE}/vendez/Smartphones/APPLE",
                    })
            return results

    except Exception as e:
        console.print(f"[red]  EasyCash erreur: {e}[/red]")
        return []


# ─── SCRAPER : CASH EXPRESS ────────────────────────────────────────────────────
_CE_START    = "https://revendre.cashexpress.fr/revente/smartphones/choisissez_votre_modele,1.html"
_CE_COTATION = "https://revendre.cashexpress.fr/achat/smartphone/session_cotation"

_CE_MODEL_MAP: dict[str, str] = {
    "iPhone 12":         "IPHONE 12 5G",
    "iPhone 12 mini":    "IPHONE 12 MINI 5G",
    "iPhone 12 Pro":     "IPHONE 12 PRO 5G",
    "iPhone 12 Pro Max": "IPHONE 12 PRO MAX 5G",
    "iPhone 13":         "IPHONE 13 5G",
    "iPhone 13 mini":    "IPHONE 13 MINI 5G",
    "iPhone 13 Pro":     "IPHONE 13 PRO 5G",
    "iPhone 13 Pro Max": "IPHONE 13 PRO MAX 5G",
    "iPhone 14":         "IPHONE 14 5G",
    "iPhone 14 Plus":    "IPHONE 14 PLUS 5G",
    "iPhone 14 Pro":     "IPHONE 14 PRO 5G",
    "iPhone 14 Pro Max": "IPHONE 14 PRO MAX 5G",
    "iPhone 15":         "IPHONE 15 5G",
    "iPhone 15 Plus":    "IPHONE 15 PLUS 5G",
    "iPhone 15 Pro":     "IPHONE 15 PRO 5G",
    "iPhone 15 Pro Max": "IPHONE 15 PRO MAX 5G",
    "iPhone 16":         "IPHONE 16 5G",
    "iPhone 16 Plus":    "IPHONE 16 PLUS 5G",
    "iPhone 16 Pro":     "IPHONE 16 PRO 5G",
    "iPhone 16 Pro Max": "IPHONE 16 PRO MAX 5G",
    "iPhone 17":         "IPHONE 17 5G",
    "iPhone 17 Plus":    "IPHONE 17 PLUS 5G",
    "iPhone 17 Pro":     "IPHONE 17 PRO 5G",
    "iPhone 17 Pro Max": "IPHONE 17 PRO MAX 5G",
}

# (raw_condition, norm_condition, qu_1, qu_2, qu_3, qu_4, qu_5, qu_6)
_CE_CONDITIONS = [
    ("Excellent état (A+)", "Parfait",       "Intact",  "Intact",  "Intact",  "Intact",  "Oui", "Oui"),
    ("Très bon état (A)",   "Très bon état", "Intact",  "Intact",  "Intact",  "Intact",  "Non", "Oui"),
    ("Bon état (B)",        "Bon état",      "Rayures", "Intact",  "Intact",  "Intact",  "Non", "Oui"),
    ("Correct (C)",         "Bon état",      "Choc",    "Intact",  "Intact",  "Intact",  "Non", "Non"),
]


def _ce_storage(gb: str) -> str:
    """Convert "128GB" → "128Go", "1024GB" → "1To"."""
    if gb == "1024GB":
        return "1To"
    return gb.replace("GB", "Go")


async def _ce_setup_model(page, model_ce: str, cap_ce: str) -> bool:
    """Navigate the 5-step Cash Express model funnel. Returns True on success."""
    try:
        await page.goto(_CE_START, wait_until="domcontentloaded", timeout=30000)
        await asyncio.sleep(2)
        await page.evaluate(
            "() => { const el=document.getElementById('__abconsent-cmp'); if(el) el.remove(); }"
        )
        await page.locator("label[for='oui_etape_0']").first.click(force=True)
        await asyncio.sleep(0.8)
        await page.locator("label[for='non_etape_1']").first.click(force=True)
        await asyncio.sleep(0.8)
        # JS click bypasses dimension constraints (element may have 0px size on return visits)
        await page.evaluate(
            "() => { document.querySelector(\"li[data-value='APPLE']\")?.click(); }"
        )
        await asyncio.sleep(1.5)
        model_js = model_ce.replace("'", "\\'")
        await page.evaluate(
            f"() => {{ document.querySelector(\"li[data-value='{model_js}']\")?.click(); }}"
        )
        await asyncio.sleep(1.5)
        cap_label = page.locator(f"label[for='{cap_ce}_etape_4']")
        if await cap_label.count() == 0:
            return False
        await cap_label.first.click(force=True)
        await asyncio.sleep(1)
        estimer = page.locator("a.modele-valide")
        if await estimer.count() == 0:
            return False
        async with page.expect_navigation(timeout=20000):
            await estimer.first.click()
        await asyncio.sleep(2)
        return True
    except Exception:
        return False


async def _ce_post_cotation(page, qu_1, qu_2, qu_3, qu_4, qu_5, qu_6) -> dict:
    body = f"qu_1={qu_1}&qu_2={qu_2}&qu_3={qu_3}&qu_4={qu_4}&qu_5={qu_5}&qu_6={qu_6}"
    raw = await page.evaluate(f"""
        async () => {{
            const r = await fetch("{_CE_COTATION}", {{
                method: "POST",
                headers: {{
                    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                    "X-Requested-With": "XMLHttpRequest",
                    "Accept": "application/json, */*"
                }},
                body: "{body}",
                credentials: "include"
            }});
            return await r.text();
        }}
    """)
    try:
        return json.loads(raw)
    except Exception:
        return {}


def _ce_parse_price(prix_raw) -> float:
    if not prix_raw:
        return 0.0
    cleaned = html_module.unescape(str(prix_raw))
    cleaned = cleaned.replace("\xa0", "").replace(" ", "").replace("€", "").replace(",", ".").strip()
    m = re.search(r"[\d]+\.[\d]+", cleaned)
    return float(m.group()) if m else 0.0


async def _ce_process_storage(
    browser, model: str, storage_gb: str, ce_model: str
) -> list[dict]:
    """Run the Cash Express funnel for one storage in its own browser context."""
    cap_ce = _ce_storage(storage_gb)
    ctx = await browser.new_context(
        viewport={"width": 1440, "height": 900},
        user_agent=(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        ),
        locale="fr-FR",
    )
    page = await ctx.new_page()
    results = []
    try:
        ok = await _ce_setup_model(page, ce_model, cap_ce)
        if not ok:
            return []
        seen_norms: dict[str, float] = {}
        for raw_cond, norm_cond, q1, q2, q3, q4, q5, q6 in _CE_CONDITIONS:
            data = await _ce_post_cotation(page, q1, q2, q3, q4, q5, q6)
            price = _ce_parse_price(data.get("prix_rachat"))
            if price <= 0:
                continue
            if price <= seen_norms.get(norm_cond, 0):
                continue
            seen_norms[norm_cond] = price
            results.append({
                "source":        "CashExpress",
                "model":         model,
                "storage":       storage_gb,
                "condition":     norm_cond,
                "raw_condition": raw_cond,
                "price":         price,
                "currency":      "EUR",
                "url":           _CE_START,
            })
    except Exception:
        pass
    finally:
        await ctx.close()
    return results


async def _scrape_cashexpress_impl(
    _client,
    model: str,
    storages: Optional[list[str]] = None,
) -> list[dict]:
    """
    Navigue le funnel Cash Express via Playwright.
    Chaque stockage utilise son propre browser context (session PHP isolée), traités séquentiellement.
    """
    ce_model = _CE_MODEL_MAP.get(model)
    if not ce_model:
        return []

    cap_list = storages or SWAPPIE_STORAGES.get(model, ["128GB", "256GB"])

    try:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-blink-features=AutomationControlled"],
            )
            storage_results = []
            for s in cap_list:
                r = await _ce_process_storage(browser, model, s, ce_model)
                storage_results.append(r)
            await browser.close()

        results = []
        for r in storage_results:
            if isinstance(r, list):
                results.extend(r)
        return results

    except Exception as e:
        console.print(f"[red]  CashExpress erreur: {e}[/red]")
        return []


async def scrape_cashexpress(
    client,
    model: str,
    storages: Optional[list[str]] = None,
) -> list[dict]:
    if sys.platform == "win32":
        try:
            loop = asyncio.get_event_loop()
            return await loop.run_in_executor(
                None,
                lambda: _run_in_new_loop(
                    _scrape_cashexpress_impl(client, model, storages)
                )
            )
        except Exception as e:
            console.print(f"[red]  CashExpress erreur: {e}[/red]")
            return []
    return await _scrape_cashexpress_impl(client, model, storages)


# ─── SCRAPER : GREENDID (FNAC REPRISE) ────────────────────────────────────────
_GD_SEARCH_URL = "https://fnac.greendid.com/searchForm"

# (raw_condition, norm_condition, IS_WORKING label, condition label, IS_RESETED, IS_GEOLOC)
_GD_CONDITIONS = [
    ("Comme neuf",    "Parfait",       "Oui", "Comme neuf",    "Oui", "Non"),
    ("Très bon état", "Très bon état", "Oui", "Très bon état", "Oui", "Non"),
    ("Bon état",      "Bon état",      "Oui", "Bon état",      "Oui", "Non"),
    ("Endommagé",     "Cassé",         "Oui", "Endommagé",     "Oui", "Non"),
]


async def _gd_dismiss_modal(page) -> None:
    for text in ["OK pour moi", "Non merci"]:
        try:
            btn = page.get_by_text(text, exact=True)
            if await btn.count() > 0:
                await btn.first.click(force=True)
                await asyncio.sleep(0.4)
        except Exception:
            pass
    await page.evaluate(
        "() => { document.querySelectorAll('.modal-mask,.modal-wrapper').forEach(e=>e.remove()); }"
    )


async def _gd_get_price_for_condition(page, basket_url: str, cond_tuple: tuple) -> float:
    """Navigate to basket page, answer conditions, click Voir mon offre, return price."""
    _raw_cond, _norm_cond, q_working, q_cond, q_reseted, q_geoloc = cond_tuple
    await page.goto(basket_url, wait_until="domcontentloaded", timeout=30000)
    try:
        await page.wait_for_load_state("networkidle", timeout=5000)
    except Exception:
        pass
    await asyncio.sleep(1)
    await _gd_dismiss_modal(page)

    label_list: list[tuple[str, str, object]] = []
    for lbl in await page.locator("label.form-option-label-grd").all():
        txt = (await lbl.inner_text()).strip()
        for_attr = await lbl.get_attribute("for") or ""
        label_list.append((txt, for_attr, lbl))

    async def click_label(target_text: str, skip_count: int = 0) -> bool:
        skipped = 0
        for txt, _, lbl in label_list:
            if txt == target_text:
                if skipped < skip_count:
                    skipped += 1
                    continue
                try:
                    await lbl.click(force=True)
                    await asyncio.sleep(0.3)
                    return True
                except Exception:
                    pass
        return False

    await click_label(q_working)         # IS_WORKING
    await asyncio.sleep(0.3)
    await click_label(q_cond)            # aesthetic condition
    await asyncio.sleep(0.3)
    await click_label(q_reseted, 1)      # IS_RESETED (second "Oui")
    await asyncio.sleep(0.3)
    # IS_GEOLOC: click the last label matching q_geoloc
    for txt, for_attr, lbl in reversed(label_list):
        if txt == q_geoloc and "GEOLOC" in for_attr:
            try:
                await lbl.click(force=True)
                await asyncio.sleep(0.3)
            except Exception:
                pass
            break

    # Click "Voir mon offre"
    voir = page.get_by_text("Voir mon offre", exact=True)
    if await voir.count() == 0:
        return 0.0
    await voir.first.click(force=True)

    # Wait until a price (€) appears — faster than a fixed 5s sleep
    try:
        await page.wait_for_function(
            r"""() => {
                const texts = Array.from(document.querySelectorAll('*'))
                    .filter(e => e.children.length === 0)
                    .map(e => (e.innerText || '').trim());
                return texts.some(t => t.includes('€') && !t.startsWith('+') && /\d/.test(t));
            }""",
            timeout=12000,
        )
    except Exception:
        await asyncio.sleep(3)

    # Parse first real price (not bonus)
    texts = await page.evaluate(r"""
        () => Array.from(document.querySelectorAll('*'))
            .filter(el => {
                const t=(el.innerText||'').trim();
                const r=el.getBoundingClientRect();
                return t && t.length < 40 && el.children.length===0
                    && r.width > 0 && r.height > 0;
            })
            .map(el => (el.innerText||'').trim())
            .filter((v,i,a) => a.indexOf(v)===i)
    """)
    for t in texts:
        if "€" in t and not t.startswith("+"):
            m = re.search(r"([\d]+(?:[,\.][\d]+)?)", t)
            if m:
                return float(m.group(1).replace(",", "."))
    return 0.0


async def _gd_process_storage(browser, model: str, storage_gb: str) -> list[dict]:
    """Search + basket + all conditions for one storage in its own browser context."""
    gd_storage = "1 To" if storage_gb == "1024GB" else storage_gb.replace("GB", " Go")
    ctx = await browser.new_context(
        viewport={"width": 1440, "height": 900},
        user_agent=(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        ),
        locale="fr-FR",
    )
    page = await ctx.new_page()
    results = []
    try:
        await page.goto(_GD_SEARCH_URL, wait_until="domcontentloaded", timeout=30000)
        await asyncio.sleep(2)
        await _gd_dismiss_modal(page)

        try:
            await page.get_by_text("Smartphones", exact=True).first.click(force=True)
            await asyncio.sleep(1.5)
        except Exception:
            return []

        search_inp = page.locator(".vs__search")
        await search_inp.click()
        await asyncio.sleep(0.3)
        await search_inp.type(f"{model} {gd_storage}", delay=80)
        await asyncio.sleep(2)

        option_text = f"IPHONE {model.upper().replace('IPHONE ', '')} | {gd_storage}"
        option = page.get_by_text(option_text, exact=False)
        if await option.count() == 0:
            option = page.locator(".vs__dropdown-option").filter(has_text=gd_storage).first
        if await option.count() == 0:
            return []

        await option.first.click(force=True)
        await asyncio.sleep(0.5)

        valider = page.get_by_text("Valider", exact=True)
        if await valider.count() == 0:
            return []
        await valider.first.click(force=True)
        await asyncio.sleep(3)
        basket_url = page.url

        if "basket" not in basket_url:
            return []

        seen_norms: dict[str, float] = {}
        for cond_tuple in _GD_CONDITIONS:
            raw_cond, norm_cond = cond_tuple[0], cond_tuple[1]
            price = await _gd_get_price_for_condition(page, basket_url, cond_tuple)
            if price <= 0:
                continue
            if price <= seen_norms.get(norm_cond, 0):
                continue
            seen_norms[norm_cond] = price
            results.append({
                "source":        "Greendid",
                "model":         model,
                "storage":       storage_gb,
                "condition":     norm_cond,
                "raw_condition": raw_cond,
                "price":         price,
                "currency":      "EUR",
                "url":           _GD_SEARCH_URL,
            })
    except Exception:
        pass
    finally:
        await ctx.close()
    return results


async def _scrape_greendid_impl(
    _client,
    model: str,
    storages: Optional[list[str]] = None,
) -> list[dict]:
    """
    Navigue le funnel Greendid/Fnac reprise via Playwright — tous les stockages en parallèle.
    Chaque stockage utilise son propre browser context (session isolée).
    Fnac verse une carte cadeau (pas d'espèces) — on scrape la valeur en euros.
    """
    cap_list = storages or SWAPPIE_STORAGES.get(model, ["128GB", "256GB"])
    try:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-blink-features=AutomationControlled"],
            )
            tasks = [_gd_process_storage(browser, model, s) for s in cap_list]
            storage_results = await asyncio.gather(*tasks, return_exceptions=True)
            await browser.close()

        results = []
        for r in storage_results:
            if isinstance(r, list):
                results.extend(r)
        return results

    except Exception as e:
        console.print(f"[red]  Greendid erreur: {e}[/red]")
        return []


async def scrape_greendid(
    client,
    model: str,
    storages: Optional[list[str]] = None,
) -> list[dict]:
    if sys.platform == "win32":
        try:
            loop = asyncio.get_event_loop()
            return await loop.run_in_executor(
                None,
                lambda: _run_in_new_loop(
                    _scrape_greendid_impl(client, model, storages)
                )
            )
        except Exception as e:
            console.print(f"[red]  Greendid erreur: {e}[/red]")
            return []
    return await _scrape_greendid_impl(client, model, storages)


# ─── SCRAPER : E-RECYCLE ──────────────────────────────────────────────────────
_ER_BASE = "https://fr.e-recycle.com"

_ER_MODEL_SLUG: dict[str, str] = {
    "iPhone 12":         "iphone-12",
    "iPhone 12 mini":    "iphone-12-mini",
    "iPhone 12 Pro":     "iphone-12-pro",
    "iPhone 12 Pro Max": "iphone-12-pro-max",
    "iPhone 13":         "iphone-13",
    "iPhone 13 mini":    "iphone-13-mini",
    "iPhone 13 Pro":     "iphone-13-pro",
    "iPhone 13 Pro Max": "iphone-13-pro-max",
    "iPhone 14":         "iphone-14",
    "iPhone 14 Plus":    "iphone-14-plus",
    "iPhone 14 Pro":     "iphone-14-pro",
    "iPhone 14 Pro Max": "iphone-14-pro-max",
    "iPhone 15":         "iphone-15",
    "iPhone 15 Plus":    "iphone-15-plus",
    "iPhone 15 Pro":     "iphone-15-pro",
    "iPhone 15 Pro Max": "iphone-15-pro-max",
    "iPhone 16":         "iphone-16",
    "iPhone 16 Plus":    "iphone-16-plus",
    "iPhone 16 Pro":     "iphone-16-pro",
    "iPhone 16 Pro Max": "iphone-16-pro-max",
    "iPhone 17":         "iphone-17",
    "iPhone 17 Plus":    "iphone-17-plus",
    "iPhone 17 Pro":     "iphone-17-pro",
    "iPhone 17 Pro Max": "iphone-17-pro-max",
}


def _er_storage_suffix(gb: str) -> str:
    return "1to" if gb == "1024GB" else gb.replace("GB", "") + "go"


def _er_parse_prices(html: str) -> list[tuple[str, str, float]]:
    """→ [(raw_cond, norm_cond, price)]  depuis l'HTML e-Recycle."""
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text)
    results: list[tuple[str, str, float]] = []
    for pat, raw, norm in (
        (r"Intact",                     "Intact",        "Parfait"),
        (r"Ray[eé]\s*/\s*Ab[iî]m[eé]", "Rayé / Abimé", "Bon état"),
        (r"[ÉéEe]cran\s+cass[eé]",     "Écran cassé",  "Cassé"),
    ):
        # Tentative 1 : "Prix de reprise {cond} {price}€"
        m = re.search(
            r"Prix\s+de\s+reprise\s+" + pat + r"\s+(\d{2,4})\s*€",
            text, re.IGNORECASE,
        )
        if m:
            results.append((raw, norm, float(m.group(1))))
            continue
        # Tentative 2 : chercher la condition puis le premier prix dans 300 chars
        m2 = re.search(pat + r".{0,300}?(\d{2,4})\s*€", text, re.IGNORECASE | re.DOTALL)
        if m2:
            price = float(m2.group(m2.lastindex))
            if price >= 5:
                results.append((raw, norm, price))
    return results


async def scrape_erecycle(
    _client,
    model: str,
    storages: Optional[list[str]] = None,
) -> list[dict]:
    """
    Prix statiques HTML, 3 conditions : Intact → Parfait | Rayé → Bon état | Cassé → Cassé.
    URL : https://fr.e-recycle.com/fr/reprise/mobile/apple/{model_slug}-{storage_suffix}
    """
    model_slug = _ER_MODEL_SLUG.get(model)
    if not model_slug:
        return []
    if storages is None:
        storages = SWAPPIE_STORAGES.get(model, ["128GB", "256GB"])
    hdrs = {
        "Accept":          "text/html,application/xhtml+xml,*/*",
        "Accept-Language": "fr-FR,fr;q=0.9",
        "Referer":         f"{_ER_BASE}/fr/reprise/mobile/apple",
    }
    results: list[dict] = []
    try:
        async with CurlSession(impersonate="chrome124") as s:
            for storage in storages:
                url = (
                    f"{_ER_BASE}/fr/reprise/mobile/apple/"
                    f"{model_slug}-{_er_storage_suffix(storage)}"
                )
                try:
                    r = await s.get(url, headers=hdrs, timeout=15)
                    if r.status_code != 200:
                        continue
                    for raw, norm, price in _er_parse_prices(r.text):
                        results.append({
                            "source":        "eRecycle",
                            "model":         model,
                            "storage":       storage,
                            "condition":     norm,
                            "raw_condition": raw,
                            "price":         price,
                            "currency":      "EUR",
                            "url":           url,
                        })
                except Exception:
                    pass
                await asyncio.sleep(0.3)
    except Exception as e:
        console.print(f"[red]  eRecycle erreur: {e}[/red]")
    return results


# ─── SCRAPER : MAGICRECYCLE ────────────────────────────────────────────────────
_MR_BASE = "https://www.magicrecycle.com"

_MR_MODEL_SLUG: dict[str, str] = {
    "iPhone 12":         "12",
    "iPhone 12 mini":    "12-mini",
    "iPhone 12 Pro":     "12-pro",
    "iPhone 12 Pro Max": "12-pro-max",
    "iPhone 13":         "13",
    "iPhone 13 mini":    "13-mini",
    "iPhone 13 Pro":     "13-pro",
    "iPhone 13 Pro Max": "13-pro-max",
    "iPhone 14":         "14",
    "iPhone 14 Plus":    "14-plus",
    "iPhone 14 Pro":     "14-pro",
    "iPhone 14 Pro Max": "14-pro-max",
    "iPhone 15":         "15",
    "iPhone 15 Plus":    "15-plus",
    "iPhone 15 Pro":     "15-pro",
    "iPhone 15 Pro Max": "15-pro-max",
    "iPhone 16":         "16",
    "iPhone 16 Plus":    "16-plus",
    "iPhone 16 Pro":     "16-pro",
    "iPhone 16 Pro Max": "16-pro-max",
    "iPhone 17":         "17",
    "iPhone 17 Plus":    "17-plus",
    "iPhone 17 Pro":     "17-pro",
    "iPhone 17 Pro Max": "17-pro-max",
}

# Ordre : patterns spécifiques avant génériques
_MR_COND_PATTERNS: list[tuple[str, str, str]] = [
    (r"Comme\s+[Nn]euf|Fonctionnel\s+comme\s+[Nn]euf", "Comme Neuf",               "Parfait"),
    (r"Fonctionnel\s+Petite\s+Panne",                   "Fonctionnel Petite Panne", "Bon état"),
    (r"Fonctionnel(?!\s+(?:comme|Petite))",              "Fonctionnel",              "Très bon état"),
    (r"Appareil\s+fissur[eé]",                          "Appareil fissuré",         "Cassé"),
]


def _mr_parse_prices(html: str) -> list[tuple[str, str, float]]:
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text)
    results: list[tuple[str, str, float]] = []
    for pat, raw, norm in _MR_COND_PATTERNS:
        m = re.search(pat, text, re.IGNORECASE)
        if not m:
            continue
        after = text[m.start(): m.start() + 350]
        pm = re.search(r"(\d{2,4})\s*€", after)
        if pm:
            price = float(pm.group(1))
            if price >= 10:
                results.append((raw, norm, price))
    return results


async def scrape_magicrecycle(
    _client,
    model: str,
    storages: Optional[list[str]] = None,
) -> list[dict]:
    """
    Prix statiques HTML, 4 conditions : Comme Neuf / Fonctionnel / Petite Panne / Fissuré.
    URL : https://www.magicrecycle.com/vendre-portable/Apple/Apple-Iphone-{slug}-{n}-GB
    """
    model_slug = _MR_MODEL_SLUG.get(model)
    if not model_slug:
        return []
    if storages is None:
        storages = SWAPPIE_STORAGES.get(model, ["128GB", "256GB"])
    hdrs = {
        "Accept":          "text/html,application/xhtml+xml,*/*",
        "Accept-Language": "fr-FR,fr;q=0.9",
        "Referer":         f"{_MR_BASE}/achat/revendre-smartphone-apple-7",
    }
    results: list[dict] = []
    try:
        async with CurlSession(impersonate="chrome124") as s:
            for storage in storages:
                storage_num = storage.replace("GB", "")
                url = (
                    f"{_MR_BASE}/vendre-portable/Apple/"
                    f"Apple-Iphone-{model_slug}-{storage_num}-GB"
                )
                try:
                    r = await s.get(url, headers=hdrs, timeout=15)
                    if r.status_code != 200:
                        continue
                    for raw, norm, price in _mr_parse_prices(r.text):
                        results.append({
                            "source":        "MagicRecycle",
                            "model":         model,
                            "storage":       storage,
                            "condition":     norm,
                            "raw_condition": raw,
                            "price":         price,
                            "currency":      "EUR",
                            "url":           url,
                        })
                except Exception:
                    pass
                await asyncio.sleep(0.3)
    except Exception as e:
        console.print(f"[red]  MagicRecycle erreur: {e}[/red]")
    return results


# ─── SCRAPER : CERTIDEAL ──────────────────────────────────────────────────────
_CD_BASE = "https://certideal.com"

_CD_MODEL_SLUG: dict[str, str] = {
    "iPhone 12":         "iphone-12",
    "iPhone 12 mini":    "iphone-12-mini",
    "iPhone 12 Pro":     "iphone-12-pro",
    "iPhone 12 Pro Max": "iphone-12-pro-max",
    "iPhone 13":         "iphone-13",
    "iPhone 13 mini":    "iphone-13-mini",
    "iPhone 13 Pro":     "iphone-13-pro",
    "iPhone 13 Pro Max": "iphone-13-pro-max",
    "iPhone 14":         "iphone-14",
    "iPhone 14 Plus":    "iphone-14-plus",
    "iPhone 14 Pro":     "iphone-14-pro",
    "iPhone 14 Pro Max": "iphone-14-pro-max",
    "iPhone 15":         "iphone-15",
    "iPhone 15 Plus":    "iphone-15-plus",
    "iPhone 15 Pro":     "iphone-15-pro",
    "iPhone 15 Pro Max": "iphone-15-pro-max",
    "iPhone 16":         "iphone-16",
    "iPhone 16 Plus":    "iphone-16-plus",
    "iPhone 16 Pro":     "iphone-16-pro",
    "iPhone 16 Pro Max": "iphone-16-pro-max",
    "iPhone 17":         "iphone-17",
    "iPhone 17 Plus":    "iphone-17-plus",
    "iPhone 17 Pro":     "iphone-17-pro",
    "iPhone 17 Pro Max": "iphone-17-pro-max",
}

_CD_HDRS = {
    "Accept":          "text/html,application/xhtml+xml,*/*",
    "Accept-Language": "fr-FR,fr;q=0.9",
    "Referer":         f"{_CD_BASE}/vendre-mon-smartphone",
}

# (screen_label, case_label, raw_condition, norm_condition)
_CD_COMBOS: list[tuple[str, str, str, str]] = [
    ("Parfait état",  "Parfait état",  "Parfait état",  "Parfait"),
    ("Très bon état", "Très bon état", "Très bon état", "Très bon état"),
    ("Correct",       "Correct",       "Correct",       "Bon état"),
    ("Cassé",         "Cassé",         "Cassé",         "Cassé"),
]

_CD_PRICE_RE = re.compile(
    r'vous\s+rac(?:hète|het).*?pour\s+([\d\s ,\.]+)\s*€',
    re.IGNORECASE | re.DOTALL,
)

_CD_DISMISS_JS = (
    "() => {"
    "  const texts = ['OK pour moi','Accepter','Tout accepter','Fermer'];"
    "  for (const t of texts) {"
    "    const b = Array.from(document.querySelectorAll('button,a,[role=\"button\"]'))"
    "      .find(el => el.textContent.trim() === t);"
    "    if (b) { b.click(); return t; }"
    "  }"
    "  return 'nothing';"
    "}"
)

_CD_CLICK_VISIBLE_JS = (
    "(text) => {"
    "  const all = Array.from(document.querySelectorAll('a.btn'));"
    "  const vis = all.filter(el => {"
    "    const r = el.getBoundingClientRect();"
    "    const s = window.getComputedStyle(el);"
    "    return r.width > 0 && r.height > 0 && s.display !== 'none';"
    "  });"
    "  const btn = vis.find(el => el.textContent.trim() === text);"
    "  if (btn) { btn.click(); return true; }"
    "  return false;"
    "}"
)


async def _certideal_get_capacity_map(model_slug: str) -> dict[str, int]:
    """Récupère {storage_GB: capacity_id} depuis la page modèle."""
    url = f"{_CD_BASE}/vendre-mon-smartphone?category={model_slug}"
    for attempt in range(2):
        try:
            async with CurlSession(impersonate="chrome124") as s:
                r = await s.get(url, headers=_CD_HDRS, timeout=15)
                if r.status_code != 200:
                    break
                html = r.text
                cap_map: dict[str, int] = {}
                for cap_id, gb_str in re.findall(
                    r'capacity=(\d+)[^"]*"[^>]*>\s*(\d{2,4})\s*[Gg][Oo]', html
                ):
                    cap_map[f"{gb_str}GB"] = int(cap_id)
                for cap_id in re.findall(
                    r'capacity=(\d+)[^"]*"[^>]*>\s*1\s*[Tt][Oo]', html
                ):
                    cap_map["1024GB"] = int(cap_id)
                if cap_map:
                    return cap_map
        except Exception:
            pass
        if attempt == 0:
            await asyncio.sleep(3)
    return {}


async def _cd_one(
    browser, model: str, model_slug: str, cap_id: int, storage: str,
    screen_label: str, case_label: str, raw_cond: str, norm_cond: str,
) -> Optional[dict]:
    """Renvoie un résultat pour une (storage, condition) donnée."""
    ctx = await browser.new_context(
        viewport={"width": 1440, "height": 900},
        locale="fr-FR",
    )
    page = await ctx.new_page()
    base_url = f"{_CD_BASE}/vendre-mon-smartphone?category={model_slug}&capacity={cap_id}"
    try:
        await page.goto(base_url, wait_until="domcontentloaded", timeout=30000)
        await asyncio.sleep(1.5)
        await page.evaluate(_CD_DISMISS_JS)
        await asyncio.sleep(1)

        async with page.expect_navigation(wait_until="domcontentloaded", timeout=15000):
            await page.evaluate(_CD_CLICK_VISIBLE_JS, "Oui")
        await asyncio.sleep(0.5)

        async with page.expect_navigation(wait_until="domcontentloaded", timeout=15000):
            await page.evaluate(_CD_CLICK_VISIBLE_JS, screen_label)
        await asyncio.sleep(0.5)

        async with page.expect_navigation(wait_until="domcontentloaded", timeout=15000):
            await page.evaluate(_CD_CLICK_VISIBLE_JS, case_label)
        await asyncio.sleep(0.8)

        body = await page.evaluate("() => document.body.innerText")
        m = _CD_PRICE_RE.search(body)
        if m:
            raw = m.group(1).replace(" ", "").replace("\xa0", "").replace(",", ".")
            price = float(raw)
            if price > 5:
                return {
                    "source":        "CertiDeal",
                    "model":         model,
                    "storage":       storage,
                    "condition":     norm_cond,
                    "raw_condition": raw_cond,
                    "price":         price,
                    "currency":      "EUR",
                    "url":           base_url,
                }
    except Exception:
        pass
    finally:
        await ctx.close()
    return None


async def _scrape_certideal_impl(
    _client,
    model: str,
    storages: Optional[list[str]] = None,
) -> list[dict]:
    """
    CertiDeal via Playwright.
    Formulaire 3 clics : Oui → état écran → état coque.
    Contexte isolé par condition pour éviter le cache serveur.
    """
    model_slug = _CD_MODEL_SLUG.get(model)
    if not model_slug:
        return []
    if storages is None:
        storages = SWAPPIE_STORAGES.get(model, ["128GB", "256GB"])

    cap_map = await _certideal_get_capacity_map(model_slug)
    if not cap_map:
        console.print(f"[yellow]  CertiDeal: aucun capacity ID pour {model}[/yellow]")
        return []

    try:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-blink-features=AutomationControlled"],
            )
            tasks = []
            for storage in storages:
                cap_id = cap_map.get(storage)
                if cap_id is None:
                    continue
                for screen_lbl, case_lbl, raw_cond, norm_cond in _CD_COMBOS:
                    tasks.append(_cd_one(
                        browser, model, model_slug, cap_id, storage,
                        screen_lbl, case_lbl, raw_cond, norm_cond,
                    ))
            results = await asyncio.gather(*tasks, return_exceptions=True)
            await browser.close()

        return [r for r in results if isinstance(r, dict)]
    except Exception as e:
        console.print(f"[red]  CertiDeal erreur: {e}[/red]")
        return []


async def scrape_certideal(
    client,
    model: str,
    storages: Optional[list[str]] = None,
) -> list[dict]:
    if sys.platform == "win32":
        try:
            loop = asyncio.get_event_loop()
            return await loop.run_in_executor(
                None,
                lambda: _run_in_new_loop(
                    _scrape_certideal_impl(client, model, storages)
                )
            )
        except Exception as e:
            console.print(f"[red]  CertiDeal erreur: {e}[/red]")
            return []
    return await _scrape_certideal_impl(client, model, storages)


# ─── SCRAPER : ASGOODASNEW ────────────────────────────────────────────────────
_AGAA_BASE = "https://vendre.asgoodasnew.fr"

_AGAA_MODEL_SLUG: dict[str, str] = {
    "iPhone 12":         "iphone-12",
    "iPhone 12 mini":    "iphone-12-mini",
    "iPhone 12 Pro":     "iphone-12-pro",
    "iPhone 12 Pro Max": "iphone-12-pro-max",
    "iPhone 13":         "iphone-13",
    "iPhone 13 mini":    "iphone-13-mini",
    "iPhone 13 Pro":     "iphone-13-pro",
    "iPhone 13 Pro Max": "iphone-13-pro-max",
    "iPhone 14":         "iphone-14",
    "iPhone 14 Plus":    "iphone-14-plus",
    "iPhone 14 Pro":     "iphone-14-pro",
    "iPhone 14 Pro Max": "iphone-14-pro-max",
    "iPhone 15":         "iphone-15",
    "iPhone 15 Plus":    "iphone-15-plus",
    "iPhone 15 Pro":     "iphone-15-pro",
    "iPhone 15 Pro Max": "iphone-15-pro-max",
    "iPhone 16":         "iphone-16",
    "iPhone 16 Plus":    "iphone-16-plus",
    "iPhone 16 Pro":     "iphone-16-pro",
    "iPhone 16 Pro Max": "iphone-16-pro-max",
    "iPhone 17":         "iphone-17",
    "iPhone 17 Plus":    "iphone-17-plus",
    "iPhone 17 Pro":     "iphone-17-pro",
    "iPhone 17 Pro Max": "iphone-17-pro-max",
}


def _agaa_storage_suffix(gb: str) -> str:
    return "1-to" if gb == "1024GB" else gb.replace("GB", "") + "-go"


# (aesthetic_label, raw_cond, norm_cond)  — ordered from best to worst
_AGAA_AESTHETICS: list[tuple[str, str, str]] = [
    ("Neuf",       "Neuf",       "Parfait"),
    ("Comme neuf", "Comme neuf", "Parfait"),
    ("Bon",        "Bon",        "Très bon état"),
    ("Correct",    "Correct",    "Bon état"),
    ("Mauvais",    "Mauvais",    "Cassé"),
]

_AGAA_DISMISS_JS = (
    "() => {"
    "  const texts = ['Accepter tout','Accepter','Tout accepter'];"
    "  for (const t of texts) {"
    "    const b = Array.from(document.querySelectorAll('button,a,[role=\"button\"]'))"
    "      .find(el => (el.textContent||'').trim() === t);"
    "    if (b) { b.click(); return t; }"
    "  }"
    "  return 'nothing';"
    "}"
)

_AGAA_CLICK_OUI_JS = (
    "() => {"
    "  const vis = Array.from(document.querySelectorAll('button')).filter(el => {"
    "    const r = el.getBoundingClientRect();"
    "    const s = window.getComputedStyle(el);"
    "    return r.width > 0 && r.height > 0 && s.display !== 'none';"
    "  });"
    "  const oui = vis.filter(el => (el.textContent||'').trim() === 'Oui');"
    "  oui.forEach(el => el.click());"
    "  return oui.length;"
    "}"
)

_AGAA_CLICK_COND_JS = (
    "(text) => {"
    "  const all = Array.from(document.querySelectorAll('*'));"
    "  const el = all.find(e => (e.textContent||'').trim() === text && e.children.length === 0);"
    "  if (el) { el.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})); el.click(); return true; }"
    "  return false;"
    "}"
)

_AGAA_PRICE_JS = (
    "() => {"
    "  const body = document.body.innerText;"
    "  const m = body.match(/Notre prix[\\s\\xA0]*:?[\\s\\xA0]*([\\d,\\.]+)\\s*€/);"
    "  if (m && m[1] !== '0,00' && m[1] !== '0') return m[1];"
    "  return '';"
    "}"
)


async def _agaa_one_storage(
    browser, model: str, storage: str, product_url: str
) -> list[dict]:
    ctx = await browser.new_context(
        viewport={"width": 1440, "height": 900},
        user_agent=(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        ),
        locale="fr-FR",
    )
    await ctx.add_init_script(
        "Object.defineProperty(navigator, 'webdriver', {get: () => undefined});"
    )
    page = await ctx.new_page()
    results: list[dict] = []

    try:
        await page.goto(product_url, wait_until="domcontentloaded", timeout=30000)
        await asyncio.sleep(3)

        await page.evaluate(_AGAA_DISMISS_JS)
        await asyncio.sleep(1.5)

        # Click all visible "Oui" buttons (there are 3 functional questions)
        for _ in range(3):
            await page.evaluate(_AGAA_CLICK_OUI_JS)
            await asyncio.sleep(0.5)
        await asyncio.sleep(1)

        # Each aesthetic level updates the price dynamically — no reload needed
        seen_norms: dict[str, float] = {}
        for label, raw_cond, norm_cond in _AGAA_AESTHETICS:
            ok = await page.evaluate(_AGAA_CLICK_COND_JS, label)
            if not ok:
                continue
            await asyncio.sleep(1.2)
            raw_price = await page.evaluate(_AGAA_PRICE_JS)
            if not raw_price:
                continue
            try:
                price = float(raw_price.replace(",", "."))
            except Exception:
                continue
            if price > 10 and price > seen_norms.get(norm_cond, 0):
                seen_norms[norm_cond] = price
                results.append({
                    "source":        "Asgoodasnew",
                    "model":         model,
                    "storage":       storage,
                    "condition":     norm_cond,
                    "raw_condition": raw_cond,
                    "price":         price,
                    "currency":      "EUR",
                    "url":           product_url,
                })
    except Exception as e:
        console.print(f"[yellow]  Asgoodasnew skip {storage}: {e}[/yellow]")
    finally:
        await ctx.close()
    return results


async def _scrape_asgoodasnew_impl(
    _client,
    model: str,
    storages: Optional[list[str]] = None,
) -> list[dict]:
    """
    Asgoodasnew via Playwright.
    Clique les 3 questions fonctionnelles (Oui), puis sélectionne chaque
    niveau esthétique (conditionSlider__rangeitem) pour lire le prix dynamique.
    """
    model_slug = _AGAA_MODEL_SLUG.get(model)
    if not model_slug:
        return []
    if storages is None:
        storages = SWAPPIE_STORAGES.get(model, ["128GB", "256GB"])

    try:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-blink-features=AutomationControlled"],
            )
            tasks = [
                _agaa_one_storage(
                    browser, model, storage,
                    f"{_AGAA_BASE}/produits/apple-{model_slug}-{_agaa_storage_suffix(storage)}",
                )
                for storage in storages
            ]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            await browser.close()

        all_results: list[dict] = []
        for r in results:
            if isinstance(r, list):
                all_results.extend(r)
        return all_results
    except Exception as e:
        console.print(f"[red]  Asgoodasnew erreur: {e}[/red]")
        return []


async def scrape_asgoodasnew(
    client,
    model: str,
    storages: Optional[list[str]] = None,
) -> list[dict]:
    if sys.platform == "win32":
        try:
            loop = asyncio.get_event_loop()
            return await loop.run_in_executor(
                None,
                lambda: _run_in_new_loop(
                    _scrape_asgoodasnew_impl(client, model, storages)
                )
            )
        except Exception as e:
            console.print(f"[red]  Asgoodasnew erreur: {e}[/red]")
            return []
    return await _scrape_asgoodasnew_impl(client, model, storages)


# ─── REGISTRE DES SCRAPERS ─────────────────────────────────────────────────────
# Pour ajouter un site : créer scrape_X() et l'ajouter ici.
# Tous les scrapers s'exécutent en parallèle via asyncio.gather().
SCRAPERS: dict[str, dict] = {
    "Swappie":      {"fn": scrape_swappie,      "playwright": False},
    "BackMarket":   {"fn": scrape_backmarket,   "playwright": False},
    "EasyCash":     {"fn": scrape_easycash,     "playwright": False},
    "eRecycle":     {"fn": scrape_erecycle,     "playwright": False},
    "MagicRecycle": {"fn": scrape_magicrecycle, "playwright": False},
    "Recommerce":   {"fn": scrape_recommerce,   "playwright": True},
    "CashExpress":  {"fn": scrape_cashexpress,  "playwright": True},
    "Greendid":     {"fn": scrape_greendid,     "playwright": True},
    "CertiDeal":    {"fn": scrape_certideal,    "playwright": True},
    "Asgoodasnew":  {"fn": scrape_asgoodasnew,  "playwright": True},
}


# ─── AGRÉGATION ────────────────────────────────────────────────────────────────
def build_comparison(
    all_results: list[dict],
) -> dict[str, dict[str, dict[str, float]]]:
    """
    Construit {storage: {condition_normalisée: {source: prix_max}}}.
    Si plusieurs raw conditions mappent à la même condition normalisée (ex : Swappie
    Neuf scellé + Comme neuf → Parfait), on conserve le prix MAX (le plus favorable
    pour le vendeur).
    """
    comp: dict[str, dict[str, dict[str, float]]] = {}
    for r in all_results:
        s, cond, src, price = r["storage"], r["condition"], r["source"], r["price"]
        if not s or price <= 0:
            continue
        comp.setdefault(s, {}).setdefault(cond, {})
        comp[s][cond][src] = max(comp[s][cond].get(src, 0), price)
    return comp


# ─── AFFICHAGE ─────────────────────────────────────────────────────────────────
SOURCE_COLORS = {
    "Swappie":      "cyan",
    "BackMarket":   "green",
    "Recommerce":   "blue",
    "EasyCash":     "yellow",
    "CashExpress":  "magenta",
    "Greendid":     "red",
    "eRecycle":     "bright_cyan",
    "MagicRecycle": "bright_green",
    "CertiDeal":    "bright_magenta",
    "Asgoodasnew":  "bright_yellow",
}


def print_results(
    model: str,
    comparison: dict[str, dict[str, dict[str, float]]],
    sources_present: list[str],
) -> None:
    if not comparison:
        console.print("[red]Aucun résultat.[/red]")
        return

    all_storages = sorted(
        comparison.keys(),
        key=lambda s: int(s.replace("GB", "").replace("TB", "000")),
    )

    # Colonnes : groupées par source, dans l'ordre des conditions standardisées
    cols: list[tuple[str, str]] = []
    for src in sources_present:
        for cond in STANDARD_CONDITIONS:
            if any(comparison[s].get(cond, {}).get(src) for s in all_storages):
                cols.append((src, cond))

    t = Table(
        title=f"[bold]Rachat — {model}[/bold]",
        box=box.ROUNDED,
        header_style="bold white",
    )
    t.add_column("Stockage", style="bold white", min_width=9)
    for src, cond in cols:
        color = SOURCE_COLORS.get(src, "white")
        t.add_column(
            f"[{color}]{src}[/{color}]\n{cond}",
            justify="right",
            min_width=11,
        )

    for storage in all_storages:
        row = [storage]
        for src, cond in cols:
            p = comparison[storage].get(cond, {}).get(src)
            row.append(f"{p:.0f} €" if p else "—")
        t.add_row(*row)

    console.print(t)
    console.print()


# ─── CACHE ─────────────────────────────────────────────────────────────────────
_CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cache")
_CACHE_TTL  = 7200  # secondes — 2 heures par défaut


def _cache_path(model: str) -> str:
    slug = model.lower().replace(" ", "_")
    os.makedirs(_CACHE_DIR, exist_ok=True)
    return os.path.join(_CACHE_DIR, f"{slug}.json")


def _cache_load(model: str, max_age: int = _CACHE_TTL) -> Optional[dict]:
    """Retourne les données du cache si elles existent et sont fraîches."""
    path = _cache_path(model)
    if not os.path.exists(path):
        return None
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        scraped_at = datetime.fromisoformat(data["scraped_at"])
        age = (datetime.now(timezone.utc) - scraped_at).total_seconds()
        return data if age <= max_age else None
    except Exception:
        return None


def _cache_save(data: dict) -> None:
    with open(_cache_path(data["model"]), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


# ─── EXPORT / BUILD OUTPUT ─────────────────────────────────────────────────────
def build_output(
    model: str,
    all_results: list[dict],
    comparison: dict[str, dict[str, dict[str, float]]],
) -> dict:
    """
    Construit le dict de résultats — format orienté API web.

    Clés principales :
      scraped_at  : horodatage ISO 8601 UTC
      model       : modèle recherché
      conditions  : 4 conditions standardisées
      storages    : liste des stockages disponibles
      comparison  : {storage → {condition → {source → prix}}}
      raw         : liste brute de tous les prix
    """
    storages = sorted(
        comparison.keys(),
        key=lambda s: int(s.replace("GB", "").replace("TB", "000")),
    )
    sources = sorted({r["source"] for r in all_results})
    return {
        "scraped_at": datetime.now(timezone.utc).isoformat(),
        "model":      model,
        "sources":    sources,
        "conditions": STANDARD_CONDITIONS,
        "storages":   storages,
        "comparison": {
            storage: {
                cond: comparison[storage][cond]
                for cond in STANDARD_CONDITIONS
                if comparison[storage].get(cond)
            }
            for storage in storages
        },
        "raw": all_results,
    }


# ─── API PUBLIQUE ───────────────────────────────────────────────────────────────
async def _run_scrape(
    model: str,
    storages: Optional[list[str]] = None,
) -> dict:
    """Lance tous les scrapers et retourne le dict de résultats prêt à cacher."""
    all_results: list[dict] = []
    async with httpx.AsyncClient(
        verify=False, follow_redirects=True, http2=True, timeout=20
    ) as client:
        src_keys = list(SCRAPERS.keys())
        all_res = await asyncio.gather(
            *[cfg["fn"](client, model, storages) for cfg in SCRAPERS.values()],
            return_exceptions=True,
        )
        for src, res in zip(src_keys, all_res):
            if isinstance(res, list) and res:
                all_results.extend(res)
            elif isinstance(res, Exception):
                console.print(f"[red]ERREUR {src}: {res}[/red]")
    comparison = build_comparison(all_results)
    return build_output(model, all_results, comparison)


async def search(
    model: str,
    storages: Optional[list[str]] = None,
    max_cache_age: int = _CACHE_TTL,
    force_refresh: bool = False,
) -> dict:
    """
    Point d'entrée pour intégration web. Retourne les prix en <100ms si cache valide.

    Exemple FastAPI :
        from scraper import search

        @app.get("/prices/{model}")
        async def prices(model: str):
            return await search(model)
    """
    model_match = next(
        (m for m in SWAPPIE_MODELS if model.lower() == m.lower()),
        next((m for m in SWAPPIE_MODELS if model.lower() in m.lower()), None),
    )
    if not model_match:
        raise ValueError(f"Modèle inconnu : {model}")

    if not force_refresh:
        cached = _cache_load(model_match, max_age=max_cache_age)
        if cached:
            return cached

    data = await _run_scrape(model_match, storages)
    _cache_save(data)
    return data


# ─── MAIN ──────────────────────────────────────────────────────────────────────
async def main() -> None:
    args = sys.argv[1:]

    if "--list-models" in args:
        console.print("[bold]Modèles supportés :[/bold]")
        for m in SWAPPIE_MODELS:
            console.print(f"  {m:<30} {', '.join(SWAPPIE_STORAGES.get(m, []))}")
        return

    if "--discover-models" in args:
        console.print("[bold cyan]Auto-détection des modèles via BackMarket...[/bold cyan]")
        models = await discover_models_backmarket()
        console.print(f"[green]{len(models)} modèles détectés :[/green]")
        for m in models:
            console.print(f"  {m}")
        return

    if "--warm-cache" in args:
        console.print("[bold cyan]Préchauffage du cache pour tous les modèles...[/bold cyan]")
        for m in SWAPPIE_MODELS:
            console.print(f"\n[bold]{m}[/bold]")
            try:
                data = await _run_scrape(m)
                _cache_save(data)
                console.print(f"[green]  OK — {len(data['raw'])} prix mis en cache[/green]")
            except Exception as e:
                console.print(f"[red]  ERREUR : {e}[/red]")
        return

    no_cache = "--no-cache" in args
    args = [a for a in args if a not in ("--no-cache",)]

    storages: Optional[list[str]] = None
    if "--storage" in args:
        idx = args.index("--storage")
        storages = [a for a in args[idx + 1:] if not a.startswith("--")]
        args = [a for a in args if a not in ["--storage"] + (storages or [])]

    model = " ".join(a for a in args if not a.startswith("--")).strip() or None

    if not model:
        console.print("[bold cyan]iPhone Resale Price Scraper[/bold cyan]")
        console.print("\nModèles disponibles :")
        for i, m in enumerate(SWAPPIE_MODELS, 1):
            console.print(f"  [{i:2d}] {m}")
        console.print()
        model = console.input("[bold]Modèle (ex: iPhone 15 Pro) :[/bold] ").strip()

    if not model:
        console.print("[red]Aucun modèle spécifié.[/red]")
        return

    model_match = next(
        (m for m in SWAPPIE_MODELS if model.lower() == m.lower()),
        next((m for m in SWAPPIE_MODELS if model.lower() in m.lower()), model),
    )

    # ── Vérification du cache ───────────────────────────────────────────────────
    if not no_cache:
        cached = _cache_load(model_match)
        if cached:
            age_min = int((datetime.now(timezone.utc) -
                           datetime.fromisoformat(cached["scraped_at"])).total_seconds() // 60)
            console.print(f"\n[bold cyan]Recherche : {model_match}[/bold cyan]")
            console.print(f"[dim]Cache valide ({age_min} min) — résultat instantané[/dim]\n")
            comparison = build_comparison(cached["raw"])
            sources_present = cached.get("sources", [])
            print_results(model_match, comparison, sources_present)
            return

    # ── Scraping complet ────────────────────────────────────────────────────────
    console.print(f"\n[bold cyan]Recherche : {model_match}[/bold cyan]")
    if storages:
        console.print(f"[dim]Stockages : {', '.join(storages)}[/dim]")
    console.print()

    all_results: list[dict] = []
    sources_present: list[str] = []

    async with httpx.AsyncClient(
        verify=False, follow_redirects=True, http2=True, timeout=20
    ) as client:
        src_keys = list(SCRAPERS.keys())
        all_res = await asyncio.gather(
            *[cfg["fn"](client, model_match, storages) for cfg in SCRAPERS.values()],
            return_exceptions=True,
        )
        for src, res in zip(src_keys, all_res):
            if isinstance(res, Exception):
                console.print(f"[red]ERREUR {src}: {res}[/red]")
            elif res:
                console.print(f"[green]OK {src}: {len(res)} prix[/green]")
                all_results.extend(res)
                sources_present.append(src)

    console.print()
    comparison = build_comparison(all_results)
    print_results(model_match, comparison, sources_present)

    if not no_cache:
        data = build_output(model_match, all_results, comparison)
        _cache_save(data)
        console.print(f"[dim]Cache mis a jour -> cache/{model_match.lower().replace(' ', '_')}.json[/dim]")


if __name__ == "__main__":
    asyncio.run(main())
