/* Kaya Section: System — the machine Kaya lives on. */
'use strict';

async function loadSystem(container) {
  container.innerHTML = '';
  const head = KayaUI.h('div', { className: 'page-head' });
  head.appendChild(KayaUI.h('h1', {}, 'System'));
  head.appendChild(KayaUI.h('p', {}, 'The hardware and services your Kaya runs on — version, updates, diagnostics, and permissions.'));
  container.appendChild(head);

  // Port-fallback banner: the console moved off its usual port. Dismissal
  // is per-port (sessionStorage), so a new move re-arms it. Fetched once,
  // reused by the This-console row below.
  let consoleStatus = null;
  try {
    const cs = await KayaAPI.get('/api/status');
    consoleStatus = cs;
    if (cs && cs.console_port && cs.console_port_requested && cs.console_port !== cs.console_port_requested &&
        !sessionStorage.getItem('kaya:port-banner:' + cs.console_port)) {
      const who = cs.console_port_occupant ? ' — ' + cs.console_port_occupant + ' is using port ' + cs.console_port_requested : '';
      const banner = KayaUI.h('div', { className: 'panel', style: 'border-left:3px solid var(--warn)' });
      const bh = KayaUI.h('div', { className: 'panel-head' });
      const bt = KayaUI.h('div');
      bt.appendChild(KayaUI.h('h2', {}, 'Console moved to port ' + cs.console_port));
      bt.appendChild(KayaUI.h('p', {}, 'Its usual port (' + cs.console_port_requested + ') was taken' + who + '. It stays here until that port is free when Kaya starts — your bookmarks to this address keep working.'));
      bh.appendChild(bt);
      const dismiss = KayaUI.h('button', { className: 'kaya-btn kaya-btn-kaya kaya-btn-sm' }, 'Dismiss');
      dismiss.addEventListener('click', () => {
        try { sessionStorage.setItem('kaya:port-banner:' + cs.console_port, '1'); } catch (e) {}
        banner.remove();
      });
      bh.appendChild(dismiss);
      banner.appendChild(bh);
      container.appendChild(banner);
    }
  } catch (e) { /* banner is best-effort */ }

  const statusEl = KayaUI.h('div', { className: 'loading' }, KayaUI.h('span', {}, 'Reading system…'));
  container.appendChild(statusEl);

  let st;
  try { st = await KayaAPI.get('/api/admin/status'); }
  catch (e) { statusEl.outerHTML = ''; container.appendChild(KayaUI.errorState('Couldn’t read system', 'Kaya may be starting.')); return; }
  statusEl.remove();

  // Kaya + Hardware — one panel with Update button in the header
  const g = KayaUI.h('div', { className: 'panel' });
  const gHead = KayaUI.h('div', { className: 'panel-head' });
  const gText = KayaUI.h('div');
  gText.appendChild(KayaUI.h('h2', {}, 'Kaya'));
  gHead.appendChild(gText);
  const upLogBox = KayaUI.h('div', { className: 'panel hidden', style: 'margin-top:var(--s-4)' });
  const updateBtn = KayaUI.h('button', { className: 'kaya-btn kaya-btn-secondary', onClick: () => runUpdate(upLogBox, updateBtn) }, 'Update Kaya');
  gHead.appendChild(updateBtn);
  g.appendChild(gHead);
  const gk = KayaUI.h('div', { className: 'kv' });
  gk.appendChild(systemKv('Version', st.version || '—'));
  gk.appendChild(systemKv('Uptime', st.uptime || '—'));
  gk.appendChild(systemKv('Model', (st.provider || '—') + (st.model ? ' · ' + st.model : '')));
  gk.appendChild(systemKv('Address', (st.ip || '—') + (st.hostname ? '  (' + st.hostname + ')' : '')));

  gk.appendChild(systemKv('CPU', (st.cpu_percent != null ? st.cpu_percent.toFixed(0) + '%' : '—')));
  if (st.memory) gk.appendChild(systemKv('Memory', fmtBytes(st.memory.used) + ' / ' + fmtBytes(st.memory.total)));
  if (st.disk) gk.appendChild(systemKv('Storage', KayaUI.fmtNum(Math.round(st.disk.used / 1073741824)) + ' GB / ' + KayaUI.fmtNum(Math.round(st.disk.total / 1073741824)) + ' GB'));
  if (st.load) {
    const cores = st.cpu_count || 1;
    const ratio = st.load.one / cores;
    const state = ratio < 0.5 ? 'ready' : ratio < 1 ? 'warn' : 'bad';
    const label = ratio < 0.5 ? 'Idle' : ratio < 1 ? 'Loaded' : 'Overloaded';
    const loadVal = KayaUI.h('div', { className: 'kv-val' });
    loadVal.appendChild(KayaUI.h('span', { className: 'status-pill' }, KayaUI.statusDot(state), label));
    loadVal.appendChild(KayaUI.h('div', { className: 'type-foot text-tertiary', style: 'margin-top:2px' },
      st.load.one.toFixed(2) + ' / ' + st.load.five.toFixed(2) + ' / ' + st.load.fifteen.toFixed(2) + '  ·  ' + cores + ' core' + (cores > 1 ? 's' : '')));
    const loadRow = KayaUI.h('div', { className: 'kv-row' });
    loadRow.appendChild(KayaUI.h('div', { className: 'kv-key' }, 'Load'));
    loadRow.appendChild(loadVal);
    gk.appendChild(loadRow);
  }
  g.appendChild(gk);
  g.appendChild(upLogBox);
  container.appendChild(g);

  try {
    const upRes = await KayaAPI.get('/api/admin/update/status');
    if (upRes.running) runUpdate(upLogBox, updateBtn);
    else if (upRes.log) { upLogBox.classList.remove('hidden'); upLogBox.appendChild(KayaUI.h('pre', { className: 'type-mono', style: 'white-space:pre-wrap;margin:0' }, upRes.log)); }
  } catch (e) { /* not running */ }

  // Services
  const sv = KayaUI.h('div', { className: 'panel' });
  sv.appendChild(panelHead('Services'));
  const svk = KayaUI.h('div', { className: 'kv' });
  (st.services || []).forEach(s => {
    svk.appendChild(kvRow2(s.name, s.active ? 'Running' : 'Stopped', s.active ? 'ready' : 'bad'));
  });
  sv.appendChild(svk);
  container.appendChild(sv);

  // Diagnostics
  const diag = KayaUI.h('div', { className: 'panel' });
  const dh = KayaUI.h('div', { className: 'panel-head' });
  const dhText = KayaUI.h('div');
  dhText.appendChild(KayaUI.h('h2', {}, 'Diagnostics'));
  dh.appendChild(dhText);
  const runBtn = KayaUI.h('button', { className: 'kaya-btn kaya-btn-secondary' }, 'Run diagnostics');
  runBtn.addEventListener('click', () => runDiag(diagBody));
  dh.appendChild(runBtn);
  diag.appendChild(dh);
  const diagBody = KayaUI.h('div', { id: 'diag-body', style: 'margin-top:var(--s-3)' });
  diagBody.appendChild(KayaUI.emptyState('Not run yet', 'Run a check to see how Kaya is doing.'));
  diag.appendChild(diagBody);
  container.appendChild(diag);
  runDiag(diagBody);

  // Permissions — what Kaya is allowed to do (embedded, same data and
  // actions as the standalone permissions screen used to show).
  const perm = KayaUI.h('div', { className: 'panel' });
  const permHead = KayaUI.h('div', { className: 'panel-head' });
  const permText = KayaUI.h('div');
  permText.appendChild(KayaUI.h('h2', {}, 'Permissions'));
  permHead.appendChild(permText);
  perm.appendChild(permHead);
  const permBody = KayaUI.h('div', {});
  perm.appendChild(permBody);
  container.appendChild(perm);
  loadPermissions(permBody, { embedded: true });
}

async function runUpdate(logBox, btn) {
  btn.disabled = true; btn.textContent = 'Updating…';
  logBox.classList.remove('hidden');
  logBox.innerHTML = '';
  logBox.appendChild(KayaUI.loading('Starting update…'));
  try { await KayaAPI.post('/api/admin/update'); } catch (e) { KayaUI.toast('Couldn’t start update.', 'err'); btn.disabled = false; btn.textContent = 'Update Kaya'; return; }
  const poll = setInterval(async () => {
    try {
      const s = await KayaAPI.get('/api/admin/update/status');
      logBox.innerHTML = '';
      logBox.appendChild(KayaUI.h('pre', { className: 'type-mono', style: 'white-space:pre-wrap;margin:0;max-height:300px;overflow:auto' }, s.log || ''));
      if (!s.running) {
        clearInterval(poll);
        btn.disabled = false; btn.textContent = 'Update Kaya';
        if (s.success) KayaUI.toast('Kaya is up to date');
      }
    } catch (e) { clearInterval(poll); btn.disabled = false; btn.textContent = 'Update Kaya'; }
  }, 1500);
}

function panelHead(title) {
  const h = KayaUI.h('div', { className: 'panel-head' });
  const text = KayaUI.h('div');
  text.appendChild(KayaUI.h('h2', {}, title));
  h.appendChild(text);
  return h;
}
function systemKv(k, v) { const r = KayaUI.h('div', { className: 'kv-row' }); r.appendChild(KayaUI.h('div', { className: 'kv-key' }, k)); r.appendChild(KayaUI.h('div', { className: 'kv-val' }, v)); return r; }

function fmtBytes(n) {
  if (!n) return '0 B';
  const gb = 1073741824, mb = 1048576;
  if (n >= gb) return (n / gb).toFixed(1) + ' GB';
  if (n >= mb) return (n / mb).toFixed(0) + ' MB';
  return Math.round(n / 1024) + ' KB';
}
function kvRow2(k, v, state) {
  const r = KayaUI.h('div', { className: 'kv-row' });
  r.appendChild(KayaUI.h('div', { className: 'kv-key' }, k));
  const tr = KayaUI.h('div', { className: 'kv-val' });
  tr.appendChild(KayaUI.h('span', { className: 'status-pill' }, KayaUI.statusDot(state), v));
  r.appendChild(tr);
  return r;
}

async function runDiag(body) {
  body.innerHTML = ''; body.appendChild(KayaUI.loading('Running diagnostics\u2026'));
  let res;
  try { res = await KayaAPI.proxyGet('/v1/doctor'); }
  catch (e) { body.innerHTML = ''; body.appendChild(KayaUI.errorState('Diagnostics unavailable', e.message || 'The gateway may be starting.')); return; }
  body.innerHTML = '';
  const grid = KayaUI.h('div', { className: 'diag-grid' });
  const checks = Array.isArray(res.checks) ? res.checks : [];
  if (checks.length === 0) {
    grid.appendChild(KayaUI.emptyState('Nothing to report', 'No checks returned. Response keys: ' + Object.keys(res).join(', ')));
  }
  checks.forEach(ch => {
    const row = KayaUI.h('div', { className: 'diag-row' });
    const st = ch.status === 'ok' ? 'ready' : ch.status === 'info' ? 'neutral' : ch.status === 'warn' ? 'warn' : 'bad';
    row.appendChild(KayaUI.h('span', { className: 'status-dot ' + st }));
    row.appendChild(KayaUI.h('div', { className: 'diag-name' }, ch.label || ch.name));
    const msg = KayaUI.h('div', { className: 'diag-msg' });
    msg.textContent = ch.message || '';
    row.appendChild(msg);
    grid.appendChild(row);
  });
  body.appendChild(grid);
}

KayaApp.registerSection('system', loadSystem);
