/* Kaya Section: Intelligence — default model, providers, routing, health. */
'use strict';

async function loadAI(container) {
  if (KayaApp.currentSection() !== 'intelligence') return;
  container.innerHTML = '';
  const head = KayaUI.h('div', { className: 'page-head' });
  head.appendChild(KayaUI.h('h1', {}, 'Intelligence'));
  head.appendChild(KayaUI.h('p', {}, 'Which AI Kaya runs on, and whether it is healthy.'));
  container.appendChild(head);

  const [providerModelsRes, cfgRes, ollamaRes, modelRes] = await Promise.allSettled([
    KayaAPI.get('/api/admin/providers/models'),
    KayaAPI.get('/api/admin/config'),
    KayaAPI.get('/api/ollama/models'),
    KayaAPI.proxyGet('/v1/model'),
  ]);

  const pm = providerModelsRes.status === 'fulfilled' ? providerModelsRes.value : null;
  const cfg = cfgRes.status === 'fulfilled' ? cfgRes.value : null;
  // Embedding models (embeddinggemma and the like) cannot hold a conversation:
  // listing one with a "Use" button invites picking a model that cannot answer.
  const ollamaModels = (ollamaRes.status === 'fulfilled' ? (ollamaRes.value.models || []) : []).filter(m => !/embed/i.test(m));
  const activeModel = modelRes.status === 'fulfilled' ? modelRes.value : null;

  const currentProvider = (pm && pm.provider) || (cfg && cfg.provider) || '';
  const currentModel = (pm && pm.model) || (cfg && cfg.model) || '';
  const providerModels = (pm && pm.providers) || {};

  // ── Default model ──
  const defPanel = KayaUI.h('div', { className: 'panel' });
  renderDefaultModel(defPanel, currentProvider, currentModel, providerModels, ollamaModels, cfg);
  container.appendChild(defPanel);

  // ── Providers ──
  const provPanel = KayaUI.h('div', { className: 'panel' });
  renderProviders(provPanel, cfg, providerModels, ollamaModels, currentProvider, currentModel);
  container.appendChild(provPanel);

  // ── Routing ──
  const routingPanel = KayaUI.h('div', { className: 'panel' });
  const routingCfg = cfg ? (cfg.routing || {}) : {};
  renderRouting(routingPanel, routingCfg);
  container.appendChild(routingPanel);

  // ── Local models ──
  if (ollamaModels.length > 0) {
    const localPanel = KayaUI.h('div', { className: 'panel' });
    renderLocal(localPanel, ollamaModels, activeModel ? activeModel.active : '');
    container.appendChild(localPanel);
  }

  // ── AI Health ──
  const diagPanel = KayaUI.h('div', { className: 'panel' });
  renderDiag(diagPanel);
  container.appendChild(diagPanel);
}

// ── Default model panel ──

function renderDefaultModel(panel, currentProvider, currentModel, providerModels, ollamaModels, cfgForDefault) {
  const h = KayaUI.h('div', { className: 'panel-head' });
  const text = KayaUI.h('div');
  text.appendChild(KayaUI.h('h2', {}, 'Default model'));
  text.appendChild(KayaUI.h('p', {}, 'The model Kaya normally uses for conversations and everyday tasks.'));
  h.appendChild(text);
  panel.appendChild(h);

  if (currentProvider && currentModel) {
    const f = KayaUI.modelFriendly(currentProvider + ':' + currentModel);
    const row = KayaUI.h('div', { className: 'kaya-row' });
    const c = KayaUI.h('div', { className: 'kaya-row-content' });
    c.appendChild(KayaUI.h('div', { className: 'kaya-row-title', style: 'font-size:var(--t-body);font-weight:600' }, f.name));
    const sub = KayaUI.h('div', { className: 'kaya-row-subtitle' });
    sub.appendChild(document.createTextNode(f.provName + (f.provName ? ' \u00b7 ' : '') + f.model));
    if (f.provider === 'ollama' || f.provider === 'vllm') {
      sub.appendChild(document.createTextNode(' \u00b7 Local'));
    }
    c.appendChild(sub);
    row.appendChild(c);
    const tr = KayaUI.h('div', { className: 'kaya-row-trailing' });
    // Models live in their provider's Configure sheet; this opens the one
    // the default model comes from.
    tr.appendChild(KayaUI.h('button', { className: 'kaya-btn kaya-btn-secondary', onClick: () => {
      const local = currentProvider === 'ollama' || currentProvider === 'vllm';
      const name = currentProvider.charAt(0).toUpperCase() + currentProvider.slice(1);
      configureProviderModal(currentProvider, name, local, cfgForDefault, { providerModels, ollamaModels, activeProvider: currentProvider, activeModel: currentModel });
    } }, 'Change'));
    row.appendChild(tr);
    panel.appendChild(row);
  } else {
    panel.appendChild(KayaUI.emptyState('No model selected', 'Pick a model below so Kaya knows how to think.'));
  }
}

// ── Providers panel ──

function renderProviders(panel, cfg, providerModels, ollamaModels, activeProvider, activeModel) {
  const ctx = { providerModels, ollamaModels, activeProvider, activeModel };
  const h = KayaUI.h('div', { className: 'panel-head' });
  const text = KayaUI.h('div');
  text.appendChild(KayaUI.h('h2', {}, 'Providers'));
  text.appendChild(KayaUI.h('p', {}, 'The AI services Kaya can think with. It only uses what you connect.'));
  h.appendChild(text);
  panel.appendChild(h);

  const all = ['ollama', 'openai', 'anthropic', 'moonshot', 'groq', 'deepseek', 'qwen', 'gemini', 'zhipu', 'openrouter', 'nvidia'];
  const currentProvider = cfg ? (cfg.provider || '') : '';
  const labelOf = k => ({ openai: 'OpenAI', deepseek: 'DeepSeek', openrouter: 'OpenRouter', nvidia: 'NVIDIA', zhipu: 'Zhipu' }[k] || (k.charAt(0).toUpperCase() + k.slice(1)));
  const isLocal = k => k === 'ollama' || k === 'vllm';
  const connected = all.filter(k => { const pm = providerModels[k]; return isLocal(k) ? ollamaModels.length > 0 : !!(pm && pm.configured); })
    .sort((a, b) => (a === currentProvider ? -1 : 0) - (b === currentProvider ? -1 : 0));
  const available = all.filter(k => !connected.includes(k));

  if (connected.length === 0) {
    panel.appendChild(KayaUI.emptyState('No provider connected', 'Connect one below so Kaya has something to think with.'));
  }
  for (const key of connected) {
    const pm = providerModels[key];
    const modelCount = isLocal(key) ? ollamaModels.length : (pm && pm.models ? pm.models.length : 0);
    const row = KayaUI.h('div', { className: 'kaya-row' });
    const c = KayaUI.h('div', { className: 'kaya-row-content' });
    const title = KayaUI.h('div', { className: 'kaya-row-title' }, labelOf(key));
    if (key === currentProvider) title.appendChild(KayaUI.h('span', { className: 'state-chip state-chip-ok', style: 'margin-left:var(--s-2)' }, 'Default'));
    c.appendChild(title);
    const sub = modelCount > 0 ? modelCount + ' model' + (modelCount !== 1 ? 's' : '') + (isLocal(key) ? ' on your Pod' : '') : 'Connected';
    c.appendChild(KayaUI.h('div', { className: 'kaya-row-subtitle' }, sub + (pm && pm.source === 'catalog' && !isLocal(key) ? ' · built-in list (couldn’t reach the provider)' : '')));
    row.appendChild(c);
    const tr = KayaUI.h('div', { className: 'kaya-row-trailing' });
    tr.appendChild(KayaUI.h('button', { className: 'kaya-btn kaya-btn-secondary kaya-btn-sm', onClick: () => configureProviderModal(key, labelOf(key), isLocal(key), cfg, ctx) }, 'Configure'));
    row.appendChild(tr);
    panel.appendChild(row);
  }

  if (available.length > 0) {
    panel.appendChild(KayaUI.h('div', { className: 'provider-add-label' }, connected.length ? 'Add another' : 'Add a provider'));
    const chips = KayaUI.h('div', { className: 'provider-add' });
    for (const key of available) {
      chips.appendChild(KayaUI.h('button', {
        className: 'provider-chip',
        onClick: () => configureProviderModal(key, labelOf(key), isLocal(key), cfg, ctx),
      }, '+ ' + labelOf(key)));
    }
    panel.appendChild(chips);
  }
}

function configureProviderModal(key, name, isLocal, cfg, ctx) {
  const body = KayaUI.h('div');
  let keyInput = null;
  let urlInput = null;

  if (isLocal && key === 'ollama') {
    // Ollama setup
    body.appendChild(KayaUI.h('div', { className: 'type-foot text-tertiary', style: 'margin-bottom:var(--s-3)' }, 'Ollama runs on your device. No API key needed.'));
    const urlField = KayaUI.h('div', { className: 'field' });
    urlField.appendChild(KayaUI.h('label', {}, 'Host URL'));
    urlInput = KayaUI.h('input', { className: 'kaya-input', type: 'text', value: (cfg && cfg.providers && cfg.providers.ollama && cfg.providers.ollama.api_base) || 'http://localhost:11434' });
    urlField.appendChild(urlInput);
    body.appendChild(urlField);
  } else {
    // Cloud provider setup
    const currentKey = cfg && cfg.providers && cfg.providers[key] && cfg.providers[key].api_key || '';
    const keyField = KayaUI.h('div', { className: 'field' });
    keyField.appendChild(KayaUI.h('label', {}, 'API key'));
    keyInput = KayaUI.h('input', { className: 'kaya-input secret-field', type: 'password', placeholder: currentKey ? 'Leave empty to keep current key' : 'Paste your API key' });
    keyField.appendChild(keyInput);
    body.appendChild(keyField);
    if (currentKey) {
      body.appendChild(KayaUI.h('div', { className: 'type-foot text-tertiary' }, 'A key is saved. Leave the field empty to keep it. Test connection uses the saved key.'));
    } else {
      body.appendChild(KayaUI.h('div', { className: 'type-foot text-tertiary' }, 'Stored securely in your Kaya\u2019s secrets file. Never shown back in full.'));
    }
  }

  // Test connection button
  const testRow = KayaUI.h('div', { style: 'margin-top:var(--s-3);display:flex;gap:var(--s-2);align-items:center' });
  const testBtn = KayaUI.h('button', { className: 'kaya-btn kaya-btn-secondary' }, 'Test connection');
  const testResult = KayaUI.h('span', { style: 'font-size:var(--t-caption)' });
  testBtn.addEventListener('click', async () => {
    testBtn.disabled = true;
    testBtn.textContent = 'Testing\u2026';
    testResult.textContent = '';
    testResult.className = '';
    try {
      const payload = { provider: key };
      const val = keyInput ? keyInput.value.trim() : '';
      if (val) payload.api_key = val;
      const res = await KayaAPI.post('/api/admin/providers/test', payload);
      if (res.ok) {
        testResult.textContent = '\u2713 ' + (res.message || 'Connected');
        testResult.style.color = 'var(--ok)';
      } else {
        testResult.textContent = '\u2717 ' + (res.message || 'Failed');
        testResult.style.color = 'var(--bad)';
      }
    } catch (e) {
      const msg = e.message || 'Unknown error';
      testResult.textContent = '\u2717 ' + (msg.includes('Session expired') ? 'Session expired \u2014 please log in again' : msg.length > 80 ? msg.substring(0, 80) + '\u2026' : msg);
      testResult.style.color = 'var(--bad)';
    }
    testBtn.disabled = false;
    testBtn.textContent = 'Test connection';
  });
  testRow.appendChild(testBtn);
  testRow.appendChild(testResult);
  body.appendChild(testRow);

  // The provider's models, in the same sheet: ask it what it serves and let
  // the owner pick one to think with.
  const info = (ctx && ctx.providerModels && ctx.providerModels[key]) || null;
  let models = isLocal ? ((ctx && ctx.ollamaModels) || []) : ((info && info.models) || []);
  const connected = isLocal ? models.length > 0 : !!(info && info.configured);
  if (connected) {
    const head = KayaUI.h('div', { style: 'display:flex;align-items:center;justify-content:space-between;margin-top:var(--s-5)' });
    head.appendChild(KayaUI.h('div', { className: 'kaya-row-title' }, 'Models'));
    const refresh = KayaUI.h('button', { className: 'kaya-btn kaya-btn-kaya kaya-btn-sm' }, 'Refresh');
    head.appendChild(refresh);
    body.appendChild(head);
    const note = KayaUI.h('div', { className: 'type-foot text-tertiary', style: 'margin-bottom:var(--s-2)' });
    body.appendChild(note);
    const search = KayaUI.h('input', { className: 'kaya-input', type: 'search', placeholder: 'Search models', 'aria-label': 'Search models', style: models.length > 8 ? '' : 'display:none' });
    body.appendChild(search);
    const list = KayaUI.h('div', { style: 'max-height:40vh;overflow-y:auto;margin-top:var(--s-2)' });
    body.appendChild(list);
    let query = '';
    const describe = (i) => {
      if (isLocal) return 'Installed on your Pod.';
      if (i && i.source === 'catalog') return 'Built-in list \u2014 couldn\u2019t reach ' + name + (i.error ? ' (' + i.error + ')' : '') + '.';
      return 'Live from ' + name + '.';
    };
    const draw = (i) => {
      note.textContent = describe(i);
      list.innerHTML = '';
      const q = query.trim().toLowerCase();
      const shown = (q ? models.filter((m) => m.toLowerCase().includes(q)) : models).slice(0, 80);
      if (shown.length === 0) list.appendChild(KayaUI.emptyState(q ? 'No matches' : 'No models listed', q ? 'Try a different search.' : name + ' did not list any models.'));
      for (const m of shown) {
        const val = key + ':' + m;
        const active = ctx && ctx.activeProvider === key && ctx.activeModel === m;
        const row = KayaUI.h('div', { className: 'kaya-row', style: 'padding:var(--s-2) var(--s-3)' });
        const c = KayaUI.h('div', { style: 'min-width:0;flex:1' });
        c.appendChild(KayaUI.h('div', { className: 'kaya-row-title', style: 'font-size:var(--t-body);overflow-wrap:anywhere' }, KayaUI.modelFriendly(val).model));
        row.appendChild(c);
        if (active) {
          row.appendChild(KayaUI.h('span', { className: 'state-chip state-chip-ok' }, 'Active'));
        } else {
          row.appendChild(KayaUI.h('button', { className: 'kaya-btn kaya-btn-secondary kaya-btn-sm', onClick: async (e) => {
            e.target.disabled = true;
            try {
              await KayaAPI.proxyPost('/v1/model', { model: val });
              e.target.closest('.kaya-modal-backdrop').remove();
              KayaUI.toast('Now using ' + m);
              loadAI(document.getElementById('view'));
            } catch (err) { KayaUI.toast('Couldn\u2019t switch model.', 'err'); e.target.disabled = false; }
          } }, 'Use'));
        }
        list.appendChild(row);
      }
    };
    search.addEventListener('input', () => { query = search.value; draw(info); });
    refresh.addEventListener('click', async () => {
      refresh.disabled = true; refresh.textContent = 'Asking\u2026';
      try {
        const res = await KayaAPI.get('/api/admin/providers/models?refresh=1');
        const fresh = res && res.providers && res.providers[key];
        if (fresh && !isLocal) { models = fresh.models || []; draw(fresh); } else draw(info);
      } catch (err) { KayaUI.toast('Couldn\u2019t refresh the list.', 'err'); }
      refresh.disabled = false; refresh.textContent = 'Refresh';
    });
    draw(info);
  }

  KayaUI.modal('Configure ' + name, body, [
    KayaUI.h('button', { className: 'kaya-btn kaya-btn-kaya', onClick: (e) => e.target.closest('.kaya-modal-backdrop').remove() }, 'Cancel'),
    KayaUI.h('button', { className: 'kaya-btn kaya-btn-primary', onClick: async (e) => {
      const val = keyInput ? keyInput.value.trim() : '';
      const payload = { api_keys: { [key]: val || undefined } };
      if (isLocal && key === 'ollama') {
        payload.ollama_url = urlInput.value.trim();
      }
      e.target.disabled = true;
      try {
        await KayaAPI.post('/api/admin/config/save', payload);
        e.target.closest('.kaya-modal-backdrop').remove();
        KayaUI.toast(name + ' saved');
        loadAI(document.getElementById('view'));
      } catch (err) { KayaUI.toast('Couldn\u2019t save.', 'err'); e.target.disabled = false; }
    } }, 'Save'),
  ]);
}

// ── Routing panel ──

function renderRouting(panel, routing) {
  const h = KayaUI.h('div', { className: 'panel-head' });
  const text = KayaUI.h('div');
  text.appendChild(KayaUI.h('h2', {}, 'Routing'));
  text.appendChild(KayaUI.h('p', {}, 'Kaya automatically chooses the best model when a task requires something different.'));
  h.appendChild(text);
  panel.appendChild(h);

  const prefs = [
    { key: 'prefer_local', label: 'Prefer local AI', desc: 'Always try the local model first, even for complex tasks.' },
    { key: 'allow_cloud', label: 'Allow cloud AI', desc: 'Let Kaya use cloud providers when you have one configured.' },
    { key: 'cloud_when_local_fails', label: 'Fall back to cloud', desc: 'If the local model fails or is unavailable, try cloud instead.' },
  ];
  for (const p of prefs) {
    const row = KayaUI.h('div', { className: 'kaya-row' });
    const c = KayaUI.h('div', { className: 'kaya-row-content' });
    c.appendChild(KayaUI.h('div', { className: 'kaya-row-title' }, p.label));
    c.appendChild(KayaUI.h('div', { className: 'kaya-row-subtitle' }, p.desc));
    row.appendChild(c);
    const tr = KayaUI.h('div', { className: 'kaya-row-trailing' });
    const sw = KayaUI.toggle(routing[p.key] || false, async (on) => {
      const next = { ...routing, [p.key]: on };
      try {
        await KayaAPI.post('/api/admin/config/save', { routing: next });
        Object.assign(routing, next);
        KayaUI.toast(p.label + (on ? ' on' : ' off'));
      } catch (err) {
        sw.classList.toggle('on', !on);
        KayaUI.toast('Couldn\u2019t save', 'err');
      }
    });
    tr.appendChild(sw);
    row.appendChild(tr);
    panel.appendChild(row);
  }
}

// ── Local models panel ──

function renderLocal(panel, models, active) {
  const h = KayaUI.h('div', { className: 'panel-head' });
  const text = KayaUI.h('div');
  text.appendChild(KayaUI.h('h2', {}, 'Local models'));
  text.appendChild(KayaUI.h('p', {}, 'Installed on your device via Ollama.'));
  h.appendChild(text);
  panel.appendChild(h);

  for (const m of models) {
    const f = KayaUI.modelFriendly('ollama:' + m);
    const row = KayaUI.h('div', { className: 'kaya-row' });
    const c = KayaUI.h('div', { className: 'kaya-row-content' });
    c.appendChild(KayaUI.h('div', { className: 'kaya-row-title' }, f.name));
    c.appendChild(KayaUI.h('div', { className: 'kaya-row-subtitle', 'aria-hidden': 'true' }, m));
    row.appendChild(c);
    const tr = KayaUI.h('div', { className: 'kaya-row-trailing' });
    if (m === active) {
      tr.appendChild(KayaUI.h('span', { className: 'status-pill' }, KayaUI.statusDot('ready'), 'Active'));
    } else {
      tr.appendChild(KayaUI.h('button', { className: 'kaya-btn kaya-btn-secondary', onClick: async () => {
        try { await KayaAPI.proxyPost('/v1/model', { model: 'ollama:' + m }); KayaUI.toast('Default model updated'); loadAI(document.getElementById('view')); }
        catch (e) { KayaUI.toast('Couldn\u2019t set model.', 'err'); }
      } }, 'Use'));
    }
    row.appendChild(tr);
    panel.appendChild(row);
  }

  // Install row
  const install = KayaUI.h('div', { className: 'row-flex', style: 'margin-top:var(--s-3)' });
  const input = KayaUI.input('Model name (e.g. qwen3:8b)');
  const btn = KayaUI.h('button', { className: 'kaya-btn kaya-btn-secondary' }, 'Install');
  btn.addEventListener('click', async () => {
    const name = input.value.trim();
    if (!name) return;
    btn.disabled = true; input.disabled = true;
    try { await KayaAPI.post('/api/ollama/pull', { model: name }); KayaUI.toast('Download started \u2014 this can take a while'); }
    catch (e) { KayaUI.toast('Couldn\u2019t start download.', 'err'); btn.disabled = false; input.disabled = false; }
  });
  install.appendChild(input); install.appendChild(btn);
  panel.appendChild(install);
}

// ── AI Health panel ──

function renderDiag(panel) {
  const h = KayaUI.h('div', { className: 'panel-head' });
  const text = KayaUI.h('div');
  text.appendChild(KayaUI.h('h2', {}, 'AI health'));
  text.appendChild(KayaUI.h('p', {}, 'Quick check that your local and cloud AI are reachable.'));
  h.appendChild(text);
  const btn = KayaUI.h('button', { className: 'kaya-btn kaya-btn-secondary' }, 'Run check');
  h.appendChild(btn);
  panel.appendChild(h);
  const body = KayaUI.h('div', { style: 'margin-top:var(--s-3)' });
  body.appendChild(KayaUI.emptyState('Not run yet', 'Run a check to see how your AI providers are doing.'));
  panel.appendChild(body);

  btn.addEventListener('click', async () => {
    btn.disabled = true; btn.textContent = 'Checking\u2026';
    body.innerHTML = '';
    body.appendChild(KayaUI.loading('Running AI health check\u2026'));
    let res;
    try { res = await KayaAPI.proxyGet('/v1/doctor'); }
    catch (e) {
      body.innerHTML = '';
      body.appendChild(KayaUI.errorState('Diagnostics unavailable', 'The gateway may be starting.'));
      btn.disabled = false; btn.textContent = 'Run check';
      return;
    }
    body.innerHTML = '';
    const checks = (res.checks || []).filter(c => c.name === 'provider' || c.name === 'database' || c.name === 'gateway');
    if (checks.length === 0) {
      body.appendChild(KayaUI.emptyState('Nothing to report', 'No AI checks returned.'));
      btn.disabled = false; btn.textContent = 'Run check';
      return;
    }
    const grid = KayaUI.h('div', { className: 'diag-grid' });
    for (const ch of checks) {
      const row = KayaUI.h('div', { className: 'diag-row' });
      const st = ch.status === 'ok' ? 'ready' : ch.status === 'info' ? 'neutral' : ch.status === 'warn' ? 'warn' : 'bad';
      row.appendChild(KayaUI.h('span', { className: 'status-dot ' + st }));
      row.appendChild(KayaUI.h('div', { className: 'diag-name' }, ch.label || ch.name));
      const msg = KayaUI.h('div', { className: 'diag-msg' });
      msg.textContent = ch.message || '';
      row.appendChild(msg);
      grid.appendChild(row);
    }
    body.appendChild(grid);
    btn.disabled = false; btn.textContent = 'Run check';
  });
}

KayaApp.registerSection('intelligence', loadAI);
