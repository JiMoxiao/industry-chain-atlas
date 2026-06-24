from __future__ import annotations

import json
import threading
from datetime import datetime
from pathlib import Path
from typing import Any

from backend.config import DATA_DIR, HEAT_CACHE_PATH, PROJECT_ROOT, SNAPSHOT_DIR, WEB_DATA_DIR
from generate_data import (
    CHAIN_SLUGS,
    build_chain_payload,
    build_fusion_payload,
    run_all,
)
from lib.capacity_trends import build_trend_payload
from lib.research_audit import build_audit_payload, build_research_overview
from update_heat import collect_stocks, compute_segment_heat, fetch_d20, fetch_realhead

GENERATED_JSON_CACHE: dict[Path, tuple[int, dict[str, Any]]] = {}
HEAT_CACHE_MAX_AGE_SECONDS = 30 * 60
GENERATED_DATA_LOCK = threading.Lock()
GENERATED_FILENAMES = [
    *(f"{slug}.json" for slug in CHAIN_SLUGS),
    "fusion.json",
    "research_audit.json",
    "research_overview.json",
    "research_trends.json",
]


def _read_generated_json(filename: str) -> dict[str, Any] | None:
    path = WEB_DATA_DIR / filename
    if not path.exists():
        return None

    mtime_ns = path.stat().st_mtime_ns
    cached = GENERATED_JSON_CACHE.get(path)
    if cached and cached[0] == mtime_ns:
        return cached[1]

    with path.open("r", encoding="utf-8") as f:
        payload = json.load(f)

    GENERATED_JSON_CACHE[path] = (mtime_ns, payload)
    return payload


def _source_paths() -> list[Path]:
    paths = [
        PROJECT_ROOT / "generate_data.py",
        PROJECT_ROOT / "snapshot.py",
        PROJECT_ROOT / "update_heat.py",
        HEAT_CACHE_PATH,
    ]
    paths.extend(sorted(DATA_DIR.glob("*.yaml")))
    paths.extend(sorted(path for path in SNAPSHOT_DIR.rglob("*") if path.is_file()))
    paths.extend(sorted(path for path in (PROJECT_ROOT / "lib").rglob("*.py")))
    return [path for path in paths if path.exists()]


def _generated_paths() -> list[Path]:
    return [WEB_DATA_DIR / filename for filename in GENERATED_FILENAMES]


def _latest_mtime_ns(paths: list[Path]) -> int:
    if not paths:
        return 0
    return max(path.stat().st_mtime_ns for path in paths)


def _earliest_mtime_ns(paths: list[Path]) -> int | None:
    existing = [path.stat().st_mtime_ns for path in paths if path.exists()]
    if not existing:
        return None
    return min(existing)


def _generated_data_is_stale() -> bool:
    generated_paths = _generated_paths()
    earliest_generated = _earliest_mtime_ns(generated_paths)
    if earliest_generated is None or any(not path.exists() for path in generated_paths):
        return True

    latest_source = _latest_mtime_ns(_source_paths())
    return latest_source > earliest_generated


def ensure_generated_data_fresh() -> None:
    if not _generated_data_is_stale():
        return

    with GENERATED_DATA_LOCK:
        if not _generated_data_is_stale():
            return
        run_all()
        GENERATED_JSON_CACHE.clear()


def _parse_iso_timestamp(value: str) -> datetime | None:
    if not value:
        return None

    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def _heat_cache_meta(timestamp: str) -> tuple[str, int | None]:
    parsed = _parse_iso_timestamp(timestamp)
    if parsed is None:
        return "empty", None

    age_seconds = max(0, int((datetime.now() - parsed).total_seconds()))
    return ("fresh" if age_seconds <= HEAT_CACHE_MAX_AGE_SECONDS else "stale", age_seconds)


def build_chain_response(slug: str) -> dict[str, Any]:
    if slug not in CHAIN_SLUGS:
        raise KeyError(slug)
    ensure_generated_data_fresh()
    cached_payload = _read_generated_json(f"{slug}.json")
    if cached_payload is not None:
        return cached_payload
    return build_chain_payload(slug)


def build_fusion_response() -> dict[str, Any]:
    ensure_generated_data_fresh()
    cached_payload = _read_generated_json("fusion.json")
    if cached_payload is not None:
        return cached_payload
    return build_fusion_payload()


def _build_chain_payloads() -> list[dict[str, Any]]:
    return [build_chain_payload(slug) for slug in CHAIN_SLUGS]


def build_research_bundle() -> dict[str, Any]:
    ensure_generated_data_fresh()
    audit_payload = _read_generated_json("research_audit.json")
    overview_payload = _read_generated_json("research_overview.json")
    trend_payload = _read_generated_json("research_trends.json")

    if audit_payload is not None and overview_payload is not None and trend_payload is not None:
        return {
            "researchAuditPayload": audit_payload,
            "researchOverviewPayload": overview_payload,
            "researchTrendsPayload": trend_payload,
        }

    chain_payloads = _build_chain_payloads()
    fusion_payload = build_fusion_payload()
    trend_payload = build_trend_payload(chain_payloads, str(SNAPSHOT_DIR))
    audit_payload = build_audit_payload(chain_payloads, fusion_payload)
    overview_payload = build_research_overview(
        chain_payloads,
        fusion_payload,
        audit_payload,
        trend_payload,
    )
    return {
        "researchAuditPayload": audit_payload,
        "researchOverviewPayload": overview_payload,
        "researchTrendsPayload": trend_payload,
    }


def build_research_trends() -> dict[str, Any]:
    ensure_generated_data_fresh()
    cached_payload = _read_generated_json("research_trends.json")
    if cached_payload is not None:
        return cached_payload
    chain_payloads = _build_chain_payloads()
    return build_trend_payload(chain_payloads, str(SNAPSHOT_DIR))


def read_heat_cache() -> dict[str, Any]:
    if not HEAT_CACHE_PATH.exists():
        return {"timestamp": "", "segments": {}, "stocks": {}}
    with HEAT_CACHE_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)


def write_heat_cache(payload: dict[str, Any]) -> None:
    with HEAT_CACHE_PATH.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)


def get_heat_for_codes(codes: list[str], refresh: bool = False) -> dict[str, Any]:
    cache = read_heat_cache()
    stocks_cache = cache.get("stocks", {})
    stocks, segments = collect_stocks()
    requested_codes = [code for code in codes if code]

    live_result: dict[str, dict[str, Any]] = {}
    refreshed_count = 0

    if refresh and requested_codes:
        rh_result = fetch_realhead(requested_codes)
        d20_result = fetch_d20(requested_codes)
        for code in requested_codes:
            previous = stocks_cache.get(code, {})
            next_heat = {
                "d": rh_result.get(code, {}).get("d", previous.get("d", 0)),
                "d5": rh_result.get(code, {}).get("d5", previous.get("d5", 0)),
                "d20": d20_result.get(code, previous.get("d20", 0)),
            }
            live_result[code] = next_heat
            if code in rh_result or code in d20_result:
                refreshed_count += 1

        merged_stocks = {**stocks_cache, **live_result}
        full_segment_heat = compute_segment_heat(segments, merged_stocks)
        cache = {
            "timestamp": datetime.now().isoformat(timespec="seconds"),
            "segments": full_segment_heat,
            "stocks": merged_stocks,
        }
        write_heat_cache(cache)
        stocks_cache = merged_stocks

    response_stocks = {
        code: stocks_cache.get(code, {"d": 0, "d5": 0, "d20": 0})
        for code in requested_codes
    }
    missing_codes = [code for code in requested_codes if code not in stocks_cache]
    cache_status, cache_age_seconds = _heat_cache_meta(cache.get("timestamp", ""))

    return {
        "timestamp": cache.get("timestamp", ""),
        "cache_status": cache_status,
        "cache_age_seconds": cache_age_seconds,
        "requested_count": len(requested_codes),
        "refreshed_count": refreshed_count,
        "missing_codes": missing_codes,
        "stocks": response_stocks,
    }
