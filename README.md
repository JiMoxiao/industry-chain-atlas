# Industry Chain Atlas

![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)
![Python](https://img.shields.io/badge/python-3.11%2B-3776AB.svg)
![Node.js](https://img.shields.io/badge/node.js-20%2B-339933.svg)
![React](https://img.shields.io/badge/react-18-61DAFB.svg)
![FastAPI](https://img.shields.io/badge/fastapi-0.136%2B-009688.svg)
![Vite](https://img.shields.io/badge/vite-6-646CFF.svg)

多领域产业链可视化工作台，基于 `FastAPI + React + Vite + AntV G6` 构建。当前覆盖半导体及上游材料（电子化学品、有色金属、硅材料、PCB 材料），支持单链浏览与融合图谱交叉分析。

**核心思路**：YAML 源数据驱动 + 可交互有向图谱 + 研究结论内嵌 + 热度/产能时序缓存。

适合产业链研究、投研知识梳理、行业分析工具的二次开发。

## 快速开始

### 环境要求

- `Python 3.11+`
- `Node.js 20+`
- `pnpm 9+`

### 克隆并启动

```bash
git clone https://github.com/JiMoxiao/industry-chain-atlas.git
cd industry-chain-atlas
```

**Windows 一键启动：**

```bat
start.bat
```

双击 `start.bat` 或在终端执行它即可。脚本会自动完成依赖安装、数据生成、前后端后台启动，并打开浏览器访问 `http://localhost:5173/`。

> `start.bat` 会自动以 `ExecutionPolicy Bypass` 调用内部 `PowerShell` 脚本，普通用户无需手动设置执行策略。

**兼容旧入口：**

```powershell
.\start.ps1
```

**跨平台手动启动：**

```bash
pip install -r backend/requirements.txt
cd web && pnpm install && cd ..
python generate_data.py --all
python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8001 &   # 后端
cd web && pnpm dev --host 127.0.0.1 --port 5173                              # 前端
```

## 常用命令

| 用途 | 命令 |
|------|------|
| 启动图谱 | `start.bat` |
| 停止后台服务 | `stop.bat` |
| 刷新全部研究数据 | `refresh-data.bat` |
| 仅刷新热度缓存 | `refresh-heat.bat` |
| 生成全部 JSON 数据 | `python generate_data.py --all` |
| 生成单条子链 | `python generate_data.py semiconductor` |
| 生成融合图谱 | `python generate_data.py fusion` |
| 前端开发 | `cd web && pnpm dev` |
| 前端构建 | `cd web && pnpm build` |

> `refresh-data.bat` 和 `refresh-heat.bat` 都会自动调用内部 `PowerShell` 脚本；后端未启动时会自动回退到本地脚本模式。

## 项目结构

```text
├── backend/                 # FastAPI 服务、任务调度、接口入口
├── data/                    # YAML 源数据、热度缓存、产能快照
├── lib/                     # Python 数据处理、布局、趋势和审计逻辑
├── web/                     # React + Vite 前端
├── generate_data.py         # 生成前端消费的 JSON 数据
├── refresh-data.bat         # Windows 双击刷新全部数据
├── refresh-heat.bat         # Windows 双击仅刷新热度缓存
├── snapshot.py              # 生成产能快照
├── update_heat.py           # 更新市场热度
├── refresh-data.ps1         # 刷新研究数据/热度缓存
├── start.bat                # Windows 双击启动入口
├── start.ps1                # Windows 一键启动
├── stop.bat                 # Windows 双击停止入口
├── stop.ps1                 # 停止后台服务
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

### 为什么首次打开图谱页会稍慢？

前端按需加载 G6 图谱引擎，首次进入需初始化；再次访问会更快。

### 页面样式或图谱没有更新？

1. 重新运行 `python generate_data.py --all`
2. 重启后端服务
3. 刷新前端页面

### 启动后看不到终端窗口？

`start.bat` 默认将前后端置于后台运行。确认方式：浏览器访问 `http://localhost:5173/`，或查看日志 `.dbg/runtime/logs/`。

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

## 许可

MIT · 详见 [LICENSE](./LICENSE)
