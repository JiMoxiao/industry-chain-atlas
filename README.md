# Semiconductor Industry Chain Atlas

半导体全产业链图谱 — 独立于 capacity-cycle 的交互式知识库。

## 目录

```
semiconductor/
├── data/
│   ├── semiconductor.yaml      # 产业链定义（26 环节 / 93 供应关系 / 140+ 公司）
│   └── market_heat.json        # 市场热度数据缓存
├── lib/
│   ├── config.py               # 配置常量（分组/分层/颜色/布局参数）
│   ├── data_loader.py          # YAML 读取 + 热度数据合并 + 扁平化
│   ├── layout.py               # 分层布局引擎
│   └── renderer.py             # 模板加载 + 数据注入 → 自包含 HTML
├── templates/
│   ├── styles.css              # 样式（独立可预览）
│   ├── app.js                  # 交互逻辑（拖拽/缩放/过滤/面板/提示）
│   └── page.html               # HTML 骨架
├── generate_viz.py             # 入口：5 行调度逻辑
├── industry_chain.html         # 生成的可视化页面（浏览器直接打开）
├── README.md
```

## 快速开始

```bash
# 更新 YAML 后重新生成 HTML
python generate_viz.py

# 浏览器直接打开
start industry_chain.html
```

## 覆盖范围

| 层级 | 环节数 | 代表公司 |
|------|--------|---------|
| 上游材料 | 13 | 沪硅产业、天岳先进、江丰电子、安集科技、华特气体、南大光电、路维光电、江化微、富创精密、沃格光电、深南电路、康强电子、华海诚科 等 |
| 中游制造/设计 | 10 | 中芯国际、华虹公司、寒武纪、海光信息、兆易创新、圣邦股份、豪威集团、斯达半导、卓胜微、敏芯股份 等 |
| 下游应用 | 3 | 工业富联、浪潮信息、德赛西威、拓普集团 等 |

**特色**：VCU 风格全交互式可视化，支持搜索/过滤/缩放/点击详情。

## 设计原则

- **YAML 是唯一真相源**：HTML 从 YAML 生成，不手动维护两份数据
- **自包含**：HTML 零外部依赖，浏览器直接打开
- **可复现**：修改 YAML → 运行 `generate_viz.py` → 新 HTML 立即可用
- **模块化源码**：配置/数据/布局/渲染/CSS/JS 各自独立文件，互不污染
