// ==================== G6 GRAPH SETUP ====================
const nodeMap = {};
RAW_NODES.forEach(n => { nodeMap[n.id] = n; });

(function checkG6() {
  if (typeof G6 === 'undefined') {
    document.getElementById('mc').textContent = 'ERROR: G6 CDN 未加载';
    document.getElementById('mc').style.color = 'red';
    throw new Error('G6 not loaded');
  }
})();

const POS_LABELS = {upstream:'上游', midstream:'中游', downstream:'下游'};

// heat → color (clean warm-cool heatmap)
function heatToColor(h) {
  if (h >= 20) return {fill:'#fff0f0', stroke:'#e57373', tag_bg:'#ef5350', tag_text:'#fff', text:'#c62828', heat_text:'#d32f2f'};
  if (h >= 10) return {fill:'#fff5f5', stroke:'#ef8e8e', tag_bg:'#e57373', tag_text:'#fff', text:'#c62828', heat_text:'#e53935'};
  if (h >= 5)  return {fill:'#fffafa', stroke:'#f4acac', tag_bg:'#ef8e8e', tag_text:'#7f0000', text:'#333', heat_text:'#d32f2f'};
  if (h >= 2)  return {fill:'#fffafa', stroke:'#f8c8c8', tag_bg:'#f4acac', tag_text:'#8b0000', text:'#333', heat_text:'#c62828'};
  if (h >= 0)  return {fill:'#fafafa', stroke:'#d0d0d0', tag_bg:'#e8e8e8', tag_text:'#666', text:'#333', heat_text:'#888'};
  if (h >= -2) return {fill:'#f5fdf6', stroke:'#b3e0b3', tag_bg:'#8ed48e', tag_text:'#1b5e20', text:'#333', heat_text:'#2e7d32'};
  if (h >= -5) return {fill:'#f0faf2', stroke:'#8ed48e', tag_bg:'#66bb6a', tag_text:'#fff', text:'#1b5e20', heat_text:'#1b5e20'};
  if (h >= -10)return {fill:'#e8f5e9', stroke:'#66bb6a', tag_bg:'#43a047', tag_text:'#fff', text:'#1b5e20', heat_text:'#155724'};
  return {fill:'#e0f0e0', stroke:'#4caf50', tag_bg:'#388e3c', tag_text:'#fff', text:'#0a3d0a', heat_text:'#0d3d0d'};
}

// Edge styling — subtle defaults, bold on focus
const EDGE_STYLE = {
  primary:   {stroke:'#a5d6a7', lineWidth:1.2, arrowSize:7},
  secondary: {stroke:'#bdbdbd', lineWidth:1.0, arrowSize:6},
  exclusive: {stroke:'#ef9a9a', lineWidth:1.2, lineDash:[8,4], arrowSize:7},
  // focus colors (same hue, more saturated)
  focus: {
    primary:   {stroke:'#2e7d32', lineWidth:2.5, arrowSize:10},
    secondary: {stroke:'#546e7a', lineWidth:2.0, arrowSize:8},
    exclusive: {stroke:'#c62828', lineWidth:2.5, arrowSize:10},
  },
};

// Register custom node with rich content
let graph;
try {
G6.registerNode('heat-node', {
  draw(cfg, group) {
    const w = 160, h = 76, r = 10;
    const nd = cfg.nodeData || {};
    const h20 = nd.heat_d20 || 0;
    const c = heatToColor(h20);
    const posLabel = POS_LABELS[nd.position] || nd.position;

    // background
    const keyShape = group.addShape('rect', {
      attrs: { x: -w/2, y: -h/2, width: w, height: h, radius: r,
        fill: c.fill, stroke: c.stroke, lineWidth: 2.5, cursor: 'pointer' },
      name: 'main-box',
    });

    // id tag
    group.addShape('text', {
      attrs: { x: -w/2+12, y: -h/2+14,
        text: nd.id ? nd.id.replace('semi_','').replace('_',' ') : '',
        fontSize: 9, fontWeight: 700, fill: c.tag_text, opacity: 0.6,
        fontFamily: 'Consolas, monospace' },
      name: 'nid-text',
    });

    // name
    group.addShape('text', {
      attrs: { x: -w/2+12, y: -h/2+32,
        text: (nd.name||'').length>14 ? (nd.name||'').slice(0,14)+'..' : (nd.name||''),
        fontSize: 13, fontWeight: 700, fill: c.text||'#333' },
      name: 'name-text',
    });

    // heat badge
    const heatEmoji = h20>10?'🔥':h20>3?'📈':h20<-5?'❄️':h20<0?'📉':'';
    group.addShape('text', {
      attrs: { x: -w/2+12, y: -h/2+50,
        text: `20日 ${h20>=0?'+':''}${h20.toFixed(1)}% ${heatEmoji}`,
        fontSize: 10, fontWeight: 600, fill: c.heat_text||'#888' },
      name: 'heat-text',
    });

    // position tag
    const tagW = posLabel.length*10+14;
    group.addShape('rect', {
      attrs: { x: w/2-tagW-8, y: h/2-20, width: tagW, height: 18, radius: 7,
        fill: c.tag_bg, opacity: 0.9 },
      name: 'tag-bg',
    });
    group.addShape('text', {
      attrs: { x: w/2-tagW/2-8, y: h/2-11,
        text: posLabel, fontSize: 9, fontWeight: 700, fill: c.tag_text, textAlign: 'center' },
      name: 'tag-text',
    });

    return keyShape;
  },
  getAnchorPoints() {
    return [[0,0.5],[1,0.5],[0.5,0],[0.5,1]];
  },
});

// Convert data
const g6Nodes = RAW_NODES.map(n => ({
  id: n.id,
  type: 'heat-node',
  group: n.group,
  nodeData: n,
  x: n.x || 0,
  y: n.y || 0,
}));

const g6Edges = RAW_EDGES.map(e => {
  const src = nodeMap[e.from];
  const tgt = nodeMap[e.to];
  const sameLayer = src && tgt && src.layer === tgt.layer;

  let edgeType, sourceAnchor, targetAnchor;
  if (sameLayer) {
    edgeType = 'cubic-vertical';
    if ((src.y || 0) <= (tgt.y || 0)) {
      sourceAnchor = 3; targetAnchor = 2;
    } else {
      sourceAnchor = 2; targetAnchor = 3;
    }
  } else {
    edgeType = 'cubic-horizontal';
    if ((src.x || 0) <= (tgt.x || 0)) {
      sourceAnchor = 1; targetAnchor = 0;
    } else {
      sourceAnchor = 0; targetAnchor = 1;
    }
  }

  const es = EDGE_STYLE[e.rel_type] || EDGE_STYLE.primary;
  const as = es.arrowSize || 8;
  return {
    source: e.from,
    target: e.to,
    type: edgeType,
    sourceAnchor,
    targetAnchor,
    style: {
      stroke: es.stroke,
      lineWidth: es.lineWidth,
      lineDash: es.lineDash,
      endArrow: {
        path: G6.Arrow.triangle(as, as * 1.25, 0),
        fill: es.stroke,
      },
    },
    edgeData: e,
  };
});

const container = document.getElementById('g6-container');
const width = container.scrollWidth || 1200;
const height = container.scrollHeight || 800;

graph = new G6.Graph({
  container: 'g6-container',
  width, height,
  fitView: true,
  fitViewPadding: 40,
  layout: { type: 'preset' },
  defaultNode: { type: 'heat-node' },
  defaultEdge: {
    type: 'cubic-horizontal',
    style: { endArrow: true, lineWidth: 2 },
  },
  edgeStateStyles: {
    hover: { lineWidth: 4, shadowBlur: 8, shadowColor: 'rgba(67,160,71,0.4)' },
  },
  modes: {
    default: ['drag-canvas', 'zoom-canvas', 'drag-node', 'click-select'],
  },
  nodeStateStyles: {
    selected: { lineWidth: 3, shadowBlur: 16, shadowColor: 'rgba(27,110,46,0.3)' },
    active: { shadowBlur: 14, shadowColor: 'rgba(46,125,50,0.25)', stroke: '#2e7d32', lineWidth: 2.5 },
    inactive: { opacity: 0.3 },
  },
  edgeStateStyles: {
    hover: { lineWidth: 4, shadowBlur: 8, shadowColor: 'rgba(67,160,71,0.4)' },
  },
});

graph.data({ nodes: g6Nodes, edges: g6Edges });
graph.render();

} catch(e) {
  document.getElementById('mc').textContent = 'ERROR: G6 init - ' + e.message;
  document.getElementById('mc').style.color = 'red';
  console.error(e);
  throw e;
}

// ==================== GROUP LABELS (annotation nodes) ====================
// Add invisible nodes as group labels at the top of each group's layer
const groups = {};
RAW_NODES.forEach(n => {
  if (!groups[n.group]) groups[n.group] = [];
  groups[n.group].push(n.id);
});

// Add group labels after render (positions are computed by dagre)
setTimeout(() => {
  const label = GROUP_LABELS[gk];
  // simplified: render group labels using HTML overlay
}, 500);

// ==================== FOCUS / HIGHLIGHT ====================
// Build adjacency maps once (edges are directional: from → to = upstream → downstream)
const upstreamOf = {};   // upstreamOf[B] = [A, ...]  means A supplies B
const downstreamOf = {}; // downstreamOf[A] = [B, ...] means A supplies B
RAW_EDGES.forEach(e => {
  if (!upstreamOf[e.to]) upstreamOf[e.to] = [];
  upstreamOf[e.to].push(e.from);
  if (!downstreamOf[e.from]) downstreamOf[e.from] = [];
  downstreamOf[e.from].push(e.to);
});

function traverseUpstream(startId) {
  return new Set(upstreamOf[startId] || []);
}

function traverseDownstream(startId) {
  return new Set(downstreamOf[startId] || []);
}

function focusNode(nodeId) {
  const upstreamNodes = traverseUpstream(nodeId);
  const downstreamNodes = traverseDownstream(nodeId);
  const connected = new Set([nodeId, ...upstreamNodes, ...downstreamNodes]);

  // Nodes: highlight connected, dim rest
  RAW_NODES.forEach(n => {
    const item = graph.findById(n.id);
    if (!item) return;
    if (connected.has(n.id)) {
      item.setState('active', true);
      item.setState('inactive', false);
    } else {
      item.setState('active', false);
      item.setState('inactive', true);
    }
  });

  // Edges: highlight if both endpoints are in the connected set
  graph.getEdges().forEach(edge => {
    const m = edge.getModel();
    const ed = m.edgeData;
    if (connected.has(m.source) && connected.has(m.target)) {
      const fs = (EDGE_STYLE.focus || {})[ed.rel_type] || EDGE_STYLE.focus.primary;
      graph.updateItem(edge, {
        style: {
          stroke: fs.stroke,
          lineWidth: fs.lineWidth,
          lineDash: (EDGE_STYLE[ed.rel_type] || {}).lineDash,
          endArrow: { path: G6.Arrow.triangle(fs.arrowSize, fs.arrowSize*1.25, 0), fill: fs.stroke },
          opacity: 1,
        },
      });
    } else {
      graph.updateItem(edge, {
        style: {
          stroke: (EDGE_STYLE[ed.rel_type] || EDGE_STYLE.primary).stroke,
          lineWidth: 1.0,
          opacity: 0.25,
        },
      });
    }
  });
}
function clearFocus() {
  RAW_NODES.forEach(n => {
    const item = graph.findById(n.id);
    if (item) { item.setState('active', false); item.setState('inactive', false); }
  });
  // Restore all edges to default subtle style
  graph.getEdges().forEach(edge => {
    const m = edge.getModel();
    const ed = m.edgeData;
    const es = EDGE_STYLE[ed.rel_type] || EDGE_STYLE.primary;
    graph.updateItem(edge, {
      style: {
        stroke: es.stroke,
        lineWidth: es.lineWidth,
        lineDash: es.lineDash,
        endArrow: { path: G6.Arrow.triangle(es.arrowSize, es.arrowSize*1.25, 0), fill: es.stroke },
        opacity: 1,
      },
    });
  });
}

// ==================== INTERACTION ====================
graph.on('canvas:click', () => { closePanel(); clearFocus(); });
graph.on('node:click', evt => {
  const nodeId = evt.item.getID();
  openPanel(nodeId);
});

graph.on('node:mouseenter', evt => {
  const nd = evt.item.getModel().nodeData;
  if (!nd || !nd.companies || nd.companies.length === 0) return;
  const d = nd.heat_d || 0, d5 = nd.heat_d5 || 0, d20 = nd.heat_d20 || 0;
  const cd = d>=0?'color:#e53935':'color:#2e7d32';
  const c5 = d5>=0?'color:#e53935':'color:#2e7d32';
  const c20 = d20>=0?'color:#e53935':'color:#2e7d32';
  let html = `<div class="tt-title">${nd.name}</div>`;
  html += `<div style="display:flex;gap:12px;margin-bottom:6px;font-size:10px">`;
  html += `<span>当日 <b style="${cd}">${d>=0?'+':''}${d.toFixed(1)}%</b></span>`;
  html += `<span>5日 <b style="${c5}">${d5>=0?'+':''}${d5.toFixed(1)}%</b></span>`;
  html += `<span>20日 <b style="${c20}">${d20>=0?'+':''}${d20.toFixed(1)}%</b></span>`;
  html += `</div>`;
  nd.companies.slice(0, 8).forEach(c => {
    const cd2 = (c.d||0)>=0?'color:#e53935':'color:#2e7d32';
    html += `<div class="tt-co"><span class="tt-code">${c.code}</span>${c.name}<span style="${cd2};margin-left:4px;font-size:9px">${(c.d||0)>=0?'+':''}${(c.d||0).toFixed(1)}%</span></div>`;
  });
  if (nd.companies.length > 8) html += `<div class="tt-co" style="color:#999">...还有 ${nd.companies.length-8} 家</div>`;
  tooltip.innerHTML = html;
  tooltip.classList.add('show');
});

graph.on('node:mousemove', evt => {
  const oe = evt.originalEvent || evt;
  let tx = (oe.clientX || evt.x || 0) + 14, ty = (oe.clientY || evt.y || 0) + 10;
  if (tx + 310 > window.innerWidth) tx = (oe.clientX || evt.x || 0) - 310;
  if (ty + 200 > window.innerHeight) ty = (oe.clientY || evt.y || 0) - 210;
  tooltip.style.left = tx + 'px';
  tooltip.style.top = ty + 'px';
  tooltip.style.transform = 'none';
});

graph.on('node:mouseleave', () => { tooltip.classList.remove('show'); });

// ==================== PANEL ====================
const panel = document.getElementById('panel');
const tooltip = document.getElementById('tooltip');
let activeNode = null, activeTab = 'overview';

function openPanel(nodeId) {
  activeNode = nodeMap[nodeId]; if (!activeNode) return;
  panel.classList.add('open'); activeTab = 'overview';
  document.querySelectorAll('#panel .pt button').forEach(b => b.classList.remove('on'));
  document.getElementById('tb-overview').classList.add('on');
  graph.setItemState(nodeId, 'selected', true);
  focusNode(nodeId);
  renderPanel();
}

function closePanel() {
  if (activeNode) graph.setItemState(activeNode.id, 'selected', false);
  panel.classList.remove('open'); activeNode = null;
  clearFocus();
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
  const d = n.heat_d||0, d5 = n.heat_d5||0, d20 = n.heat_d20||0;
  const cd=d>=0?'#e53935':'#2e7d32', c5=d5>=0?'#e53935':'#2e7d32', c20=d20>=0?'#e53935':'#2e7d32';
  document.getElementById('p-title').textContent = n.name;
  document.getElementById('p-sub').innerHTML = `<span style="background:${c.tag_bg};color:${c.tag_text};padding:1px 8px;border-radius:8px;font-size:10px;margin-right:8px">${posLabel}</span>20日 ${d20>=0?'+':''}${d20.toFixed(1)}% · ${n.companies.length} 家上市公司`;
  const body = document.getElementById('panel-body');

  if (activeTab === 'overview') {
    let html = `<div class="desc">${n.description}</div>`;
    html += '<h3>市场热度</h3>';
    html += `<div style="display:flex;gap:12px;margin:8px 0;flex-wrap:wrap">`;
    html += `<div style="flex:1;min-width:100px;background:#fff;border:1px solid #e0e0e0;border-radius:8px;padding:10px;text-align:center"><div style="font-size:10px;color:#888">当日</div><div style="font-size:22px;font-weight:700;color:${cd}">${d>=0?'+':''}${d.toFixed(1)}%</div><div style="font-size:10px;color:${cd}">${d>=0?'🔥火热':'❄️冰冷'}</div></div>`;
    html += `<div style="flex:1;min-width:100px;background:#fff;border:1px solid #e0e0e0;border-radius:8px;padding:10px;text-align:center"><div style="font-size:10px;color:#888">近5日</div><div style="font-size:22px;font-weight:700;color:${c5}">${d5>=0?'+':''}${d5.toFixed(1)}%</div><div style="font-size:10px;color:${c5}">${d5>=0?'🔥':'❄️'}</div></div>`;
    html += `<div style="flex:1;min-width:100px;background:#fff;border:1px solid #e0e0e0;border-radius:8px;padding:10px;text-align:center"><div style="font-size:10px;color:#888">近20日</div><div style="font-size:22px;font-weight:700;color:${c20}">${d20>=0?'+':''}${d20.toFixed(1)}%</div><div style="font-size:10px;color:${c20}">${d20>=0?'🔥':'❄️'}</div></div>`;
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
      let html = '<table><tr><th>指标名称</th><th>当前值</th><th>单位</th><th>来源</th></tr>';
      n.data_points.forEach(dp => {
        const v = dp.current_value;
        let vd = '—', vc = '';
        if (v !== undefined && v !== null && v !== '') {
          const isPct = dp.type === 'ratio' || dp.type === 'price_change';
          vd = isPct ? `${v}%` : (Number.isInteger(v) ? v.toLocaleString() : String(v));
          if (v > 0 && isPct) vc = 'color:#e53935;font-weight:600';
          else if (v < 0 && isPct) vc = 'color:#2e7d32;font-weight:600';
        }
        let src = '—';
        if (dp.source_url) src = `<a href="${dp.source_url}" target="_blank" style="color:#43a047;text-decoration:none;font-size:10px">${dp.source_name||'链接'}</a>`;
        else if (dp.source_name) src = `<span style="color:#888;font-size:10px">${dp.source_name}</span>`;
        if (dp.last_updated) src += ` <span style="color:#bbb;font-size:9px">${dp.last_updated}</span>`;
        html += `<tr><td>${dp.name}</td><td style="${vc}">${vd}</td><td>${dp.unit}</td><td>${src}</td></tr>`;
      });
      html += '</table>';
      body.innerHTML = html;
    } else { body.innerHTML = '<p style="color:#5a7a8a">暂无定义数据指标。</p>'; }
  } else if (activeTab === 'edges') {
    const rel = RAW_EDGES.filter(e => e.from === n.id || e.to === n.id);
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
  RAW_NODES.forEach(n => {
    let hide = false;
    if (currentGroup !== 'all' && n.group !== currentGroup) hide = true;
    if (query) {
      const mN = n.name.includes(query) || n.id.includes(query) || n.description.includes(query);
      const mC = n.companies.some(c => c.name.includes(query) || c.code.includes(query));
      if (!mN && !mC) hide = true;
    }
    if (hide) hidden.add(n.id);
  });
  RAW_NODES.forEach(n => {
    if (hidden.has(n.id)) graph.hideItem(n.id);
    else graph.showItem(n.id);
  });
  graph.getEdges().forEach(edge => {
    const m = edge.getModel();
    if (hidden.has(m.source) || hidden.has(m.target)) graph.hideItem(edge);
    else graph.showItem(edge);
  });
  document.getElementById('mc').textContent = `显示 ${RAW_NODES.filter(n=>!hidden.has(n.id)).length}/${RAW_NODES.length} 环节`;
  setTimeout(() => graph.fitView(40), 50);
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
    return { d: parseFloat((items['199112'] || 0)), d5: parseFloat((items['1149395'] || 0)) };
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
  RAW_NODES.forEach(node => {
    let sumD = 0, sumD5 = 0, cnt = 0;
    node.companies.forEach(co => {
      const h = heatData[co.code];
      if (h) { co.d = h.d; co.d5 = h.d5; sumD += h.d; sumD5 += h.d5; cnt++; }
    });
    if (cnt > 0) { node.heat_d = sumD / cnt; node.heat_d5 = sumD5 / cnt; }
  });
  // Refresh graph to update node colors
  g6Nodes.forEach(gn => {
    gn.nodeData = nodeMap[gn.id];
  });
  graph.changeData({ nodes: g6Nodes, edges: g6Edges });
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
  mc.textContent = `${RAW_NODES.length} 环节 · ${RAW_EDGES.length} 条供应关系 · 热度已更新`;
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') closePanel(); });
document.getElementById('mc').textContent = `${RAW_NODES.length} 环节 · ${RAW_EDGES.length} 条供应关系`;

// Resize handler
window.addEventListener('resize', () => {
  const c = document.getElementById('g6-container');
  graph.changeSize(c.clientWidth, c.clientHeight);
});

setTimeout(initLiveHeat, 200);
