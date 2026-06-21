"""
半导体产业链图谱 — 数据加载与扁平化
读取 YAML 定义 + 市场热度缓存 → 输出统一的 nodes/edges 结构。
"""

import json
import os
from collections import defaultdict

from .config import NODE_W, NODE_H  # layout constants only
from .source_metadata import enrich_data_point, enrich_relationship

SCRIPT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load_heat_data():
    """加载市场热度缓存，返回 (segments热度字典, stocks热度字典)."""
    cache_path = os.path.join(SCRIPT_DIR, "data", "market_heat.json")
    if not os.path.exists(cache_path):
        return {}, {}
    with open(cache_path, "r", encoding="utf-8") as f:
        cache = json.load(f)
    return cache.get("segments", {}), cache.get("stocks", {})


def build_segment_edges(segments, supply_rels):
    """公司级供应关系 → 细分领域级连线（去重）."""
    co_to_segs = defaultdict(list)
    code_to_company = {}
    for seg in segments:
        for co in seg.get("key_companies", []):
            co_to_segs[co["code"]].append(seg["id"])
            code_to_company[co["code"]] = co.get("name", co["code"])

    pairs = set()
    edges = []
    orphan_relationships = []
    for rel in supply_rels:
        enriched_rel = enrich_relationship(rel)
        sup = rel.get("supplier_code", "")
        buy = rel.get("buyer_code", "")
        matched = False
        for ss in co_to_segs.get(sup, []):
            for bs in co_to_segs.get(buy, []):
                if ss != bs and (ss, bs) not in pairs:
                    pairs.add((ss, bs))
                    matched = True
                    edges.append({
                        "from": ss, "to": bs,
                        "product": rel.get("product", ""),
                        "notes": rel.get("notes", ""),
                        "rel_type": rel.get("relationship_type", "primary"),
                        "confidence": enriched_rel["confidence"],
                        "source_confidence": enriched_rel["source_confidence"],
                        "source_confidence_label": enriched_rel["source_confidence_label"],
                        "source_tier": enriched_rel["source_tier"],
                        "source_tier_label": enriched_rel["source_tier_label"],
                        "source_name": enriched_rel.get("source_name", ""),
                        "source_url": enriched_rel.get("source_url", ""),
                        "estimated": enriched_rel["estimated"],
                    })
        if not matched:
            orphan_relationships.append({
                "supplier_code": sup,
                "supplier_name": code_to_company.get(sup, sup),
                "buyer_code": buy,
                "buyer_name": code_to_company.get(buy, buy),
                "product": rel.get("product", ""),
                "notes": rel.get("notes", ""),
                "rel_type": rel.get("relationship_type", "primary"),
                "confidence": enriched_rel["confidence"],
                "source_confidence": enriched_rel["source_confidence"],
                "source_confidence_label": enriched_rel["source_confidence_label"],
                "source_tier": enriched_rel["source_tier"],
                "source_tier_label": enriched_rel["source_tier_label"],
                "source_name": enriched_rel.get("source_name", ""),
                "source_url": enriched_rel.get("source_url", ""),
                "estimated": enriched_rel["estimated"],
            })
    return edges, orphan_relationships


def flatten_data(data):
    """将 YAML 结构化数据展开为前端可用的 nodes/edges 列表."""
    segments = data["segments"]
    supply_rels = data.get("supply_relationships", [])
    seg_heat, stock_heat = load_heat_data()
    nodes = []
    for seg in segments:
        companies = []
        for c in seg.get("key_companies", []):
            st = stock_heat.get(c["code"], {})
            companies.append({
                "code": c["code"], "name": c["name"], "role": c["role"],
                "d": st.get("d", 0), "d5": st.get("d5", 0), "d20": st.get("d20", 0)
            })
        new_cap = [{"company": nc.get("company",""), "scale": nc.get("scale",""),
                     "expected_online": nc.get("expected_online",""), "status": nc.get("status","")}
                   for nc in seg.get("new_capacity", [])]
        h = seg_heat.get(seg["id"], {"d":0,"d5":0,"d20":0})
        nodes.append({
            "id": seg["id"], "name": seg["name"],
            "position": seg.get("position", "midstream"),
            "tier": seg.get("tier", 1),
            "description": seg.get("description", ""),
            "companies": companies,
            "data_points": [enrich_data_point(point) for point in seg.get("data_points", [])],
            "new_capacity": new_cap,
            "group": seg.get("group", "material"),
            "layer": seg.get("layer", 2),
            "heat_d": h.get("d", 0),
            "heat_d5": h.get("d5", 0),
            "heat_d20": h.get("d20", 0),
        })
    edges, orphan_relationships = build_segment_edges(segments, supply_rels)
    return {
        "nodes": nodes,
        "edges": edges,
        "orphan_relationships": orphan_relationships,
        "industry": data.get("industry", ""),
        "icon": data.get("icon", ""),
        "flow_description": data.get("flow_description", ""),
        "group_labels": data.get("group_labels", {}),
        "group_order": data.get("group_order", []),
    }
