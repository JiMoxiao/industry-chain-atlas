"""
产业链融合图谱生成器
读取所有 data/<industry>.yaml → 生成统一的 G6 有向图 HTML
用法: python generate_fusion.py
"""

import json
import os

from lib.fusion import load_all_yamls, INDUSTRY_META, INDUSTRY_COLORS

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATE_DIR = os.path.join(SCRIPT_DIR, "templates")
OUTPUT_PATH = os.path.join(SCRIPT_DIR, "fusion_chain.html")


def _read_template(filename):
    with open(os.path.join(TEMPLATE_DIR, filename), "r", encoding="utf-8") as f:
        return f.read()


def _build_filter_buttons(group_labels, group_order):
    """从融合后的 group_labels 动态生成筛选按钮 HTML，按行业分组."""
    buttons = ['<button onclick="filterGroup(\'all\')" id="fg-all" class="on">全部</button>']

    # Group by industry prefix
    industry_groups = {}
    for gk in group_order:
        if gk in group_labels:
            industry = gk.split("/")[0]
            if industry not in industry_groups:
                industry_groups[industry] = []
            industry_groups[industry].append(gk)

    for industry in ["electronic_chemicals", "nonferrous_metals", "silicon_materials", "pcb_materials", "semiconductor"]:
        groups = industry_groups.get(industry, [])
        if not groups:
            continue
        meta = INDUSTRY_META.get(industry, {})
        icon = meta.get("icon", "")
        for gk in groups:
            label = group_labels[gk][0]
            buttons.append(
                f'<button onclick="filterGroup(\'{gk}\')" id="fg-{gk}">{icon} {label}</button>'
            )

    return "\n".join(buttons)


def gen_html(fusion_data):
    """生成完整的自包含 G6 HTML 字符串."""
    nodes = fusion_data["nodes"]
    edges = fusion_data["edges"]
    group_order = fusion_data["group_order"]
    group_labels = fusion_data["group_labels"]

    nodes_json = json.dumps(nodes, ensure_ascii=False, indent=2)
    edges_json = json.dumps(edges, ensure_ascii=False, indent=2)

    page = _read_template("g6_page.html")

    page = page.replace("__PAGE_TITLE__", "半导体全产业链融合图谱")
    page = page.replace("__PAGE_HEADER__", "🔬 半导体全产业链融合图谱")
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
    print("Loading all YAMLs...")
    fusion_data = load_all_yamls()
    print(f"  {len(fusion_data['nodes'])} nodes, {len(fusion_data['edges'])} edges")
    print(f"  {len(fusion_data['group_labels'])} groups across {len(set(g.split('/')[0] for g in fusion_data['group_labels']))} industries")
    print(f"  Canvas: {fusion_data['canvas_w']} x {fusion_data['canvas_h']}")

    # Count cross-chain edges
    cross_edges = [e for e in fusion_data["edges"] if e.get("industry") == "cross"]
    print(f"  Cross-chain edges: {len(cross_edges)}")

    html = gen_html(fusion_data)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"Written: {OUTPUT_PATH} ({len(html):,} bytes)")


if __name__ == "__main__":
    main()
