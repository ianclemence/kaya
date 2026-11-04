/* Kaya Section: Routines — everything Kaya runs for you, in one list.
 *
 * One destination for routines, reminders, and scheduled actions. The owner
 * never files their intent as a "routine" or an "automation"; the gateway
 * merges both backing models at /v1/routinefeed and this surface renders one feed.
 * Creation happens in conversation; this screen reviews and steers.
 *
 * (This file used to be called things.js. Nothing on this surface is a
 * "thing" — not to the owner, and not in the API: the feed answers with
 * "routines". The old file read res.things, so it always rendered the empty
 * state no matter how many reminders existed.)
 */
'use strict';

// The feed's kind set is closed (pkg/routinefeed): reminder, routine,
// automation, task. The default exists only so a newly added kind still
// reads as a routine rather than as the word "Thing".
function routineKindLabel(kind) {
  switch (kind) {
    case 'reminder': return 'Reminder';
    case 'routine': return 'Recurring';
    case 'automation': return 'Scheduled';
    case 'task': return 'Task';
    default: return 'Routine';
  }
}

function routineState(item) {
  switch (item.state) {
    case 'waiting': return { label: 'Waiting for you', cls: 'state-chip state-chip-warn' };
    case 'failed': return { label: 'Needs attention', cls: 'state-chip state-chip-bad' };
    case 'paused': return { label: 'Paused', cls: 'state-chip state-chip-off' };
    case 'done': return { label: 'Done', cls: 'state-chip state-chip-ok' };
    case 'cancelled': return { label: 'Cancelled', cls: 'state-chip state-chip-off' };
    default: return { label: 'Active', cls: 'state-chip state-chip-ok' };
  }
}

async function loadRoutines(container) {
  if (KayaApp.currentSection() !== 'routines') return;
  container.innerHTML = '';
  const head = KayaUI.h('div', { className: 'page-head' });
  head.appendChild(KayaUI.h('h1', {}, 'Routines'));
  head.appendChild(KayaUI.h('p', {},
    'Everything Kaya runs for you \u2014 recurring briefs, reminders, and scheduled actions. Pause, resume, or stop any of them here.'));
  container.appendChild(head);

  const listEl = KayaUI.h('div', { className: 'kaya-list', id: 'routines-list' });
  listEl.appendChild(KayaUI.loading('Loading what Kaya is doing\u2026'));
  container.appendChild(listEl);

  let res;
  try {
    res = await KayaAPI.proxyGet('/v1/routinefeed');
  } catch (e) {
    if (!document.body.contains(container)) return;
    listEl.innerHTML = '';
    listEl.appendChild(KayaUI.errorState('Couldn\u2019t load what Kaya is doing', 'Kaya may still be starting. Try again in a moment.'));
    return;
  }
  if (!document.body.contains(container)) return;
  renderRoutines(listEl, container, Array.isArray(res && res.routines) ? res.routines : []);
}

function renderRoutines(listEl, container, items) {
  listEl.innerHTML = '';
  if (items.length === 0) {
    listEl.appendChild(KayaUI.emptyState(
      'Nothing yet',
      'Say \u201cevery Monday at 9, prepare my weekly brief\u201d in a chat and it appears here.'));
    return;
  }

  const rank = { waiting: 0, failed: 0, active: 1, paused: 2 };
  items = items.slice().sort((a, b) => (rank[a.state] ?? 3) - (rank[b.state] ?? 3));
  items.forEach(item => {
    const card = KayaUI.h('div', { className: 'kaya-card' });

    // The title and the text it came from are often the same words; say them once.
    const words = KayaWording.routine(item.title, item.what);
    const titleRow = KayaUI.h('div', { className: 'kaya-card-title' });
    titleRow.appendChild(document.createTextNode(words.title));
    titleRow.appendChild(KayaUI.h('span', { className: routineState(item).cls }, routineState(item).label));
    card.appendChild(titleRow);

    const schedule = item.schedule && item.schedule !== 'Manual' ? item.schedule : 'No schedule';
    const metaParts = [routineKindLabel(item.kind), schedule];
    if (item.run_count > 0) metaParts.push('ran ' + item.run_count + '\u00d7');
    if (item.state === 'active' && typeof whenAhead === 'function' && item.next_run_at) {
      const next = whenAhead(item.next_run_at);
      if (next) metaParts.push('next ' + next);
    }
    card.appendChild(KayaUI.h('div', { className: 'kaya-card-meta' }, metaParts.join('  \u00b7  ')));

    if (words.sub) {
      card.appendChild(KayaUI.h('div', { className: 'kaya-card-sub' }, words.sub));
    }
    if (item.last_error) {
      card.appendChild(KayaUI.h('div', { className: 'type-foot text-danger', style: 'margin-top:var(--s-1)' }, item.last_error));
    }

    const row = KayaUI.h('div', { className: 'btn-row' });
    if (item.state === 'active') {
      row.appendChild(KayaUI.btn('Pause', 'secondary', () => routineAction(container, item, 'pause')));
    } else if (item.state === 'paused' || item.state === 'failed') {
      row.appendChild(KayaUI.btn('Resume', 'secondary', () => routineAction(container, item, 'resume')));
    }
    if (item.state === 'active' || item.state === 'paused' || item.state === 'waiting') {
      row.appendChild(KayaUI.btn('Stop', 'danger', async () => {
        const ok = await KayaUI.confirmModal(
          'Stop this?',
          'Kaya will stop \u201c' + (item.title || 'this') + '\u201d.',
          'Stop');
        if (ok) routineAction(container, item, 'cancel');
      }));
    }
    if (row.childNodes.length > 0) card.appendChild(row);

    listEl.appendChild(card);
  });
}

// routineAction routes to the correct backend action based on provenance so the
// routine metadata sidecar stays consistent for routine-sourced entries.
async function routineAction(container, item, op) {
  const isRoutine = item.source === 'routine';
  const base = isRoutine ? '/v1/routines/' : '/v1/scheduled/';
  try {
    await KayaAPI.proxyPost(base + encodeURIComponent(item.id) + '/' + op, {});
  } catch (e) {
    KayaUI.toast('Couldn\u2019t do that \u2014 try again.', 'err');
    return;
  }
  loadRoutines(container);
}

KayaApp.registerSection('routines', loadRoutines);
