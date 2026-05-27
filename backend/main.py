import sys
import os
import hmac
import json
import asyncio
import logging
import httpx
from datetime import datetime, timezone
from pathlib import Path
from contextlib import asynccontextmanager

sys.path.insert(0, str(Path(__file__).parent.parent / "scrapper"))

from fastapi import FastAPI, Query, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional
from dotenv import load_dotenv
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

load_dotenv()

from scraper import search, SWAPPIE_MODELS, SWAPPIE_STORAGES, STANDARD_CONDITIONS

limiter = Limiter(key_func=get_remote_address)
from cache_manager import cache_read, cache_read_stale, cache_write, cache_status, CACHE_DIR
from scheduler import start_scheduler
from ai_generator import generate_listing

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("main")

PRICES_FILE = Path(__file__).parent / "prices.json"
RESALE_PRICES_FILE = Path(__file__).parent / "resale_prices.json"
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")

# Tracks progress of the current full cache refresh
refresh_state: dict = {
    "running": False,
    "current_model": None,
    "progress": 0,
    "total": 0,
    "success": 0,
    "errors": 0,
    "started_at": None,
    "finished_at": None,
}


async def refresh_single(model: str) -> None:
    """Scrape one model with all its storages."""
    try:
        storages = SWAPPIE_STORAGES.get(model)
        data = await search(model, storages=storages, force_refresh=True)
        cache_write(data)
        logger.info(f"Cache refreshed: {model} — {len(data['raw'])} prices")
    except Exception as e:
        logger.error(f"Refresh error {model}: {e}")


async def refresh_all() -> None:
    """
    Scrape ALL models with ALL their storages.
    Sequential with 3s pause between models to avoid overloading scrapers.
    """
    total = len(SWAPPIE_MODELS)
    refresh_state["running"] = True
    refresh_state["current_model"] = None
    refresh_state["progress"] = 0
    refresh_state["total"] = total
    refresh_state["success"] = 0
    refresh_state["errors"] = 0
    refresh_state["started_at"] = datetime.now(timezone.utc).isoformat()
    refresh_state["finished_at"] = None

    logger.info(f"Full cache refresh started — {total} models to scrape")

    for i, model in enumerate(SWAPPIE_MODELS, 1):
        refresh_state["current_model"] = model
        try:
            storages = SWAPPIE_STORAGES.get(model)
            logger.info(
                f"[{i}/{total}] Scraping {model} "
                f"({len(storages) if storages else '?'} storages)..."
            )
            data = await search(model, storages=storages, force_refresh=True)
            cache_write(data)
            sources = data.get("sources", [])
            logger.info(
                f"  ✓ {model} — {len(data['raw'])} prices "
                f"from {len(sources)} sources: {', '.join(sources)}"
            )
            refresh_state["success"] += 1
        except Exception as e:
            logger.error(f"  ✗ {model}: {e}")
            refresh_state["errors"] += 1

        refresh_state["progress"] = i

        if i < total:
            await asyncio.sleep(3)

    refresh_state["running"] = False
    refresh_state["current_model"] = None
    refresh_state["finished_at"] = datetime.now(timezone.utc).isoformat()
    logger.info(
        f"Full refresh complete — "
        f"{refresh_state['success']}/{total} models OK, "
        f"{refresh_state['errors']} errors"
    )


async def warm_cache_if_empty() -> None:
    """On first startup, scrape models that have no cache file at all."""
    missing = [
        m for m in SWAPPIE_MODELS
        if not (CACHE_DIR / (m.lower().replace(" ", "_") + ".json")).exists()
    ]
    if not missing:
        return
    logger.info(f"Warming cache for {len(missing)} models with no cache...")
    for model in missing:
        try:
            data = await search(model)
            cache_write(data)
            await asyncio.sleep(2)
        except Exception as e:
            logger.error(f"Warm cache error {model}: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler = start_scheduler()
    asyncio.create_task(warm_cache_if_empty())
    yield
    scheduler.shutdown()


app = FastAPI(lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def load_prices() -> dict:
    if PRICES_FILE.exists():
        return json.loads(PRICES_FILE.read_text(encoding="utf-8"))
    return {}


def save_prices(data: dict):
    PRICES_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def generate_default_resale_prices() -> dict:
    BASE = {
        "Parfait":       430,
        "Très bon état": 410,
        "Bon état":      350,
        "Cassé":         220,
    }
    MODEL_MULTIPLIERS = {
        "iPhone 12":         0.38,
        "iPhone 12 mini":    0.33,
        "iPhone 12 Pro":     0.48,
        "iPhone 12 Pro Max": 0.52,
        "iPhone 13":         0.52,
        "iPhone 13 mini":    0.45,
        "iPhone 13 Pro":     0.65,
        "iPhone 13 Pro Max": 0.70,
        "iPhone 14":         0.72,
        "iPhone 14 Plus":    0.75,
        "iPhone 14 Pro":     1.00,
        "iPhone 14 Pro Max": 1.10,
        "iPhone 15":         0.85,
        "iPhone 15 Plus":    0.88,
        "iPhone 15 Pro":     1.15,
        "iPhone 15 Pro Max": 1.25,
        "iPhone 16":         1.05,
        "iPhone 16 Plus":    1.08,
        "iPhone 16 Pro":     1.30,
        "iPhone 16 Pro Max": 1.40,
        "iPhone 17":         1.20,
        "iPhone 17 Plus":    1.22,
        "iPhone 17 Pro":     1.45,
        "iPhone 17 Pro Max": 1.55,
    }
    STORAGE_MULTIPLIERS = {
        "64GB":   0.90,
        "128GB":  1.00,
        "256GB":  1.12,
        "512GB":  1.25,
        "1024GB": 1.40,
    }

    prices = {}
    for model in SWAPPIE_MODELS:
        model_mult = MODEL_MULTIPLIERS.get(model, 1.0)
        storages = SWAPPIE_STORAGES.get(model, ["128GB"])
        for storage in storages:
            storage_mult = STORAGE_MULTIPLIERS.get(storage, 1.0)
            for condition in STANDARD_CONDITIONS:
                base = BASE[condition]
                price = round(base * model_mult * storage_mult / 5) * 5
                price = max(price, 20)
                key = f"{model}_{storage}_{condition}"
                prices[key] = price
    return prices


def load_resale_prices() -> dict:
    if RESALE_PRICES_FILE.exists():
        return json.loads(RESALE_PRICES_FILE.read_text(encoding="utf-8"))
    return generate_default_resale_prices()


def save_resale_prices(data: dict):
    RESALE_PRICES_FILE.write_text(
        json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def verify_admin(authorization: str | None) -> bool:
    if not authorization:
        return False
    token = authorization.removeprefix("Bearer ")
    return hmac.compare_digest(token, ADMIN_PASSWORD)


def validate_model(model: str) -> str:
    match = next((m for m in SWAPPIE_MODELS if m.lower() == model.lower()), None)
    if not match:
        raise HTTPException(status_code=400, detail=f"Modèle invalide: {model}")
    return match


def validate_storage(model: str, storage: str) -> str:
    valid = SWAPPIE_STORAGES.get(model, [])
    if storage not in valid:
        raise HTTPException(status_code=400, detail=f"Capacité invalide: {storage}")
    return storage


def validate_condition(condition: str) -> str:
    if condition not in STANDARD_CONDITIONS:
        raise HTTPException(status_code=400, detail=f"État invalide: {condition}")
    return condition


@app.get("/api/models")
async def get_models():
    return {
        "models": SWAPPIE_MODELS,
        "storages": SWAPPIE_STORAGES,
        "conditions": STANDARD_CONDITIONS,
    }


@app.get("/api/prices/{model}")
@limiter.limit("30/minute")
async def get_prices(request: Request, model: str, storages: list[str] | None = Query(None)):
    model = validate_model(model)

    cached = cache_read(model)
    if cached:
        logger.info(f"Cache hit for {model}")
        return cached

    logger.info(f"Cache miss for {model} — scraping now")
    try:
        data = await search(model, storages=storages, force_refresh=True)
        cache_write(data)
        return data
    except Exception as e:
        logger.error(f"Scraping error for {model}: {e}")
        stale = cache_read_stale(model)
        if stale:
            stale["stale"] = True
            stale["warning"] = "Données non actualisées — affichage du dernier cache disponible."
            logger.info(f"Returning stale cache for {model}")
            return stale
        raise HTTPException(
            status_code=503,
            detail="Prix temporairement indisponibles. Réessayez dans quelques minutes."
        )


@app.get("/api/phonespot-price")
@limiter.limit("60/minute")
async def get_phonespot_price(
    request: Request,
    model: str = Query(...),
    storage: str = Query(...),
    condition: str = Query(...),
):
    model = validate_model(model)
    storage = validate_storage(model, storage)
    condition = validate_condition(condition)
    prices = load_prices()
    key = f"{model}_{storage}_{condition}"
    prix = prices.get(key)
    return {"prix": prix}


@app.get("/api/resale-prices")
@limiter.limit("60/minute")
async def get_resale_prices(
    request: Request,
    model: str = Query(...),
    storage: str = Query(...),
    condition: str = Query(...),
):
    model = validate_model(model)
    storage = validate_storage(model, storage)
    condition = validate_condition(condition)
    prices = load_resale_prices()
    key = f"{model}_{storage}_{condition}"
    prix = prices.get(key)
    return {"prix": prix}


@app.get("/api/admin/resale-prices")
async def admin_get_resale_prices(authorization: Optional[str] = Header(None)):
    if not verify_admin(authorization):
        raise HTTPException(status_code=401, detail="Non autorisé")
    return load_resale_prices()


@app.post("/api/admin/resale-prices")
async def admin_set_resale_prices(
    prices: dict,
    authorization: Optional[str] = Header(None),
):
    if not verify_admin(authorization):
        raise HTTPException(status_code=401, detail="Non autorisé")
    save_resale_prices(prices)
    return {"success": True}


@app.post("/api/admin/resale-prices/reset")
async def admin_reset_resale_prices(authorization: Optional[str] = Header(None)):
    if not verify_admin(authorization):
        raise HTTPException(status_code=401, detail="Non autorisé")
    defaults = generate_default_resale_prices()
    save_resale_prices(defaults)
    return {"success": True, "count": len(defaults)}


@app.get("/api/barometre")
async def barometre():
    from cache_manager import CACHE_DIR
    import json
    from pathlib import Path

    best = None
    best_score = 0

    if not CACHE_DIR.exists():
        return {"available": False}

    for path in CACHE_DIR.glob("*.json"):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            comparison = data.get("comparison", {})
            model = data.get("model", "")
            sources = data.get("sources", [])

            for storage, conditions in comparison.items():
                for condition, prices in conditions.items():
                    if condition == "Cassé":
                        continue
                    score = len(prices)
                    max_price = max(prices.values()) if prices else 0
                    if score > best_score or (score == best_score and max_price > (best["max_price"] if best else 0)):
                        best_score = score
                        best_source = max(prices, key=prices.get)
                        best = {
                            "model": model,
                            "storage": storage,
                            "condition": condition,
                            "max_price": max_price,
                            "best_source": best_source,
                            "sources_count": len(sources),
                            "scraped_at": data.get("scraped_at"),
                        }
        except Exception:
            continue

    if not best:
        return {"available": False}

    return {"available": True, **best}


ALLOWED_PLATFORMS = {"Leboncoin", "Facebook Marketplace", "Vinted", "eBay"}


class ListingRequest(BaseModel):
    model: str
    storage: str
    condition: str
    battery: int = Field(..., ge=0, le=100)
    prix_max: float = Field(..., ge=0)
    platform: str = "Leboncoin"


@app.post("/api/listing")
@limiter.limit("10/minute")
async def create_listing(request: Request, req: ListingRequest):
    model = validate_model(req.model)
    storage = validate_storage(model, req.storage)
    condition = validate_condition(req.condition)
    if req.platform not in ALLOWED_PLATFORMS:
        raise HTTPException(status_code=400, detail=f"Plateforme invalide: {req.platform}")
    try:
        result = await generate_listing(
            model=model,
            storage=storage,
            condition=condition,
            battery=req.battery,
            prix_max=req.prix_max,
            platform=req.platform,
        )
        return result
    except Exception as e:
        logger.error(f"Listing generation error: {e}")
        raise HTTPException(status_code=500, detail="Une erreur interne est survenue.")


@app.get("/api/admin/prices")
async def admin_get_prices(authorization: Optional[str] = Header(None)):
    if not verify_admin(authorization):
        raise HTTPException(status_code=401, detail="Non autorisé")
    return load_prices()


@app.post("/api/admin/prices")
async def admin_set_prices(
    prices: dict,
    authorization: Optional[str] = Header(None),
):
    if not verify_admin(authorization):
        raise HTTPException(status_code=401, detail="Non autorisé")
    save_prices(prices)
    return {"success": True}


@app.get("/api/admin/cache-status")
async def get_cache_status(authorization: Optional[str] = Header(None)):
    if not verify_admin(authorization):
        raise HTTPException(status_code=401, detail="Non autorisé")
    return {"models": cache_status()}


@app.post("/api/admin/cache-refresh")
async def trigger_refresh(
    model: Optional[str] = None,
    authorization: Optional[str] = Header(None),
):
    if not verify_admin(authorization):
        raise HTTPException(status_code=401, detail="Non autorisé")

    if model:
        model = validate_model(model)
        asyncio.create_task(refresh_single(model))
        return {"status": "refresh_started", "scope": model}
    else:
        asyncio.create_task(refresh_all())
        return {"status": "refresh_started", "scope": "all"}


@app.get("/api/admin/cache-refresh-status")
async def get_refresh_status(authorization: Optional[str] = Header(None)):
    if not verify_admin(authorization):
        raise HTTPException(status_code=401, detail="Non autorisé")
    return refresh_state


@app.get("/api/admin/ai-status")
async def ai_status(authorization: Optional[str] = Header(None)):
    if not verify_admin(authorization):
        raise HTTPException(status_code=401, detail="Non autorisé")

    ollama_running = False
    try:
        async with httpx.AsyncClient(timeout=3) as client:
            r = await client.get(
                f"{os.getenv('OLLAMA_URL', 'http://localhost:11434')}/api/tags"
            )
            ollama_running = r.status_code == 200
    except Exception:
        ollama_running = False

    return {
        "ollama":    ollama_running,
        "groq":      bool(os.getenv("GROQ_API_KEY")),
        "anthropic": bool(os.getenv("ANTHROPIC_API_KEY")),
        "fallback":  "static templates",
        "active": (
            "ollama" if ollama_running
            else "groq" if os.getenv("GROQ_API_KEY")
            else "anthropic" if os.getenv("ANTHROPIC_API_KEY")
            else "static"
        ),
    }
