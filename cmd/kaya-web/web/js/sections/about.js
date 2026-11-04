/* Kaya Section: About \u2014 the product, quietly. */
'use strict';

async function loadAbout(container) {
  container.innerHTML = '';
  const head = KayaUI.h('div', { className: 'page-head' });
  head.appendChild(KayaUI.h('h1', {}, 'About'));
  head.appendChild(KayaUI.h('p', {}, 'Your Kaya: who it belongs to and what it is.'));
  container.appendChild(head);

  const [identityRes] = await Promise.allSettled([
    KayaAPI.get('/api/admin/identity'),
  ]);

  const identity = identityRes.status === 'fulfilled' ? identityRes.value : {};

  const brand = KayaUI.h('div', { className: 'row-flex', style: 'margin-bottom:var(--s-5);gap:var(--s-3)' });
  brand.appendChild(KayaUI.kayaMark('lg'));
  const brandText = KayaUI.h('div', {});
  brandText.appendChild(KayaUI.h('div', { className: 'type-title' }, identity.kaya_name || 'Kaya'));
  brandText.appendChild(KayaUI.h('div', { className: 'type-foot text-tertiary' }, identity.owner_name ? ('Owned by ' + identity.owner_name) : 'Your AI. Your Memory. Your Machine.'));
  brand.appendChild(brandText);
  container.appendChild(brand);

  // Identity panel
  if (identity.configured) {
    const idPanel = KayaUI.h('div', { className: 'panel' });
    idPanel.appendChild(KayaUI.h('div', { className: 'panel-head' }, KayaUI.h('div', {}, KayaUI.h('h2', {}, 'Your Kaya'))));
    const details = KayaUI.h('div', { style: 'margin-top:var(--s-3)' });
    if (identity.kaya_id) details.appendChild(aboutKvRow('Kaya ID', identity.kaya_id.slice(0, 12) + '\u2026'));
    if (identity.created_at) details.appendChild(aboutKvRow('Created', KayaUI.timeAgo(Math.floor(new Date(identity.created_at).getTime() / 1000))));
    idPanel.appendChild(details);
    container.appendChild(idPanel);
  }

  const prose = KayaUI.h('div', { className: 'panel prose', style: 'margin-top:var(--s-3)' });
  prose.innerHTML = KayaUI.md(`
Kaya is a personal AI that lives on a small computer in your home, called a Pod. It remembers the people and plans in your life, does things for you, and speaks up when something needs you.

- **This console** is where you set Kaya up, connect it to things, and look after it.
- **The Kaya app** is where you talk to it, approve what it wants to do, and step in when it needs you.
- **The Pod** is the machine it lives on.

Your memory, files and logins stay on this Pod. Nothing is sent to a central service. Only what you ask Kaya to think about goes to the AI model you chose, and only if that model is in the cloud.

Kaya is open source. The code, the documentation and the license are at [github.com/kayahq/kaya](https://github.com/kayahq/kaya).
  `);
  container.appendChild(prose);
}

function aboutKvRow(label, value) {
  const r = KayaUI.h('div', { className: 'kv-row' });
  r.appendChild(KayaUI.h('div', { className: 'kv-key' }, label));
  r.appendChild(KayaUI.h('div', { className: 'kv-val' }, value));
  return r;
}

KayaApp.registerSection('about', loadAbout);
