"""
产能快照时间序列聚合与前端趋势 JSON 导出。
"""

from __future__ import annotations

import json
import os
from collections import defaultdict
from datetime import datetime
from glob import glob
from typing import Any, Dict, Iterable, List, Tuple

SNAPSHOT_KIND = "capacity_trend_snapshot"
TRENDS_FILENAME = "research_trends.json"


def _safe_float(value: Any) -> float | None:
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        text = value.strip().replace(",", "")
        if not text:
            return None
        try:
            return float(text)
        except ValueError:
            return None
    return None


def _parse_date(value: str) -> datetime:
    return datetime.strptime(value, "%Y-%m-%d")


def _infer_slug(
    snapshot: Dict[str, Any],
    file_path: str,
    segment_ids_by_slug: Dict[str, set[str]],
) -> str | None:
    slug = snapshot.get("industry")
    if slug:
        return str(slug)

    parent = os.path.basename(os.path.dirname(file_path))
    if parent in segment_ids_by_slug:
        return parent

    metrics = snapshot.get("metrics", {})
    if not isinstance(metrics, dict) or not metrics:
        return None

    best_slug = None
    best_score = 0
    metric_segment_ids = set(metrics.keys())
    for candidate, segment_ids in segment_ids_by_slug.items():
        score = len(metric_segment_ids & segment_ids)
        if score > best_score:
            best_slug = candidate
            best_score = score
    return best_slug


def _collect_snapshot_files(snapshot_dir: str) -> List[str]:
    nested = glob(os.path.join(snapshot_dir, "*", "*.json"))
    legacy = glob(os.path.join(snapshot_dir, "*.json"))
    files = {os.path.normpath(path) for path in [*nested, *legacy]}
    return sorted(files)


def _series_rank_key(series: Dict[str, Any]) -> Tuple[int, float, float]:
    delta = abs(series.get("delta_value") or 0)
    latest = abs(series.get("latest_value") or 0)
    return (
        int(series.get("sample_count", 0)),
        float(delta),
        float(latest),
    )


def build_trend_payload(
    chain_payloads: Iterable[Dict[str, Any]],
    snapshot_dir: str,
) -> Dict[str, Any]:
    chain_payloads = list(chain_payloads)
    payload_map = {payload["slug"]: payload for payload in chain_payloads}
    segment_ids_by_slug = {
        payload["slug"]: {node["id"] for node in payload["nodes"]}
        for payload in chain_payloads
    }
    segment_meta = {
        payload["slug"]: {
            node["id"]: {
                "name": node["name"],
                "metrics": {
                    point["name"]: {
                        "type": point.get("type", ""),
                        "unit": point.get("unit"),
                    }
                    for point in node.get("data_points", [])
                },
            }
            for node in payload["nodes"]
        }
        for payload in chain_payloads
    }

    grouped_points: Dict[str, Dict[str, Dict[str, List[Dict[str, Any]]]]] = defaultdict(
        lambda: defaultdict(lambda: defaultdict(list))
    )
    snapshot_dates: Dict[str, set[str]] = defaultdict(set)

    for file_path in _collect_snapshot_files(snapshot_dir):
        with open(file_path, "r", encoding="utf-8") as f:
            snapshot = json.load(f)

        slug = _infer_slug(snapshot, file_path, segment_ids_by_slug)
        if not slug or slug not in payload_map:
            continue

        snapshot_date = snapshot.get("date")
        if not snapshot_date:
            continue

        metrics = snapshot.get("metrics", {})
        if not isinstance(metrics, dict):
            continue

        snapshot_dates[slug].add(snapshot_date)
        for segment_id, metric_values in metrics.items():
            if not isinstance(metric_values, dict):
                continue
            for metric_name, raw_value in metric_values.items():
                value = _safe_float(raw_value)
                if value is None:
                    continue
                grouped_points[slug][segment_id][metric_name].append(
                    {
                        "date": snapshot_date,
                        "value": value,
                    }
                )

    chains = []
    all_snapshot_dates = set()
    tracked_series_total = 0

    for slug, payload in payload_map.items():
        chain_dates = sorted(snapshot_dates.get(slug, set()))
        all_snapshot_dates.update(chain_dates)
        segments = []
        flat_series = []

        for node in payload["nodes"]:
            segment_id = node["id"]
            metric_series = []
            meta = segment_meta.get(slug, {}).get(segment_id, {})
            metric_meta = meta.get("metrics", {})

            for metric_name, points in grouped_points.get(slug, {}).get(segment_id, {}).items():
                sorted_points = sorted(points, key=lambda item: _parse_date(item["date"]))
                if not sorted_points:
                    continue

                latest = sorted_points[-1]["value"]
                previous = sorted_points[-2]["value"] if len(sorted_points) > 1 else None
                delta_value = round(latest - previous, 4) if previous is not None else None
                delta_ratio = (
                    round(((latest - previous) / abs(previous)) * 100, 2)
                    if previous not in (None, 0)
                    else None
                )

                series = {
                    "key": f"{segment_id}:{metric_name}",
                    "segment_id": segment_id,
                    "segment_name": node["name"],
                    "metric_name": metric_name,
                    "metric_type": metric_meta.get(metric_name, {}).get("type", ""),
                    "unit": metric_meta.get(metric_name, {}).get("unit"),
                    "sample_count": len(sorted_points),
                    "latest_value": latest,
                    "previous_value": previous,
                    "delta_value": delta_value,
                    "delta_ratio": delta_ratio,
                    "points": sorted_points,
                }
                metric_series.append(series)
                flat_series.append(series)

            if metric_series:
                metric_series.sort(key=_series_rank_key, reverse=True)
                segments.append(
                    {
                        "id": segment_id,
                        "name": meta.get("name", node["name"]),
                        "metric_count": len(metric_series),
                        "metrics": metric_series,
                    }
                )

        flat_series.sort(key=_series_rank_key, reverse=True)
        tracked_series_total += len(flat_series)
        chains.append(
            {
                "slug": slug,
                "title": payload["title"],
                "snapshot_count": len(chain_dates),
                "earliest_snapshot_date": chain_dates[0] if chain_dates else "",
                "latest_snapshot_date": chain_dates[-1] if chain_dates else "",
                "tracked_segment_count": len(segments),
                "tracked_metric_count": len(flat_series),
                "orphan_relationship_count": len(payload.get("orphan_relationships", [])),
                "segments": segments,
                "top_series": flat_series[:6],
            }
        )

    return {
        "kind": "research_trends",
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "summary": {
            "chain_count": len(chains),
            "chains_with_snapshots": sum(1 for chain in chains if chain["snapshot_count"] > 0),
            "total_snapshot_count": sum(chain["snapshot_count"] for chain in chains),
            "tracked_series_count": tracked_series_total,
            "earliest_snapshot_date": min(all_snapshot_dates) if all_snapshot_dates else "",
            "latest_snapshot_date": max(all_snapshot_dates) if all_snapshot_dates else "",
        },
        "chains": chains,
    }


def write_trend_payload(output_dir: str, trend_payload: Dict[str, Any]) -> Tuple[str, Dict[str, Any]]:
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, TRENDS_FILENAME)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(trend_payload, f, ensure_ascii=False, indent=2)
    return output_path, trend_payload
