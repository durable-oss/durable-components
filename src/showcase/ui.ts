import type { ShowcaseParam, ShowcaseScenario } from './parser';

export interface UIData {
  showcaseFiles: Array<{ rel: string; abs: string }>;
  scenarios: ShowcaseScenario[];
  params: ShowcaseParam[];
  activeFile: string;
}

export function buildShellHtml(wsPort: number): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>dcc showcase</title>
<style>
*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; height: 100%; font-family: system-ui, sans-serif; }

/* Layout */
body { display: grid; grid-template-columns: 240px 1fr; grid-template-rows: 48px 1fr; }
header { grid-column: 1/-1; background: #1e1e2e; color: #cdd6f4; display: flex; align-items: center; padding: 0 1rem; gap: 1rem; }
header h1 { font-size: 1rem; font-weight: 600; margin: 0; flex: 1; }

/* Sidebar */
#sidebar { background: #181825; color: #cdd6f4; overflow-y: auto; border-right: 1px solid #313244; }
.sidebar-section { padding: 0.5rem 0; }
.sidebar-label { font-size: 0.65rem; text-transform: uppercase; letter-spacing: .08em; color: #6c7086; padding: 0.25rem 1rem; }
.sidebar-file { font-size: 0.8rem; font-weight: 600; padding: 0.4rem 1rem; cursor: pointer; color: #89b4fa; }
.sidebar-file:hover, .sidebar-file.active { background: #313244; }
.sidebar-scenario { font-size: 0.8rem; padding: 0.3rem 1rem 0.3rem 2rem; cursor: pointer; color: #cdd6f4; }
.sidebar-scenario:hover { background: #1e1e2e; }
.sidebar-scenario.active { background: #313244; color: #cba6f7; }

/* Main */
#main { display: flex; flex-direction: column; overflow: hidden; }
#toolbar { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; background: #1e1e2e; border-bottom: 1px solid #313244; flex-shrink: 0; }
#toolbar select { background: #313244; color: #cdd6f4; border: 1px solid #45475a; border-radius: 4px; padding: 0.25rem 0.5rem; font-size: 0.85rem; }
#toolbar label { font-size: 0.8rem; color: #a6adc8; }

/* Params panel */
#params-panel { display: flex; gap: 1rem; padding: 0.5rem 1rem; background: #181825; border-bottom: 1px solid #313244; flex-wrap: wrap; flex-shrink: 0; }
#params-panel:empty { display: none; }
.param-control { display: flex; flex-direction: column; gap: 2px; }
.param-control label { font-size: 0.7rem; color: #6c7086; }
.param-control input[type=text], .param-control input[type=number] {
  background: #313244; color: #cdd6f4; border: 1px solid #45475a; border-radius: 4px;
  padding: 0.2rem 0.4rem; font-size: 0.85rem; width: 140px;
}
.param-control input[type=checkbox] { width: 16px; height: 16px; }

/* Tabs */
#tabs { display: flex; background: #1e1e2e; border-bottom: 1px solid #313244; flex-shrink: 0; }
.tab { padding: 0.4rem 1rem; font-size: 0.8rem; cursor: pointer; color: #6c7086; border-bottom: 2px solid transparent; }
.tab.active { color: #cba6f7; border-bottom-color: #cba6f7; }

/* Content */
#content { flex: 1; overflow: hidden; position: relative; }
#preview-frame { width: 100%; height: 100%; border: none; display: block; }
#source-view { display: none; width: 100%; height: 100%; overflow: auto; background: #11111b; margin: 0; }
#source-view code { display: block; padding: 1rem; font-size: 0.82rem; line-height: 1.5; color: #cdd6f4; white-space: pre; font-family: 'Fira Code', 'Cascadia Code', monospace; }

/* Status */
#status { position: absolute; bottom: 8px; right: 12px; font-size: 0.7rem; color: #6c7086; }
#status.error { color: #f38ba8; }
#status.reload { color: #a6e3a1; }
</style>
</head>
<body>
<header>
  <h1>dcc showcase</h1>
  <span id="ws-status" style="font-size:0.75rem;color:#6c7086;">●</span>
</header>

<nav id="sidebar"><div id="sidebar-content"></div></nav>

<div id="main">
  <div id="toolbar">
    <label>Framework:</label>
    <select id="target-select">
      <option value="react">React</option>
      <option value="vue">Vue</option>
      <option value="svelte">Svelte</option>
      <option value="solid">Solid</option>
    </select>
  </div>
  <div id="params-panel"></div>
  <div id="tabs">
    <div class="tab active" data-tab="preview">Preview</div>
    <div class="tab" data-tab="source">Source</div>
  </div>
  <div id="content">
    <iframe id="preview-frame" sandbox="allow-scripts allow-same-origin"></iframe>
    <pre id="source-view"><code></code></pre>
    <div id="status"></div>
  </div>
</div>

<script>
const WS_PORT = ${wsPort};
let state = {
  activeFile: null,
  activeScenario: null,
  target: 'react',
  params: {},
  tab: 'preview',
  files: [],
  scenarios: [],
  paramDefs: [],
};

// WebSocket hot-reload
let ws;
function connectWS() {
  ws = new WebSocket('ws://localhost:' + WS_PORT);
  ws.onopen = () => { document.getElementById('ws-status').style.color = '#a6e3a1'; };
  ws.onclose = () => {
    document.getElementById('ws-status').style.color = '#f38ba8';
    setTimeout(connectWS, 1000);
  };
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === 'init' || msg.type === 'reload') {
      handleServerData(msg);
    } else if (msg.type === 'preview') {
      updatePreview(msg.html, msg.source, msg.error);
    }
  };
}
connectWS();

function handleServerData(msg) {
  if (msg.type === 'init') {
    state.files = msg.files || [];
    renderSidebar();
    if (state.files.length > 0 && !state.activeFile) {
      selectFile(state.files[0].rel);
    }
  } else if (msg.type === 'reload' && msg.file === state.activeFile) {
    state.paramDefs = msg.params || [];
    state.scenarios = msg.scenarios || [];
    renderParamControls();
    renderSidebar();
    if (!state.scenarios.find(s => s.name === state.activeScenario)) {
      state.activeScenario = state.scenarios[0]?.name ?? null;
    }
    requestPreview();
  }
}

function selectFile(rel) {
  state.activeFile = rel;
  send({ type: 'selectFile', file: rel });
}

function selectScenario(name) {
  state.activeScenario = name;
  renderSidebarScenarios();
  requestPreview();
}

function requestPreview() {
  if (!state.activeFile || !state.activeScenario) return;
  send({
    type: 'render',
    file: state.activeFile,
    scenario: state.activeScenario,
    target: state.target,
    params: state.params,
  });
}

function send(obj) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
}

function updatePreview(html, source, error) {
  const status = document.getElementById('status');
  if (error) {
    status.textContent = 'Error: ' + error;
    status.className = 'error';
  } else {
    status.textContent = '';
    status.className = '';
  }
  const frame = document.getElementById('preview-frame');
  frame.srcdoc = html || '';
  const codeEl = document.querySelector('#source-view code');
  codeEl.textContent = source || '';
}

// Sidebar
function renderSidebar() {
  const container = document.getElementById('sidebar-content');
  container.innerHTML = '';
  const label = document.createElement('div');
  label.className = 'sidebar-label';
  label.textContent = 'Showcase Files';
  container.appendChild(label);

  for (const f of state.files) {
    const el = document.createElement('div');
    el.className = 'sidebar-file' + (f.rel === state.activeFile ? ' active' : '');
    el.textContent = f.rel;
    el.onclick = () => selectFile(f.rel);
    container.appendChild(el);
  }

  renderSidebarScenarios(container);
}

function renderSidebarScenarios(container) {
  container = container || document.getElementById('sidebar-content');
  // Remove old scenario items
  for (const el of container.querySelectorAll('.sidebar-scenario')) el.remove();
  const sectionLabel = container.querySelector('.scenarios-label');
  if (sectionLabel) sectionLabel.remove();

  if (state.scenarios.length === 0) return;

  const label = document.createElement('div');
  label.className = 'sidebar-label scenarios-label';
  label.textContent = 'Scenarios';
  container.appendChild(label);

  for (const s of state.scenarios) {
    const el = document.createElement('div');
    el.className = 'sidebar-scenario' + (s.name === state.activeScenario ? ' active' : '');
    el.textContent = s.name;
    el.onclick = () => selectScenario(s.name);
    container.appendChild(el);
  }
}

// Params
let paramTimers = {};
function renderParamControls() {
  const panel = document.getElementById('params-panel');
  panel.innerHTML = '';
  // Reset params to defaults for new file
  state.params = {};
  for (const p of state.paramDefs) {
    state.params[p.name] = p.default;
    const wrap = document.createElement('div');
    wrap.className = 'param-control';
    const lbl = document.createElement('label');
    lbl.textContent = p.name + ' (' + p.type + ')';
    wrap.appendChild(lbl);

    let input;
    if (p.type === 'boolean') {
      input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = !!p.default;
    } else {
      input = document.createElement('input');
      input.type = p.type === 'number' ? 'number' : 'text';
      input.value = String(p.default);
    }

    input.addEventListener('input', () => {
      let val;
      if (p.type === 'boolean') val = input.checked;
      else if (p.type === 'number') val = Number(input.value);
      else val = input.value;
      state.params[p.name] = val;

      clearTimeout(paramTimers[p.name]);
      paramTimers[p.name] = setTimeout(requestPreview, 150);
    });

    wrap.appendChild(input);
    panel.appendChild(wrap);
  }
}

// Target dropdown
document.getElementById('target-select').addEventListener('change', (e) => {
  state.target = e.target.value;
  requestPreview();
});

// Tabs
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    state.tab = tab.dataset.tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const frame = document.getElementById('preview-frame');
    const src = document.getElementById('source-view');
    if (state.tab === 'preview') {
      frame.style.display = 'block';
      src.style.display = 'none';
    } else {
      frame.style.display = 'none';
      src.style.display = 'block';
    }
  });
});

// Server-side events feed into state
ws || connectWS();
</script>
</body>
</html>`;
}
