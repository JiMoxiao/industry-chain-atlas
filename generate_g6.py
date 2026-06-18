"""
半导体产业链 G6 交互式图谱生成器
读取 data/<industry>.yaml → 生成 G6 有向图 HTML
用法: python generate_g6.py <industry>
示例: python generate_g6.py semiconductor
"""

import json
import os
import sys

import yaml

from lib.data_loader import flatten_data
from lib.layout import layout_nodes

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATE_DIR = os.path.join(SCRIPT_DIR, "templates")


def _read_template(filename):
    with open(os.path.join(TEMPLATE_DIR, filename), "r", encoding="utf-8") as f:
        return f.read()


def _build_filter_buttons(group_labels, group_order):
    """从 YAML group_labels 动态生成筛选按钮 HTML."""
    buttons = ['<button onclick="filterGroup(\'all\')" id="fg-all" class="on">全部</button>']
    for gk in group_order:
        if gk in group_labels:
            label = group_labels[gk][0]
            buttons.append(
                f'<button onclick="filterGroup(\'{gk}\')" id="fg-{gk}">{label}</button>'
            )
    return "\n".join(buttons)


def gen_html(flat_data):
    """生成 G6 HTML 字符串，外链引用 templates/ 下的共享 CSS/JS."""
    nodes = flat_data["nodes"]
    edges = flat_data["edges"]
    group_order = flat_data["group_order"]
    group_labels = flat_data["group_labels"]
    industry = flat_data.get("industry", "")
    icon = flat_data.get("icon", "")

    # Compute positions using existing layout engine
    positions, canvas_w, canvas_h = layout_nodes(nodes, group_order)

    # Inject x, y into each node for G6 preset layout
    for n in nodes:
        pos = positions.get(n["id"], {"x": 0, "y": 0})
        n["x"] = pos["x"]
        n["y"] = pos["y"]

    nodes_json = json.dumps(nodes, ensure_ascii=False, indent=2)
    edges_json = json.dumps(edges, ensure_ascii=False, indent=2)

    page = _read_template("g6_page.html")

    page = page.replace("__PAGE_TITLE__", f"{icon} {industry}全产业链图谱")
    page = page.replace("__PAGE_HEADER__", f"{icon} {industry}全产业链图谱")
    page = page.replace("__FILTER_BUTTONS__", _build_filter_buttons(group_labels, group_order))

    page = page.replace("__NODES_JSON__", nodes_json)
    page = page.replace("__EDGES_JSON__", edges_json)
    page = page.replace("__GROUP_LABELS_JSON__", json.dumps(group_labels, ensure_ascii=False))

    stock_codes = []
    seen_codes = set()
    for n in nodes:
        for c in n.get("companies", []):
            if c["code"] not in seen_codes:
                seen_codes.add(c["code"])
                stock_codes.append(c["code"])

    page = page.replace("__STOCK_CODES__", json.dumps(stock_codes))

    return page


def main():
    if len(sys.argv) < 2:
        print("Usage: python generate_g6.py <industry>")
        print("Example: python generate_g6.py semiconductor")
        sys.exit(1)

    industry = sys.argv[1]
    yaml_path = os.path.join(SCRIPT_DIR, "data", f"{industry}.yaml")
    output_path = os.path.join(SCRIPT_DIR, f"{industry}_chain_g6.html")

    if not os.path.exists(yaml_path):
        print(f"Error: {yaml_path} not found")
        sys.exit(1)

    print(f"Reading {yaml_path}...")
    with open(yaml_path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    print(f"  {len(data['segments'])} segments, {len(data.get('supply_relationships', []))} relationships")

    flat = flatten_data(data)
    group_order = flat["group_order"]
    print(f"  Nodes: {len(flat['nodes'])}, Edges: {len(flat['edges'])}")

    layers = {}
    for n in flat["nodes"]:
        ly = n["layer"]
        if ly not in layers:
            layers[ly] = []
        layers[ly].append((n["group"], n["name"]))
    for lyr in sorted(layers.keys()):
        names = ", ".join(
            f"{g}/{nm}"
            for g, nm in sorted(layers[lyr], key=lambda x: (group_order.index(x[0]) if x[0] in group_order else 99, x[1]))
        )
        print(f"  L{lyr}: {names}")

    html = gen_html(flat)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"Written: {output_path} ({len(html):,} bytes)")


if __name__ == "__main__":
    main()
