/* Kaya Section: Devices — paired phones and the secure connect flow. */
'use strict';

async function loadDevices(container) {
  container.innerHTML = '';
  const head = KayaUI.h('div', { className: 'page-head' });
  head.appendChild(KayaUI.h('h1', {}, 'Devices'));
  head.appendChild(KayaUI.h('p', {}, 'Phones paired with your Kaya — add a new one or remove one.'));
  container.appendChild(head);

  KayaApp.setActions(null);

  const listEl = KayaUI.h('div', { className: 'kaya-list', id: 'dev-list' });
  listEl.appendChild(KayaUI.loading('Loading devices…'));
  container.appendChild(listEl);

  const awayEl = KayaUI.h('div', { id: 'away-card' });
  container.appendChild(awayEl);

  await renderDevices(listEl);
  renderAway(awayEl);
}

/* ── Away from home: Kaya Connect ───────────────────────────────────────
   Link this Pod to the hosted relay, check it, and connect a phone that is
   not on the home network. Everything here is what `kaya relay link|status|
   pair` does, so the console and the terminal never disagree. */
let awayTimer = null;

function drawQR(text, host) {
  const canvas = KayaUI.h('canvas', {});
  const box = KayaUI.h('div', { className: 'kaya-qr' });
  box.appendChild(canvas);
  if (!KayaQR.draw(text, canvas, 5)) {
    box.innerHTML = '';
    host.appendChild(KayaUI.h('div', { className: 'qr-fallback-string' }, text));
  } else host.appendChild(box);
}

async function renderAway(el) {
  if (awayTimer) { clearInterval(awayTimer); awayTimer = null; }
  el.innerHTML = '';
  let st;
  try { st = await KayaAPI.proxyGet('/v1/connect/status'); }
  catch (e) { return; }

  const card = KayaUI.h('div', { className: 'kaya-card away-card' });
  card.appendChild(KayaUI.h('div', { className: 'kaya-card-title' }, 'Away from home'));
  el.appendChild(card);

  if (!st.available && !st.linked) {
    card.appendChild(KayaUI.h('div', { className: 'kaya-card-sub' },
      'At home your phone connects straight to your Kaya. To reach it from anywhere, use Tailscale or your own relay, or Kaya Connect once it opens.'));
    return;
  }

  if (st.pending && st.pending.state === 'waiting') { awayWaiting(card, st.pending, el); return; }

  if (!st.linked) {
    card.appendChild(KayaUI.h('div', { className: 'kaya-card-sub' },
      'Reach your Kaya from anywhere with nothing to set up. Everything is sealed on your phone, so the relay carries it and can’t read it.'));
    if (st.pending && (st.pending.state === 'needs_plan' || st.pending.state === 'expired' || st.pending.state === 'error')) {
      card.appendChild(KayaUI.h('div', { className: 'kaya-card-sub away-note' }, st.pending.message || 'That didn’t finish.'));
    }
    card.appendChild(KayaUI.h('div', { className: 'away-actions' },
      KayaUI.h('button', { className: 'kaya-btn kaya-btn-primary', onClick: async (ev) => {
        ev.target.disabled = true;
        try { await KayaAPI.proxyPost('/v1/connect/link', {}); renderAway(el); }
        catch (e) { ev.target.disabled = false; KayaUI.toast('Couldn’t start. Check the Pod’s internet connection.', 'err'); }
      } }, 'Link to Kaya Connect')));
    return;
  }

  // Linked
  const tunnel = st.tunnel || 'offline';
  const label = tunnel === 'connected' ? 'Connected' : tunnel === 'needs-payment' ? 'Plan needs attention' : 'Connecting…';
  const dot = tunnel === 'connected' ? 'ready' : tunnel === 'needs-payment' ? 'error' : 'neutral';
  const line = KayaUI.h('div', { className: 'kaya-card-meta' });
  line.appendChild(KayaUI.statusDot ? KayaUI.statusDot(dot) : document.createTextNode(''));
  line.appendChild(document.createTextNode(' ' + label));
  card.appendChild(line);
  if (tunnel === 'needs-payment') {
    card.appendChild(KayaUI.h('div', { className: 'kaya-card-sub away-note' },
      'Your Kaya Connect plan has lapsed, so the relay has stopped. Your Kaya still works at home. Renew on the Kaya site to turn it back on.'));
  } else {
    card.appendChild(KayaUI.h('div', { className: 'kaya-card-sub' },
      'Your phone can reach this Kaya from anywhere. The pass renews itself while your plan is active.'));
  }
  card.appendChild(KayaUI.h('div', { className: 'away-actions' },
    KayaUI.h('button', { className: 'kaya-btn kaya-btn-primary', onClick: () => showRemotePairing() }, 'Connect a phone for away from home'),
    KayaUI.h('button', { className: 'kaya-btn kaya-btn-kaya', onClick: async () => {
      if (!(await KayaUI.confirmModal('Unlink Kaya Connect?', 'Phones will stop reaching your Kaya away from home. At home, and over any other route you set up, nothing changes.', 'Unlink'))) return;
      try { await KayaAPI.proxyPost('/v1/connect/unlink', {}); KayaUI.toast('Unlinked'); renderAway(el); }
      catch (e) { KayaUI.toast('Couldn’t unlink it.', 'err'); }
    } }, 'Unlink')));
}

function awayWaiting(card, p, el) {
  card.appendChild(KayaUI.h('div', { className: 'kaya-card-sub' }, 'On your computer or phone, open this address and sign in, then check the code matches:'));
  const link = KayaUI.h('a', { href: p.verify_url, target: '_blank', rel: 'noopener', className: 'away-link' }, p.verify_url.replace(/^https?:\/\//, ''));
  card.appendChild(link);
  card.appendChild(KayaUI.h('div', { className: 'away-code', 'aria-label': 'Your code' }, p.user_code));
  const qr = KayaUI.h('div', { className: 'qr-wrap' });
  drawQR(p.verify_url, qr);
  card.appendChild(qr);
  const left = KayaUI.h('div', { className: 'qr-expiry' }, '');
  card.appendChild(left);
  card.appendChild(KayaUI.h('div', { className: 'away-actions' },
    KayaUI.h('button', { className: 'kaya-btn kaya-btn-kaya', onClick: () => renderAway(el) }, 'Refresh')));
  const exp = new Date(p.expires_at).getTime();
  const tick = () => { const s = Math.max(0, Math.floor((exp - Date.now()) / 1000)); left.textContent = s > 0 ? 'Waiting… the code works for ' + Math.ceil(s / 60) + ' more minutes' : 'This code expired.'; };
  tick();
  awayTimer = setInterval(async () => {
    tick();
    if (!document.body.contains(card)) { clearInterval(awayTimer); awayTimer = null; return; }
    try {
      const st = await KayaAPI.proxyGet('/v1/connect/status');
      if (!st.pending || st.pending.state !== 'waiting' || st.linked) { renderAway(el); if (st.linked) KayaUI.toast('Linked. Your Kaya is on Kaya Connect.'); }
    } catch (e) { /* keep waiting */ }
  }, 3000);
}

function showRemotePairing() {
  const backdrop = KayaUI.h('div', { className: 'kaya-modal-backdrop' });
  const m = KayaUI.h('div', { className: 'kaya-modal', style: 'max-width:440px' });
  m.appendChild(KayaUI.h('div', { className: 'modal__title' }, 'Connect a phone for away from home'));
  m.appendChild(KayaUI.h('div', { className: 'modal__body type-callout text-tertiary' },
    'Open Kaya on the phone and scan this. It works once and expires in a few minutes. It carries a key for that phone, so don’t share it.'));
  const wrap = KayaUI.h('div', { className: 'qr-wrap' });
  m.appendChild(wrap);
  const actions = KayaUI.h('div', { className: 'modal__actions' });
  actions.appendChild(KayaUI.h('button', { className: 'kaya-btn kaya-btn-kaya', onClick: () => backdrop.remove() }, 'Close'));
  m.appendChild(actions);
  backdrop.appendChild(m);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) backdrop.remove(); });
  document.body.appendChild(backdrop);
  wrap.appendChild(KayaUI.loading('Preparing…'));
  KayaAPI.proxyPost('/v1/connect/pair', {}).then(r => {
    wrap.innerHTML = '';
    drawQR(r.uri, wrap);
    wrap.appendChild(KayaUI.h('div', { className: 'qr-expiry' }, 'Expires in ' + Math.round((r.expires_in || 300) / 60) + ' minutes'));
  }).catch(() => { backdrop.remove(); KayaUI.toast('Couldn’t prepare a phone. Is Kaya Connect connected?', 'err'); });
}

async function renderDevices(listEl) {
  let res;
  try { res = await KayaAPI.proxyGet('/v1/pairing/devices'); }
  catch (e) {
    listEl.innerHTML = '';
    listEl.appendChild(KayaUI.errorState('Couldn’t reach your Kaya', 'The device service may be starting. Try again shortly.'));
    return;
  }
  const devices = res.devices || [];
  listEl.innerHTML = '';

  if (devices.length > 0) {
    const connectBtn = KayaUI.h('button', { className: 'kaya-btn kaya-btn-primary', onClick: () => showPairingModal() }, 'Connect another device');
    KayaApp.setActions(connectBtn);
  } else {
    KayaApp.setActions(null);
  }

  if (devices.length === 0) {
    listEl.appendChild(KayaUI.emptyState('No devices connected', 'Connect your phone by scanning a code \u2014 then you can talk to Kaya from anywhere, while your Kaya stays on this hardware.'));
    listEl.appendChild(KayaUI.h('div', { style: 'text-align:center;border-top:0' }, KayaUI.h('button', { className: 'kaya-btn kaya-btn-primary', onClick: () => showPairingModal() }, 'Connect a device')));
    return;
  }
  const now = Date.now();
  devices.forEach(d => {
    const row = KayaUI.h('div', { className: 'kaya-row' });
    const c = KayaUI.h('div', { className: 'kaya-row-content' });
    const title = KayaUI.h('div', { className: 'kaya-row-title' });
    title.appendChild(document.createTextNode(d.display_name || 'Device'));
    const plat = (d.platform || 'device');
    let statusText, dot;
    if (d.last_seen_at) {
      const seen = new Date(d.last_seen_at).getTime();
      if (now - seen < 3 * 60000) { statusText = 'Connected now'; dot = 'ready'; }
      else { statusText = 'Last seen ' + KayaUI.timeAgo(Math.floor(seen / 1000)); dot = 'neutral'; }
    } else { statusText = 'Paired'; dot = 'neutral'; }
    title.appendChild(KayaUI.h('span', { className: 'kaya-row-subtitle', style: 'margin-left:var(--s-2);font-weight:400' }, '\u00b7  ' + statusText));
    c.appendChild(title);
    const sub = KayaUI.h('div', { className: 'kaya-row-subtitle' });
    sub.appendChild(document.createTextNode(plat.charAt(0).toUpperCase() + plat.slice(1)));
    sub.appendChild(document.createTextNode('  \u00b7  added ' + KayaUI.timeAgo(Math.floor(new Date(d.paired_at).getTime() / 1000))));
    c.appendChild(sub);
    row.appendChild(c);
    const tr = KayaUI.h('div', { className: 'kaya-row-trailing' });
    tr.appendChild(KayaUI.h('button', { className: 'kaya-btn kaya-btn-kaya', onClick: async () => {
      if (!(await KayaUI.confirmModal('Disconnect this device?', d.display_name + ' will no longer be able to reach your Kaya. Your Kaya itself is not affected.', 'Disconnect'))) return;
      try { await KayaAPI.proxyPost('/v1/pairing/revoke', { device_id: d.device_id }); KayaUI.toast('Device disconnected'); renderDevices(document.getElementById('dev-list')); }
      catch (e) { KayaUI.toast('Couldn’t disconnect it.', 'err'); }
    } }, 'Disconnect'));
    row.appendChild(tr);
    listEl.appendChild(row);
  });
}

function showPairingModal() {
  const backdrop = KayaUI.h('div', { className: 'kaya-modal-backdrop' });
  const m = KayaUI.h('div', { className: 'kaya-modal', style: 'max-width:420px' });
  m.appendChild(KayaUI.h('div', { className: 'modal__title' }, 'Connect another device'));
  m.appendChild(KayaUI.h('div', { className: 'modal__body type-callout text-tertiary' }, 'Open Kaya on your phone and scan this code. It expires shortly and can be used once.'));

  const wrap = KayaUI.h('div', { className: 'qr-wrap' });
  const canvas = KayaUI.h('canvas', {});
  const qrBox = KayaUI.h('div', { className: 'kaya-qr' });
  qrBox.appendChild(canvas);
  wrap.appendChild(qrBox);
  const expiry = KayaUI.h('div', { className: 'qr-expiry' }, '');
  wrap.appendChild(expiry);
  const fallback = KayaUI.h('div', { className: 'qr-fallback-string hidden' });
  wrap.appendChild(fallback);
  const manual = KayaUI.h('div', { className: 'qr-manual hidden' });
  wrap.appendChild(manual);
  m.appendChild(wrap);

  const actions = KayaUI.h('div', { className: 'modal__actions' });
  const cancelBtn = KayaUI.h('button', { className: 'kaya-btn kaya-btn-kaya' }, 'Cancel');
  actions.appendChild(cancelBtn);
  m.appendChild(actions);
  backdrop.appendChild(m);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });
  document.body.appendChild(backdrop);

  let pollTimer = null, countdownTimer = null, currentInvite = null, closed = false;
  // Reset the pairing baseline for every dialog: a stale count from a
  // previous session would otherwise trigger an instant false success.
  window.__kayaDeviceCount = null;
  function close() { closed = true; if (pollTimer) clearInterval(pollTimer); if (countdownTimer) clearInterval(countdownTimer); window.__kayaDeviceCount = null; backdrop.remove(); }

  function copyText(text, btn) {
    const restore = () => { btn.textContent = 'Copy token'; };
    const done = () => { btn.textContent = 'Copied ✓'; setTimeout(restore, 1500); KayaUI.toast('Token copied'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
    } else {
      fallbackCopy(text, done);
    }
  }

  function fallbackCopy(text, done) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); }
    catch (e) { KayaUI.toast('Copy failed — select and copy manually', 'err'); }
    document.body.removeChild(ta);
  }

  cancelBtn.addEventListener('click', async () => {
    if (currentInvite) { try { await KayaAPI.proxyPost('/v1/pairing/cancel', { pairing_id: currentInvite.pairing_id }); } catch (e) {} }
    close();
  });

  async function generate() {
    let inv;
    try {
      // Pass the address the admin used to reach this console so the QR
      // carries a usable host. If the console was opened via localhost,
      // let the gateway detect its LAN address instead.
      const body = { display_name: 'Phone', transport: 'lan' };
      const host = window.location.hostname;
      if (host && host !== 'localhost' && host !== '127.0.0.1') body.host = host;
      inv = await KayaAPI.proxyPost('/v1/pairing/invitations', body);
    }
    catch (e) { close(); KayaUI.toast('Couldn’t create a code.', 'err'); return; }
    currentInvite = inv;
    const url = 'kaya://pair?v=1&pod=' + encodeURIComponent(inv.pod_id) + '&transport=' + encodeURIComponent(inv.transport) + '&host=' + encodeURIComponent(inv.host) + '&port=' + encodeURIComponent(inv.port) + '&token=' + encodeURIComponent(inv.token);
    const ok = KayaQR.draw(url, canvas, 5);
    if (!ok) { qrBox.innerHTML = ''; fallback.classList.remove('hidden'); fallback.textContent = url; }
    else fallback.classList.add('hidden');

    // Manual entry: expose the bare token so it can be typed/copied on a phone
    // without scanning the QR.
    manual.classList.remove('hidden');
    manual.innerHTML = '';
    manual.appendChild(KayaUI.h('div', { className: 'qr-manual-label' }, "Can’t scan? Enter this token in the app’s manual screen:"));
    manual.appendChild(KayaUI.h('div', { className: 'qr-manual-token' }, inv.token));
    const copyBtn = KayaUI.h('button', { className: 'kaya-btn kaya-btn-kaya kaya-btn-sm' }, 'Copy token');
    copyBtn.addEventListener('click', () => copyText(inv.token, copyBtn));
    manual.appendChild(copyBtn);
    const expiresAt = new Date(inv.expires_at).getTime();
    const tick = () => {
      const left = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      expiry.textContent = left > 0 ? 'Expires in ' + left + 's' : 'This code has expired.';
      if (left <= 0 && !closed) { clearInterval(countdownTimer); expired(); }
    };
    tick();
    countdownTimer = setInterval(tick, 1000);
  }

  async function poll() {
    try {
      const res = await KayaAPI.proxyGet('/v1/pairing/devices');
      const count = (res.devices || []).length;
      if (window.__kayaDeviceCount != null && count > window.__kayaDeviceCount) {
        window.__kayaDeviceCount = count;
        success();
        return;
      }
      if (window.__kayaDeviceCount == null) {
        window.__kayaDeviceCount = count;
      }
    } catch (e) { /* ignore */ }
  }

  function success() {
    clearInterval(pollTimer); clearInterval(countdownTimer);
    m.innerHTML = '';
    m.appendChild(KayaUI.h('div', { style: 'text-align:center;padding:var(--s-4) 0' },
      KayaUI.h('div', { style: 'font-size:40px;margin-bottom:var(--s-3)' }, '✓'),
      KayaUI.h('div', { className: 'type-title' }, 'Device connected'),
      KayaUI.h('div', { className: 'type-callout text-tertiary', style: 'margin-top:var(--s-2)' }, 'Your phone can now reach your Kaya.')
    ));
    m.appendChild(KayaUI.h('div', { className: 'modal__actions', style: 'justify-content:center' },
      KayaUI.h('button', { className: 'kaya-btn kaya-btn-primary', onClick: () => { close(); renderDevices(document.getElementById('dev-list')); } }, 'Done')));
  }

  function expired() {
    clearInterval(pollTimer);
    m.innerHTML = '';
    m.appendChild(KayaUI.h('div', { className: 'modal__title' }, 'Code expired'));
    m.appendChild(KayaUI.h('div', { className: 'modal__body type-callout text-tertiary' }, 'For security, pairing codes expire after a few minutes.'));
    m.appendChild(KayaUI.h('div', { className: 'modal__actions', style: 'justify-content:center' },
      KayaUI.h('button', { className: 'kaya-btn kaya-btn-primary', onClick: () => { document.body.removeChild(backdrop); showPairingModal(); } }, 'Generate a new code')));
  }

  generate();
  pollTimer = setInterval(poll, 2000);
}

KayaApp.registerSection('devices', loadDevices);
