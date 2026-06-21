# Semiconductor React SPA 迁移实施文档

## 1. 背景

当前项目基于 `YAML -> Python -> 多个 HTML` 的静态生成模式运行，已经具备以下能力：

- 单产业链图谱生成：`generate_g6.py`
- 融合图谱生成：`generate_fusion.py`
- 市场热度缓存：`data/market_heat.json`
- 浏览器侧 G6 交互：`templates/g6_app.js`

现有方案的优势是简单、稳定、可直接打开；缺点是页面割裂，筛选和跨链交互难以持续扩展。迁移目标不是推翻旧系统，而是在保留旧链路的前提下，新建一套可维护的 React SPA。

## 2. 范围

### 2.1 本次范围

- 在 `projects/semiconductor/web/` 新建 React + Vite + TypeScript SPA
- 新增 `generate_data.py`，把 YAML 和现有 Python 布局逻辑导出为 JSON
- 通过路由替代当前 6 个 HTML 页面
- 迁移现有核心交互：搜索、筛选、节点聚焦、详情面板、热度刷新
- 保留旧 HTML 产物和原有生成脚本，作为稳定兜底

### 2.2 不在本次范围

- 不改写 YAML 数据结构
- 不引入新的后端服务
- 不移除或替换旧版 `generate_g6.py` / `generate_fusion.py`
- 不与 `projects/stock` 做运行时耦合

## 3. 目录约定

```text
projects/semiconductor/
├── data/                          # YAML + 热度缓存 + 产能快照
├── docs/
│   └── react-spa-migration-plan.md
├── lib/                           # 现有 Python 数据与布局逻辑
├── templates/                     # 现有 HTML / G6 模板
├── web/                           # 新增 React SPA
│   ├── package.json
│   ├── vite.config.ts
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── styles/
│       ├── data/                  # 预生成 JSON
│       ├── types/
│       ├── store/
│       ├── hooks/
│       ├── utils/
│       ├── components/
│       └── pages/
├── generate_data.py               # 新增：YAML -> JSON 导出
├── generate_g6.py                 # 保留
├── generate_fusion.py             # 保留
└── *_chain_g6.html / fusion_chain.html
```

## 4. 技术决策

### 4.1 前端栈

- React 18
- Vite 6
- TypeScript 5
- TailwindCSS 3
- react-router-dom 6
- Zustand
- `@antv/g6` v4

说明：

- 继续采用与 `projects/stock/apps/web` 接近的前端基础栈，但不接入其 workspace，不复用其包管理结构。
- `projects/semiconductor` 保持独立项目；前端仅放在 `web/` 子目录。

### 4.2 数据源策略

- `YAML` 仍是唯一真相源
- `generate_data.py` 读取 YAML、热度缓存和布局逻辑，生成前端静态 JSON
- SPA 默认使用静态 JSON 启动
- 运行时热度刷新为增强能力，不作为页面可用性的前置条件

### 4.3 热度策略

- 首屏：使用 `generate_data.py` 导出的预计算热度字段
- 运行时：浏览器直接请求同花顺接口刷新 `d` / `d5`
- `d20` 默认仍以离线缓存和导出值为准
- 若运行时刷新失败，页面继续使用静态 JSON 中已有热度数据，不阻塞交互

## 5. JSON 契约

`generate_data.py` 需要输出 6 个 JSON：

- `semiconductor.json`
- `electronic_chemicals.json`
- `nonferrous_metals.json`
- `silicon_materials.json`
- `pcb_materials.json`
- `fusion.json`

### 5.1 单链 JSON 结构

```json
{
  "kind": "chain",
  "slug": "semiconductor",
  "title": "半导体全产业链图谱",
  "icon": "🔬",
  "flow_description": "",
  "generated_at": "2026-06-19T12:00:00",
  "stats": {
    "node_count": 26,
    "edge_count": 93,
    "group_count": 8,
    "stock_count": 140
  },
  "group_labels": {},
  "group_order": [],
  "stock_codes": [],
  "nodes": [],
  "edges": []
}
```

### 5.2 融合 JSON 结构

```json
{
  "kind": "fusion",
  "slug": "fusion",
  "title": "半导体全产业链融合图谱",
  "generated_at": "2026-06-19T12:00:00",
  "stats": {
    "node_count": 58,
    "edge_count": 120,
    "group_count": 20,
    "stock_count": 197
  },
  "group_labels": {},
  "group_order": [],
  "stock_codes": [],
  "nodes": [],
  "edges": []
}
```

### 5.3 `nodes[]` 字段要求

- `id`
- `name`
- `position`
- `tier`
- `description`
- `companies`
- `data_points`
- `new_capacity`
- `group`
- `layer`
- `x`
- `y`
- `heat_d`
- `heat_d5`
- `heat_d20`
- `industry`，单链可选，融合必填

### 5.4 `edges[]` 字段要求

- `from`
- `to`
- `product`
- `notes`
- `rel_type`
- `industry`，融合必填

## 6. 交互规则

### 6.1 路由

- `/` -> 融合总览
- `/chain/semiconductor`
- `/chain/electronic_chemicals`
- `/chain/nonferrous_metals`
- `/chain/silicon_materials`
- `/chain/pcb_materials`

### 6.2 筛选规则

- 单链页：允许多选 `group`
- 融合页：按完整 group key 筛选，key 格式保持 `industry/group`
- 空选择视为全部显示
- 筛选默认采用 `hide/show` 策略，而不是重新计算 layout

### 6.3 搜索规则

搜索命中任一字段即视为可见：

- 节点名称
- 节点 ID
- 节点描述
- 公司名称
- 股票代码

### 6.4 聚焦规则

- 点击节点后，高亮自身、一级上游、一级下游
- 非关联节点降透明度，不移除
- 关闭面板或点击画布后恢复默认状态

## 7. 实施阶段

### Phase 1：数据层

- 新增 `generate_data.py`
- 导出 6 份 JSON 到 `web/src/data/`
- 保证字段契约稳定

完成标准：

- `python generate_data.py --all` 成功执行
- `web/src/data/` 下出现 6 个 JSON
- 任一 JSON 都包含 `stats`、`stock_codes`、`nodes`、`edges`

### Phase 2：前端脚手架

- 初始化 `web/`
- 建立 Vite + React + TypeScript + Tailwind 基础结构
- 配置路由与全局样式

完成标准：

- `pnpm install`
- `pnpm dev`
- 首页可打开

### Phase 3：图谱与交互

- 迁移 G6 渲染
- 迁移 tooltip / detail panel / focus / filter / search
- 接入 Zustand 状态管理

完成标准：

- 6 条路由均可渲染图谱
- 搜索、筛选、聚焦、详情面板正常

### Phase 4：热度增强与验收

- 迁移运行时热度刷新逻辑
- 校正 UI 状态文案
- 补充构建验证

完成标准：

- `pnpm build` 通过
- 静态 JSON 可独立驱动页面
- 热度刷新失败不影响图谱主流程

## 8. 验证清单

- `python generate_data.py --all`
- `pnpm install`
- `pnpm dev`
- `pnpm build`
- 6 个路由可访问
- JSON 字段与页面使用字段一致
- 旧 HTML 仍可独立打开

## 9. 当前执行顺序

本轮开发从以下顺序开始：

1. 落地本实施文档
2. 实现 `generate_data.py`
3. 初始化 `web/` 项目
4. 搭建路由和基础页面骨架
