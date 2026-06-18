// ==================== CONSTANTS ====================
const NODE_W = 155, NODE_H = 78;
const nodeMap = {};
NODES.forEach(n => { nodeMap[n.id] = n; });

const POS_LABELS = {upstream:'上游', midstream:'中游', downstream:'下游'};

// heat → color: 红涨绿跌 (red=up=hot, green=down=cold)
function heatToColor(h) {
  if (h >= 20) return {border:'#b71c1c',bg:'#ffebee',tag_bg:'#ffcdd2',tag_text:'#7f0000'};
  if (h >= 10) return {border:'#e53935',bg:'#ffebee',tag_bg:'#ffcdd2',tag_text:'#8b0000'};
  if (h >= 5)  return {border:'#ef5350',bg:'#fff5f5',tag_bg:'#ffebee',tag_text:'#c62828'};
  if (h >= 2)  return {border:'#ef9a9a',bg:'#fffafa',tag_bg:'#ffebee',tag_text:'#b71c1c'};
  if (h >= 0)  return {border:'#e0e0e0',bg:'#fafafa',tag_bg:'#f5f5f5',tag_text:'#757575'};
  if (h >= -2) return {border:'#a5d6a7',bg:'#f5fdf6',tag_bg:'#e8f5e9',tag_text:'#2e7d32'};
  if (h >= -5) return {border:'#66bb6a',bg:'#e8f5e9',tag_bg:'#c8e6c9',tag_text:'#1b5e20'};
  if (h >= -10)return {border:'#43a047',bg:'#e8f5e9',tag_bg:'#c8e6c9',tag_text:'#1b5e20'};
  return {border:'#2e7d32',bg:'#e0f0e0',tag_bg:'#a5d6a7',tag_text:'#0a3d0a'};
}

// drag state
let dragNode = null, dragStartX, dragStartY, dragOrigX, dragOrigY, hasDragged = false;
const DRAG_THRESHOLD = 3;
const edgeKeys = new Map(); // "from|||to" → count for duplicate y-offset

// edge path: smooth S-curve, arrow stops before target node border
function makeEdgePath(fromId, toId, dupIdx) {
  const f = POSITIONS[fromId], t = POSITIONS[toId];
  if (!f || !t) return '';
  const yOff = dupIdx > 1 ? 5 : 0;
  const scx = f.x + NODE_W/2, tcx = t.x + NODE_W/2;
  const forward = tcx >= scx;
  const x1 = forward ? f.x + NODE_W : f.x;
  const y1 = f.y + NODE_H/2 + yOff;
  const x2 = forward ? t.x - 18 : t.x + NODE_W + 18;
  const y2 = t.y + NODE_H/2 + yOff;
  const dx = x2 - x1;
  const cx1 = x1 + dx * 0.42;
  const cx2 = x2 - dx * 0.42;
  return `M${x1},${y1} C${cx1},${y1} ${cx2},${y2} ${x2},${y2}`;
}

function redrawEdges(nodeId) {
  const paths = document.querySelectorAll(`#svg-layer path[data-from="${nodeId}"], #svg-layer path[data-to="${nodeId}"]`);
  paths.forEach(p => {
    const from = p.getAttribute('data-from');
    const to = p.getAttribute('data-to');
    const key = from + '|||' + to;
    const dupIdx = edgeKeys.get(key) || 1;
    p.setAttribute('d', makeEdgePath(from, to, dupIdx));
  });
}

// ==================== RENDER ====================
const diagram = document.getElementById('diagram');
const svgLayer = document.getElementById('svg-layer');
const tooltip = document.getElementById('tooltip');
const nodeEls = {};
const groupLabelEls = [];

// --- Group labels (render first so they're behind nodes) ---
const layerGroupPositions = {};
Object.entries(POSITIONS).forEach(([nid, pos]) => {
  const n = nodeMap[nid]; if (!n) return;
  const key = `${pos.x}|${n.group}`;
  if (!layerGroupPositions[key]) layerGroupPositions[key] = {x:pos.x, group:n.group, minY:pos.y};
  else layerGroupPositions[key].minY = Math.min(layerGroupPositions[key].minY, pos.y);
});

Object.values(layerGroupPositions).forEach(lp => {
  const label = GROUP_LABELS[lp.group];
  if (!label) return;
  const div = document.createElement('div');
  div.className = 'group-label';
  div.style.cssText = `left:${lp.x}px;top:${lp.minY - 26}px;color:${label[1]};border:1px solid ${label[1]}33`;
  div.textContent = label[0];
  div.setAttribute('data-group', lp.group);
  diagram.appendChild(div);
  groupLabelEls.push(div);
});

// --- Connection ports (SVG circles at node edges) ---
const PORT_R = 3;
const portEls = {}; // nodeId → {exit: circle, entry: circle}
let portHTML = '';
Object.entries(POSITIONS).forEach(([nid, pos]) => {
  portHTML += `<circle id="port-ex-${nid}" cx="${pos.x + NODE_W}" cy="${pos.y + NODE_H/2}" r="${PORT_R}" fill="#999" stroke="#fff" stroke-width="1.5" class="port port-exit" data-node="${nid}"/>`;
  portHTML += `<circle id="port-en-${nid}" cx="${pos.x}" cy="${pos.y + NODE_H/2}" r="${PORT_R}" fill="#999" stroke="#fff" stroke-width="1.5" class="port port-entry" data-node="${nid}"/>`;
});

function updatePorts(nodeId) {
  const p = POSITIONS[nodeId]; if (!p) return;
  const ex = document.getElementById('port-ex-' + nodeId);
  const en = document.getElementById('port-en-' + nodeId);
  if (ex) { ex.setAttribute('cx', p.x + NODE_W); ex.setAttribute('cy', p.y + NODE_H/2); }
  if (en) { en.setAttribute('cx', p.x); en.setAttribute('cy', p.y + NODE_H/2); }
}

// --- Nodes ---
NODES.forEach(n => {
  const pos = POSITIONS[n.id]; if (!pos) return;
  const h20 = n.heat_d20 || 0;
  const c = heatToColor(h20);
  const div = document.createElement('div');
  div.className = 'node';
  div.id = 'n-' + n.id;
  div.style.cssText = `left:${pos.x}px;top:${pos.y}px;width:${NODE_W}px;min-height:${NODE_H}px;border-color:${c.border};background:${c.bg}`;
  const posLabel = POS_LABELS[n.position] || n.position;
  const heatEmoji = h20 > 10 ? '🔥' : h20 > 3 ? '📈' : h20 < -5 ? '❄️' : h20 < 0 ? '📉' : '';
  div.innerHTML = `<div class="nid">${n.id.replace('semi_','')}</div><div class="nn">${n.name}</div><div class="nc">20日 ${h20.toFixed(1)}% ${heatEmoji}</div><span class="pos-tag" style="background:${c.tag_bg};color:${c.tag_text}">${posLabel}</span>`;
  div.addEventListener('click', e => { e.stopPropagation(); if (hasDragged) return; openPanel(n.id); });
  div.setAttribute('data-group', n.group);
  // tooltip — multi-period heat + company list
  div.addEventListener('mouseenter', () => {
    if (!n.companies || n.companies.length === 0) return;
    const d = n.heat_d || 0, d5 = n.heat_d5 || 0, d20 = n.heat_d20 || 0;
    const cd = d>=0?'color:#e53935':'color:#2e7d32';
    const c5 = d5>=0?'color:#e53935':'color:#2e7d32';
    const c20 = d20>=0?'color:#e53935':'color:#2e7d32';
    let html = `<div class="tt-title">${n.name}</div>`;
    html += `<div style="display:flex;gap:12px;margin-bottom:6px;font-size:10px">`;
    html += `<span>当日 <b style="${cd}">${d>=0?'+':''}${d.toFixed(1)}%</b></span>`;
    html += `<span>5日 <b style="${c5}">${d5>=0?'+':''}${d5.toFixed(1)}%</b></span>`;
    html += `<span>20日 <b style="${c20}">${d20>=0?'+':''}${d20.toFixed(1)}%</b></span>`;
    html += `</div>`;
    n.companies.slice(0, 8).forEach(c => {
      const cd2 = (c.d||0)>=0?'color:#e53935':'color:#2e7d32';
      html += `<div class="tt-co"><span class="tt-code">${c.code}</span>${c.name}<span style="${cd2};margin-left:4px;font-size:9px">${(c.d||0)>=0?'+':''}${(c.d||0).toFixed(1)}%</span></div>`;
    });
    if (n.companies.length > 8) html += `<div class="tt-co" style="color:#999">...还有 ${n.companies.length-8} 家</div>`;
    tooltip.innerHTML = html;
    tooltip.classList.add('show');
  });
  div.addEventListener('mousemove', e => {
    let tx = e.clientX + 14, ty = e.clientY + 10;
    if (tx + 310 > window.innerWidth) tx = e.clientX - 310;
    if (ty + 200 > window.innerHeight) ty = e.clientY - 210;
    tooltip.style.left = tx + 'px';
    tooltip.style.top = ty + 'px';
    tooltip.style.transform = 'none';
  });
  div.addEventListener('mouseleave', () => { tooltip.classList.remove('show'); });
  // drag
  div.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    dragNode = n.id; hasDragged = false;
    dragStartX = e.clientX; dragStartY = e.clientY;
    dragOrigX = POSITIONS[n.id].x; dragOrigY = POSITIONS[n.id].y;
    div.classList.add('dragging');
    e.stopPropagation();
  });
  diagram.appendChild(div);
  nodeEls[n.id] = div;
});

// --- Edges ---
const EDGE_CLASS = {primary:'ep', secondary:'es', exclusive:'ex'};
const ARROW_COLORS = {ep:'#43a047', es:'#90a4ae', ex:'#e53935'};
let svgDefs = `<defs>${['ep','es','ex'].map(cls => `
  <marker id="arrow-${cls}" viewBox="0 0 10 8" refX="9" refY="4" markerWidth="14" markerHeight="11" orient="auto" markerUnits="userSpaceOnUse">
    <polygon points="0,0 10,4 0,8" fill="${ARROW_COLORS[cls]}"/>
  </marker>`).join('')}</defs>`;
let svgHTML = '';
EDGES.forEach(e => {
  const f = POSITIONS[e.from], t = POSITIONS[e.to];
  if (!f || !t) return;
  const key = e.from + '|||' + e.to;
  const dupIdx = (edgeKeys.get(key) || 0) + 1;
  edgeKeys.set(key, dupIdx);
  const pathD = makeEdgePath(e.from, e.to, dupIdx);
  const cls = EDGE_CLASS[e.rel_type] || 'ep';
  svgHTML += `<path d="${pathD}" class="${cls}" id="edge-${e.from}-${e.to}" data-from="${e.from}" data-to="${e.to}" marker-end="url(#arrow-${cls})"/>`;
});
svgLayer.innerHTML = svgDefs + svgHTML + portHTML;

// ==================== PAN & ZOOM ====================
let scale = 1, panX = 0, panY = 0;
const canvasWrap = document.getElementById('canvas-wrap');
function applyTransform() { diagram.style.transform = `translate(${panX}px,${panY}px) scale(${scale})`; }

canvasWrap.addEventListener('wheel', e => {
  e.preventDefault();
  const ns = Math.min(2.5, Math.max(0.2, scale * (e.deltaY > 0 ? 0.92 : 1.08)));
  const r = canvasWrap.getBoundingClientRect();
  panX = (e.clientX - r.left) - ((e.clientX - r.left) - panX) * (ns / scale);
  panY = (e.clientY - r.top) - ((e.clientY - r.top) - panY) * (ns / scale);
  scale = ns; applyTransform();
}, {passive:false});

let dragging = false, dragX, dragY;
canvasWrap.addEventListener('mousedown', e => {
  if (e.target === canvasWrap || e.target.id === 'diagram' || e.target.classList.contains('group-label')) {
    dragging = true; dragX = e.clientX - panX; dragY = e.clientY - panY; canvasWrap.style.cursor = 'grabbing';
  }
});
window.addEventListener('mousemove', e => {
  if (dragNode) {
    const dx = e.clientX - dragStartX, dy = e.clientY - dragStartY;
    if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
    hasDragged = true;
    POSITIONS[dragNode].x = dragOrigX + dx / scale;
    POSITIONS[dragNode].y = dragOrigY + dy / scale;
    const el = nodeEls[dragNode];
    if (el) { el.style.left = POSITIONS[dragNode].x + 'px'; el.style.top = POSITIONS[dragNode].y + 'px'; }
    updatePorts(dragNode);
    redrawEdges(dragNode);
    return;
  }
  if (!dragging) return;
  panX = e.clientX - dragX; panY = e.clientY - dragY; applyTransform();
});
window.addEventListener('mouseup', () => {
  if (dragNode && nodeEls[dragNode]) nodeEls[dragNode].classList.remove('dragging');
  dragNode = null;
  dragging = false; canvasWrap.style.cursor = 'grab';
});

function fitScreen() {
  const w = canvasWrap.clientWidth, h = canvasWrap.clientHeight;
  scale = Math.min((w-80)/CANVAS_W, (h-120)/CANVAS_H, 1.0);
  panX = (w - CANVAS_W*scale)/2; panY = 40; applyTransform();
}
window.addEventListener('resize', fitScreen);
setTimeout(fitScreen, 100);

// ==================== PANEL ====================
const panel = document.getElementById('panel');
let activeNode = null, activeTab = 'overview';

function openPanel(nodeId) {
  activeNode = nodeMap[nodeId]; if (!activeNode) return;
  panel.classList.add('open'); activeTab = 'overview';
  document.querySelectorAll('#panel .pt button').forEach(b => b.classList.remove('on'));
  document.getElementById('tb-overview').classList.add('on');
  renderPanel();
  // highlight connected edges & nodes
  const connectedNodeIds = new Set();
  connectedNodeIds.add(nodeId);
  document.querySelectorAll('#svg-layer path').forEach(p => {
    const from = p.getAttribute('data-from'), to = p.getAttribute('data-to');
    if (from === nodeId || to === nodeId) {
      p.classList.add('edge-hl'); p.classList.remove('edge-dim');
      connectedNodeIds.add(from); connectedNodeIds.add(to);
    } else {
      p.classList.add('edge-dim'); p.classList.remove('edge-hl');
    }
  });
  Object.entries(nodeEls).forEach(([nid, el]) => {
    el.classList.remove('sel', 'node-connected', 'node-dim');
    if (nid === nodeId) el.classList.add('sel');
    else if (connectedNodeIds.has(nid)) el.classList.add('node-connected');
    else el.classList.add('node-dim');
  });
}

function closePanel() {
  panel.classList.remove('open'); activeNode = null;
  Object.values(nodeEls).forEach(el => el.classList.remove('sel', 'node-connected', 'node-dim'));
  document.querySelectorAll('#svg-layer path').forEach(p => p.classList.remove('edge-hl', 'edge-dim'));
}

function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('#panel .pt button').forEach(b => b.classList.remove('on'));
  document.getElementById('tb-' + tab).classList.add('on');
  renderPanel();
}

function renderPanel() {
  if (!activeNode) return;
  const n = activeNode;
  const h20 = n.heat_d20 || 0;
  const c = heatToColor(h20);
  const posLabel = POS_LABELS[n.position] || n.position;
  const d = ((n.heat_d||0)>=0?'+':'') + (n.heat_d||0).toFixed(1);
  const d5 = ((n.heat_d5||0)>=0?'+':'') + (n.heat_d5||0).toFixed(1);
  const d20 = ((n.heat_d20||0)>=0?'+':'') + (n.heat_d20||0).toFixed(1);
  document.getElementById('p-title').textContent = n.name;
  document.getElementById('p-sub').innerHTML = `<span style="background:${c.tag_bg};color:${c.tag_text};padding:1px 8px;border-radius:8px;font-size:10px;margin-right:8px">${posLabel}</span>20日 ${d20}% · ${n.companies.length} 家上市公司`;
  const body = document.getElementById('panel-body');

  if (activeTab === 'overview') {
    const d = n.heat_d||0, d5 = n.heat_d5||0, d20 = n.heat_d20||0;
    const cd=d>=0?'#e53935':'#2e7d32', c5=d5>=0?'#e53935':'#2e7d32', c20=d20>=0?'#e53935':'#2e7d32';
    const hd=d>=0?'🔥火热':'❄️冰冷', h5=d5>=0?'🔥':'❄️', h20v=d20>=0?'🔥':'❄️';
    let html = `<div class="desc">${n.description}</div>`;
    html += '<h3>市场热度</h3>';
    html += `<div style="display:flex;gap:12px;margin:8px 0;flex-wrap:wrap">`;
    html += `<div style="flex:1;min-width:100px;background:#fff;border:1px solid #e0e0e0;border-radius:8px;padding:10px;text-align:center"><div style="font-size:10px;color:#888">当日</div><div style="font-size:22px;font-weight:700;color:${cd}">${d>=0?'+':''}${d.toFixed(1)}%</div><div style="font-size:10px;color:${cd}">${hd}</div></div>`;
    html += `<div style="flex:1;min-width:100px;background:#fff;border:1px solid #e0e0e0;border-radius:8px;padding:10px;text-align:center"><div style="font-size:10px;color:#888">近5日</div><div style="font-size:22px;font-weight:700;color:${c5}">${d5>=0?'+':''}${d5.toFixed(1)}%</div><div style="font-size:10px;color:${c5}">${h5}</div></div>`;
    html += `<div style="flex:1;min-width:100px;background:#fff;border:1px solid #e0e0e0;border-radius:8px;padding:10px;text-align:center"><div style="font-size:10px;color:#888">近20日</div><div style="font-size:22px;font-weight:700;color:${c20}">${d20>=0?'+':''}${d20.toFixed(1)}%</div><div style="font-size:10px;color:${c20}">${h20v}</div></div>`;
    html += `</div>`;
    if (n.new_capacity && n.new_capacity.length > 0) {
      html += '<h3>在建/扩产产能</h3><table><tr><th>企业</th><th>规模</th><th>预计投产</th><th>状态</th></tr>';
      const tagMap = {construction:['建设中','tag-const'], ramp_up:['爬坡中','tag-ramp'], equipment:['设备搬入','tag-equip']};
      n.new_capacity.forEach(nc => {
        const [txt, cls] = tagMap[nc.status] || ['规划中','tag-plan'];
        html += `<tr><td>${nc.company}</td><td>${nc.scale}</td><td>${nc.expected_online}</td><td><span class="tag-cap ${cls}">${txt}</span></td></tr>`;
      });
      html += '</table>';
    }
    body.innerHTML = html;
  } else if (activeTab === 'companies') {
    let html = '<table><tr><th>股票代码</th><th>公司名称</th><th>当日</th><th>产业链角色</th></tr>';
    n.companies.forEach(co => {
      const cd = (co.d||0)>=0?'color:#e53935':'color:#2e7d32';
      const ds = ((co.d||0)>=0?'+':'') + (co.d||0).toFixed(1);
      html += `<tr><td class="code">${co.code}</td><td>${co.name}</td><td style="${cd};font-weight:600">${ds}%</td><td>${co.role}</td></tr>`;
    });
    html += '</table>';
    body.innerHTML = html;
  } else if (activeTab === 'metrics') {
    if (n.data_points && n.data_points.length > 0) {
      const tn = {capacity:'产能',output:'产量',market:'市场规模',ratio:'比率',price_change:'价格变化',order:'订单',lead_time:'交期'};
      let html = '<p style="color:#6a7d8d;font-size:11px;margin-bottom:8px">该环节需追踪的关键数据指标：</p><table><tr><th>指标名称</th><th>当前值</th><th>单位</th><th>来源</th></tr>';
      n.data_points.forEach(dp => {
        const v = dp.current_value;
        // format value: ratio/price_change with % sign, others with locale formatting
        let vd = '—';
        let vc = '';
        if (v !== undefined && v !== null && v !== '') {
          const isPct = dp.type === 'ratio' || dp.type === 'price_change';
          vd = isPct ? `${v}%` : (Number.isInteger(v) ? v.toLocaleString() : String(v));
          // color: red for positive ratio/price_change, green for negative
          if (v > 0 && isPct) vc = 'color:#e53935;font-weight:600';
          else if (v < 0 && isPct) vc = 'color:#2e7d32;font-weight:600';
        }
        // source column
        let src = '—';
        if (dp.source_url) src = `<a href="${dp.source_url}" target="_blank" style="color:#43a047;text-decoration:none;font-size:10px" title="${dp.source_name||''}">${dp.source_name||'链接'}</a>`;
        else if (dp.source_name) src = `<span style="color:#888;font-size:10px">${dp.source_name}</span>`;
        if (dp.last_updated) src += ` <span style="color:#bbb;font-size:9px">${dp.last_updated}</span>`;
        html += `<tr><td>${dp.name}</td><td style="${vc}">${vd}</td><td>${dp.unit}</td><td>${src}</td></tr>`;
      });
      html += '</table>';
      body.innerHTML = html;
    } else { body.innerHTML = '<p style="color:#5a7a8a">暂无定义数据指标。</p>'; }
  } else if (activeTab === 'edges') {
    const rel = EDGES.filter(e => e.from === n.id || e.to === n.id);
    if (rel.length > 0) {
      let html = '';
      rel.forEach(e => {
        const fn = nodeMap[e.from], tn = nodeMap[e.to];
        const dir = e.from === n.id ? '→ 下游' : '← 上游';
        html += `<div class="edge-item"><span class="edir" style="color:${e.from===n.id?'#ffb74d':'#4fc3f7'}">${dir}</span> <strong>${e.product}</strong><br><span style="font-size:10px;color:#6a7d8d">${fn?fn.name:'?'} → ${tn?tn.name:'?'}</span><span style="font-size:10px;color:#5a7a8a;display:block;margin-top:2px">${e.notes}</span></div>`;
      });
      body.innerHTML = html;
    } else { body.innerHTML = '<p style="color:#5a7a8a">暂无该环节的供应关系数据。</p>'; }
  }
}

// ==================== FILTER ====================
let currentGroup = 'all';
function filterGroup(g) {
  currentGroup = g;
  document.querySelectorAll('#topbar button[id^="fg-"]').forEach(b => b.classList.remove('on'));
  const btn = document.getElementById('fg-' + g); if (btn) btn.classList.add('on');
  applyFilters();
}
function doSearch() { applyFilters(); }

function applyFilters() {
  closePanel();
  const query = (document.getElementById('search').value || '').toLowerCase();
  const hidden = new Set();
  NODES.forEach(n => {
    let hide = false;
    if (currentGroup !== 'all' && n.group !== currentGroup) hide = true;
    if (query) {
      const mN = n.name.includes(query) || n.id.includes(query) || n.description.includes(query);
      const mC = n.companies.some(c => c.name.includes(query) || c.code.includes(query));
      if (!mN && !mC) hide = true;
    }
    if (hide) hidden.add(n.id);
  });
  NODES.forEach(n => { const el = nodeEls[n.id]; if (el) el.classList.toggle('hidden', hidden.has(n.id)); });
  document.querySelectorAll('#svg-layer circle.port').forEach(c => {
    c.style.display = hidden.has(c.getAttribute('data-node')) ? 'none' : '';
  });
  document.querySelectorAll('#svg-layer path').forEach(p => {
    const hid = hidden.has(p.getAttribute('data-from')) || hidden.has(p.getAttribute('data-to'));
    p.style.display = hid ? 'none' : '';
    if (hid) { p.classList.remove('edge-hl', 'edge-dim'); }
  });
  groupLabelEls.forEach(el => {
    const g = el.getAttribute('data-group');
    if (currentGroup !== 'all' && g !== currentGroup) { el.style.display = 'none'; return; }
    const gNodes = NODES.filter(n => n.group === g);
    el.style.opacity = gNodes.length > 0 && gNodes.every(n => hidden.has(n.id)) ? '0.1' : '0.55';
    el.style.display = '';
  });
  document.getElementById('mc').textContent = `显示 ${NODES.filter(n=>!hidden.has(n.id)).length}/${NODES.length} 环节`;
}
// ==================== LIVE HEAT ====================
const LIVE_CACHE_KEY = 'semi_live_heat';
const LIVE_CACHE_DATE_KEY = 'semi_live_heat_date';

function todayStr() { return new Date().toISOString().slice(0, 10); }

function loadCachedHeat() {
  try {
    if (localStorage.getItem(LIVE_CACHE_DATE_KEY) === todayStr()) {
      const d = JSON.parse(localStorage.getItem(LIVE_CACHE_KEY));
      if (d) return d;
    }
  } catch(e) {}
  return null;
}

function saveCachedHeat(data) {
  try {
    localStorage.setItem(LIVE_CACHE_DATE_KEY, todayStr());
    localStorage.setItem(LIVE_CACHE_KEY, JSON.stringify(data));
  } catch(e) {}
}

async function fetchStockHeat(code) {
  const url = `https://d.10jqka.com.cn/v2/realhead/hs_${code}/last.js`;
  try {
    const resp = await fetch(url);
    const text = await resp.text();
    const m = text.match(/quotebridge[^(]*\(([\s\S]*)\)/);
    if (!m) return null;
    const items = JSON.parse(m[1]).items || {};
    return {
      d: parseFloat((items['199112'] || 0)),
      d5: parseFloat((items['1149395'] || 0))
    };
  } catch(e) { return null; }
}

async function fetchAllLiveHeat(codes, onProgress) {
  const results = {};
  const B = 8;
  let done = 0;
  for (let i = 0; i < codes.length; i += B) {
    const batch = codes.slice(i, i + B);
    await Promise.allSettled(batch.map(async c => {
      const d = await fetchStockHeat(c);
      if (d) results[c] = d;
    }));
    done += batch.length;
    if (onProgress) onProgress(done, codes.length);
  }
  return results;
}

function applyLiveHeat(heatData) {
  NODES.forEach(node => {
    let sumD = 0, sumD5 = 0, cnt = 0;
    node.companies.forEach(co => {
      const h = heatData[co.code];
      if (h) { co.d = h.d; co.d5 = h.d5; sumD += h.d; sumD5 += h.d5; cnt++; }
    });
    if (cnt > 0) { node.heat_d = sumD / cnt; node.heat_d5 = sumD5 / cnt; }
  });
}

async function initLiveHeat() {
  const cached = loadCachedHeat();
  if (cached) applyLiveHeat(cached);

  if (!ALL_STOCK_CODES || ALL_STOCK_CODES.length === 0) return;
  const mc = document.getElementById('mc');
  mc.textContent = `刷新热度 0/${ALL_STOCK_CODES.length}...`;

  const liveData = await fetchAllLiveHeat(ALL_STOCK_CODES, (done, total) => {
    mc.textContent = `刷新热度 ${done}/${total}...`;
  });

  const merged = Object.assign({}, cached || {}, liveData);
  saveCachedHeat(merged);
  applyLiveHeat(merged);
  mc.textContent = `${NODES.length} 环节 · ${EDGES.length} 条供应关系 · 热度已更新`;
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') closePanel(); });
document.getElementById('mc').textContent = `${NODES.length} 环节 · ${EDGES.length} 条供应关系`;
setTimeout(initLiveHeat, 200);
