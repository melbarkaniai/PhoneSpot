from pathlib import Path
from datetime import datetime, timezone
import json
import logging
import re

logger = logging.getLogger("cache_manager")

CACHE_DIR = Path(__file__).parent / "cache"
CACHE_DIR.mkdir(exist_ok=True)
CACHE_TTL_HOURS = 13  # valid for 13h — allows 2x/day refresh with margin


def get_cache_path(model: str) -> Path:
    # Strip everything except letters, digits, spaces and hyphens
    safe = re.sub(r"[^a-zA-Z0-9 \-]", "", model)
    filename = safe.lower().replace(" ", "_") + ".json"
    path = (CACHE_DIR / filename).resolve()
    # Ensure the resolved path stays inside CACHE_DIR
    if not str(path).startswith(str(CACHE_DIR.resolve())):
        raise ValueError(f"Invalid cache path: {filename}")
    return path


def cache_read(model: str) -> dict | None:
    path = get_cache_path(model)
    if not path.exists():
        slug_variants = [
            model.lower().replace(" ", "_"),
            model.lower().replace(" ", "-"),
            model.strip().lower().replace(" ", "_"),
        ]
        for slug in slug_variants:
            candidate = CACHE_DIR / f"{slug}.json"
            if candidate.exists():
                path = candidate
                break
        else:
            return None

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        logger.info(f"Cache hit for {model}")
        return data
    except Exception as e:
        logger.error(f"Cache read error for {model}: {e}")
        return None


def cache_read_stale(model: str) -> dict | None:
    """Return cache regardless of age. Last resort fallback."""
    path = get_cache_path(model)
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def cache_write(data: dict) -> None:
    """Writes scraping result to cache file."""
    CACHE_DIR.mkdir(exist_ok=True)
    model = data["model"]
    path = get_cache_path(model)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def cache_status() -> list[dict]:
    """Returns status of all cached models. Used by /api/admin/cache-status."""
    results = []
    if not CACHE_DIR.exists():
        return results
    for path in sorted(CACHE_DIR.glob("*.json")):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            scraped_at = datetime.fromisoformat(data["scraped_at"])
            age_minutes = int(
                (datetime.now(timezone.utc) - scraped_at).total_seconds() / 60
            )
            results.append({
                "model": data.get("model", path.stem),
                "scraped_at": data["scraped_at"],
                "age_minutes": age_minutes,
                "fresh": age_minutes < CACHE_TTL_HOURS * 60,
                "sources": data.get("sources", []),
                "file": path.name,
            })
        except Exception as e:
            results.append({"file": path.name, "error": str(e)})
    return results
