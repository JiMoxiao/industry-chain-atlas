"""
半导体产业链图谱 — 数据加载与扁平化
读取 YAML 定义 + 市场热度缓存 → 输出统一的 nodes/edges 结构。
"""

import json
import os
from collections import defaultdict

from .config import NODE_W, NODE_H  # layout constants only

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
    for seg in segments:
        for co in seg.get("key_companies", []):
            co_to_segs[co["code"]].append(seg["id"])

    pairs = set()
    edges = []
    for rel in supply_rels:
        sup = rel.get("supplier_code", "")
        buy = rel.get("buyer_code", "")
        for ss in co_to_segs.get(sup, []):
            for bs in co_to_segs.get(buy, []):
                if ss != bs and (ss, bs) not in pairs:
                    pairs.add((ss, bs))
                    edges.append({
                        "from": ss, "to": bs,
                        "product": rel.get("product", ""),
                        "notes": rel.get("notes", ""),
                        "rel_type": rel.get("relationship_type", "primary"),
                    })
    return edges


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
            "data_points": seg.get("data_points", []),
            "new_capacity": new_cap,
            "group": seg.get("group", "material"),
            "layer": seg.get("layer", 2),
            "heat_d": h.get("d", 0),
            "heat_d5": h.get("d5", 0),
            "heat_d20": h.get("d20", 0),
        })
    edges = build_segment_edges(segments, supply_rels)
    return {
        "nodes": nodes,
        "edges": edges,
        "industry": data.get("industry", ""),
        "icon": data.get("icon", ""),
        "flow_description": data.get("flow_description", ""),
        "group_labels": data.get("group_labels", {}),
        "group_order": data.get("group_order", []),
    }
