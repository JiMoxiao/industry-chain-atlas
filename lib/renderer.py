"""
产业链图谱 — HTML 渲染器
加载模板文件 + 注入数据 → 生成自包含 HTML。
所有行业特定内容（标题、筛选按钮、流向箭头）均从 YAML 数据驱动。
"""

import json
import os

from .layout import layout_nodes

TEMPLATE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "templates")


def _read_template(filename):
    with open(os.path.join(TEMPLATE_DIR, filename), "r", encoding="utf-8") as f:
        return f.read()


def _build_filter_buttons(group_labels, group_order):
    """从 YAML group_labels 动态生成筛选按钮 HTML."""
    buttons = ['<button onclick="filterGroup(\'all\')" id="fg-all" class="on">全部</button>']
    for gk in group_order:
        if gk in group_labels:
            label = group_labels[gk][0]  # emoji + 短标签
            buttons.append(
                f'<button onclick="filterGroup(\'{gk}\')" id="fg-{gk}">{label}</button>'
            )
    return "\n".join(buttons)


def gen_html(flat_data):
    """生成完整的自包含 HTML 字符串."""
    nodes = flat_data["nodes"]
    edges = flat_data["edges"]
    group_order = flat_data["group_order"]
    group_labels = flat_data["group_labels"]
    industry = flat_data.get("industry", "")
    icon = flat_data.get("icon", "")

    positions, canvas_w, canvas_h = layout_nodes(nodes, group_order)

    nodes_json = json.dumps(nodes, ensure_ascii=False, indent=2)
    edges_json = json.dumps(edges, ensure_ascii=False, indent=2)
    pos_json = json.dumps(positions, ensure_ascii=False)

    styles = _read_template("styles.css")
    app_js = _read_template("app.js")
    page = _read_template("page.html")

    page = page.replace("__STYLES__", styles)
    page = page.replace("__APP_JS__", app_js)

    page = page.replace("__PAGE_TITLE__", f"{icon} {industry}全产业链图谱")
    page = page.replace("__PAGE_HEADER__", f"{icon} {industry}全产业链图谱")
    page = page.replace("__FILTER_BUTTONS__", _build_filter_buttons(group_labels, group_order))
    page = page.replace("__FLOW_DESC__", flat_data.get("flow_description", ""))

    page = page.replace("__NODES_JSON__", nodes_json)
    page = page.replace("__EDGES_JSON__", edges_json)
    page = page.replace("__POSITIONS_JSON__", pos_json)
    page = page.replace("__GROUP_LABELS_JSON__", json.dumps(group_labels, ensure_ascii=False))
    stock_codes = []
    seen_codes = set()
    for n in nodes:
        for c in n.get("companies", []):
            if c["code"] not in seen_codes:
                seen_codes.add(c["code"])
                stock_codes.append(c["code"])

    page = page.replace("__STOCK_CODES__", json.dumps(stock_codes))
    page = page.replace("__CANVAS_W__", str(int(canvas_w)))
    page = page.replace("__CANVAS_H__", str(int(canvas_h)))

    return page
