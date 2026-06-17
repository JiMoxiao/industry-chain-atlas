# Semiconductor Industry Chain Atlas

半导体全产业链图谱 — 独立于 capacity-cycle 的交互式知识库。

## 目录

```
semiconductor/
├── data/
│   └── semiconductor.yaml   # 产业链定义（26 环节 / 93 供应关系 / 140+ 公司）
├── generate_viz.py          # YAML → 交互式 HTML 生成器
├── industry_chain.html      # 生成的可视化页面（浏览器直接打开）
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
