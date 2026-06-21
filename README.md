# Semiconductor Industry Chain Atlas

![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)
![Python](https://img.shields.io/badge/python-3.11%2B-3776AB.svg)
![Node.js](https://img.shields.io/badge/node.js-20%2B-339933.svg)
![React](https://img.shields.io/badge/react-18-61DAFB.svg)
![FastAPI](https://img.shields.io/badge/fastapi-0.136%2B-009688.svg)
![Vite](https://img.shields.io/badge/vite-6-646CFF.svg)

一个面向半导体产业链研究的可视化工作台，基于 `FastAPI + React + Vite + AntV G6` 构建。

它把产业链 YAML 数据、研究总览、趋势分析、热度缓存和图谱交互整合到同一个本地可运行项目里，适合用于：

- 产业链研究与知识梳理
- 融合图谱与子链关系浏览
- 本地数据维护与可视化验证
- 面向投研、行业分析或知识库场景的二次开发

## 快速链接

- 快速开始：[`3 分钟快速开始`](#3-分钟快速开始)
- 贡献说明：[CONTRIBUTING.md](./CONTRIBUTING.md)
- 开源协议：[LICENSE](./LICENSE)

## 项目概览

这个项目的核心目标是把“产业链结构数据 + 研究结论 + 可交互图谱”统一到一个可本地运行、可扩展、可二次开发的工作台中。

相较于只输出静态图谱或只保留 YAML 原始数据的方式，这个项目更适合以下场景：

- 团队内部做产业链研究协作
- 快速验证新的链路结构和上下游关系
- 把研究结果转成可浏览、可筛选、可搜索的图谱界面
- 作为行业研究知识库或投研工具的基础模板

## 功能亮点

- 融合图谱与多条子链图谱统一浏览
- 研究总览、趋势、审计结果集中展示
- 后端热度缓存机制，减少重复刷新
- 支持手动刷新研究数据和热度数据
- YAML 源数据驱动，便于扩展与维护
- 提供 Windows 一键启动脚本，首次上手成本低

## 技术栈

- 前端：`React`、`TypeScript`、`Vite`、`Tailwind CSS`、`AntV G6`、`Zustand`
- 后端：`FastAPI`、`Uvicorn`、`APScheduler`
- 数据：`YAML`、本地 `JSON` 缓存、研究审计与趋势生成脚本

## 界面预览

当前 README 暂未内置正式截图或演示 GIF。

如果你准备正式公开仓库，建议后续在这里补充：

- 首页总览截图
- 融合图谱页面截图
- 节点详情面板截图
- 简短操作 GIF

## 3 分钟快速开始

### 环境要求

- `Python 3.11+`
- `Node.js 20+`
- `pnpm 9+`

### 1. 克隆项目

```bash
git clone <your-repo-url>
cd semiconductor
```

### 2. Windows 用户一键启动

在项目根目录执行：

```powershell
.\start.ps1
```

该脚本会自动：

1. 安装后端依赖
2. 检查前端依赖
3. 生成前端消费的 JSON 数据
4. 在后台启动后端服务
5. 在后台启动前端开发服务
6. 自动打开浏览器

默认不会再额外弹出两个命令行窗口，服务会在后台运行，并把日志写入：

- `.dbg/runtime/logs/backend.out.log`
- `.dbg/runtime/logs/frontend.out.log`

启动成功后访问：

- 前端：`http://localhost:5173/`
- 后端：`http://127.0.0.1:8001/`

如果 PowerShell 首次执行脚本被拦截，可先执行：

```powershell
Set-ExecutionPolicy -Scope Process Bypass
```

然后再次运行：

```powershell
.\start.ps1
```

### 3. 跨平台手动启动

如果你不使用 Windows，或者想分别调试前后端，可以按下面的方式启动。

安装后端依赖：

```bash
python -m pip install -r backend/requirements.txt
```

安装前端依赖：

```bash
cd web
pnpm install
cd ..
```

生成图谱和研究数据：

```bash
python generate_data.py --all
```

启动后端：

```bash
python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8001
```

启动前端：

```bash
cd web
pnpm dev --host 127.0.0.1 --port 5173
```

## 常用命令

### 一键启动

```powershell
.\start.ps1
```

### 停止后台服务

```powershell
.\stop.ps1
```

### 刷新全部研究数据

```powershell
.\refresh-data.ps1
```

说明：

- 如果后端已启动，脚本会调用后端任务接口刷新
- 如果后端未启动，脚本会自动回退到本地脚本模式

### 仅刷新热度缓存

```powershell
.\refresh-data.ps1 -HeatOnly
```

### 重新生成前端 JSON 数据

```bash
python generate_data.py --all
```

### 仅生成某条子链

```bash
python generate_data.py semiconductor
python generate_data.py silicon_materials
```

### 仅生成融合图谱

```bash
python generate_data.py fusion
```

### 前端开发

```bash
cd web
pnpm dev
```

### 前端构建

```bash
cd web
pnpm build
```

### 前端类型检查

```bash
cd web
pnpm check
```

## 项目结构

```text
semiconductor/
├── backend/                 # FastAPI 服务、任务调度、接口入口
├── data/                    # YAML 源数据、热度缓存、产能快照
├── docs/                    # 项目文档
├── lib/                     # Python 数据处理、布局、趋势和审计逻辑
├── templates/               # 旧版静态模板资源
├── web/                     # React + Vite 前端
├── generate_data.py         # 生成前端消费的 JSON 数据
├── snapshot.py              # 生成产能快照
├── update_heat.py           # 更新市场热度
├── refresh-data.ps1         # 刷新研究数据/热度缓存
├── start.ps1                # Windows 一键启动脚本
├── stop.ps1                 # 停止后台前后端服务
└── README.md
```

## 数据如何流动

### 数据源

- `data/*.yaml` 是产业链结构与研究内容的源数据
- `data/market_heat.json` 存放市场热度缓存
- `data/capacity_snapshots/` 存放产能趋势快照

### 生成流程

执行 `python generate_data.py --all` 后会输出：

- 各子链图谱 JSON
- 融合图谱 JSON
- 研究总览 JSON
- 研究趋势 JSON
- 研究审计 JSON

这些文件会被写入 `web/src/data/`，供前端和后端共同消费。

### 运行时链路

- 后端优先读取已生成的 JSON 数据
- 后端在进程内做缓存，减少重复构建
- 前端优先读取服务端结果，必要时回退到本地静态 JSON
- 热度接口默认优先返回服务端缓存，避免每次打开页面都重新刷新

## 后端 API 概览

当前主要接口包括：

- `GET /api/health`：健康检查
- `GET /api/chains/{slug}`：获取单条产业链图谱
- `GET /api/fusion`：获取融合图谱
- `GET /api/research/bundle`：获取研究总览与审计数据
- `GET /api/research/trends`：获取趋势数据
- `GET /api/heat`：获取股票热度缓存，可选 `refresh=true`
- `GET /api/jobs/status`：查看后台刷新任务状态
- `POST /api/jobs/refresh`：触发完整刷新
- `POST /api/jobs/refresh-heat`：仅触发热度刷新

## 当前内置产业链

目前项目内置以下产业链数据：

- `semiconductor`
- `electronic_chemicals`
- `nonferrous_metals`
- `silicon_materials`
- `pcb_materials`
- `fusion`

如果你要扩展新的链路，通常需要完成以下步骤：

1. 在 `data/` 下新增或维护对应 YAML
2. 更新生成逻辑或图谱元数据
3. 运行 `python generate_data.py --all`
4. 启动前端和后端验证展示结果

## 常见问题

### 1. 为什么首次打开图谱页会稍慢？

首次进入图谱页时，前端需要按需加载 G6 图谱引擎，属于正常现象；后续再次进入通常会更快。

### 2. 为什么我换了浏览器后数据状态不一致？

当前实现已经优先消费服务端缓存，但如果后端没有运行，前端只能退回到本地静态数据模式。开发时建议始终同时启动前后端。

### 3. PowerShell 执行脚本被系统拦截怎么办？

先执行：

```powershell
Set-ExecutionPolicy -Scope Process Bypass
```

然后重新运行 `.\start.ps1` 或 `.\refresh-data.ps1`。

### 4. 页面样式或图谱没有更新怎么办？

通常按下面顺序排查：

1. 重新运行 `python generate_data.py --all`
2. 重启后端服务
3. 刷新前端页面

### 5. 启动后看不到终端窗口，服务是不是没起来？

现在 `.\start.ps1` 默认会把前后端放到后台运行，这是预期行为。

你可以通过下面几种方式确认：

1. 浏览器是否自动打开 `http://localhost:5173/`
2. 访问 `http://127.0.0.1:8001/api/health`
3. 查看日志文件：
   - `.dbg/runtime/logs/backend.out.log`
   - `.dbg/runtime/logs/frontend.out.log`

## 适合二次开发的入口

- 前端入口：`web/src/App.tsx`
- 图谱页布局：`web/src/components/AtlasPage.tsx`
- 侧栏与工作台外壳：`web/src/components/AppLayout.tsx`
- 图谱画布：`web/src/components/Canvas.tsx`
- 后端入口：`backend/main.py`
- 数据生成入口：`generate_data.py`

## 贡献建议

欢迎通过以下方式参与改进：

- 提交 Issue 反馈 bug 或体验问题
- 提交 PR 优化图谱交互、样式、性能或数据结构
- 补充新的产业链 YAML 数据和研究内容
- 改进启动脚本、文档和跨平台体验

如果你准备对数据结构或接口做较大调整，建议先开 Issue 讨论。

详细协作规范见 [CONTRIBUTING.md](./CONTRIBUTING.md)。

## 免责声明

本项目主要用于产业链研究、数据整理与可视化展示，不构成投资建议。项目内数据与分析结果请结合你的实际研究流程进行校验。

## 开源建议

为了让这个仓库更适合公开使用，当前已经补充：

- `MIT LICENSE`
- `CONTRIBUTING.md`
- 更完整的快速开始和开发说明

后续你还可以继续补充：

- README 截图或演示 GIF
- 数据来源说明
- 示例 YAML 或演示数据说明
- `CHANGELOG.md`
