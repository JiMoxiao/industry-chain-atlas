"""
产业链融合引擎 — 多 YAML 合并为统一产业网络
"""

import os
from collections import defaultdict

import yaml

from .data_loader import load_heat_data
from .layout import layout_nodes

SCRIPT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Layer offsets: upstream chains start at 0, semiconductor at 3
INDUSTRY_META = {
    "electronic_chemicals": {"layer_offset": 0, "icon": "🧪", "name": "电子化学品"},
    "nonferrous_metals":    {"layer_offset": 0, "icon": "⛏️", "name": "有色金属"},
    "silicon_materials":    {"layer_offset": 0, "icon": "🏭", "name": "硅材料"},
    "pcb_materials":        {"layer_offset": 0, "icon": "📦", "name": "PCB材料"},
    "semiconductor":        {"layer_offset": 3, "icon": "🔬", "name": "半导体"},
}

# Group colors per industry (for visual distinction)
INDUSTRY_COLORS = {
    "electronic_chemicals": "rgba(33,150,243,0.12)",
    "nonferrous_metals":    "rgba(255,152,0,0.12)",
    "silicon_materials":    "rgba(156,39,176,0.10)",
    "pcb_materials":        "rgba(0,150,136,0.10)",
    "semiconductor":        "rgba(76,175,80,0.10)",
}


def load_all_yamls():
    """Load all YAML files and return merged, flattened data."""
    yaml_names = ["electronic_chemicals", "nonferrous_metals", "silicon_materials", "pcb_materials", "semiconductor"]

    seg_heat, stock_heat = load_heat_data()
    all_nodes = []
    all_edges = []
    all_group_labels = {}
    all_group_order = []

    for name in yaml_names:
        path = os.path.join(SCRIPT_DIR, "data", f"{name}.yaml")
        with open(path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)

        meta = INDUSTRY_META[name]
        offset = meta["layer_offset"]
        prefix = name + "/"

        # Build company → segments map for this industry
        co_to_segs = defaultdict(list)
        for seg in data["segments"]:
            for co in seg.get("key_companies", []):
                co_to_segs[co["code"]].append(prefix + seg["id"])

        # Build nodes
        for seg in data["segments"]:
            sid = prefix + seg["id"]
            companies = []
            for c in seg.get("key_companies", []):
                st = stock_heat.get(c["code"], {})
                companies.append({
                    "code": c["code"], "name": c["name"], "role": c["role"],
                    "d": st.get("d", 0), "d5": st.get("d5", 0), "d20": st.get("d20", 0),
                })
            new_cap = [{"company": nc.get("company", ""), "scale": nc.get("scale", ""),
                        "expected_online": nc.get("expected_online", ""), "status": nc.get("status", "")}
                       for nc in seg.get("new_capacity", [])]
            h = seg_heat.get(sid, seg_heat.get(seg["id"], {"d": 0, "d5": 0, "d20": 0}))
            all_nodes.append({
                "id": sid,
                "name": meta["icon"] + " " + seg["name"],
                "position": seg.get("position", "midstream"),
                "tier": seg.get("tier", 1),
                "description": seg.get("description", ""),
                "companies": companies,
                "data_points": seg.get("data_points", []),
                "new_capacity": new_cap,
                "group": prefix + seg.get("group", "material"),
                "layer": seg.get("layer", 0) + offset,
                "industry": name,
                "heat_d": h.get("d", 0),
                "heat_d5": h.get("d5", 0),
                "heat_d20": h.get("d20", 0),
            })

        # Build edges (within this industry)
        seg_ids = {seg["id"]: True for seg in data["segments"]}
        pairs = set()
        for rel in data.get("supply_relationships", []):
            sup = rel.get("supplier_code", "")
            buy = rel.get("buyer_code", "")
            for ss in co_to_segs.get(sup, []):
                for bs in co_to_segs.get(buy, []):
                    if ss != bs and (ss, bs) not in pairs:
                        pairs.add((ss, bs))
                        all_edges.append({
                            "from": ss, "to": bs,
                            "product": rel.get("product", ""),
                            "notes": rel.get("notes", ""),
                            "rel_type": rel.get("relationship_type", "primary"),
                            "industry": name,
                        })

        # Merge group labels
        for gk, gl in data.get("group_labels", {}).items():
            all_group_labels[prefix + gk] = [meta["icon"] + " " + gl[0], gl[1] if len(gl) > 1 else ""]
        all_group_order.extend([prefix + g for g in data.get("group_order", [])])

    # Build cross-chain edges (companies appearing in multiple industries' segments)
    co_to_all_segs = defaultdict(list)
    for n in all_nodes:
        for c in n["companies"]:
            co_to_all_segs[c["code"]].append(n["id"])

    cross_pairs = set()
    for code, seg_ids in co_to_all_segs.items():
        if len(seg_ids) < 2:
            continue
        # Only connect if from DIFFERENT industries
        for i, sid1 in enumerate(seg_ids):
            for sid2 in seg_ids[i + 1:]:
                ind1 = sid1.split("/")[0]
                ind2 = sid2.split("/")[0]
                if ind1 != ind2 and (sid1, sid2) not in cross_pairs and (sid2, sid1) not in cross_pairs:
                    cross_pairs.add((sid1, sid2))
                    # Direction: upstream → downstream (lower layer → higher layer)
                    n1 = next(n for n in all_nodes if n["id"] == sid1)
                    n2 = next(n for n in all_nodes if n["id"] == sid2)
                    if n1["layer"] <= n2["layer"]:
                        frm, to = sid1, sid2
                    else:
                        frm, to = sid2, sid1
                    all_edges.append({
                        "from": frm, "to": to,
                        "product": "产业链交叉",
                        "notes": f"共享企业: {code}",
                        "rel_type": "secondary",
                        "industry": "cross",
                    })

    # Compute positions
    positions, canvas_w, canvas_h = layout_nodes(all_nodes, all_group_order)
    for n in all_nodes:
        pos = positions.get(n["id"], {"x": 0, "y": 0})
        n["x"] = pos["x"]
        n["y"] = pos["y"]

    return {
        "nodes": all_nodes,
        "edges": all_edges,
        "group_labels": all_group_labels,
        "group_order": all_group_order,
        "canvas_w": canvas_w,
        "canvas_h": canvas_h,
    }
