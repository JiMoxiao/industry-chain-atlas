# Semiconductor Industry Chain Atlas

半导体全产业链图谱 — 基于 AntV G6 的交互式知识库。

## 目录

```
semiconductor/
├── data/
│   ├── semiconductor.yaml           # 半导体产业链（26 环节 / 93 供应关系）
│   ├── electronic_chemicals.yaml    # 电子化学品（9 环节）
│   ├── nonferrous_metals.yaml       # 有色金属（10 环节）
│   ├── silicon_materials.yaml       # 硅材料（8 环节）
│   ├── pcb_materials.yaml           # PCB 材料（5 环节）
│   ├── market_heat.json             # 市场热度缓存
│   └── capacity_snapshots/          # 产能快照
├── lib/
│   ├── config.py                    # 布局常量
│   ├── data_loader.py               # 单 YAML 读取 + 扁平化
│   ├── fusion.py                    # 多 YAML 融合引擎
│   └── layout.py                    # 分层布局引擎
├── templates/
│   ├── g6_page.html                 # G6 HTML 骨架
│   ├── g6_app.js                    # G6 交互逻辑
│   └── styles.css                   # 样式
├── generate_g6.py                   # 单产业链生成器
├── generate_fusion.py               # 融合图谱生成器
├── update_heat.py                   # 热度数据更新
├── snapshot.py                      # 产能快照工具
└── README.md
```

## 快速开始

```bash
# 生成单产业链图谱
python generate_g6.py semiconductor
python generate_g6.py electronic_chemicals

# 生成融合全图谱
python generate_fusion.py

# 浏览器打开
start semiconductor_chain_g6.html
start fusion_chain.html
```

## 产业链覆盖

| 模块 | 环节 | 公司 | YAML |
|------|------|------|------|
| 半导体 | 26 | 140+ | semiconductor.yaml |
| 电子化学品 | 9 | 35+ | electronic_chemicals.yaml |
| 有色金属 | 10 | 30+ | nonferrous_metals.yaml |
| 硅材料 | 8 | 25+ | silicon_materials.yaml |
| PCB 材料 | 5 | 15+ | pcb_materials.yaml |
| **融合** | **58** | **197** | 以上全部 |

## 设计原则

- **YAML 是唯一真相源**：HTML 从 YAML 生成，不手动维护两份数据
- **自包含**：HTML 零外部依赖（G6 走 CDN），浏览器直接打开
- **可复现**：修改 YAML → 运行 generator → 新 HTML 立即可用
- **模块化**：配置/数据/布局/融合/模板各司其职
