"""
研究总览与数据质量审计导出。
"""

from __future__ import annotations

import json
import os
from collections import Counter
from datetime import datetime
from typing import Any, Dict, Iterable, List

CHAIN_DESCRIPTIONS = {
    "semiconductor": "核心半导体制造主链，覆盖材料、设备、设计、制造、封测与终端应用。",
    "electronic_chemicals": "聚焦湿电子化学品、光刻胶、电子特气与先进封装化学材料。",
    "nonferrous_metals": "覆盖铜、铝、金、银等有色金属在半导体链中的关键供给环节。",
    "silicon_materials": "聚焦工业硅、多晶硅、石英、硅片、SiC 与 SOI 等底层材料。",
    "pcb_materials": "覆盖覆铜板、铜箔、玻纤布、树脂和高频高速 PCB 材料。",
    "fusion": "融合多条链路后的全局图谱，用于观察跨行业连接与共享公司。",
}

TIER_ORDER = ("official", "authoritative", "secondary", "unknown")


def _bucket_counter(items: Iterable[Dict[str, Any]], key: str, order: Iterable[Any]) -> Dict[str, int]:
    counter = Counter(item.get(key) for item in items if item.get(key) is not None)
    return {str(name): int(counter.get(name, 0)) for name in order if counter.get(name, 0) or name in order}


def _confidence_distribution(items: Iterable[Dict[str, Any]], key: str = "source_confidence") -> Dict[str, int]:
    counter = Counter(int(item.get(key, 0) or 0) for item in items)
    return {str(level): int(counter.get(level, 0)) for level in range(1, 6)}


def _top_segments(nodes: List[Dict[str, Any]], limit: int = 5) -> List[Dict[str, Any]]:
    ranked = sorted(
        nodes,
        key=lambda node: (
            len(node.get("companies", [])),
            len(node.get("data_points", [])),
            node.get("heat_d20", 0),
        ),
        reverse=True,
    )
    return [
        {
            "id": node["id"],
            "name": node["name"],
            "company_count": len(node.get("companies", [])),
            "data_point_count": len(node.get("data_points", [])),
            "heat_d20": node.get("heat_d20", 0),
        }
        for node in ranked[:limit]
    ]


def _collect_low_confidence_items(payload: Dict[str, Any], limit: int = 8) -> Dict[str, List[Dict[str, Any]]]:
    low_points = []
    for node in payload["nodes"]:
        for point in node.get("data_points", []):
            confidence = int(point.get("source_confidence", 0) or 0)
            if confidence > 2:
                continue
            low_points.append(
                {
                    "kind": "data_point",
                    "chain_slug": payload["slug"],
                    "segment_id": node["id"],
                    "segment_name": node["name"],
                    "name": point.get("name", ""),
                    "source_name": point.get("source_name", ""),
                    "source_tier": point.get("source_tier", "unknown"),
                    "source_tier_label": point.get("source_tier_label", "待校验"),
                    "source_confidence": confidence,
                    "source_confidence_label": point.get("source_confidence_label", ""),
                    "estimated": bool(point.get("estimated")),
                }
            )

    low_edges = []
    node_map = {node["id"]: node for node in payload["nodes"]}
    for edge in payload["edges"]:
        confidence = int(edge.get("source_confidence", 0) or 0)
        if confidence > 2:
            continue
        low_edges.append(
            {
                "kind": "relationship",
                "chain_slug": payload["slug"],
                "from": edge.get("from", ""),
                "to": edge.get("to", ""),
                "from_name": node_map.get(edge.get("from", ""), {}).get("name", edge.get("from", "")),
                "to_name": node_map.get(edge.get("to", ""), {}).get("name", edge.get("to", "")),
                "product": edge.get("product", ""),
                "source_tier": edge.get("source_tier", "unknown"),
                "source_tier_label": edge.get("source_tier_label", "待校验"),
                "source_confidence": confidence,
                "source_confidence_label": edge.get("source_confidence_label", ""),
                "estimated": bool(edge.get("estimated")),
            }
        )

    for orphan in payload.get("orphan_relationships", []):
        confidence = int(orphan.get("source_confidence", 0) or 0)
        if confidence > 2:
            continue
        low_edges.append(
            {
                "kind": "relationship",
                "chain_slug": payload["slug"],
                "from": orphan.get("supplier_code", ""),
                "to": orphan.get("buyer_code", ""),
                "from_name": orphan.get("supplier_code", ""),
                "to_name": orphan.get("buyer_code", "") or "未映射买方",
                "product": orphan.get("product", ""),
                "source_tier": orphan.get("source_tier", "unknown"),
                "source_tier_label": orphan.get("source_tier_label", "待校验"),
                "source_confidence": confidence,
                "source_confidence_label": orphan.get("source_confidence_label", ""),
                "estimated": bool(orphan.get("estimated")),
            }
        )

    low_points.sort(key=lambda item: (item["source_confidence"], item["estimated"]), reverse=False)
    low_edges.sort(key=lambda item: item["source_confidence"])
    return {
        "data_points": low_points[:limit],
        "relationships": low_edges[:limit],
    }


def _chain_audit_summary(payload: Dict[str, Any]) -> Dict[str, Any]:
    data_points = [point for node in payload["nodes"] for point in node.get("data_points", [])]
    relationships = list(payload["edges"])
    orphan_relationships = list(payload.get("orphan_relationships", []))
    low_confidence = _collect_low_confidence_items(payload)
    avg_confidence = (
        round(sum(point.get("source_confidence", 0) for point in data_points) / len(data_points), 2)
        if data_points
        else 0
    )
    quality_score = round(avg_confidence * 20, 1) if avg_confidence else 0

    return {
        "slug": payload["slug"],
        "title": payload["title"],
        "kind": payload["kind"],
        "generated_at": payload["generated_at"],
        "description": CHAIN_DESCRIPTIONS.get(payload["slug"], ""),
        "stats": payload["stats"],
        "data_point_count": len(data_points),
        "relationship_count": len(relationships),
        "orphan_relationship_count": len(orphan_relationships),
        "estimated_data_point_count": sum(1 for point in data_points if point.get("estimated")),
        "estimated_relationship_count": sum(1 for edge in relationships if edge.get("estimated"))
        + sum(1 for edge in orphan_relationships if edge.get("estimated")),
        "missing_source_name_count": sum(1 for point in data_points if not point.get("source_name")),
        "missing_source_url_count": sum(1 for point in data_points if not point.get("source_url")),
        "missing_buyer_count": sum(1 for edge in orphan_relationships if not edge.get("buyer_code")),
        "data_point_tier_distribution": _bucket_counter(data_points, "source_tier", TIER_ORDER),
        "relationship_tier_distribution": _bucket_counter(
            [*relationships, *orphan_relationships], "source_tier", TIER_ORDER
        ),
        "data_point_confidence_distribution": _confidence_distribution(data_points),
        "relationship_confidence_distribution": _confidence_distribution([*relationships, *orphan_relationships]),
        "average_data_point_confidence": avg_confidence,
        "quality_score": quality_score,
        "top_segments": _top_segments(payload["nodes"]),
        "low_confidence": low_confidence,
    }


def build_audit_payload(chain_payloads: List[Dict[str, Any]], fusion_payload: Dict[str, Any]) -> Dict[str, Any]:
    generated_at = datetime.now().isoformat(timespec="seconds")
    chains = [_chain_audit_summary(payload) for payload in chain_payloads]
    fusion_summary = _chain_audit_summary(fusion_payload)

    data_points_total = sum(item["data_point_count"] for item in chains)
    relationships_total = sum(item["relationship_count"] for item in chains)
    missing_source_name_total = sum(item["missing_source_name_count"] for item in chains)
    missing_source_url_total = sum(item["missing_source_url_count"] for item in chains)
    missing_buyer_total = sum(item["missing_buyer_count"] for item in chains)
    estimated_points_total = sum(item["estimated_data_point_count"] for item in chains)
    average_quality_score = round(
        sum(item["quality_score"] for item in chains) / len(chains), 1
    ) if chains else 0

    global_risks = []
    for item in chains:
        global_risks.extend(item["low_confidence"]["data_points"])
        global_risks.extend(item["low_confidence"]["relationships"])

    global_risks.sort(key=lambda risk: risk.get("source_confidence", 5))

    return {
        "kind": "research_audit",
        "generated_at": generated_at,
        "summary": {
            "chain_count": len(chains),
            "data_point_count": data_points_total,
            "relationship_count": relationships_total,
            "missing_source_name_count": missing_source_name_total,
            "missing_source_url_count": missing_source_url_total,
            "missing_buyer_count": missing_buyer_total,
            "estimated_data_point_count": estimated_points_total,
            "average_quality_score": average_quality_score,
        },
        "chains": chains,
        "fusion": fusion_summary,
        "global_top_risks": global_risks[:12],
    }


def build_research_overview(
    chain_payloads: List[Dict[str, Any]],
    fusion_payload: Dict[str, Any],
    audit_payload: Dict[str, Any],
    trend_payload: Dict[str, Any],
) -> Dict[str, Any]:
    generated_at = audit_payload["generated_at"]
    trend_map = {chain["slug"]: chain for chain in trend_payload.get("chains", [])}

    chain_cards = []
    for payload, audit in zip(chain_payloads, audit_payload["chains"]):
        tier_distribution = audit["data_point_tier_distribution"]
        trend_summary = trend_map.get(payload["slug"], {})
        chain_cards.append(
            {
                "slug": payload["slug"],
                "title": payload["title"],
                "route": f"/chain/{payload['slug']}",
                "description": CHAIN_DESCRIPTIONS.get(payload["slug"], ""),
                "stats": payload["stats"],
                "data_point_count": audit["data_point_count"],
                "relationship_count": audit["relationship_count"],
                "quality_score": audit["quality_score"],
                "average_data_point_confidence": audit["average_data_point_confidence"],
                "estimated_ratio": round(
                    audit["estimated_data_point_count"] / audit["data_point_count"], 3
                ) if audit["data_point_count"] else 0,
                "missing_source_url_count": audit["missing_source_url_count"],
                "orphan_relationship_count": audit["orphan_relationship_count"],
                "tier_distribution": tier_distribution,
                "snapshot_count": trend_summary.get("snapshot_count", 0),
                "latest_snapshot_date": trend_summary.get("latest_snapshot_date", ""),
                "tracked_segment_count": trend_summary.get("tracked_segment_count", 0),
                "tracked_metric_count": trend_summary.get("tracked_metric_count", 0),
                "top_segments": audit["top_segments"][:3],
            }
        )

    highest_quality = max(chain_cards, key=lambda item: item["quality_score"], default=None)
    most_missing = max(chain_cards, key=lambda item: item["missing_source_url_count"], default=None)
    most_estimated = max(chain_cards, key=lambda item: item["estimated_ratio"], default=None)

    return {
        "kind": "research_overview",
        "generated_at": generated_at,
        "summary": {
            "chain_count": len(chain_payloads),
            "fusion_node_count": fusion_payload["stats"]["node_count"],
            "fusion_edge_count": fusion_payload["stats"]["edge_count"],
            "fusion_stock_count": fusion_payload["stats"]["stock_count"],
            "total_node_count": sum(payload["stats"]["node_count"] for payload in chain_payloads),
            "total_edge_count": sum(payload["stats"]["edge_count"] for payload in chain_payloads),
            "total_stock_count": len({code for payload in chain_payloads for code in payload["stock_codes"]}),
            "average_quality_score": audit_payload["summary"]["average_quality_score"],
            "missing_source_url_count": audit_payload["summary"]["missing_source_url_count"],
            "estimated_data_point_count": audit_payload["summary"]["estimated_data_point_count"],
            "chains_with_snapshots": trend_payload["summary"]["chains_with_snapshots"],
            "total_snapshot_count": trend_payload["summary"]["total_snapshot_count"],
            "tracked_series_count": trend_payload["summary"]["tracked_series_count"],
            "latest_snapshot_date": trend_payload["summary"]["latest_snapshot_date"],
            "orphan_relationship_count": sum(
                item["orphan_relationship_count"] for item in audit_payload["chains"]
            ),
        },
        "fusion": {
            "title": fusion_payload["title"],
            "route": "/fusion",
            "stats": fusion_payload["stats"],
            "description": CHAIN_DESCRIPTIONS["fusion"],
        },
        "chains": chain_cards,
        "focus": {
            "highest_quality_chain": highest_quality["slug"] if highest_quality else "",
            "most_missing_source_chain": most_missing["slug"] if most_missing else "",
            "most_estimated_chain": most_estimated["slug"] if most_estimated else "",
        },
        "highlights": [
            f"融合图谱汇总 {fusion_payload['stats']['node_count']} 个环节、{fusion_payload['stats']['edge_count']} 条关系。",
            f"主链平均质量分 {audit_payload['summary']['average_quality_score']} / 100。",
            f"产能快照累计 {trend_payload['summary']['total_snapshot_count']} 份，覆盖 {trend_payload['summary']['chains_with_snapshots']} 条子链。",
            f"待补外链来源共 {audit_payload['summary']['missing_source_url_count']} 条，优先影响研究可追溯性。",
        ],
    }


def write_research_reports(
    output_dir: str,
    chain_payloads: List[Dict[str, Any]],
    fusion_payload: Dict[str, Any],
    trend_payload: Dict[str, Any],
) -> List[tuple[str, Dict[str, Any]]]:
    os.makedirs(output_dir, exist_ok=True)
    audit_payload = build_audit_payload(chain_payloads, fusion_payload)
    overview_payload = build_research_overview(
        chain_payloads,
        fusion_payload,
        audit_payload,
        trend_payload,
    )

    audit_path = os.path.join(output_dir, "research_audit.json")
    overview_path = os.path.join(output_dir, "research_overview.json")

    with open(audit_path, "w", encoding="utf-8") as f:
        json.dump(audit_payload, f, ensure_ascii=False, indent=2)
    with open(overview_path, "w", encoding="utf-8") as f:
        json.dump(overview_payload, f, ensure_ascii=False, indent=2)

    return [
        (audit_path, audit_payload),
        (overview_path, overview_payload),
    ]
