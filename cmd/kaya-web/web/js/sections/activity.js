/* Kaya Section: Activity — "what Kaya has been doing."
   Uses the canonical, user-safe activity projection (/v1/activity), not
   conversation history and not raw runtime events. Read-only timeline. */
'use strict';

async function loadActivity(container) {
  if (KayaApp.currentSection() !== 'activity') return;
  container.innerHTML = '';
  const head = KayaUI.h('div', { className: 'page-head' });
  head.appendChild(KayaUI.h('h1', {}, 'Activity'));
  head.appendChild(KayaUI.h('p', {}, 'What Kaya has been doing. Each item is something real Kaya did or is waiting on \u2014 nothing here is guessed from conversation text.'));
  container.appendChild(head);

  const listEl = KayaUI.h('div', { className: 'kaya-list', id: 'activity-list' });
  listEl.appendChild(KayaUI.loading('Loading activity…'));
  container.appendChild(listEl);

  const refresh = KayaUI.h('button', { className: 'kaya-btn kaya-btn-secondary', onClick: () => loadActivity(container) }, 'Refresh');
  KayaApp.setActions(refresh);

  let res;
  try { res = await KayaAPI.proxyGet('/v1/activity?limit=100'); }
  catch (e) {
    if (!document.body.contains(container)) return;
    listEl.innerHTML = '';
    listEl.appendChild(KayaUI.errorState('Couldn\u2019t load activity', 'Kaya may still be starting.'));
    return;
  }
  if (!document.body.contains(container)) return;

  const items = (res && res.activity) || [];
  listEl.innerHTML = '';
  if (items.length === 0) {
    listEl.appendChild(KayaUI.emptyState('Nothing here yet', 'As Kaya works for you, what it did will appear here \u2014 checked, sent, remembered, scheduled.'));
    return;
  }

  // A tree: each day is a branch, and what Kaya did that day hangs from it.
  // Every node carries a dot in the colour of its outcome, the time, what
  // happened, and (quietly) why Kaya acted. Days fold away with their caret.
  // The same thing failing or succeeding five times in a row is one line
  // with a count, not five lines (newest first, so the first of a run wins).
  const folded = [];
  items.forEach(item => {
    const prev = folded[folded.length - 1];
    const same = prev && prev.item.title === item.title && prev.item.state === item.state
      && (prev.item.summary || '') === (item.summary || '');
    if (same) prev.count++; else folded.push({ item, count: 1 });
  });
  const groups = [];
  folded.forEach(({ item, count }) => {
    const t = item.timestamp ? new Date(item.timestamp) : null;
    const valid = t && !isNaN(t.getTime());
    const label = valid ? activityDayLabel(t) : 'Earlier';
    let g = groups[groups.length - 1];
    if (!g || g.label !== label) { g = { label, items: [] }; groups.push(g); }
    g.items.push({ item, t: valid ? t : null, count });
  });

  const tree = KayaUI.h('div', { className: 'act-tree' });
  groups.forEach((g, gi) => {
    const day = KayaUI.h('section', { className: 'act-day', 'data-open': 'true' });
    const head = KayaUI.h('button', { className: 'act-day-head', type: 'button', 'aria-expanded': 'true' });
    head.appendChild(KayaUI.h('span', { className: 'act-caret', 'aria-hidden': 'true', html: '<svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m3.5 4.5 2.5 3 2.5-3"/></svg>' }));
    head.appendChild(KayaUI.h('span', { className: 'act-day-label' }, g.label));
    head.appendChild(KayaUI.h('span', { className: 'act-day-count' }, String(g.items.length)));
    const branch = KayaUI.h('ol', { className: 'act-branch' });
    g.items.forEach(({ item, t, count }, ni) => {
      const node = KayaUI.h('li', { className: 'act-node tone-' + KayaUI.activityTone(item.state) });
      node.style.setProperty('--n', String(Math.min(gi * 3 + ni, 12)));
      node.appendChild(KayaUI.h('span', { className: 'act-dot', 'aria-hidden': 'true' }));
      const body = KayaUI.h('div', { className: 'act-body' });
      const titleLine = KayaUI.h('div', { className: 'kaya-row-title act-title' }, item.title || 'Activity');
      const word = KayaUI.activityWord(item.state);
      const summary = (item.summary || '').trim();
      if (word && word.toLowerCase() !== summary.toLowerCase()) {
        titleLine.appendChild(KayaUI.h('span', { className: 'status-pill activity-status' }, KayaUI.statusDot(KayaUI.activityTone(item.state)), word));
      }
      if (count > 1) titleLine.appendChild(KayaUI.h('span', { className: 'act-repeat', title: 'Happened ' + count + ' times in a row' }, '\u00d7' + count));
      body.appendChild(titleLine);
      const bits = [];
      if (t) bits.push(t.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
      if (summary) bits.push(summary);
      if (bits.length) body.appendChild(KayaUI.h('div', { className: 'kaya-row-subtitle' }, bits.join('  \u00b7  ')));
      // Revelation: why Kaya asked or acted.
      if (item.why) body.appendChild(KayaUI.h('div', { className: 'kaya-row-subtitle type-foot text-tertiary', style: 'margin-top:2px' }, item.why));
      // The raw technical text (tool error, query) is one click away, in a
      // quiet monospace box, for anyone who wants it.
      if (item.diagnostic) {
        const more = KayaUI.h('details', { className: 'act-details' });
        more.appendChild(KayaUI.h('summary', {}, 'Details'));
        more.appendChild(KayaUI.h('pre', { className: 'act-raw' }, item.diagnostic));
        body.appendChild(more);
      }
      node.appendChild(body);
      branch.appendChild(node);
    });
    head.addEventListener('click', () => {
      const open = day.getAttribute('data-open') !== 'true';
      day.setAttribute('data-open', String(open));
      head.setAttribute('aria-expanded', String(open));
    });
    day.appendChild(head);
    day.appendChild(branch);
    tree.appendChild(day);
  });
  listEl.appendChild(tree);
}

function activityDayLabel(d) {
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Today';
  const y = new Date(now); y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' });
}

KayaApp.registerSection('activity', loadActivity);
