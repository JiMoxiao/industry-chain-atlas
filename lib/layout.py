"""
半导体产业链图谱 — 分层布局引擎
将节点按供应链层级排布，同层内按功能分组，垂直居中。
"""

from collections import defaultdict

from .config import NODE_W, NODE_H, LAYER_GAP, GROUP_GAP, ROW_GAP, PADDING


def layout_nodes(nodes, group_order):
    """按层垂直居中，松散布局。返回 (positions字典, canvas_w, canvas_h)."""
    # 每层每group的节点
    layer_groups = defaultdict(lambda: defaultdict(list))
    for n in nodes:
        layer_groups[n["layer"]][n["group"]].append(n)

    # 先算每列总高度
    col_heights = {}
    for lyr, groups in layer_groups.items():
        total = 0
        gkeys = sorted(groups.keys(), key=lambda g: group_order.index(g) if g in group_order else 99)
        for gi, gk in enumerate(gkeys):
            if gi > 0:
                total += GROUP_GAP
            total += len(groups[gk]) * (NODE_H + ROW_GAP) - ROW_GAP
        col_heights[lyr] = total

    max_col_h = max(col_heights.values()) if col_heights else 600

    positions = {}
    max_layer = max(layer_groups.keys())

    for lyr in sorted(layer_groups.keys()):
        groups = layer_groups[lyr]
        x = PADDING + lyr * (NODE_W + LAYER_GAP)
        col_h = col_heights[lyr]
        offset_y = (max_col_h - col_h) / 2

        y = PADDING + offset_y
        gkeys = sorted(groups.keys(), key=lambda g: group_order.index(g) if g in group_order else 99)
        for gi, gk in enumerate(gkeys):
            if gi > 0:
                y += GROUP_GAP
            for ni, n in enumerate(sorted(groups[gk], key=lambda n: n["name"])):
                positions[n["id"]] = {"x": x, "y": y + ni * (NODE_H + ROW_GAP)}
            y += len(groups[gk]) * (NODE_H + ROW_GAP)

    max_x = PADDING + max_layer * (NODE_W + LAYER_GAP) + NODE_W
    return positions, max_x + PADDING, max_col_h + PADDING * 2
