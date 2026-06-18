"""
产业链图谱 — 通用配置常量
仅包含布局参数和颜色方案等跨行业通用配置。
行业特定的 group/layer/labels 已移入各 YAML 数据文件。
"""

# ── 布局参数 ────────────────────
NODE_W = 155
NODE_H = 78
LAYER_GAP = 280
GROUP_GAP = 60
ROW_GAP = 50
PADDING = 60

# ── 位置颜色方案（通用，可被 YAML 覆盖）─────────
POSITION_COLORS = {
    "upstream":   {"border": "#1b6e2e", "bg": "#f0faf3", "tag_bg": "#d4edda", "tag_text": "#155724"},
    "midstream":  {"border": "#78909c", "bg": "#f8fafb", "tag_bg": "#eceff1", "tag_text": "#455a64"},
    "downstream": {"border": "#c0392b", "bg": "#fef5f5", "tag_bg": "#fde8e8", "tag_text": "#8b0000"},
    "equipment":  {"border": "#43a047", "bg": "#f5fdf6", "tag_bg": "#e8f5e9", "tag_text": "#2e7d32"},
}
