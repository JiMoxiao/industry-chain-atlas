"""
产业链图谱 — 通用配置常量
仅包含布局参数和颜色方案等跨行业通用配置。
行业特定的 group/layer/labels 已移入各 YAML 数据文件。
"""

# ── 布局参数 ────────────────────
NODE_W = 150
NODE_H = 72
LAYER_GAP = 180
GROUP_GAP = 20
ROW_GAP = 8
PADDING = 60

# ── 位置颜色方案（通用，可被 YAML 覆盖）─────────
POSITION_COLORS = {
    "upstream":   {"border": "#2a5a7a", "bg": "#152535", "tag_bg": "#152a38", "tag_text": "#4fc3f7"},
    "midstream":  {"border": "#2a5a3a", "bg": "#152535", "tag_bg": "#153020", "tag_text": "#66bb6a"},
    "downstream": {"border": "#5a4a2a", "bg": "#152535", "tag_bg": "#302a15", "tag_text": "#ffb74d"},
    "equipment":  {"border": "#4a2a5a", "bg": "#152535", "tag_bg": "#281530", "tag_text": "#ce93d8"},
}
