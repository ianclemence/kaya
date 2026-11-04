/* Kaya Section: Jobs — what Kaya takes on for the owner.
 *
 * The same jobs as the phone's Jobs screen (/v1/jobs): each one switch and a
 * time. Turning one on asks the Pod, which runs it as a routine; the switch
 * shows what the Pod answered. What a job still needs is said on the job, and
 * its switch waits until it is met.
 */
'use strict';

async function loadJobs(container) {
  if (KayaApp.currentSection() !== 'jobs') return;
  container.innerHTML = '';
  const head = KayaUI.h('div', { className: 'page-head' });
  head.appendChild(KayaUI.h('h1', {}, 'Jobs'));
  head.appendChild(KayaUI.h('p', {},
    'What Kaya takes on for you. Turn one on and it runs at its time, in your time zone, and tells you in the app. Each is a routine underneath, so it also shows under Routines.'));
  container.appendChild(head);

  const listEl = KayaUI.h('div', { className: 'kaya-list' });
  listEl.appendChild(KayaUI.loading('Loading jobs…'));
  container.appendChild(listEl);

  let res;
  try {
    res = await KayaAPI.proxyGet('/v1/jobs');
  } catch (e) {
    if (!document.body.contains(container)) return;
    listEl.innerHTML = '';
    listEl.appendChild(KayaUI.errorState('Couldn’t load jobs', 'Kaya may still be starting. Try again in a moment.'));
    return;
  }
  if (!document.body.contains(container)) return;
  renderJobs(listEl, container, Array.isArray(res && res.jobs) ? res.jobs : []);
}

function renderJobs(listEl, container, jobs) {
  listEl.innerHTML = '';
  jobs.forEach(job => {
    const card = KayaUI.h('div', { className: 'kaya-card' });
    const schedulable = !!job.time;
    const missing = Array.isArray(job.missing) ? job.missing : [];
    const at = (job.settings && job.settings.time) || job.time;

    const titleRow = KayaUI.h('div', { className: 'kaya-card-title' });
    titleRow.appendChild(document.createTextNode(job.title));
    if (schedulable && job.enabled) titleRow.appendChild(KayaUI.h('span', { className: 'state-chip state-chip-ok' }, 'On'));
    card.appendChild(titleRow);
    card.appendChild(KayaUI.h('div', { className: 'kaya-card-meta' }, at ? job.when + ' at ' + at : job.when));
    card.appendChild(KayaUI.h('div', { className: 'kaya-card-sub' }, job.promise));
    if (missing.length) {
      card.appendChild(KayaUI.h('div', { className: 'type-foot text-warning', style: 'margin-top:var(--s-1)' }, missing.join(' · ')));
    }
    if (job.settings && job.settings.topic) {
      card.appendChild(KayaUI.h('div', { className: 'kaya-card-meta' }, 'Learning: ' + job.settings.topic));
    }

    if (schedulable) {
      const row = KayaUI.h('div', { className: 'btn-row' });
      const time = KayaUI.input('', 'time');
      time.value = at || '';
      time.setAttribute('aria-label', job.title + ' time');
      time.style.maxWidth = '9rem';
      let topic = null;
      if (job.ask && !job.enabled) {
        topic = KayaUI.input(job.ask);
        topic.maxLength = 80;
        topic.setAttribute('aria-label', job.ask);
        topic.style.marginTop = 'var(--s-2)';
        card.appendChild(topic);
      }
      const send = async (enabled) => {
        const body = { enabled, time: time.value || job.time };
        body.topic = topic ? topic.value : ((job.settings && job.settings.topic) || '');
        try {
          await KayaAPI.proxyPost('/v1/jobs/' + encodeURIComponent(job.id), body);
          KayaUI.toast(enabled ? job.title + ' is on.' : job.title + ' is off.', 'ok');
        } catch (e) {
          KayaUI.toast((e && e.message) || 'Couldn’t do that — try again.', 'err');
        }
        loadJobs(container);
      };
      row.appendChild(time);
      if (job.enabled) {
        row.appendChild(KayaUI.btn('Change time', 'secondary', () => send(true)));
        row.appendChild(KayaUI.btn('Turn off', 'secondary', () => send(false)));
      } else {
        const on = KayaUI.btn('Turn on', 'primary', () => send(true));
        if (missing.length) on.disabled = true;
        row.appendChild(on);
      }
      card.appendChild(row);
    }
    listEl.appendChild(card);
  });
}

KayaApp.registerSection('jobs', loadJobs);
