"""
半导体产业链 SPA 数据导出脚本

用法:
  python generate_data.py --all
  python generate_data.py semiconductor
  python generate_data.py fusion
"""

import json
import os
import sys
from datetime import datetime

import yaml

from lib.capacity_trends import build_trend_payload, write_trend_payload
from lib.data_loader import flatten_data
from lib.fusion import load_all_yamls
from lib.layout import layout_nodes
from lib.research_audit import write_research_reports

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, "data")
SNAPSHOT_DIR = os.path.join(DATA_DIR, "capacity_snapshots")
WEB_DATA_DIR = os.path.join(SCRIPT_DIR, "web", "src", "data")

CHAIN_SLUGS = [
    "semiconductor",
    "electronic_chemicals",
    "nonferrous_metals",
    "silicon_materials",
    "pcb_materials",
]


def ensure_output_dir():
    os.makedirs(WEB_DATA_DIR, exist_ok=True)


def compute_stock_codes(nodes):
    stock_codes = []
    seen_codes = set()
    for node in nodes:
        for company in node.get("companies", []):
            code = company.get("code")
            if code and code not in seen_codes:
                seen_codes.add(code)
                stock_codes.append(code)
    return stock_codes


def apply_positions(nodes, group_order):
    positions, canvas_w, canvas_h = layout_nodes(nodes, group_order)
    enriched_nodes = []
    for node in nodes:
        pos = positions.get(node["id"], {"x": 0, "y": 0})
        item = dict(node)
        item["x"] = pos["x"]
        item["y"] = pos["y"]
        enriched_nodes.append(item)
    return enriched_nodes, canvas_w, canvas_h


def build_stats(nodes, edges, group_labels, stock_codes):
    return {
        "node_count": len(nodes),
        "edge_count": len(edges),
        "group_count": len(group_labels),
        "stock_count": len(stock_codes),
    }


def write_payload(filename, payload):
    output_path = os.path.join(WEB_DATA_DIR, filename)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    return output_path


def build_chain_payload(slug):
    yaml_path = os.path.join(DATA_DIR, f"{slug}.yaml")
    if not os.path.exists(yaml_path):
        raise FileNotFoundError(f"YAML not found: {yaml_path}")

    with open(yaml_path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)

    flat = flatten_data(data)
    nodes, canvas_w, canvas_h = apply_positions(flat["nodes"], flat["group_order"])
    edges = flat["edges"]
    stock_codes = compute_stock_codes(nodes)

    payload = {
        "kind": "chain",
        "slug": slug,
        "title": f"{flat.get('icon', '')} {flat.get('industry', slug)}全产业链图谱".strip(),
        "icon": flat.get("icon", ""),
        "industry": flat.get("industry", slug),
        "flow_description": flat.get("flow_description", ""),
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "canvas": {"width": canvas_w, "height": canvas_h},
        "stats": build_stats(nodes, edges, flat["group_labels"], stock_codes),
        "group_labels": flat["group_labels"],
        "group_order": flat["group_order"],
        "stock_codes": stock_codes,
        "nodes": nodes,
        "edges": edges,
        "orphan_relationships": flat.get("orphan_relationships", []),
    }

    return payload


def export_chain(slug):
    payload = build_chain_payload(slug)
    return write_payload(f"{slug}.json", payload), payload


def build_fusion_payload():
    fusion_data = load_all_yamls()
    nodes = fusion_data["nodes"]
    edges = fusion_data["edges"]
    stock_codes = compute_stock_codes(nodes)

    payload = {
        "kind": "fusion",
        "slug": "fusion",
        "title": "半导体全产业链融合图谱",
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "canvas": {
            "width": fusion_data["canvas_w"],
            "height": fusion_data["canvas_h"],
        },
        "stats": build_stats(nodes, edges, fusion_data["group_labels"], stock_codes),
        "group_labels": fusion_data["group_labels"],
        "group_order": fusion_data["group_order"],
        "stock_codes": stock_codes,
        "nodes": nodes,
        "edges": edges,
    }

    return payload


def export_fusion():
    payload = build_fusion_payload()
    return write_payload("fusion.json", payload), payload


def run_all():
    results = []
    chain_payloads = []
    for slug in CHAIN_SLUGS:
        output_path, payload = export_chain(slug)
        chain_payloads.append(payload)
        results.append((output_path, payload))
    fusion_path, fusion_payload = export_fusion()
    results.append((fusion_path, fusion_payload))
    trend_payload = build_trend_payload(chain_payloads, SNAPSHOT_DIR)
    results.append(write_trend_payload(WEB_DATA_DIR, trend_payload))
    results.extend(write_research_reports(WEB_DATA_DIR, chain_payloads, fusion_payload, trend_payload))
    return results


def main():
    ensure_output_dir()

    if len(sys.argv) < 2:
        print("Usage: python generate_data.py --all | <chain-slug> | fusion")
        sys.exit(1)

    target = sys.argv[1]
    if target == "--all":
        results = run_all()
    elif target == "fusion":
        results = [export_fusion()]
    elif target in CHAIN_SLUGS:
        results = [export_chain(target)]
    else:
        print(f"Unknown target: {target}")
        sys.exit(1)

    for path, payload in results:
        stats = payload.get("stats")
        if stats:
            print(
                f"Written: {path} | "
                f"nodes={stats['node_count']} edges={stats['edge_count']} "
                f"groups={stats['group_count']} stocks={stats['stock_count']}"
            )
            continue
        summary = payload.get("summary", {})
        print(f"Written: {path} | summary={summary}")


if __name__ == "__main__":
    main()
