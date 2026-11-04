/* Kaya Section: Integrations — connect Calendar, Flight, Home Assistant.
   Product setup for skills that need credentials. No SSH, no .env editing. */
'use strict';

// What a save tells the owner. A refusal from the service is shown in its own
// words; a key that was saved but could not be checked is said honestly.
function savedToast(name, res) {
  if (res && res.status === 'unverified' && res.note) KayaUI.toast(res.note);
  else KayaUI.toast(name + ' connected');
}
function saveError(err) {
  let msg = (err && err.message) || '';
  try { const j = JSON.parse(msg); msg = (j && (j.error || j.message)) || msg; } catch (e) { /* plain text */ }
  return msg || 'That didn\u2019t work.';
}

async function loadIntegrations(container) {
  if (KayaApp.currentSection() !== 'apps') return;
  container.innerHTML = '';
  const head = KayaUI.h('div', { className: 'page-head' });
  head.appendChild(KayaUI.h('h1', {}, 'Apps'));
  head.appendChild(KayaUI.h('p', {}, 'The apps and services Kaya can reach — Gmail, Google Calendar, flight tracking, Home Assistant, web search, and camera.'));
  container.appendChild(head);

  const panel = KayaUI.h('div', { className: 'panel' });
  const listEl = KayaUI.h('div', { id: 'int-list' });
  listEl.appendChild(KayaUI.loading('Loading apps…'));
  panel.appendChild(listEl);
  container.appendChild(panel);

  // Connections strip: vault lifecycle states (never secrets).
  const connEl = KayaUI.h('div', { className: 'chips', id: 'int-connections' });
  container.insertBefore(connEl, panel);
  KayaAPI.proxyGet('/v1/connected-apps').then(res => {
    if (!document.body.contains(container)) return;
    const conns = (res && (res.connected_apps || res.connections)) || [];
    connEl.innerHTML = '';
    const interesting = conns.filter(c => c.status && c.status !== 'connected' && c.status !== 'not_configured');
    interesting.slice(0, 8).forEach(c => {
      connEl.appendChild(KayaUI.h('span', { className: 'chip chip-waiting', title: c.display_name },
        '! ' + c.display_name + ': ' + String(c.status).replace(/_/g, ' ')));
    });
  }).catch(() => {});

  let status;
  try { status = await KayaAPI.get('/api/admin/integrations/status'); }
  catch (e) {
    if (!document.body.contains(container)) return;
    listEl.innerHTML = '';
    listEl.appendChild(KayaUI.errorState('Couldn’t load integrations', e.message || 'Kaya may still be starting.'));
    return;
  }
  if (!document.body.contains(container)) return;
  const ints = (status && status.integrations) || {};
  listEl.innerHTML = '';

  // Optional Brave search key (tools config → vault on save). Built-in
  // DuckDuckGo already works with no setup, so this row never alarms:
  // it shows the active provider and offers the upgrade.
  let toolsCfg = null;
  try { toolsCfg = await KayaAPI.get('/api/admin/tools'); } catch (e) { /* offline-safe */ }
  const braveOn = !!(toolsCfg && toolsCfg.web && toolsCfg.web.brave &&
    toolsCfg.web.brave.enabled && toolsCfg.web.brave.api_key);

  // Calendar
  const cal = ints.calendar || {};
  const calState = cal.connected ? 'connected' : 'neutral';
  listEl.appendChild(intRow('Google Calendar', 'Calendar',
    calState, cal.connected ? 'Connected' : 'Not connected',
    cal.connected ? () => confirmDisconnectCalendar() : () => startCalendarConnect(), ['Connect', 'Disconnect']));

  // Gmail (OAuth product flow: consent URL in new tab, poll status)
  const gm = ints.gmail || {};
  const gmState = gm.connected ? 'connected' : 'neutral';
  listEl.appendChild(intRow('Gmail', 'Email',
    gmState, gm.connected ? 'Connected' : 'Not connected',
    gm.connected ? () => confirmDisconnectGmail() : () => startGmailConnect(), ['Connect', 'Disconnect']));

  // Outlook (OAuth product flow: consent URL in new tab, poll status)
  const om = ints.outlook || {};
  const omState = om.connected ? 'connected' : 'neutral';
  listEl.appendChild(intRow('Outlook', 'Email + Calendar',
    omState, om.connected ? 'Connected' : 'Not connected',
    om.connected ? () => confirmDisconnectOutlook() : () => startOutlookConnect(), ['Connect', 'Disconnect']));

  // Spotify (OAuth product flow: consent URL in new tab, poll status)
  const sp = ints.spotify || {};
  const spState = sp.connected ? 'connected' : 'neutral';
  listEl.appendChild(intRow('Spotify', 'Music',
    spState, sp.connected ? 'Connected' : 'Not connected',
    sp.connected ? () => confirmDisconnectSpotify() : () => startSpotifyConnect(), ['Connect', 'Disconnect']));

  // GitHub (paste read-only PAT; trust-user: token scopes govern)
  const gh = ints.github || {};
  const ghCfg = gh.configured === true;
  listEl.appendChild(intRow('GitHub', 'Code search',
    ghCfg ? 'ready' : 'neutral', ghCfg ? 'Configured' : 'Not connected',
    () => editGithubToken(ghCfg)));

  // Notion (paste integration token)
  const nt = ints.notion || {};
  const ntCfg = nt.configured === true;
  listEl.appendChild(intRow('Notion', 'Docs',
    ntCfg ? 'ready' : 'neutral', ntCfg ? 'Configured' : 'Not connected',
    () => editNotionToken(ntCfg)));

  // Flight
  const fl = ints.flight || {};
  const flCfg = fl.configured === true;
  listEl.appendChild(intRow('Flight tracking', 'Aviation data',
    flCfg ? 'ready' : 'neutral', flCfg ? 'Configured' : 'Not configured',
    () => editFlightKey(flCfg)));

  // Home Assistant
  const ha = ints.homeassistant || {};
  const haCfg = ha.configured === true;
  listEl.appendChild(intRow('Home Assistant', 'Smart home',
    haCfg ? 'ready' : 'neutral', haCfg ? 'Configured' : 'Not configured',
    () => editHass(haCfg)));

  // Web search (built-in DuckDuckGo always works; Brave is an optional
  // key pasted here — the normie surface for tools.web.brave).
  const braveRow = KayaUI.h('div', { className: 'model-row' });
  const brMain = KayaUI.h('div', { className: 'model-main' });
  brMain.appendChild(KayaUI.h('div', { className: 'model-name' }, 'Web search'));
  brMain.appendChild(KayaUI.h('div', { className: 'model-sub' },
    braveOn ? 'Brave Search  ·  pro results' : 'Built-in search active  ·  optional Brave upgrade'));
  braveRow.appendChild(brMain);
  const brTr = KayaUI.h('div', { className: 'kaya-row-trailing' });
  brTr.appendChild(KayaUI.h('span', { className: 'status-pill' },
    KayaUI.statusDot(braveOn ? 'ready' : 'neutral'), braveOn ? 'Brave on' : 'Built-in'));
  brTr.appendChild(KayaUI.h('button', { className: 'kaya-btn kaya-btn-secondary',
    onClick: () => editBraveKey(braveOn) }, braveOn ? 'Edit' : 'Add Brave key'));
  braveRow.appendChild(brTr);
  listEl.appendChild(braveRow);

  // Website logins: sign-ins the browser can use without the model ever
  // seeing a password. Same shape as connected apps — paste once, revoke here.
  let webLogins = [];
  try { const r = await KayaAPI.proxyGet('/v1/website-logins'); webLogins = (r && r.logins) || []; } catch (e) { /* offline-safe */ }
  listEl.appendChild(intRow('Website logins', 'Browser sign-ins',
    webLogins.length ? 'ready' : 'neutral',
    webLogins.length ? webLogins.length + ' saved' : 'None saved',
    () => manageWebLogins(webLogins)));

  // Tool servers (MCP): outside services that give Kaya more tools. Added
  // here by address and key, no terminal; the key is sealed on the Pod.
  let toolServers = [];
  try { const r = await KayaAPI.proxyGet('/v1/tool-servers'); toolServers = (r && r.servers) || []; } catch (e) { /* offline-safe */ }
  const tsUp = toolServers.filter(t => t.status === 'connected').length;
  listEl.appendChild(intRow('Tool servers', 'More tools from other services',
    toolServers.length ? (tsUp === toolServers.length ? 'ready' : 'warn') : 'neutral',
    toolServers.length ? tsUp + ' of ' + toolServers.length + ' connected' : 'None added',
    () => manageToolServers(toolServers)));

  // Camera mirrors the same readiness the Skills list uses — the two
  // screens can never disagree. Status already fetched above.
  const cam = (status && status.integrations && status.integrations.camera) || {};
  const camAvail = !!cam.available;
  const camRow = KayaUI.h('div', { className: 'model-row' });
  const camMain = KayaUI.h('div', { className: 'model-main' });
  camMain.appendChild(KayaUI.h('div', { className: 'model-name' }, 'Camera'));
  camMain.appendChild(KayaUI.h('div', { className: 'model-sub' },
    'On-device  ·  ' + (cam.detail || (camAvail ? 'camera detected' : 'checking…'))));
  camRow.appendChild(camMain);
  const camTr = KayaUI.h('div', { className: 'kaya-row-trailing' });
  camTr.appendChild(KayaUI.h('span', { className: 'status-pill' },
    KayaUI.statusDot(camAvail ? 'ready' : 'neutral'), camAvail ? 'Ready' : 'No camera'));
  const camBtn = KayaUI.h('button', { className: 'kaya-btn kaya-btn-secondary', onClick: () => KayaApp.navigate('abilities') }, 'View abilities');
  camTr.appendChild(camBtn);
  camRow.appendChild(camTr);
  listEl.appendChild(camRow);
}

function intRow(name, kind, state, sub, onClick, labels) {
  const row = KayaUI.h('div', { className: 'model-row' });
  const main = KayaUI.h('div', { className: 'model-main' });
  main.appendChild(KayaUI.h('div', { className: 'model-name' }, name));
  // The status pill on the right already says connected or not; only
  // repeat the sub-line when it carries something else (e.g. "camera detected").
  const stateOnly = /^(not )?(connected|configured)$/i.test(sub);
  main.appendChild(KayaUI.h('div', { className: 'model-sub' }, stateOnly ? kind : kind + '  ·  ' + sub));
  row.appendChild(main);
  const tr = KayaUI.h('div', { className: 'kaya-row-trailing' });
  const label = state === 'connected' ? 'Connected' : state === 'ready' ? 'Configured' : 'Not connected';
  tr.appendChild(KayaUI.h('span', { className: 'status-pill' }, KayaUI.statusDot(state), label));
  if (onClick) {
    tr.appendChild(KayaUI.h('button', { className: 'kaya-btn kaya-btn-secondary', onClick },
      state === 'connected' || state === 'ready' ? (labels ? labels[1] : 'Edit') : (labels ? labels[0] : 'Configure')));
  }
  row.appendChild(tr);
  return row;
}

// ── Signing in to Google, Microsoft and Spotify ─────────────────────────
// Each needs an app registered with it. Kaya doesn't ship one, so the first
// time the console walks the owner through registering their own and keeps its
// ID and secret sealed on the Pod. Signing in then finishes by pasting back the
// address the browser ended on; nothing needs a public address for the Pod.
const OAUTH_SERVICES = {
  calendar: { name: 'Google Calendar', who: 'Google', start: '/api/admin/integrations/calendar/oauth/start' },
  gmail:    { name: 'Gmail',           who: 'Google', start: '/api/admin/integrations/gmail/oauth/start' },
  outlook:  { name: 'Outlook',         who: 'Microsoft', start: '/api/admin/integrations/outlook/oauth/start' },
  spotify:  { name: 'Spotify',         who: 'Spotify', start: '/api/admin/integrations/spotify/oauth/start' },
};

function closeModalOf(el) { KayaUI.dismiss(el.closest('.kaya-modal-backdrop')); }

function setBusy(btn, on) { btn.classList.toggle('is-busy', !!on); btn.disabled = !!on; }

async function connectOAuth(service) {
  const svc = OAUTH_SERVICES[service];
  let res;
  try { res = await KayaAPI.post(svc.start, {}); }
  catch (e) { KayaUI.toast((e && e.message) || ('Couldn’t start ' + svc.name + '.'), 'err'); return; }
  if (res && res.status === 'ready') { KayaUI.toast(svc.name + ' is already connected'); loadIntegrations(document.getElementById('view')); return; }
  if (res && res.status === 'needs_configuration') { openOAuthSetup(service, () => connectOAuth(service)); return; }
  if (!res || !res.auth_url) { KayaUI.toast((res && res.message) || ('Couldn’t start ' + svc.name + '.'), 'err'); return; }
  window.open(res.auth_url, '_blank', 'noopener');
  openPasteBack(service, res.auth_url);
}

async function openOAuthSetup(service, then) {
  const svc = OAUTH_SERVICES[service];
  let info;
  try { info = await KayaAPI.get('/api/admin/integrations/oauth-setup?service=' + service); }
  catch (e) { KayaUI.toast('Couldn’t load the setup steps.', 'err'); return; }
  const body = KayaUI.h('div');
  body.appendChild(KayaUI.h('p', {}, svc.who + ' lets you sign Kaya in through an app that you own. It takes a few minutes, is free, and only has to be done once.'));
  const steps = KayaUI.h('ol');
  (info.steps || []).forEach(t => steps.appendChild(KayaUI.h('li', {}, t)));
  body.appendChild(steps);
  body.appendChild(KayaUI.h('p', {}, KayaUI.h('a', { href: info.console_url, target: '_blank', rel: 'noopener' }, 'Open ' + svc.who + '’s page for this ↗')));
  if (info.provider !== 'google') {
    body.appendChild(KayaUI.h('p', {}, 'Register this address as the redirect:'));
    const line = KayaUI.h('div', { className: 'kaya-copyline' });
    line.appendChild(KayaUI.h('code', {}, info.redirect));
    const copy = KayaUI.h('button', { className: 'kaya-btn kaya-btn-secondary kaya-btn-sm', type: 'button', onClick: async () => {
      try { await navigator.clipboard.writeText(info.redirect); KayaUI.toast('Copied'); } catch (e) { KayaUI.toast('Select it and copy by hand', 'err'); }
    } }, 'Copy');
    line.appendChild(copy);
    body.appendChild(line);
  } else {
    body.appendChild(KayaUI.h('p', { className: 'text-tertiary' }, 'A Desktop app needs no redirect address. Google allows this one automatically.'));
  }
  const group = KayaUI.h('div', { className: 'kaya-fieldgroup' });
  const idIn = KayaUI.input('Client ID', 'text'); idIn.autocomplete = 'off'; idIn.spellcheck = false;
  const secIn = KayaUI.input('Client secret', 'password'); secIn.autocomplete = 'off';
  group.appendChild(KayaUI.h('label', {}, 'Client ID', idIn));
  group.appendChild(KayaUI.h('label', {}, 'Client secret', secIn));
  let tenIn = null;
  if (info.needs_tenant) {
    tenIn = KayaUI.input('common', 'text'); tenIn.spellcheck = false;
    group.appendChild(KayaUI.h('label', {}, 'Account type (optional: common, consumers, or a tenant ID)', tenIn));
  }
  body.appendChild(group);
  const err = KayaUI.h('div', { className: 'kaya-modal-error', role: 'alert' });
  body.appendChild(err);
  body.appendChild(KayaUI.h('p', { className: 'text-tertiary', style: 'margin-top:var(--s-3)' }, 'These are stored sealed on your Pod, like your API keys. They never appear in a chat or a backup.'));
  const save = KayaUI.h('button', { className: 'kaya-btn kaya-btn-primary', type: 'button' }, 'Save and sign in');
  save.addEventListener('click', async () => {
    err.textContent = '';
    if (!idIn.value.trim() || !secIn.value.trim()) { err.textContent = 'Paste both the client ID and the client secret.'; return; }
    setBusy(save, true);
    try {
      await KayaAPI.post('/api/admin/integrations/oauth-setup', { service, client_id: idIn.value, client_secret: secIn.value, tenant: tenIn ? tenIn.value : '' });
    } catch (e) { setBusy(save, false); err.textContent = (e && e.message) || 'Couldn’t save that.'; return; }
    closeModalOf(save);
    if (then) then();
  });
  KayaUI.modal('Set up ' + svc.name, body, [
    KayaUI.h('button', { className: 'kaya-btn kaya-btn-kaya', type: 'button', onClick: (e) => closeModalOf(e.target) }, 'Cancel'),
    save,
  ], { wide: true });
}

function openPasteBack(service, authURL) {
  const svc = OAUTH_SERVICES[service];
  const body = KayaUI.h('div');
  const ol = KayaUI.h('ol');
  ol.appendChild(KayaUI.h('li', {}, 'Approve access in the tab that just opened.'));
  ol.appendChild(KayaUI.h('li', {}, 'Afterwards that tab will say it can’t be reached. That is expected: it means the sign-in worked.'));
  ol.appendChild(KayaUI.h('li', {}, 'Copy the whole address from the top of that tab and paste it here.'));
  body.appendChild(ol);
  const addr = KayaUI.input('Paste the address', 'text'); addr.autocomplete = 'off'; addr.spellcheck = false;
  body.appendChild(addr);
  const err = KayaUI.h('div', { className: 'kaya-modal-error', role: 'alert' });
  body.appendChild(err);
  body.appendChild(KayaUI.h('p', { className: 'text-tertiary', style: 'margin-top:var(--s-3)' },
    KayaUI.h('a', { href: authURL, target: '_blank', rel: 'noopener' }, 'The tab didn’t open? Open the sign-in again ↗')));
  const go = KayaUI.h('button', { className: 'kaya-btn kaya-btn-primary', type: 'button' }, 'Connect');
  const submit = async () => {
    err.textContent = '';
    if (!addr.value.trim()) { err.textContent = 'Paste the address first.'; return; }
    setBusy(go, true);
    let r;
    try { r = await KayaAPI.post('/api/admin/integrations/oauth/paste', { service, url: addr.value }); }
    catch (e) { setBusy(go, false); err.textContent = (e && e.message) || 'Couldn’t reach your Pod.'; return; }
    setBusy(go, false);
    if (!r || !r.ok) { err.textContent = (r && r.error) || 'That didn’t work. Try again.'; return; }
    closeModalOf(go);
    KayaUI.toast(r.message || (svc.name + ' is connected'), 'ok');
    loadIntegrations(document.getElementById('view'));
  };
  go.addEventListener('click', submit);
  addr.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  KayaUI.modal('Connect ' + svc.name, body, [
    KayaUI.h('button', { className: 'kaya-btn kaya-btn-kaya', type: 'button', onClick: (e) => { closeModalOf(e.target); openOAuthSetup(service, () => connectOAuth(service)); } }, 'Change app details'),
    KayaUI.h('button', { className: 'kaya-btn kaya-btn-secondary', type: 'button', onClick: (e) => closeModalOf(e.target) }, 'Cancel'),
    go,
  ]);
}

const startCalendarConnect = () => connectOAuth('calendar');
const startGmailConnect = () => connectOAuth('gmail');
const startOutlookConnect = () => connectOAuth('outlook');
const startSpotifyConnect = () => connectOAuth('spotify');

async function confirmDisconnectCalendar() {
  if (!(await KayaUI.confirmModal('Disconnect Calendar?', 'Kaya will no longer read your calendar. You can reconnect anytime.', 'Disconnect'))) return;
  try { await KayaAPI.post('/api/admin/integrations/calendar/disconnect', {}); KayaUI.toast('Calendar disconnected'); }
  catch (e) { KayaUI.toast('Couldn’t disconnect.', 'err'); return; }
  loadIntegrations(document.getElementById('view'));
}

async function confirmDisconnectGmail() {
  if (!(await KayaUI.confirmModal('Disconnect Gmail?', 'Kaya will no longer read or send your email. You can reconnect anytime.', 'Disconnect'))) return;
  try { await KayaAPI.post('/api/admin/integrations/gmail/disconnect', {}); KayaUI.toast('Gmail disconnected'); }
  catch (e) { KayaUI.toast('Couldn’t disconnect.', 'err'); return; }
  loadIntegrations(document.getElementById('view'));
}

async function confirmDisconnectOutlook() {
  if (!(await KayaUI.confirmModal('Disconnect Outlook?', 'Kaya will no longer read or send your email or calendar. You can reconnect anytime.', 'Disconnect'))) return;
  try { await KayaAPI.post('/api/admin/integrations/outlook/disconnect', {}); KayaUI.toast('Outlook disconnected'); }
  catch (e) { KayaUI.toast('Couldn’t disconnect.', 'err'); return; }
  loadIntegrations(document.getElementById('view'));
}

async function confirmDisconnectSpotify() {
  if (!(await KayaUI.confirmModal('Disconnect Spotify?', 'Kaya will no longer control your music. You can reconnect anytime.', 'Disconnect'))) return;
  try { await KayaAPI.post('/api/admin/integrations/spotify/disconnect', {}); KayaUI.toast('Spotify disconnected'); }
  catch (e) { KayaUI.toast('Couldn’t disconnect.', 'err'); return; }
  loadIntegrations(document.getElementById('view'));
}

function editGithubToken(configured) {
  const body = KayaUI.h('div');
  body.appendChild(KayaUI.h('div', { className: 'type-callout text-tertiary', style: 'margin-bottom:var(--s-4)' },
    'Paste a read-only personal access token (Settings → Developer settings → Personal access tokens). Your token’s own scopes govern what Kaya can see. Stored securely on this device only.'));
  const f = KayaUI.h('div', { className: 'field' });
  f.appendChild(KayaUI.h('label', {}, configured ? 'New token (leave blank to keep current)' : 'Personal access token'));
  const inp = KayaUI.h('input', { className: 'kaya-input', type: 'password', placeholder: configured ? '••• current token saved •••' : 'ghp_…', autocomplete: 'off' });
  f.appendChild(inp); body.appendChild(f);
  KayaUI.modal(configured ? 'Edit GitHub token' : 'Connect GitHub', body, [
    KayaUI.h('button', { className: 'kaya-btn kaya-btn-kaya', onClick: (e) => e.target.closest('.kaya-modal-backdrop').remove() }, 'Cancel'),
    KayaUI.h('button', { className: 'kaya-btn kaya-btn-primary', onClick: async (e) => {
      const token = inp.value.trim();
      if (!token) { e.target.closest('.kaya-modal-backdrop').remove(); return; }
      try {
        const saved = await KayaAPI.post('/api/admin/integrations/github/save', { token });
        e.target.closest('.kaya-modal-backdrop').remove();
        savedToast('GitHub', saved);
        loadIntegrations(document.getElementById('view'));
      } catch (err) { KayaUI.toast(saveError(err), 'err'); }
    } }, 'Save'),
  ]);
  if (configured) {
    body.appendChild(KayaUI.h('button', { className: 'kaya-btn kaya-btn-kaya', onClick: async () => {
      if (!(await KayaUI.confirmModal('Disconnect GitHub?', 'Kaya will no longer search your code.', 'Disconnect'))) return;
      try { await KayaAPI.post('/api/admin/integrations/github/disconnect', {}); KayaUI.toast('GitHub disconnected'); }
      catch (e) { KayaUI.toast('Couldn’t disconnect.', 'err'); return; }
      loadIntegrations(document.getElementById('view'));
    } }, 'Disconnect'));
  }
}

function editNotionToken(configured) {
  const body = KayaUI.h('div');
  body.appendChild(KayaUI.h('div', { className: 'type-callout text-tertiary', style: 'margin-bottom:var(--s-4)' },
    'Paste a Notion internal integration token and share the pages you want Kaya to search. Stored securely on this device only.'));
  const f = KayaUI.h('div', { className: 'field' });
  f.appendChild(KayaUI.h('label', {}, configured ? 'New token (leave blank to keep current)' : 'Integration token'));
  const inp = KayaUI.h('input', { className: 'kaya-input', type: 'password', placeholder: configured ? '••• current token saved •••' : 'ntn_… / secret_…', autocomplete: 'off' });
  f.appendChild(inp); body.appendChild(f);
  KayaUI.modal(configured ? 'Edit Notion token' : 'Connect Notion', body, [
    KayaUI.h('button', { className: 'kaya-btn kaya-btn-kaya', onClick: (e) => e.target.closest('.kaya-modal-backdrop').remove() }, 'Cancel'),
    KayaUI.h('button', { className: 'kaya-btn kaya-btn-primary', onClick: async (e) => {
      const token = inp.value.trim();
      if (!token) { e.target.closest('.kaya-modal-backdrop').remove(); return; }
      try {
        const saved = await KayaAPI.post('/api/admin/integrations/notion/save', { token });
        e.target.closest('.kaya-modal-backdrop').remove();
        savedToast('Notion', saved);
        loadIntegrations(document.getElementById('view'));
      } catch (err) { KayaUI.toast(saveError(err), 'err'); }
    } }, 'Save'),
  ]);
  if (configured) {
    body.appendChild(KayaUI.h('button', { className: 'kaya-btn kaya-btn-kaya', onClick: async () => {
      if (!(await KayaUI.confirmModal('Disconnect Notion?', 'Kaya will no longer search your docs.', 'Disconnect'))) return;
      try { await KayaAPI.post('/api/admin/integrations/notion/disconnect', {}); KayaUI.toast('Notion disconnected'); }
      catch (e) { KayaUI.toast('Couldn’t disconnect.', 'err'); return; }
      loadIntegrations(document.getElementById('view'));
    } }, 'Disconnect'));
  }
}

function editFlightKey(configured) {
  const body = KayaUI.h('div');
  body.appendChild(KayaUI.h('div', { className: 'type-callout text-tertiary', style: 'margin-bottom:var(--s-4)' },
    'Flight status uses AviationStack (free tier: 100 lookups/month). Get a key at aviationstack.com, then paste it here. It is stored securely on this device only.'));
  const f = KayaUI.h('div', { className: 'field' });
  f.appendChild(KayaUI.h('label', {}, configured ? 'New API key (leave blank to keep current)' : 'API key'));
  const inp = KayaUI.h('input', { className: 'kaya-input', type: 'password', placeholder: configured ? '••• current key saved •••' : 'aviationstack API key', autocomplete: 'off' });
  f.appendChild(inp); body.appendChild(f);
  KayaUI.modal(configured ? 'Edit flight key' : 'Connect flight tracking', body, [
    KayaUI.h('button', { className: 'kaya-btn kaya-btn-kaya', onClick: (e) => e.target.closest('.kaya-modal-backdrop').remove() }, 'Cancel'),
    KayaUI.h('button', { className: 'kaya-btn kaya-btn-primary', onClick: async (e) => {
      const key = inp.value.trim();
      if (!key) { e.target.closest('.kaya-modal-backdrop').remove(); return; }
      try {
        const saved = await KayaAPI.post('/api/admin/integrations/flight/save', { api_key: key });
        e.target.closest('.kaya-modal-backdrop').remove();
        savedToast('Flights', saved);
        loadIntegrations(document.getElementById('view'));
      } catch (err) { KayaUI.toast(saveError(err), 'err'); }
    } }, 'Save'),
  ]);
}

function editHass(configured) {
  const body = KayaUI.h('div');
  body.appendChild(KayaUI.h('div', { className: 'type-callout text-tertiary', style: 'margin-bottom:var(--s-4)' },
    'Point Kaya at your Home Assistant instance. Stored securely on this device only.'));
  const mk = (label, ph, pw) => {
    const f = KayaUI.h('div', { className: 'field' });
    f.appendChild(KayaUI.h('label', {}, label));
    const i = KayaUI.h('input', { className: 'kaya-input', placeholder: ph, autocomplete: 'off' });
    if (pw) i.type = 'password';
    f.appendChild(i); body.appendChild(f); return i;
  };
  const urlInp = mk('Home Assistant URL', 'http://homeassistant.local:8123', false);
  const tokInp = mk('Long-lived access token', configured ? '••• current token saved •••' : 'paste token', true);
  KayaUI.modal(configured ? 'Edit Home Assistant' : 'Connect Home Assistant', body, [
    KayaUI.h('button', { className: 'kaya-btn kaya-btn-kaya', onClick: (e) => e.target.closest('.kaya-modal-backdrop').remove() }, 'Cancel'),
    KayaUI.h('button', { className: 'kaya-btn kaya-btn-primary', onClick: async (e) => {
      const url = urlInp.value.trim(), token = tokInp.value.trim();
      if (!url || !token) { KayaUI.toast('URL and token are required.'); return; }
      if (!/^https?:\/\//i.test(url)) { KayaUI.toast('URL must start with http:// or https://', 'err'); return; }
      try {
        const saved = await KayaAPI.post('/api/admin/integrations/homeassistant/save', { url, token });
        e.target.closest('.kaya-modal-backdrop').remove();
        savedToast('Home Assistant', saved);
        loadIntegrations(document.getElementById('view'));
      } catch (err) { KayaUI.toast(saveError(err), 'err'); }
    } }, 'Save'),
  ]);
}

function editBraveKey(configured) {
  const body = KayaUI.h('div');
  body.appendChild(KayaUI.h('div', { className: 'type-callout text-tertiary', style: 'margin-bottom:var(--s-4)' },
    'Kaya already searches the web with its built-in free search — nothing to set up. A Brave API key is an optional upgrade for pro results: get one at brave.com/search/api, then paste it here. Stored securely on this device only.'));
  const f = KayaUI.h('div', { className: 'field' });
  f.appendChild(KayaUI.h('label', {}, configured ? 'New API key (leave blank to keep current)' : 'Brave API key'));
  const inp = KayaUI.h('input', { className: 'kaya-input', type: 'password', placeholder: configured ? '••• current key saved •••' : 'BSA… key from brave.com', autocomplete: 'off' });
  f.appendChild(inp); body.appendChild(f);
  KayaUI.modal(configured ? 'Edit Brave key' : 'Add Brave key', body, [
    KayaUI.h('button', { className: 'kaya-btn kaya-btn-kaya', onClick: (e) => e.target.closest('.kaya-modal-backdrop').remove() }, 'Cancel'),
    KayaUI.h('button', { className: 'kaya-btn kaya-btn-primary', onClick: async (e) => {
      const key = inp.value.trim();
      if (!key) { e.target.closest('.kaya-modal-backdrop').remove(); return; }
      try {
        await KayaAPI.post('/api/admin/tools/save', { web: { brave: { enabled: true, api_key: key, max_results: 5 } } });
        e.target.closest('.kaya-modal-backdrop').remove();
        KayaUI.toast('Brave Search connected');
        loadIntegrations(document.getElementById('view'));
      } catch (err) { KayaUI.toast(saveError(err), 'err'); }
    } }, 'Save'),
  ]);
  if (configured) {
    body.appendChild(KayaUI.h('button', { className: 'kaya-btn kaya-btn-kaya', onClick: async (e) => {
      if (!(await KayaUI.confirmModal('Turn off Brave?', 'Kaya keeps the built-in free search working — nothing breaks.', 'Turn off'))) return;
      try {
        await KayaAPI.post('/api/admin/tools/save', { web: { brave: { enabled: false } } });
        e.target.closest('.kaya-modal-backdrop').remove();
        KayaUI.toast('Back to built-in search');
        loadIntegrations(document.getElementById('view'));
      } catch (err) { KayaUI.toast(saveError(err), 'err'); }
    } }, 'Turn off Brave'));
  }
}

// manageWebLogins lists saved website sign-ins and lets the owner add or
// revoke one. Secrets are posted once and never rendered back.
function manageWebLogins(logins) {
  const body = KayaUI.h('div');
  body.appendChild(KayaUI.h('div', { className: 'type-callout text-tertiary', style: 'margin-bottom:var(--s-4)' },
    'Kaya can sign in to a site for you. The password is stored encrypted on this device and is never shown in chat.'));

  const list = KayaUI.h('div', { className: 'kaya-list' });
  if (!logins.length) {
    list.appendChild(KayaUI.h('div', { className: 'type-foot text-tertiary' }, 'Nothing saved yet.'));
  } else {
    logins.forEach(l => {
      const row = KayaUI.h('div', { className: 'kaya-row' });
      const c = KayaUI.h('div', { className: 'kaya-row-content' });
      c.appendChild(KayaUI.h('div', { className: 'kaya-row-title' }, l.host));
      c.appendChild(KayaUI.h('div', { className: 'kaya-row-subtitle' }, l.username ? l.username : 'saved'));
      row.appendChild(c);
      const tr = KayaUI.h('div', { className: 'kaya-row-trailing' });
      tr.appendChild(KayaUI.h('button', { className: 'kaya-btn kaya-btn-kaya', onClick: async (e) => {
        try {
          await KayaAPI.proxyDel('/v1/website-logins?host=' + encodeURIComponent(l.host));
          e.target.closest('.kaya-modal-backdrop').remove();
          KayaUI.toast('Removed');
          loadIntegrations(document.getElementById('view'));
        } catch (err) { KayaUI.toast('Couldn\u2019t remove that.', 'err'); }
      } }, 'Remove'));
      row.appendChild(tr);
      list.appendChild(row);
    });
  }
  body.appendChild(list);

  const mk = (label, ph, pw) => {
    const f = KayaUI.h('div', { className: 'field' });
    f.appendChild(KayaUI.h('label', {}, label));
    const i = KayaUI.h('input', { className: 'kaya-input', placeholder: ph, autocomplete: 'off' });
    if (pw) i.type = 'password';
    f.appendChild(i); body.appendChild(f); return i;
  };
  body.appendChild(KayaUI.h('div', { className: 'self-group', style: 'margin-top:var(--s-4)' }, 'Add or update a website'));
  body.appendChild(KayaUI.h('div', { className: 'type-foot text-tertiary', style: 'margin-bottom:var(--s-2)' },
    'Saving a site that is already here replaces its login, so there is never a duplicate. The address can be the site\u2019s front page; Kaya finds the sign-in form.'));
  const urlInp = mk('Site address', 'https://example.com', false);
  const userInp = mk('Username', 'you@example.com', false);
  const passInp = mk('Password', 'stored encrypted, never shown', true);

  KayaUI.modal('Website logins', body, [
    KayaUI.h('button', { className: 'kaya-btn kaya-btn-kaya', onClick: async () => {
      if (!(await KayaUI.confirmModal('Sign out of all sites?', 'Kaya will forget every saved browser session and cookie. You will need to sign in again.', 'Sign out'))) return;
      try { await KayaAPI.proxyPost('/v1/browser/signout', {}); KayaUI.toast('Signed out of all sites'); }
      catch (err) { KayaUI.toast('Couldn\u2019t sign out.', 'err'); }
    } }, 'Sign out of all sites'),
    KayaUI.h('button', { className: 'kaya-btn kaya-btn-kaya', onClick: (e) => e.target.closest('.kaya-modal-backdrop').remove() }, 'Close'),
    KayaUI.h('button', { className: 'kaya-btn kaya-btn-primary', onClick: async (e) => {
      const url = urlInp.value.trim(), username = userInp.value.trim(), password = passInp.value;
      if (!url || !username || !password) { KayaUI.toast('URL, username, and password are required.'); return; }
      if (!/^https?:\/\//i.test(url)) { KayaUI.toast('URL must start with http:// or https://', 'err'); return; }
      try {
        await KayaAPI.proxyPost('/v1/website-logins', { url, username, password });
        e.target.closest('.kaya-modal-backdrop').remove();
        KayaUI.toast('Login saved');
        loadIntegrations(document.getElementById('view'));
      } catch (err) { KayaUI.toast(saveError(err), 'err'); }
    } }, 'Save login'),
  ]);
}

// manageToolServers lists the tool servers (MCP) Kaya is connected to and adds
// or removes one. The key is sent once, sealed on the Pod, and never returned.
function manageToolServers(servers) {
  const body = KayaUI.h('div');
  body.appendChild(KayaUI.h('div', { className: 'type-callout text-tertiary', style: 'margin-bottom:var(--s-4)' },
    'A tool server gives Kaya extra abilities, such as reading your Notion pages or searching a database. Paste its address and, if it needs one, its key. Kaya tests the connection before saving, and asks you before it uses any of these tools.'));

  const list = KayaUI.h('div', { className: 'kaya-list calm-list' });
  if (!servers.length) {
    list.appendChild(KayaUI.h('div', { className: 'type-foot text-tertiary' }, 'None added yet.'));
  } else {
    servers.forEach(t => {
      const row = KayaUI.h('div', { className: 'kaya-row' });
      const c = KayaUI.h('div', { className: 'kaya-row-content' });
      c.appendChild(KayaUI.h('div', { className: 'kaya-row-title' }, t.name));
      const sub = t.kind === 'web' ? t.url : 'Runs a command on this Pod';
      const state = t.status === 'connected' ? t.tools + (t.tools === 1 ? ' tool' : ' tools') : (t.error || 'Not connected');
      c.appendChild(KayaUI.h('div', { className: 'kaya-row-subtitle' }, sub + ' \u00b7 ' + state));
      row.appendChild(c);
      const tr = KayaUI.h('div', { className: 'kaya-row-trailing' });
      tr.appendChild(KayaUI.h('button', { className: 'kaya-btn kaya-btn-kaya', onClick: async (e) => {
        if (!(await KayaUI.confirmModal('Remove ' + t.name + '?', 'Kaya will stop using its tools. Its saved key is deleted from this Pod.', 'Remove'))) return;
        try {
          await KayaAPI.proxyDel('/v1/tool-servers?name=' + encodeURIComponent(t.name));
          e.target.closest('.kaya-modal-backdrop').remove();
          KayaUI.toast('Removed');
          loadIntegrations(document.getElementById('view'));
        } catch (err) { KayaUI.toast(saveError(err), 'err'); }
      } }, 'Remove'));
      row.appendChild(tr);
      list.appendChild(row);
    });
  }
  body.appendChild(list);

  const mk = (label, ph, pw) => {
    const f = KayaUI.h('div', { className: 'field' });
    f.appendChild(KayaUI.h('label', {}, label));
    const i = KayaUI.h('input', { className: 'kaya-input', placeholder: ph, autocomplete: 'off' });
    if (pw) i.type = 'password';
    f.appendChild(i); body.appendChild(f); return i;
  };
  body.appendChild(KayaUI.h('div', { className: 'self-group', style: 'margin-top:var(--s-4)' }, 'Add a tool server'));
  const nameInp = mk('Name', 'notion', false);
  const urlInp = mk('Address', 'https://mcp.example.com/mcp', false);
  const keyInp = mk('Key (if it needs one)', 'stored encrypted, never shown', true);
  const msg = KayaUI.h('div', { className: 'type-foot', style: 'min-height:18px;margin-top:var(--s-2);color:var(--bad)' });
  body.appendChild(msg);

  KayaUI.modal('Tool servers', body, [
    KayaUI.h('button', { className: 'kaya-btn kaya-btn-kaya', onClick: (e) => e.target.closest('.kaya-modal-backdrop').remove() }, 'Close'),
    KayaUI.h('button', { className: 'kaya-btn kaya-btn-primary', onClick: async (e) => {
      const btn = e.target;
      msg.textContent = '';
      const name = nameInp.value.trim(), url = urlInp.value.trim(), api_key = keyInp.value.trim();
      if (!name || !url) { msg.textContent = 'A name and an address are required.'; return; }
      btn.disabled = true; btn.textContent = 'Connecting\u2026';
      try {
        const r = await KayaAPI.proxyPost('/v1/tool-servers', { name, url, api_key });
        btn.closest('.kaya-modal-backdrop').remove();
        KayaUI.toast('Connected: ' + ((r && r.tools) || 0) + ' tools from ' + name);
        loadIntegrations(document.getElementById('view'));
      } catch (err) {
        msg.textContent = saveError(err);
        btn.disabled = false; btn.textContent = 'Connect';
      }
    } }, 'Connect'),
  ]);
}

KayaApp.registerSection('apps', loadIntegrations);
