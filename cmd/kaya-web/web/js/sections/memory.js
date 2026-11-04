/* Kaya Section: Memory \u2014 what Kaya remembers about you. */
'use strict';

async function loadMemory(container) {
  container.innerHTML = '';
  const head = KayaUI.h('div', { className: 'page-head' });
  head.appendChild(KayaUI.h('h1', {}, 'Memory'));
  const sub = KayaUI.h('p', {}, 'Facts Kaya has learned about you, plus a search over past conversations.');
  head.appendChild(sub);
  container.appendChild(head);

  const [selfRes] = await Promise.allSettled([
    KayaAPI.proxyGet('/v1/memory/self'),
  ]);
  if (!document.body.contains(container)) return;

  renderRecall(container);

  const self = selfRes.status === 'fulfilled' ? (selfRes.value || {}) : {};
  const rawFacts = Array.isArray(self.entries) ? self.entries : [];
  // Present the canonical memory collection — duplicate extractions that
  // represent the same fact collapse into one visible memory.
  const facts = KayaSemantic.canonicalizeEntries(rawFacts);
  // Show only the model's own curated notes here. The user-profile lines
  // (self.you) are derived from the same structured facts already shown in the
  // profile hero, so including them would just duplicate the facts above.
  const curated = (Array.isArray(self.notes) ? self.notes : []);

  // One calm empty state when there's nothing at all.
  if (facts.length === 0 && curated.length === 0) {
    container.appendChild(KayaUI.emptyState('Kaya is still getting to know you', 'Talk to Kaya and it will remember the things that matter about you here.'));
    return;
  }

  if (facts.length || curated.length) {
    try { renderFacts(container, facts, curated); }
    catch (e) {
      console.error('renderFacts failed', e);
      container.appendChild(KayaUI.errorState('Couldn\u2019t show these memories', String(e && e.message || e)));
    }
  }
}

// renderFacts presents the structured state Kaya learns from conversation as a
// calm profile hero — grouped by kind, value-first, with provenance and quiet
// reinforcement, plus any curated notes.
function renderFacts(container, facts, curated) {
  const panel = KayaUI.h('div', { className: 'panel' });
  const ph = KayaUI.h('div', { className: 'panel-head' });
  const t = KayaUI.h('div');
  t.appendChild(KayaUI.h('h2', {}, 'What Kaya knows about you'));
  t.appendChild(KayaUI.h('p', {}, 'Learned from your conversations. Forget anything below and it won\u2019t be used anymore.'));
  ph.appendChild(t);
  panel.appendChild(ph);
  const body = KayaUI.h('div', { className: 'self-body' });
  panel.appendChild(body);
  container.appendChild(panel);

  const forgetBtn = async (payload) => {
    try {
      if (payload && payload.id) payload = Object.assign({ reason: 'forgotten from the Memory screen' }, payload);
      await KayaAPI.proxyPost('/v1/memory/self/forget', payload);
      KayaUI.toast('Forgotten');
      loadMemory(container);
    } catch (e) { KayaUI.toast('Couldn\u2019t forget that.', 'err'); }
  };

  // Grouped by what a memory *is*, in the order a person thinks of their own
  // life: who they are, the people around them, what is coming up, what they
  // have and can do, what they care about, what they are working toward.
  const KIND_ORDER = ['identity', 'person', 'relationship', 'event', 'health', 'possession', 'skill', 'preference', 'interest', 'opinion', 'routine', 'goal', 'project', 'decision', 'constraint', 'fact'];
  const KIND_LABEL = {
    identity: 'Identity', person: 'People in your life', relationship: 'People', event: 'Dates and events',
    health: 'Health (private)', possession: 'What you own', skill: 'What you can do',
    preference: 'Preferences', interest: 'Interests', opinion: 'Views', routine: 'Routines',
    goal: 'Goals', project: 'Projects', decision: 'Decisions', constraint: 'Rules you live by', fact: 'About you',
  };
  const kindOf = (k) => (KIND_LABEL[k] ? k : 'fact');
  const byKind = {};
  facts.forEach(e => {
    const k = kindOf(e.kind);
    (byKind[k] = byKind[k] || []).push(e);
  });

  function metaFor(e) {
    const parts = [];
    if (e.created_at) parts.push('Learned ' + KayaUI.timeAgo(Math.floor(new Date(e.created_at).getTime() / 1000)));
    if (e.reinforce_count > 1) parts.push('confirmed ' + e.reinforce_count + '\u00d7');
    return parts.join('  \u00b7  ');
  }

  // explainInto renders the receipt for one memory: the owner's own words,
  // how confident Kaya is, where it came from, and whether it was replaced
  // or forgotten. Plain language — this is the trust feature, not a debug view.
  async function explainInto(host, id) {
    host.innerHTML = '';
    host.appendChild(KayaUI.loading('Checking\u2026'));
    let res;
    try { res = await KayaAPI.proxyGet('/v1/memory/explain?id=' + encodeURIComponent(id)); }
    catch (err) {
      host.innerHTML = '';
      host.appendChild(KayaUI.h('div', { className: 'type-foot text-tertiary' }, 'Couldn\u2019t fetch the receipt right now.'));
      return;
    }
    const ex = (res && res.explanation) || {};
    host.innerHTML = '';
    if (ex.quote) {
      host.appendChild(KayaUI.h('div', { className: 'type-body', style: 'margin-bottom:var(--s-1)' }, 'You said: \u201c' + ex.quote + '\u201d'));
    } else {
      host.appendChild(KayaUI.h('div', { className: 'type-foot text-tertiary', style: 'margin-bottom:var(--s-1)' }, 'Saved before Kaya kept quotes, so there are no exact words on file.'));
    }
    const bits = [];
    if (typeof ex.confidence === 'number' && ex.confidence > 0) bits.push(Math.round(ex.confidence * 100) + '% confident');
    if (ex.entry && ex.entry.created_at) bits.push('learned ' + KayaUI.timeAgo(Math.floor(new Date(ex.entry.created_at).getTime() / 1000)));
    if (ex.message_ids && ex.message_ids.length) bits.push('from message ' + ex.message_ids.join(', '));
    if (bits.length) host.appendChild(KayaUI.h('div', { className: 'type-foot text-tertiary' }, bits.join('  \u00b7  ')));
    if (ex.superseded_by) host.appendChild(KayaUI.h('div', { className: 'type-foot text-tertiary' }, 'Replaced by a newer memory: ' + (ex.superseded_by.value || '')));
    if (ex.forgotten_at) host.appendChild(KayaUI.h('div', { className: 'type-foot text-tertiary' }, 'Forgotten' + (ex.forgotten_reason ? ' \u2014 ' + ex.forgotten_reason : '') + '.'));
  }

  function factRow(e) {
    const wrap = KayaUI.h('div', { className: 'self-entry-wrap' });
    const row = KayaUI.h('div', { className: 'kaya-row self-entry' });
    const c = KayaUI.h('div', { className: 'kaya-row-content' });
    const title = KayaSemantic.memoryTitleFor(e);
    c.appendChild(KayaUI.h('div', { className: 'kaya-row-title', style: 'font-weight:500' }, title));
    const sub = KayaUI.h('div', { className: 'kaya-row-subtitle' });
    const dom = KayaSemantic.inferDomainFromValue(e.kind, e.domain, e.value) || e.domain;
    const tag = KayaSemantic.domainTag(dom, e.kind);
    if (tag) sub.appendChild(KayaUI.h('span', { className: 'tag', style: 'text-transform:capitalize;font-size:0.75rem;padding:0.1em 0.4em;border-radius:var(--r-sm);background:var(--paper-sunken);color:var(--ink-muted);margin-right:var(--s-2)' }, tag));
    const meta = metaFor(e);
    if (e.about) sub.appendChild(document.createTextNode('About ' + e.about + '  \u00b7  '));
    if (meta) sub.appendChild(document.createTextNode(meta));
    if (e.valid_until) {
      const until = new Date(e.valid_until);
      if (!isNaN(until)) sub.appendChild(document.createTextNode('  \u00b7  until ' + until.toLocaleDateString([], { month: 'short', day: 'numeric' })));
    }
    if (e.sensitive) sub.appendChild(KayaUI.h('span', { className: 'tag', style: 'margin-left:var(--s-2);font-size:0.75rem;padding:0.1em 0.4em;border-radius:var(--r-sm);background:var(--warn-soft);color:var(--warn)' }, 'Private'));
    c.appendChild(sub);
    row.appendChild(c);
    const tr = KayaUI.h('div', { className: 'kaya-row-trailing' });
    const why = KayaUI.h('button', { className: 'kaya-btn kaya-btn-kaya', type: 'button' }, 'Why?');
    const detail = KayaUI.h('div', { className: 'receipt', style: 'display:none;padding:var(--s-2) var(--s-4) var(--s-3);background:var(--paper-sunken);border-radius:var(--r-sm);margin:0 0 var(--s-2)' });
    why.addEventListener('click', async () => {
      if (detail.style.display === 'none') {
        detail.style.display = 'block';
        why.textContent = 'Hide';
        await explainInto(detail, e.id);
      } else {
        detail.style.display = 'none';
        why.textContent = 'Why?';
      }
    });
    const btn = KayaUI.h('button', { className: 'kaya-btn kaya-btn-kaya', type: 'button' }, 'Forget');
    btn.addEventListener('click', () => forgetBtn({ id: e.id }));

    // Correct: change what Kaya believes without forgetting it. The old value
    // stays in its history; what is typed here becomes the receipt.
    const fix = KayaUI.h('button', { className: 'kaya-btn kaya-btn-kaya', type: 'button' }, 'Correct');
    const editor = KayaUI.h('div', { className: 'receipt memory-editor', style: 'display:none' });
    fix.addEventListener('click', () => {
      if (editor.style.display !== 'none') { editor.style.display = 'none'; return; }
      editor.innerHTML = '';
      editor.style.display = 'block';
      editor.appendChild(KayaUI.h('div', { className: 'type-foot text-tertiary', style: 'margin-bottom:var(--s-2)' },
        'What is true now? Kaya keeps the old version in its history.'));
      const input = KayaUI.h('input', { className: 'kaya-input', type: 'text', maxlength: '300', 'aria-label': 'Corrected memory' });
      input.value = e.value || '';
      const save = KayaUI.h('button', { className: 'kaya-btn kaya-btn-primary', type: 'button' }, 'Save');
      const cancel = KayaUI.h('button', { className: 'kaya-btn kaya-btn-secondary', type: 'button' }, 'Cancel');
      cancel.addEventListener('click', () => { editor.style.display = 'none'; });
      const submit = async () => {
        const value = input.value.trim();
        if (!value || value === (e.value || '').trim()) { KayaUI.toast('Type what is true now.'); return; }
        save.disabled = true;
        try {
          await KayaAPI.proxyPost('/v1/memory/self/correct', { id: e.id, value: value });
          KayaUI.toast('Updated');
          loadMemory(container);
        } catch (err) { save.disabled = false; KayaUI.toast('Couldn\u2019t save that. It may have changed already.', 'err'); }
      };
      save.addEventListener('click', submit);
      input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') submit(); if (ev.key === 'Escape') editor.style.display = 'none'; });
      const actions = KayaUI.h('div', { className: 'memory-editor-actions' }, save, cancel);
      editor.appendChild(input);
      editor.appendChild(actions);
      input.focus();
    });
    tr.appendChild(why);
    tr.appendChild(fix);
    tr.appendChild(btn);
    row.appendChild(tr);
    wrap.appendChild(row);
    wrap.appendChild(detail);
    wrap.appendChild(editor);
    return wrap;
  }

  KIND_ORDER.forEach(k => {
    const list = byKind[k];
    if (!list || !list.length) return;
    body.appendChild(KayaUI.h('div', { className: 'self-group' }, KIND_LABEL[k]));
    list.sort((a, b) => (b.reinforce_count || 0) - (a.reinforce_count || 0));
    list.forEach(e => body.appendChild(factRow(e)));
  });

  if (curated.length) {
    body.appendChild(KayaUI.h('div', { className: 'self-group' }, 'What Kaya has learned'));
    curated.forEach(entry => {
      const row = KayaUI.h('div', { className: 'kaya-row self-entry' });
      const c = KayaUI.h('div', { className: 'kaya-row-content' });
      c.appendChild(KayaUI.h('div', { className: 'kaya-row-title', style: 'font-weight:400' }, entry));
      row.appendChild(c);
      const tr = KayaUI.h('div', { className: 'kaya-row-trailing' });
      const btn = KayaUI.h('button', { className: 'kaya-btn kaya-btn-kaya', type: 'button' }, 'Forget');
      btn.addEventListener('click', () => forgetBtn({ target: 'memory', entry: entry }));
      tr.appendChild(btn);
      row.appendChild(tr);
      body.appendChild(row);
    });
  }
}

// recallMsg renders a single recall message. Recall strings are "role: content";
// we split off the role label and render the content as markdown so headings,
// bold, lists, and links read properly instead of as raw "#" / "**" characters.
function recallMsg(m) {
  const idx = m.indexOf(': ');
  const role = idx > 0 ? m.slice(0, idx) : '';
  const content = idx > 0 ? m.slice(idx + 2) : m;
  const el = KayaUI.h('div', { className: 'recall-msg' });
  if (role) el.appendChild(KayaUI.h('div', { className: 'recall-msg-role' }, role));
  const md = KayaUI.h('div', { className: 'markdown-body' });
  md.innerHTML = KayaUI.md(content);
  el.appendChild(md);
  return el;
}

// renderRecall lets the user search Kaya's past conversations ("what did we
// talk about earlier?"). It summarizes across sessions with a cloud model when
// available and falls back to the raw matches offline.
async function renderRecall(container) {
  const panel = KayaUI.h('div', { className: 'panel' });
  const ph = KayaUI.h('div', { className: 'panel-head' });
  const t = KayaUI.h('div');
  t.appendChild(KayaUI.h('h2', {}, 'Recall'));
  t.appendChild(KayaUI.h('p', {}, 'Search what you and Kaya have talked about.'));
  ph.appendChild(t);
  panel.appendChild(ph);
  const wrap = KayaUI.h('div', { className: 'row-flex', style: 'gap:var(--s-2)' });
  const input = KayaUI.input('What did we talk about\u2026');
  const btn = KayaUI.h('button', { className: 'kaya-btn kaya-btn-secondary', type: 'button' }, 'Recall');
  wrap.appendChild(input);
  wrap.appendChild(btn);
  panel.appendChild(wrap);
  const body = KayaUI.h('div', { style: 'margin-top:var(--s-4)' });
  panel.appendChild(body);
  container.appendChild(panel);

  btn.addEventListener('click', async () => {
    const q = input.value.trim();
    if (!q) return;
    body.innerHTML = '';
    body.appendChild(KayaUI.loading('Recalling\u2026'));
    let res;
    try { res = await KayaAPI.proxyGet('/v1/recall?query=' + encodeURIComponent(q)); }
    catch (e) { body.innerHTML = ''; body.appendChild(KayaUI.errorState('Couldn\u2019t recall', 'Kaya may still be starting.')); return; }
    body.innerHTML = '';
    if (!res.sessions || res.sessions.length === 0) {
      body.appendChild(KayaUI.emptyState('Nothing found', 'No past conversation matched that.'));
      return;
    }
    const list = KayaUI.h('div', { className: 'kaya-list', id: 'recall-list' });
    if (res.summarized && res.summary) {
      const sum = KayaUI.h('div', { className: 'markdown-body', style: 'padding:var(--s-3) var(--s-4);background:var(--paper-sunken);border-radius:var(--r-sm);margin-bottom:var(--s-3)' });
      sum.innerHTML = KayaUI.md(res.summary);
      list.appendChild(sum);
    } else {
      list.appendChild(KayaUI.h('div', { className: 'type-foot text-tertiary', style: 'margin-bottom:var(--s-3)' }, 'Offline recall (no cloud model) \u2014 raw matches:'));
    }
    res.sessions.forEach(sess => {
      const row = KayaUI.h('div', { className: 'kaya-row' });
      const c = KayaUI.h('div', { className: 'kaya-row-content' });
      const firstUser = (sess.messages || []).find(m => (m.indexOf(': ') > 0 ? m.slice(0, m.indexOf(':')) : '') === 'user');
      const preview = firstUser ? firstUser.slice(firstUser.indexOf(': ') + 2) : '';
      c.appendChild(KayaUI.h('div', { className: 'kaya-row-title', style: 'font-weight:500' }, KayaSemantic.conversationTitle(preview)));
      (sess.messages || []).forEach(m => c.appendChild(recallMsg(m)));
      row.appendChild(c);
      list.appendChild(row);
    });
    body.appendChild(list);
  });
}

KayaApp.registerSection('memory', loadMemory);
