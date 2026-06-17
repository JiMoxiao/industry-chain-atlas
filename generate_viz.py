"""
半导体产业链交互式图谱生成器
读取 data/semiconductor.yaml → 生成分层有向图 HTML
布局: 手动分层(物料→设备→设计→制造→封测→终端) × 功能分组
"""

import json
import yaml
import os
from collections import defaultdict

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
YAML_PATH = os.path.join(SCRIPT_DIR, "data", "semiconductor.yaml")
OUTPUT_PATH = os.path.join(SCRIPT_DIR, "industry_chain.html")

# ── 功能分组 (同层内按此排序) ────────────────
GROUP_ORDER = {
    "material": 0, "equipment": 1, "packaging_prep": 2,
    "design_ip": 3, "wafer_fab": 4, "packaging": 5, "end_product": 6,
}

# segment_id → group
NODE_GROUP = {
    "semi_silicon_wafer": "material", "semi_sic_substrate": "material",
    "semi_specialty_gas": "material", "semi_target_material": "material",
    "semi_cmp_materials": "material", "semi_photoresist": "material",
    "semi_photomask": "material", "semi_wet_chemicals": "material",
    "semi_equipment": "equipment", "semi_equipment_parts": "equipment",
    "semi_glass_substrate": "packaging_prep", "semi_ic_substrate": "packaging_prep",
    "semi_packaging_materials": "packaging_prep",
    "semi_eda_ip": "design_ip",
    "semi_ai_chip": "design_ip", "semi_storage": "design_ip",
    "semi_analog_mcu": "design_ip", "semi_rf_frontend": "design_ip",
    "semi_cis": "design_ip", "semi_mems_sensor": "design_ip",
    "semi_power_discrete": "design_ip",
    "semi_wafer_fab": "wafer_fab", "semi_packaging": "packaging",
    "semi_ai_server": "end_product", "semi_pcb_ccl": "end_product",
    "semi_auto_electronics": "end_product",
}

# ── 手动分层 (供应链流向) ────────────────
MANUAL_LAYERS = {
    # 0: 原材料与耗材
    "semi_silicon_wafer": 0, "semi_sic_substrate": 0,
    "semi_specialty_gas": 0, "semi_target_material": 0,
    "semi_cmp_materials": 0, "semi_photoresist": 0,
    "semi_photomask": 0, "semi_wet_chemicals": 0,
    # 1: 设备 / EDA / 封装上游
    "semi_equipment": 1, "semi_equipment_parts": 1,
    "semi_eda_ip": 1,
    "semi_glass_substrate": 1, "semi_ic_substrate": 1,
    "semi_packaging_materials": 1,
    # 2: 芯片设计
    "semi_ai_chip": 2, "semi_storage": 2, "semi_analog_mcu": 2,
    "semi_rf_frontend": 2, "semi_cis": 2, "semi_mems_sensor": 2,
    "semi_power_discrete": 2,
    # 3: 晶圆制造
    "semi_wafer_fab": 3,
    # 4: 封装测试
    "semi_packaging": 4,
    # 5: 终端应用
    "semi_ai_server": 5, "semi_pcb_ccl": 5, "semi_auto_electronics": 5,
}

POSITION_COLORS = {
    "upstream":   {"border": "#2a5a7a", "bg": "#152535", "tag_bg": "#152a38", "tag_text": "#4fc3f7"},
    "midstream":  {"border": "#2a5a3a", "bg": "#152535", "tag_bg": "#153020", "tag_text": "#66bb6a"},
    "downstream": {"border": "#5a4a2a", "bg": "#152535", "tag_bg": "#302a15", "tag_text": "#ffb74d"},
    "equipment":  {"border": "#4a2a5a", "bg": "#152535", "tag_bg": "#281530", "tag_text": "#ce93d8"},
}

GROUP_LABELS = {
    "material":        ("🧪 材料/耗材", "#4fc3f7"),
    "equipment":       ("🔧 设备/零部件", "#ce93d8"),
    "packaging_prep":  ("📦 封装上游", "#ff8a65"),
    "design_ip":       ("🧠 芯片设计", "#66bb6a"),
    "wafer_fab":       ("🏭 晶圆制造", "#ffb74d"),
    "packaging":       ("📦 封装测试", "#ffb74d"),
    "end_product":     ("🖥 终端应用", "#ef5350"),
}


# ── 数据扁平化 ──────────────────────────────

def build_segment_edges(segments, supply_rels):
    co_to_segs = defaultdict(list)
    for seg in segments:
        for co in seg.get("key_companies", []):
            co_to_segs[co["code"]].append(seg["id"])

    pairs = set()
    edges = []
    for rel in supply_rels:
        sup = rel.get("supplier_code", "")
        buy = rel.get("buyer_code", "")
        for ss in co_to_segs.get(sup, []):
            for bs in co_to_segs.get(buy, []):
                if ss != bs and (ss, bs) not in pairs:
                    pairs.add((ss, bs))
                    edges.append({
                        "from": ss, "to": bs,
                        "product": rel.get("product", ""),
                        "notes": rel.get("notes", ""),
                        "rel_type": rel.get("relationship_type", "primary"),
                    })
    return edges


def flatten_data(data):
    segments = data["segments"]
    supply_rels = data.get("supply_relationships", [])
    nodes = []
    for seg in segments:
        companies = [{"code": c["code"], "name": c["name"], "role": c["role"]}
                     for c in seg.get("key_companies", [])]
        new_cap = [{"company": nc.get("company",""), "scale": nc.get("scale",""),
                     "expected_online": nc.get("expected_online",""), "status": nc.get("status","")}
                   for nc in seg.get("new_capacity", [])]
        nodes.append({
            "id": seg["id"], "name": seg["name"],
            "position": seg.get("position", "midstream"),
            "tier": seg.get("tier", 1),
            "description": seg.get("description", ""),
            "companies": companies,
            "data_points": seg.get("data_points", []),
            "new_capacity": new_cap,
            "group": NODE_GROUP.get(seg["id"], "material"),
            "layer": MANUAL_LAYERS.get(seg["id"], 2),
        })
    edges = build_segment_edges(segments, supply_rels)
    return {"nodes": nodes, "edges": edges}


# ── 布局 ────────────────────────────────────

def layout_nodes(nodes):
    """按层垂直居中，组间gap合理"""
    NODE_W, NODE_H = 150, 70
    LAYER_GAP = 180
    GROUP_GAP = 20
    ROW_GAP = 8
    PADDING = 60

    # 每层每group的节点
    layer_groups = defaultdict(lambda: defaultdict(list))
    for n in nodes:
        layer_groups[n["layer"]][n["group"]].append(n)

    # 先算每列总高度
    col_heights = {}
    for lyr, groups in layer_groups.items():
        total = 0
        gkeys = sorted(groups.keys(), key=lambda g: GROUP_ORDER.get(g, 99))
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
        # 垂直居中：在 max_col_h 内居中本列
        offset_y = (max_col_h - col_h) / 2

        y = PADDING + offset_y
        gkeys = sorted(groups.keys(), key=lambda g: GROUP_ORDER.get(g, 99))
        for gi, gk in enumerate(gkeys):
            if gi > 0:
                y += GROUP_GAP
            for ni, n in enumerate(sorted(groups[gk], key=lambda n: n["name"])):
                positions[n["id"]] = {"x": x, "y": y + ni * (NODE_H + ROW_GAP)}
            y += len(groups[gk]) * (NODE_H + ROW_GAP)

    max_x = PADDING + max_layer * (NODE_W + LAYER_GAP) + NODE_W
    return positions, max_x + PADDING, max_col_h + PADDING * 2


# ── HTML 模板 ────────────────────────────────

def gen_html(flat_data):
    nodes = flat_data["nodes"]
    edges = flat_data["edges"]
    positions, canvas_w, canvas_h = layout_nodes(nodes)

    nodes_json = json.dumps(nodes, ensure_ascii=False, indent=2)
    edges_json = json.dumps(edges, ensure_ascii=False, indent=2)
    pos_json = json.dumps(positions, ensure_ascii=False)
    pos_colors_json = json.dumps(POSITION_COLORS, ensure_ascii=False)
    group_labels_json = json.dumps(GROUP_LABELS, ensure_ascii=False)

    return f'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>半导体全产业链图谱</title>
<style>
*{{box-sizing:border-box;margin:0;padding:0}}
body{{font-family:'Segoe UI','Microsoft YaHei',sans-serif;overflow:hidden;height:100vh;background:#0a1219}}
#app{{display:flex;height:100vh;width:100vw}}
#topbar{{position:absolute;top:0;left:0;right:0;z-index:20;display:flex;align-items:center;gap:10px;padding:7px 16px;
  background:linear-gradient(180deg,#152230,#0f1a25);border-bottom:1px solid #1e3040;color:#c0d0d0;flex-wrap:wrap}}
#topbar h1{{font-size:15px;font-weight:600;background:linear-gradient(90deg,#4fc3f7,#66bb6a,#ffb74d);-webkit-background-clip:text;-webkit-text-fill-color:transparent;white-space:nowrap}}
#topbar button{{padding:5px 12px;border-radius:5px;border:1px solid #2a3d50;background:#152535;color:#90a0b0;cursor:pointer;font-size:11px;transition:all .15s}}
#topbar button:hover{{background:#1e3045;border-color:#4a6d90;color:#c0d0d0}}
#topbar button.on{{background:#15354a;border-color:#4fc3f7;color:#4fc3f7}}
#topbar .sep{{width:1px;height:16px;background:#2a3d50}}
#topbar input{{padding:5px 12px;border-radius:5px;border:1px solid #2a3d50;background:#0d1922;color:#c0d0d0;font-size:11px;width:170px;outline:none}}
#topbar input:focus{{border-color:#4fc3f7}}
#topbar input::placeholder{{color:#3a5060}}
#canvas-wrap{{flex:1;position:relative;overflow:hidden;cursor:grab}}
#canvas-wrap:active{{cursor:grabbing}}
#diagram{{position:absolute;top:0;left:0;transform-origin:0 0}}
#diagram svg{{position:absolute;top:0;left:0;pointer-events:none}}
#diagram svg path{{fill:none;stroke-width:1.8;stroke-linecap:round;opacity:0.35}}
#diagram svg .ep{{stroke:#4fc3f7}}
#diagram svg .es{{stroke:#5a7a8a}}
#diagram svg .ex{{stroke:#ff7043;stroke-dasharray:6 3}}
.node{{position:absolute;background:#152535;border:2px solid #2a4a6a;border-radius:10px;padding:10px 14px;
  cursor:pointer;text-align:center;transition:all .18s;min-width:130px;user-select:none;z-index:1}}
.node:hover{{border-color:#4fc3f7;box-shadow:0 0 16px rgba(79,195,247,.3);z-index:10}}
.node.sel{{border-color:#4fc3f7!important;box-shadow:0 0 24px rgba(79,195,247,.45)!important;z-index:10}}
.node.hidden{{display:none}}
.node .nid{{font-size:9px;font-weight:700;color:#4fc3f7;font-family:'Consolas',monospace}}
.node .nn{{font-size:12px;color:#d0e0e0;margin-top:2px;font-weight:600}}
.node .nc{{font-size:10px;color:#5a7a8a;margin-top:2px}}
.node .pos-tag{{display:inline-block;font-size:8px;padding:1px 6px;border-radius:6px;margin-top:3px;font-weight:600}}
.group-label{{position:absolute;font-size:10px;padding:2px 10px;border-radius:3px;pointer-events:none;z-index:0;white-space:nowrap;font-weight:600;opacity:0.55}}
#panel{{position:fixed;top:42px;right:0;bottom:0;width:460px;background:#0d1922;border-left:1px solid #1e3040;
  display:flex;flex-direction:column;z-index:15;transform:translateX(100%);transition:transform .3s}}
#panel.open{{transform:translateX(0)}}
#panel .ph{{padding:12px 16px;background:#111d28;border-bottom:1px solid #1e3040;display:flex;justify-content:space-between;align-items:flex-start;flex-shrink:0}}
#panel .ph h2{{font-size:16px;color:#4fc3f7}}
#panel .ph .sub{{font-size:11px;color:#6a7d8d;margin-top:4px}}
#panel .ph button{{background:none;border:none;color:#6a7d8d;font-size:22px;cursor:pointer;flex-shrink:0}}
#panel .pt{{display:flex;border-bottom:1px solid #1e3040;flex-shrink:0}}
#panel .pt button{{flex:1;padding:9px 4px;border:none;background:transparent;color:#6a7d8d;cursor:pointer;font-size:11px;border-bottom:2px solid transparent;transition:all .15s}}
#panel .pt button:hover{{color:#b0c0c0}}
#panel .pt button.on{{color:#4fc3f7;border-bottom-color:#4fc3f7}}
#panel .pb{{flex:1;overflow-y:auto;padding:16px;color:#b0c0c0;font-size:13px;line-height:1.75}}
#panel .pb h3{{color:#66bb6a;font-size:13px;margin:14px 0 8px}}
#panel .pb h3:first-child{{margin-top:0}}
#panel .pb .desc{{background:#152a20;border-left:3px solid #66bb6a;padding:10px 12px;margin:8px 0;border-radius:0 6px 6px 0;font-size:12px;line-height:1.8}}
#panel .pb table{{width:100%;border-collapse:collapse;margin:8px 0;font-size:11px}}
#panel .pb th{{background:#152535;color:#66bb6a;padding:6px 10px;text-align:left;font-weight:600}}
#panel .pb td{{padding:5px 10px;border-bottom:1px solid #152535;vertical-align:top}}
#panel .pb .code{{color:#4fc3f7;font-family:'Consolas',monospace;font-size:11px}}
#panel .pb .edge-item{{background:#152535;padding:8px 12px;margin:4px 0;border-radius:6px;border-left:2px solid #2a4a6a;font-size:11px}}
#panel .pb .edge-item .edir{{font-weight:600}}
.tag-cap{{display:inline-block;padding:1px 8px;border-radius:8px;font-size:10px;margin:2px}}
.tag-plan{{background:#302a15;color:#ffb74d;border:1px solid #4a3a20}}
.tag-const{{background:#302015;color:#ff9800;border:1px solid #4a3020}}
.tag-ramp{{background:#153020;color:#66bb6a;border:1px solid #1e4a30}}
.tag-equip{{background:#2a1530;color:#ba68c8;border:1px solid #3a2050}}
.hint{{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#2a3d50;text-align:center;pointer-events:none;z-index:0}}
.hint .ic{{font-size:40px;margin-bottom:8px}}
.hint .tx{{font-size:13px}}
#legends{{position:absolute;bottom:12px;left:50%;transform:translateX(-50%);display:flex;gap:16px;color:#3a5060;font-size:10px;pointer-events:none;z-index:0}}
#legends span{{display:flex;align-items:center;gap:5px}}
#legends .ld{{width:10px;height:2px;border-radius:1px}}
#flow-arrows{{position:absolute;bottom:28px;left:50%;transform:translateX(-50%);display:flex;gap:8px;color:#3a5060;font-size:13px;pointer-events:none;z-index:0}}
</style>
</head>
<body>
<div id="app">
<div id="topbar">
  <h1>🔬 半导体全产业链图谱</h1>
  <div class="sep"></div>
  <button onclick="filterGroup('all')" id="fg-all" class="on">全部</button>
  <button onclick="filterGroup('material')" id="fg-material">🧪 材料</button>
  <button onclick="filterGroup('equipment')" id="fg-equipment">🔧 设备</button>
  <button onclick="filterGroup('design_ip')" id="fg-design_ip">🧠 设计</button>
  <button onclick="filterGroup('packaging')" id="fg-packaging">📦 封测</button>
  <button onclick="filterGroup('end_product')" id="fg-end_product">🖥 终端</button>
  <div class="sep"></div>
  <input type="text" id="search" placeholder="搜索环节/公司/股票代码..." oninput="doSearch()">
  <span style="flex:1"></span>
  <span id="mc" style="font-size:11px;color:#4a6070"></span>
</div>
<div id="canvas-wrap">
  <div id="diagram">
    <svg id="svg-layer" width="{canvas_w}" height="{canvas_h}"></svg>
    <div class="hint" id="hint"><div class="ic">🔍</div><div class="tx">点击任意环节查看上市公司与供应关系<br><small>滚轮缩放 · 拖拽平移 · 搜索过滤</small></div></div>
    <div id="legends">
      <span><span class="ld" style="background:#4fc3f7"></span> 主要供应</span>
      <span><span class="ld" style="background:#5a7a8a"></span> 次要供应</span>
      <span><span class="ld" style="border-top:2px dashed #ff7043;background:none"></span> 独家供应</span>
    </div>
    <div id="flow-arrows">原材料 → 设备/设计 → 晶圆制造 → 封装测试 → 终端应用</div>
  </div>
</div>
<div id="panel"><div class="ph"><div><h2 id="p-title"></h2><div class="sub" id="p-sub"></div></div><button onclick="closePanel()">✕</button></div>
<div class="pt">
  <button onclick="switchTab('overview')" id="tb-overview" class="on">概述</button>
  <button onclick="switchTab('companies')" id="tb-companies">上市公司</button>
  <button onclick="switchTab('metrics')" id="tb-metrics">数据指标</button>
  <button onclick="switchTab('edges')" id="tb-edges">供应关系</button>
</div>
<div class="pb" id="panel-body"></div></div>
</div>

<script>
// ==================== DATA ====================
const NODES = {nodes_json};
const EDGES = {edges_json};
const POSITIONS = {pos_json};
const POS_COLORS = {pos_colors_json};
const GROUP_LABELS = {group_labels_json};

const NODE_W = 150, NODE_H = 72;
const nodeMap = {{}};
NODES.forEach(n => {{ nodeMap[n.id] = n; }});

// ==================== RENDER ====================
const diagram = document.getElementById('diagram');
const svgLayer = document.getElementById('svg-layer');
const nodeEls = {{}};
const groupLabelEls = [];

// --- Group labels (render first so they're behind nodes) ---
const layerGroupPositions = {{}};
Object.entries(POSITIONS).forEach(([nid, pos]) => {{
  const n = nodeMap[nid]; if (!n) return;
  const key = `${{pos.x}}|${{n.group}}`;
  if (!layerGroupPositions[key]) layerGroupPositions[key] = {{x:pos.x, group:n.group, minY:pos.y}};
  else layerGroupPositions[key].minY = Math.min(layerGroupPositions[key].minY, pos.y);
}});

Object.values(layerGroupPositions).forEach(lp => {{
  const label = GROUP_LABELS[lp.group];
  if (!label) return;
  const div = document.createElement('div');
  div.className = 'group-label';
  div.style.cssText = `left:${{lp.x}}px;top:${{lp.minY - 26}}px;color:${{label[1]}};border:1px solid ${{label[1]}}33`;
  div.textContent = label[0];
  div.setAttribute('data-group', lp.group);
  diagram.appendChild(div);
  groupLabelEls.push(div);
}});

// --- Nodes ---
NODES.forEach(n => {{
  const pos = POSITIONS[n.id]; if (!pos) return;
  const c = POS_COLORS[n.position] || POS_COLORS.midstream;
  const div = document.createElement('div');
  div.className = 'node';
  div.id = 'n-' + n.id;
  div.style.cssText = `left:${{pos.x}}px;top:${{pos.y}}px;width:${{NODE_W}}px;min-height:${{NODE_H}}px;border-color:${{c.border}};background:${{c.bg}}`;
  div.innerHTML = `<div class="nid">${{n.id.replace('semi_','')}}</div><div class="nn">${{n.name}}</div><div class="nc">${{n.companies.length}} 家上市公司</div><span class="pos-tag" style="background:${{c.tag_bg}};color:${{c.tag_text}}">${{n.position}}</span>`;
  div.addEventListener('click', e => {{ e.stopPropagation(); openPanel(n.id); }});
  div.setAttribute('data-group', n.group);
  diagram.appendChild(div);
  nodeEls[n.id] = div;
}});

// --- Edges ---
const EDGE_CLASS = {{primary:'ep', secondary:'es', exclusive:'ex'}};
let svgHTML = '';
const drawnEdges = new Set();
EDGES.forEach(e => {{
  const f = POSITIONS[e.from], t = POSITIONS[e.to];
  if (!f || !t) return;
  const key = e.from + '|||' + e.to;
  const isDup = drawnEdges.has(key);
  drawnEdges.add(key);
  const x1 = f.x + NODE_W, y1 = f.y + NODE_H/2 + (isDup ? 4 : 0);
  const x2 = t.x, y2 = t.y + NODE_H/2 + (isDup ? 4 : 0);
  const midX = (x1 + x2) / 2;
  const cls = EDGE_CLASS[e.rel_type] || 'ep';
  svgHTML += `<path d="M${{x1}},${{y1}} C${{midX}},${{y1}} ${{midX}},${{y2}} ${{x2}},${{y2}}" class="${{cls}}" id="edge-${{e.from}}-${{e.to}}" data-from="${{e.from}}" data-to="${{e.to}}"/>`;
}});
svgLayer.innerHTML = svgHTML;

// ==================== PAN & ZOOM ====================
let scale = 1, panX = 0, panY = 0;
const canvasWrap = document.getElementById('canvas-wrap');
function applyTransform() {{ diagram.style.transform = `translate(${{panX}}px,${{panY}}px) scale(${{scale}})`; }}

canvasWrap.addEventListener('wheel', e => {{
  e.preventDefault();
  const ns = Math.min(2.5, Math.max(0.2, scale * (e.deltaY > 0 ? 0.92 : 1.08)));
  const r = canvasWrap.getBoundingClientRect();
  panX = (e.clientX - r.left) - ((e.clientX - r.left) - panX) * (ns / scale);
  panY = (e.clientY - r.top) - ((e.clientY - r.top) - panY) * (ns / scale);
  scale = ns; applyTransform();
}}, {{passive:false}});

let dragging = false, dragX, dragY;
canvasWrap.addEventListener('mousedown', e => {{
  if (e.target === canvasWrap || e.target.id === 'diagram' || e.target.classList.contains('group-label')) {{
    dragging = true; dragX = e.clientX - panX; dragY = e.clientY - panY; canvasWrap.style.cursor = 'grabbing';
  }}
}});
window.addEventListener('mousemove', e => {{ if (!dragging) return; panX = e.clientX - dragX; panY = e.clientY - dragY; applyTransform(); }});
window.addEventListener('mouseup', () => {{ dragging = false; canvasWrap.style.cursor = 'grab'; }});

function fitScreen() {{
  const w = canvasWrap.clientWidth, h = canvasWrap.clientHeight;
  scale = Math.min((w-80)/{canvas_w}, (h-120)/{canvas_h}, 1.0);
  panX = (w - {canvas_w}*scale)/2; panY = 40; applyTransform();
}}
window.addEventListener('resize', fitScreen);
setTimeout(fitScreen, 100);

// ==================== PANEL ====================
const panel = document.getElementById('panel');
let activeNode = null, activeTab = 'overview';

function openPanel(nodeId) {{
  activeNode = nodeMap[nodeId]; if (!activeNode) return;
  panel.classList.add('open'); activeTab = 'overview';
  document.querySelectorAll('#panel .pt button').forEach(b => b.classList.remove('on'));
  document.getElementById('tb-overview').classList.add('on');
  renderPanel();
  Object.values(nodeEls).forEach(el => el.classList.remove('sel'));
  if (nodeEls[nodeId]) nodeEls[nodeId].classList.add('sel');
}}

function closePanel() {{ panel.classList.remove('open'); activeNode = null; Object.values(nodeEls).forEach(el => el.classList.remove('sel')); }}

function switchTab(tab) {{
  activeTab = tab;
  document.querySelectorAll('#panel .pt button').forEach(b => b.classList.remove('on'));
  document.getElementById('tb-' + tab).classList.add('on');
  renderPanel();
}}

function renderPanel() {{
  if (!activeNode) return;
  const n = activeNode;
  const c = POS_COLORS[n.position] || POS_COLORS.midstream;
  document.getElementById('p-title').textContent = n.name;
  document.getElementById('p-sub').innerHTML = `<span style="background:${{c.tag_bg}};color:${{c.tag_text}};padding:1px 8px;border-radius:8px;font-size:10px;margin-right:8px">${{n.position}}</span>Tier ${{n.tier}} · ${{n.companies.length}} 家上市公司`;
  const body = document.getElementById('panel-body');

  if (activeTab === 'overview') {{
    let html = `<div class="desc">${{n.description}}</div>`;
    if (n.new_capacity && n.new_capacity.length > 0) {{
      html += '<h3>在建/扩产产能</h3><table><tr><th>企业</th><th>规模</th><th>预计投产</th><th>状态</th></tr>';
      const tagMap = {{construction:['建设中','tag-const'], ramp_up:['爬坡中','tag-ramp'], equipment:['设备搬入','tag-equip']}};
      n.new_capacity.forEach(nc => {{
        const [txt, cls] = tagMap[nc.status] || ['规划中','tag-plan'];
        html += `<tr><td>${{nc.company}}</td><td>${{nc.scale}}</td><td>${{nc.expected_online}}</td><td><span class="tag-cap ${{cls}}">${{txt}}</span></td></tr>`;
      }});
      html += '</table>';
    }}
    body.innerHTML = html;
  }} else if (activeTab === 'companies') {{
    let html = '<table><tr><th>股票代码</th><th>公司名称</th><th>产业链角色</th></tr>';
    n.companies.forEach(co => {{ html += `<tr><td class="code">${{co.code}}</td><td>${{co.name}}</td><td>${{co.role}}</td></tr>`; }});
    html += '</table>';
    body.innerHTML = html;
  }} else if (activeTab === 'metrics') {{
    if (n.data_points && n.data_points.length > 0) {{
      const tn = {{capacity:'产能',output:'产量',market:'市场规模',ratio:'比率',price_change:'价格变化',order:'订单',lead_time:'交期'}};
      let html = '<p style="color:#6a7d8d;font-size:11px;margin-bottom:8px">该环节需追踪的关键数据指标：</p><table><tr><th>指标名称</th><th>单位</th><th>类型</th></tr>';
      n.data_points.forEach(dp => {{ html += `<tr><td>${{dp.name}}</td><td>${{dp.unit}}</td><td>${{tn[dp.type] || dp.type}}</td></tr>`; }});
      html += '</table>';
      body.innerHTML = html;
    }} else {{ body.innerHTML = '<p style="color:#5a7a8a">暂无定义数据指标。</p>'; }}
  }} else if (activeTab === 'edges') {{
    const rel = EDGES.filter(e => e.from === n.id || e.to === n.id);
    if (rel.length > 0) {{
      let html = '';
      rel.forEach(e => {{
        const fn = nodeMap[e.from], tn = nodeMap[e.to];
        const dir = e.from === n.id ? '→ 下游' : '← 上游';
        html += `<div class="edge-item"><span class="edir" style="color:${{e.from===n.id?'#ffb74d':'#4fc3f7'}}">${{dir}}</span> <strong>${{e.product}}</strong><br><span style="font-size:10px;color:#6a7d8d">${{fn?fn.name:'?'}} → ${{tn?tn.name:'?'}}</span><span style="font-size:10px;color:#5a7a8a;display:block;margin-top:2px">${{e.notes}}</span></div>`;
      }});
      body.innerHTML = html;
    }} else {{ body.innerHTML = '<p style="color:#5a7a8a">暂无该环节的供应关系数据。</p>'; }}
  }}
}}

// ==================== FILTER ====================
let currentGroup = 'all';
function filterGroup(g) {{
  currentGroup = g;
  document.querySelectorAll('#topbar button[id^="fg-"]').forEach(b => b.classList.remove('on'));
  const btn = document.getElementById('fg-' + g); if (btn) btn.classList.add('on');
  applyFilters();
}}
function doSearch() {{ applyFilters(); }}

function applyFilters() {{
  const query = (document.getElementById('search').value || '').toLowerCase();
  const hidden = new Set();
  NODES.forEach(n => {{
    let hide = false;
    if (currentGroup !== 'all' && n.group !== currentGroup) hide = true;
    if (query) {{
      const mN = n.name.includes(query) || n.id.includes(query) || n.description.includes(query);
      const mC = n.companies.some(c => c.name.includes(query) || c.code.includes(query));
      if (!mN && !mC) hide = true;
    }}
    if (hide) hidden.add(n.id);
  }});
  NODES.forEach(n => {{ const el = nodeEls[n.id]; if (el) el.classList.toggle('hidden', hidden.has(n.id)); }});
  document.querySelectorAll('#svg-layer path').forEach(p => {{
    p.style.display = (hidden.has(p.getAttribute('data-from')) || hidden.has(p.getAttribute('data-to'))) ? 'none' : '';
  }});
  groupLabelEls.forEach(el => {{
    const g = el.getAttribute('data-group');
    if (currentGroup !== 'all' && g !== currentGroup) {{ el.style.display = 'none'; return; }}
    const gNodes = NODES.filter(n => n.group === g);
    el.style.opacity = gNodes.length > 0 && gNodes.every(n => hidden.has(n.id)) ? '0.1' : '0.55';
    el.style.display = '';
  }});
  document.getElementById('mc').textContent = `显示 ${{NODES.filter(n=>!hidden.has(n.id)).length}}/${{NODES.length}} 环节`;
}}
document.addEventListener('keydown', e => {{ if (e.key === 'Escape') closePanel(); }});
document.getElementById('mc').textContent = `${{NODES.length}} 环节 · ${{EDGES.length}} 条供应关系`;
</script>
</body>
</html>'''


def main():
    print(f"Reading {YAML_PATH}...")
    with open(YAML_PATH, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    print(f"  {len(data['segments'])} segments, {len(data.get('supply_relationships', []))} relationships")

    flat = flatten_data(data)
    pos, cw, ch = layout_nodes(flat["nodes"])
    print(f"  Nodes: {len(flat['nodes'])}, Edges: {len(flat['edges'])}")
    print(f"  Canvas: {cw:.0f} x {ch:.0f}")
    # Print layer layout overview
    layers = defaultdict(list)
    for n in flat["nodes"]:
        layers[n["layer"]].append((n["group"], n["name"]))
    for lyr in sorted(layers.keys()):
        names = ", ".join(f"{g}/{nm}" for g, nm in sorted(layers[lyr], key=lambda x: (GROUP_ORDER.get(x[0],99), x[1])))
        print(f"  L{lyr}: {names}")

    html = gen_html(flat)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"Written: {OUTPUT_PATH} ({len(html):,} bytes)")


if __name__ == "__main__":
    main()
