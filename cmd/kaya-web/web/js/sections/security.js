/* Kaya Section: Security \u2014 who can reach your Kaya. */
'use strict';

async function loadSecurity(container) {
  container.innerHTML = '';
  const head = KayaUI.h('div', { className: 'page-head' });
  head.appendChild(KayaUI.h('h1', {}, 'Security'));
  head.appendChild(KayaUI.h('p', {}, 'Who can reach your Kaya, plus backups and recovery when something goes wrong.'));
  container.appendChild(head);

  // Active sessions
  const sessPanel = KayaUI.h('div', { className: 'panel' });
  const sessHead = KayaUI.h('div', { className: 'panel-head' });
  const sessTitle = KayaUI.h('div');
  sessTitle.appendChild(KayaUI.h('h2', {}, 'Active sessions'));
  sessTitle.appendChild(KayaUI.h('p', {}, 'Signed-in browsers and devices.'));
  sessHead.appendChild(sessTitle);
  sessPanel.appendChild(sessHead);
  const sessBody = KayaUI.h('div', { id: 'sess-body' });
  sessBody.appendChild(KayaUI.loading('Loading sessions\u2026'));
  sessPanel.appendChild(sessBody);
  container.appendChild(sessPanel);
  loadSessions(sessBody);

  // Recent failed sign-ins (only if any)
  const [failRes] = await Promise.allSettled([
    KayaAPI.get('/api/admin/auth/failed-logins'),
  ]);
  const fails = failRes.status === 'fulfilled' ? (failRes.value.attempts || []) : [];
  if (fails.length > 0) {
    const sec = KayaUI.h('div', { className: 'panel' });
    const sh = KayaUI.h('div', { className: 'panel-head' });
    const shText = KayaUI.h('div');
    shText.appendChild(KayaUI.h('h2', {}, 'Recent failed sign-ins'));
    sh.appendChild(shText);
    sec.appendChild(sh);
    const list = KayaUI.h('div', { className: 'kv' });
    fails.slice(0, 5).forEach(f => list.appendChild(securityKv(f.ip, new Date(f.time).toLocaleString())));
    sec.appendChild(list);
    container.appendChild(sec);
  }

  // Backups panel
  const bk = KayaUI.h('div', { className: 'panel' });
  const bkH = KayaUI.h('div', { className: 'panel-head' });
  const bkText = KayaUI.h('div');
  bkText.appendChild(KayaUI.h('h2', {}, 'Backups'));
  bkText.appendChild(KayaUI.h('p', {}, 'An encrypted copy of your Kaya. Restoring brings back the same Kaya on this or new hardware.'));
  bkH.appendChild(bkText);
  bk.appendChild(bkH);
  const bkKv = KayaUI.h('div', { className: 'kv' });
  bkKv.appendChild(securityKv('Conversation history', 'Included'));
  bkKv.appendChild(securityKv('Memory', 'Included'));
  bkKv.appendChild(securityKv('Routines', 'Included'));
  bkKv.appendChild(securityKv('Standing permissions', 'Included'));
  bkKv.appendChild(securityKv('Skills & configuration', 'Included'));
  bkKv.appendChild(securityKv('Secrets & passwords', 'Never included'));
  bk.appendChild(bkKv);
  const bkActions = KayaUI.h('div', { className: 'row-flex', style: 'margin-top:var(--s-4)' });
  const bkBtn = KayaUI.h('button', { className: 'kaya-btn kaya-btn-primary', onClick: () => KayaUI.downloadBackup(bkBtn) }, 'Download backup');
  bkActions.appendChild(bkBtn);
  const rsBtn = KayaUI.h('button', { className: 'kaya-btn kaya-btn-secondary', onClick: () => startRestore(rsBtn) }, 'Restore from backup');
  bkActions.appendChild(rsBtn);
  bk.appendChild(bkActions);
  bk.appendChild(KayaUI.h('div', { className: 'type-foot text-tertiary', style: 'margin-top:var(--s-3)' }, 'Backups are encrypted with a passphrase you choose. After a restore you keep your owner password, but must re-pair devices and reconnect services that need fresh credentials.'));
  container.appendChild(bk);

  // Change password panel
  const panel = KayaUI.h('div', { className: 'panel' });
  const panelHead = KayaUI.h('div', { className: 'panel-head' });
  panelHead.appendChild(KayaUI.h('div', {}, KayaUI.h('h2', {}, 'Change password'), KayaUI.h('p', {}, 'The password used to open this console')));
  panel.appendChild(panelHead);

  const pwFields = KayaUI.h('div', { className: 'field' });
  pwFields.appendChild(KayaUI.h('label', {}, 'Current password'));
  const curPw = KayaUI.h('input', { className: 'kaya-input secret-field', type: 'password' });
  pwFields.appendChild(curPw);
  panel.appendChild(pwFields);

  const npFields = KayaUI.h('div', { className: 'field' });
  npFields.appendChild(KayaUI.h('label', {}, 'New password'));
  const newPw = KayaUI.h('input', { className: 'kaya-input secret-field', type: 'password', placeholder: 'At least 8 characters' });
  npFields.appendChild(newPw);
  panel.appendChild(npFields);

  const cfFields = KayaUI.h('div', { className: 'field' });
  cfFields.appendChild(KayaUI.h('label', {}, 'Confirm new password'));
  const cfPw = KayaUI.h('input', { className: 'kaya-input secret-field', type: 'password' });
  cfFields.appendChild(cfPw);
  panel.appendChild(cfFields);

  const pwErr = KayaUI.h('div', { className: 'type-foot', style: 'color:var(--bad);min-height:18px;margin-bottom:var(--s-2)' });
  panel.appendChild(pwErr);

  const pwBtn = KayaUI.h('button', { className: 'kaya-btn kaya-btn-primary' }, 'Save');
  pwBtn.addEventListener('click', async () => {
    pwErr.textContent = '';
    if (newPw.value !== cfPw.value) { pwErr.textContent = 'Passwords don\u2019t match.'; return; }
    if (newPw.value.length < 8) { pwErr.textContent = 'At least 8 characters.'; return; }
    if (!curPw.value) { pwErr.textContent = 'Current password is required.'; return; }
    pwBtn.disabled = true;
    try {
      await KayaAPI.post('/api/admin/password', { current: curPw.value, new: newPw.value, confirm: cfPw.value });
      KayaUI.toast('Password changed');
      curPw.value = ''; newPw.value = ''; cfPw.value = '';
    } catch (err) {
      pwErr.textContent = err.message || 'Couldn\u2019t change it.';
    } finally { pwBtn.disabled = false; }
  });
  panel.appendChild(pwBtn);
  container.appendChild(panel);

  const rec = KayaUI.h('div', { className: 'panel' });
  const recHead = KayaUI.h('div', { className: 'panel-head' });
  const recTitle = KayaUI.h('div');
  recTitle.appendChild(KayaUI.h('h2', {}, 'Recovery'));
  recTitle.appendChild(KayaUI.h('p', {}, 'If Kaya seems stuck, restart it first \u2014 reboot the device only if it doesn\u2019t come back. Neither touches your memory or devices.'));
  recHead.appendChild(recTitle);
  rec.appendChild(recHead);
  const recList = KayaUI.h('div', {});
  recList.appendChild(recoveryRow('Restart Kaya', 'Restarts the Kaya service. Use this first if Kaya seems stuck \u2014 it doesn\u2019t touch your memory or devices.', 'Restart', async () => {
    if (!(await KayaUI.confirmModal('Restart Kaya?', 'Your Kaya will be offline for a few moments while it restarts. Your memory and settings are safe.', 'Restart Kaya'))) return;
    try { await KayaAPI.post('/api/admin/kaya/restart'); KayaUI.toast('Kaya is restarting\u2026'); }
    catch (e) { KayaUI.toast('Couldn\u2019t restart Kaya.', 'err'); }
  }));
  recList.appendChild(recoveryRow('Reboot this device', 'Reboots the hardware Kaya runs on. Use only if something is wrong.', 'Reboot', async () => {
    if (!(await KayaUI.confirmModal('Reboot this device?', 'Your Kaya will be offline for a minute or two while the device reboots.', 'Reboot device'))) return;
    try { await KayaAPI.post('/api/admin/reboot'); KayaUI.toast('Rebooting\u2026'); }
    catch (e) { KayaUI.toast('Couldn\u2019t reboot.', 'err'); }
  }));
  rec.appendChild(recList);
  container.appendChild(rec);
}

function recoveryRow(k, sub, btnLabel, onClick) {
  const r = KayaUI.h('div', { className: 'kaya-row' });
  const c = KayaUI.h('div', { className: 'kaya-row-content' });
  c.appendChild(KayaUI.h('div', { className: 'kaya-row-title' }, k));
  c.appendChild(KayaUI.h('div', { className: 'kaya-row-subtitle' }, sub));
  r.appendChild(c);
  r.appendChild(KayaUI.h('div', { className: 'kaya-row-trailing' },
    KayaUI.h('button', { className: 'kaya-btn kaya-btn-danger', onClick }, btnLabel)));
  return r;
}

function securityKv(k, v) { const r = KayaUI.h('div', { className: 'kv-row' }); r.appendChild(KayaUI.h('div', { className: 'kv-key' }, k)); r.appendChild(KayaUI.h('div', { className: 'kv-val' }, v)); return r; }

async function startRestore(btn) {
  const orig = btn.textContent;
  const body = KayaUI.h('div');
  body.appendChild(KayaUI.h('p', { className: 'type-callout text-secondary', style: 'margin-bottom:var(--s-4)' }, 'Choose a backup file (.kaya) and enter its passphrase. Nothing changes until you review what is inside and confirm.'));
  const fileWrap = KayaUI.h('div', { className: 'field' });
  fileWrap.appendChild(KayaUI.h('label', {}, 'Backup file'));
  const fileInput = KayaUI.h('input', { type: 'file', accept: '.kaya' });
  fileWrap.appendChild(fileInput);
  body.appendChild(fileWrap);
  const pw = KayaUI.input('Backup passphrase', 'password');
  pw.style.marginBottom = 'var(--s-2)';
  const err = KayaUI.h('div', { className: 'type-foot', style: 'color:var(--bad);min-height:18px' });
  body.appendChild(pw);
  body.appendChild(err);
  KayaUI.modal('Restore from backup', body, [
    KayaUI.h('button', { className: 'kaya-btn kaya-btn-kaya', onClick: (e) => e.target.closest('.kaya-modal-backdrop').remove() }, 'Cancel'),
    KayaUI.h('button', { className: 'kaya-btn kaya-btn-primary', onClick: async (e) => {
      err.textContent = '';
      if (!fileInput.files || fileInput.files.length === 0) { err.textContent = 'Choose a backup file first.'; return; }
      if (!pw.value) { err.textContent = 'Enter the backup passphrase.'; return; }
      const go = e.target;
      go.disabled = true; go.textContent = 'Checking\u2026';
      try {
        const form = new FormData();
        form.append('archive', fileInput.files[0]);
        form.append('passphrase', pw.value);
        const res = await fetch('/api/admin/restore/validate', { method: 'POST', body: form });
        const j = await res.json();
        if (!res.ok || !j.ok) throw new Error((j && j.error) || 'invalid backup');
        e.target.closest('.kaya-modal-backdrop').remove();
        showRestoreSummary(j.token, pw.value, j.summary);
      } catch (ex) {
        err.textContent = ex.message || 'Couldn\u2019t read that backup.';
        go.disabled = false; go.textContent = orig;
      }
    } }, 'Check backup'),
  ]);
  setTimeout(() => pw.focus(), 50);
}

function showRestoreSummary(token, passphrase, s) {
  const body = KayaUI.h('div');
  const rows = [
    ['Conversation history', String(s.conversations)],
    ['Routines', String(s.routines)],
    ['Scheduled items', String(s.scheduled_items)],
    ['Standing permissions', String(s.standing_grants)],
    ['Other files', String(s.portable_files)],
    ['Exported', s.exported_at || 'unknown'],
    ['Secrets in backup', s.secrets_included ? 'Yes \u2014 will be restored' : 'No \u2014 must be re-entered'],
  ];
  rows.forEach(([k, v]) => {
    const r = KayaUI.h('div', { className: 'kv-row' });
    r.appendChild(KayaUI.h('div', { className: 'kv-key' }, k));
    r.appendChild(KayaUI.h('div', { className: 'kv-val' }, v));
    body.appendChild(r);
  });
  if (s.rebound && s.rebound.length > 0) {
    body.appendChild(KayaUI.h('div', { className: 'type-foot text-tertiary', style: 'margin-top:var(--s-3);margin-bottom:var(--s-1)' }, 'Stays on this machine / must be redone:'));
    s.rebound.forEach(r => body.appendChild(KayaUI.h('div', { className: 'type-foot text-tertiary' }, '\u00b7  ' + r)));
  }
  body.appendChild(KayaUI.h('p', { className: 'type-callout', style: 'margin-top:var(--s-4)' }, 'Restoring replaces this Kaya\u2019s conversations, memory, routines, and permissions with the backup. Your owner password stays the same; paired devices must be re-paired afterwards.'));
  KayaUI.modal('Restore this backup?', body, [
    KayaUI.h('button', { className: 'kaya-btn kaya-btn-kaya', onClick: (e) => e.target.closest('.kaya-modal-backdrop').remove() }, 'Keep current state'),
    KayaUI.h('button', { className: 'kaya-btn kaya-btn-danger', onClick: async (e) => {
      e.target.closest('.kaya-modal-backdrop').remove();
      if (!(await KayaUI.confirmModal('Replace this Kaya\u2019s state?', 'There is no undo. Make sure you have the right backup file.', 'Restore'))) return;
      applyRestore(token, passphrase);
    } }, 'Restore'),
  ]);
}

async function applyRestore(token, passphrase) {
  const body = KayaUI.h('div');
  const status = KayaUI.h('p', { className: 'type-callout' }, 'Starting\u2026');
  body.appendChild(status);
  const log = KayaUI.h('pre', { className: 'type-mono', style: 'white-space:pre-wrap;margin:var(--s-3) 0 0;max-height:240px;overflow:auto' });
  body.appendChild(log);
  const backdrop = KayaUI.modal('Restoring Kaya', body, null);
  try {
    const res = await fetch('/api/admin/restore/apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, passphrase, confirmed: true }) });
    const j = await res.json();
    if (!res.ok || !j.ok) throw new Error((j && j.error) || 'restore failed to start');
    for (;;) {
      await new Promise(r => setTimeout(r, 2000));
      const sres = await fetch('/api/admin/restore/status');
      const st = await sres.json();
      if (st.stage) status.textContent = 'Stage: ' + st.stage + '\u2026';
      if (st.log) log.textContent = st.log;
      if (!st.running && st.done) {
        backdrop.remove();
        if (st.success) {
          KayaUI.toast('Restore complete \u2014 re-pair your devices');
          KayaUI.modal('Restore complete', 'Your Kaya\u2019s conversations, memory, routines, and permissions now come from the backup.\n\nNext: re-pair your phone and any devices, and reconnect services that need fresh credentials. Your owner password is unchanged.', [
            KayaUI.h('button', { className: 'kaya-btn kaya-btn-primary', onClick: (e) => { e.target.closest('.kaya-modal-backdrop').remove(); KayaApp.navigate('devices'); } }, 'Pair a device'),
          ]);
        } else {
          KayaUI.modal('Restore did not complete', (st.log || 'The restore failed. Your Kaya was restarted and should be working as before \u2014 check the log above for details.'), [
            KayaUI.h('button', { className: 'kaya-btn kaya-btn-kaya', onClick: (e) => e.target.closest('.kaya-modal-backdrop').remove() }, 'Close'),
          ]);
        }
        return;
      }
    }
  } catch (ex) {
    backdrop.remove();
    KayaUI.toast(ex.message || 'Restore failed.', 'err');
  }
}

async function loadSessions(body) {
  let res;
  try { res = await KayaAPI.get('/api/admin/sessions'); }
  catch (e) {
    body.innerHTML = '';
    body.appendChild(KayaUI.errorState('Couldn\u2019t load sessions', 'Try again in a moment.'));
    return;
  }
  body.innerHTML = '';
  const sessions = res.sessions || [];
  if (sessions.length === 0) {
    body.appendChild(KayaUI.emptyState('No active sessions', 'No one is signed in right now.'));
    return;
  }
  sessions.forEach(s => {
    const row = KayaUI.h('div', { className: 'kaya-row' });
    const c = KayaUI.h('div', { className: 'kaya-row-content' });
    c.appendChild(KayaUI.h('div', { className: 'kaya-row-title' }, (s.current ? 'This browser' : friendlyAgent(s.user_agent)) + (s.current ? ' \u00b7 ' + friendlyAgent(s.user_agent) : '')));
    c.appendChild(KayaUI.h('div', { className: 'kaya-row-subtitle' }, 'Signed in ' + KayaUI.timeAgo(Math.floor(new Date(s.issued_at).getTime() / 1000)) + (s.ip ? '  \u00b7  ' + s.ip : '')));
    row.appendChild(c);
    if (!s.current) {
      const tr = KayaUI.h('div', { className: 'kaya-row-trailing' });
      tr.appendChild(KayaUI.h('button', { className: 'kaya-btn kaya-btn-kaya', onClick: async () => {
        try { await KayaAPI.post('/api/admin/sessions/revoke', { id: s.id }); KayaUI.toast('Session signed out'); loadSessions(body); }
        catch (e) { KayaUI.toast('Couldn\u2019t sign out.', 'err'); }
      } }, 'Sign out'));
      row.appendChild(tr);
    } else {
      row.appendChild(KayaUI.h('span', { className: 'status-pill' }, KayaUI.statusDot('ready'), 'You'));
    }
    body.appendChild(row);
  });
  if (sessions.length > 1) {
    const allBtn = KayaUI.h('button', { className: 'kaya-btn kaya-btn-danger', style: 'margin-top:var(--s-3)', onClick: async () => {
      if (!(await KayaUI.confirmModal('Sign out all other sessions?', 'You will remain signed in on this browser.', 'Sign out all'))) return;
      try { await KayaAPI.post('/api/admin/sessions/revoke', { action: 'revoke_all' }); KayaUI.toast('Other sessions signed out'); loadSessions(body); }
      catch (e) { KayaUI.toast('Couldn\u2019t sign out.', 'err'); }
    } }, 'Sign out all other sessions');
    body.appendChild(allBtn);
  }
}

KayaApp.registerSection('security', loadSecurity);

// friendlyAgent turns a raw User-Agent into "Chrome on Linux". Sessions are
// something an owner reviews to spot a stranger; a 90-character UA hides that.
function friendlyAgent(ua) {
  const u = String(ua || '');
  if (!u) return 'Unknown device';
  const browser = /Edg\//.test(u) ? 'Edge' : /OPR\/|Opera/.test(u) ? 'Opera' : /Firefox\//.test(u) ? 'Firefox'
    : /Chrome\/|Chromium\//.test(u) ? 'Chrome' : /Safari\//.test(u) ? 'Safari' : /curl|python|Go-http/i.test(u) ? 'Command line' : 'Browser';
  const os = /iPhone|iPad|iOS/.test(u) ? 'iOS' : /Android/.test(u) ? 'Android' : /Windows/.test(u) ? 'Windows'
    : /Mac OS X|Macintosh/.test(u) ? 'macOS' : /Linux|X11/.test(u) ? 'Linux' : '';
  return os ? browser + ' on ' + os : browser;
}
