/* Kaya Wizard — first-run setup flow */
'use strict';

const KayaWizard = (() => {
  let _container;
  let _state = {
    step: 'welcome',
    setupCode: '',
    ownerName: '',
    kayaName: 'Kaya',
    city: '',
    timezone: (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (_) { return ''; } })(),
    password: '',
    brain: 'deepseek',
    apiKey: '',
    pairingDone: false,
    notice: '',
  };

  const steps = ['welcome', 'identity', 'password', 'brain', 'preparing', 'phone', 'done'];

  // The mark inside Kaya's living light: the first thing anyone sees should
  // already feel present.
  function brandOrb() {
    const orb = KayaUI.h('div', { className: 'presence-orb orb-lg', 'data-state': 'idle', 'aria-hidden': 'true' });
    orb.appendChild(KayaUI.kayaMark('md'));
    return KayaUI.h('div', { className: 'wizard-brand' }, orb);
  }

  function render(container) {
    _container = container;
    _container.innerHTML = '';
    const wrapper = KayaUI.h('div', { id: 'wizard' });
    _container.appendChild(wrapper);
    renderStep();
  }

  function renderStep() {
    const wrapper = document.getElementById('wizard') || _container;
    wrapper.innerHTML = '';

    const screen = KayaUI.h('div', { className: `wizard-screen wizard-${_state.step}` });

    switch (_state.step) {
      case 'welcome': renderWelcome(screen); break;
      case 'identity': renderIdentity(screen); break;
      case 'password': renderPassword(screen); break;
      case 'preparing': renderPreparing(screen); break;
      case 'brain': renderBrain(screen); break;
      case 'phone': renderPhone(screen); break;
      case 'done': renderDone(screen); break;
    }

    wrapper.appendChild(screen);
  }

  function renderWelcome(screen) {
    screen.appendChild(brandOrb());
    screen.appendChild(KayaUI.h('div', { className: 'wizard-title type-display' }, 'Kaya'));
    screen.appendChild(KayaUI.h('div', { className: 'wizard-tagline type-body text-secondary' }, 'Your AI. Your Memory. Your Machine.'));
    screen.appendChild(KayaUI.h('div', { className: 'wizard-desc type-callout text-secondary' },
      'A personal AI that lives on your hardware, remembers what matters, and keeps working for you.'
    ));

    // Phone handoff: a QR carrying only the Pod address (never the setup
    // code, which stays a device-only secret). Scan it with the Kaya app to
    // prefill the address, then type the code from the device.
    const qrWrap = KayaUI.h('div', { className: 'wizard-qr hidden' });
    const qrCanvas = document.createElement('canvas');
    qrWrap.appendChild(qrCanvas);
    screen.appendChild(qrWrap);
    fetch('/api/status').then((r) => r.json()).then((s) => {
      const host = window.location.hostname || '';
      const port = String(s.console_port || window.location.port || '80');
      const pod = s.pod_id || '';
      const uri = 'kaya://setup?v=1&host=' + encodeURIComponent(host) +
        '&port=' + encodeURIComponent(port) + '&pod=' + encodeURIComponent(pod);
      let ok = false;
      try { ok = KayaQR.draw(uri, qrCanvas, 4); } catch (e) { ok = false; }
      if (ok) {
        qrWrap.classList.remove('hidden');
        qrWrap.appendChild(KayaUI.h('div', { className: 'type-footnote text-tertiary' },
          'Scan with the Kaya app to set up from your phone'));
      }
    }).catch(() => {});

    // Setup code: proves local presence so a host on the network cannot claim
    // an unconfigured Kaya. Printed in the console output on the device.
    const codeInput = KayaUI.input('Setup code');
    codeInput.value = _state.setupCode;
    codeInput.addEventListener('input', (e) => { _state.setupCode = e.target.value.trim(); });
    if (_state.notice) {
      screen.appendChild(KayaUI.h('div', { className: 'wizard-notice', role: 'alert' }, _state.notice));
      _state.notice = '';
    }
    screen.appendChild(codeInput);
    const hint = KayaUI.h('div', { className: 'wizard-code-hint type-footnote text-tertiary' },
      'This proves you are at the device. Use the code on the card in the box, or read the file named kaya-setup-code on the Pod\u2019s SD card from any computer. With a keyboard on the Pod:');
    hint.appendChild(document.createElement('br'));
    hint.appendChild(KayaUI.h('code', {}, 'journalctl -u kaya-web | grep "Setup code"'));
    screen.appendChild(hint);

    screen.appendChild(KayaUI.h('div', { className: 'wizard-actions' },
      KayaUI.h('button', { className: 'kaya-btn kaya-btn-primary kaya-btn-lg', onClick: () => {
        if (!_state.setupCode) { KayaUI.toast('Enter the setup code shown on your Kaya.'); return; }
        goTo('identity');
      }}, 'Set up Kaya')
    ));
  }

  function renderIdentity(screen) {
    screen.appendChild(KayaUI.h('div', { className: 'wizard-title type-title' }, 'Let\u2019s make this yours.'));
    screen.appendChild(KayaUI.h('div', { className: 'wizard-desc type-body text-secondary', style: 'margin-bottom:var(--s-6)' },
      'What should Kaya call you?'
    ));

    const nameInput = KayaUI.input('Your name');
    nameInput.value = _state.ownerName;
    nameInput.addEventListener('input', (e) => _state.ownerName = e.target.value);
    screen.appendChild(nameInput);

    screen.appendChild(KayaUI.h('div', { className: 'wizard-desc type-body text-secondary', style: 'margin:var(--s-5) 0 var(--s-3)' },
      'What would you like to call Kaya?'
    ));

    const kayaInput = KayaUI.input('Kaya name');
    kayaInput.value = _state.kayaName;
    kayaInput.addEventListener('input', (e) => _state.kayaName = e.target.value);
    screen.appendChild(kayaInput);

    screen.appendChild(KayaUI.h('div', { className: 'wizard-desc type-body text-secondary', style: 'margin:var(--s-5) 0 var(--s-3)' },
      'Which city are you in? (optional)'
    ));
    const cityInput = KayaUI.input('For example: Bangkok');
    cityInput.value = _state.city;
    cityInput.addEventListener('input', (e) => _state.city = e.target.value);
    screen.appendChild(cityInput);
    screen.appendChild(KayaUI.h('div', { className: 'type-footnote text-tertiary', style: 'margin-top:var(--s-2)' },
      'So Kaya can answer \u201cwhat\u2019s the weather?\u201d without asking, and set reminders in your time' +
      (_state.timezone ? ' (' + _state.timezone.replace(/_/g, ' ') + ')' : '') + '. You can skip this and tell Kaya later.'
    ));

    screen.appendChild(KayaUI.h('div', { className: 'wizard-actions' },
      KayaUI.h('button', { className: 'kaya-btn kaya-btn-primary', onClick: () => goTo('password') }, 'Continue')
    ));
  }

  function renderPassword(screen) {
    screen.appendChild(KayaUI.h('div', { className: 'wizard-title type-title' }, 'Protect your Kaya.'));
    screen.appendChild(KayaUI.h('div', { className: 'wizard-desc type-body text-secondary', style: 'margin-bottom:var(--s-6)' },
      'Create a password for accessing Kaya from this device.'
    ));

    const pwInput = KayaUI.input('Password', 'password');
    screen.appendChild(pwInput);

    const confirmInput = KayaUI.input('Confirm password', 'password');
    confirmInput.style.marginTop = 'var(--s-3)';
    screen.appendChild(confirmInput);

    screen.appendChild(KayaUI.h('div', { className: 'type-footnote text-tertiary', style: 'margin-top:var(--s-2)' },
      'At least 8 characters. A longer passphrase is easier to remember and harder to guess.'
    ));

    screen.appendChild(KayaUI.h('div', { className: 'wizard-actions' },
      KayaUI.h('button', { className: 'kaya-btn kaya-btn-primary', onClick: async () => {
        if (pwInput.value !== confirmInput.value) { KayaUI.toast('Passwords don\u2019t match.'); return; }
        if (pwInput.value.length < 8) { KayaUI.toast('Password must be at least 8 characters.'); return; }
        _state.password = pwInput.value;
        goTo('brain');
      }}, 'Continue')
    ));
  }

  function renderPreparing(screen) {
    screen.appendChild(KayaUI.h('div', { className: 'wizard-title type-title' }, 'Preparing Kaya'));
    screen.appendChild(KayaUI.h('div', { className: 'wizard-desc type-body text-secondary', style: 'margin-bottom:var(--s-6)' },
      'Your Kaya is getting ready.'
    ));

    const progress = KayaUI.h('div', { className: 'wizard-progress' });

    const items = [
      { label: 'Identity', done: false },
      { label: 'Secure access', done: false },
      { label: 'Local storage', done: false },
      { label: 'AI provider', done: false },
      { label: 'Checking system', done: false },
    ];

    for (const item of items) {
      const row = KayaUI.h('div', { className: 'wizard-progress-item' });
      row.appendChild(KayaUI.h('span', { className: 'wizard-progress-check' }, '\u2022'));
      row.appendChild(KayaUI.h('span', { className: 'type-callout' }, item.label));
      progress.appendChild(row);
    }

    screen.appendChild(progress);
    screen.appendChild(KayaUI.h('div', { className: 'type-footnote text-tertiary', style: 'margin-top:var(--s-5)' }, 'Please wait\u2026'));

    // Run setup
    setTimeout(() => runSetup(progress, items), 500);
  }

  async function runSetup(progress, items) {
    const checks = progress.children;

    // Step 1: Identity. The server answers a wrong setup code with 200 and
    // {ok:false}, so success is read from the body, not the status. Carrying
    // on after a refusal would finish the wizard with nothing configured.
    let res;
    try {
      res = await KayaAPI.post('/api/configure', {
        admin_password: _state.password,
        setup_code: _state.setupCode,
        owner_name: _state.ownerName,
        kaya_name: _state.kayaName,
        city: _state.city.trim(),
        timezone: _state.timezone,
        provider: _state.brain,
        api_key: _state.brain === 'ollama' ? '' : _state.apiKey,
      });
    } catch (e) { res = { ok: false, error: (e && e.message) || '' }; }
    if (!res || res.ok === false) {
      let msg = (res && res.error) || 'Kaya couldn\u2019t start setup.';
      try { const j = JSON.parse(msg); if (j && j.error) msg = j.error; } catch (_) { /* plain text */ }
      _state.notice = msg;
      _state.password = '';
      // A refused AI choice belongs on the AI screen; anything else (the
      // setup code above all) belongs at the start.
      const aiRefusal = /AI setup|API key|provider/i.test(msg);
      goTo(aiRefusal ? 'brain' : 'welcome');
      return;
    }
    items[0].done = true;
    checks[0].textContent = '\u2713';
    checks[0].classList.add('done');

    // Sign in silently: later setup steps save provider choices through
    // authenticated configuration calls.
    try {
      await KayaAPI.post('/api/login', { password: _state.password });
    } catch (e) { /* the final sign-in screen covers this */ }

    // Step 2: Secure access
    items[1].done = true;
    checks[1].textContent = '\u2713';
    checks[1].classList.add('done');

    // Step 3: Local storage
    items[2].done = true;
    checks[2].textContent = '\u2713';
    checks[2].classList.add('done');

    // Step 4: AI provider (validated by the server as part of the claim)
    items[3].done = true;
    checks[3].textContent = '\u2713';
    checks[3].classList.add('done');

    // Step 5: Check system
    items[4].done = true;
    checks[4].textContent = '\u2713';
    checks[4].classList.add('done');

    setTimeout(() => goTo('phone'), 800);
  }

  // The AI Kaya thinks with is chosen BEFORE the Pod is claimed, and sent in
  // the same call. A Pod claimed with no working AI cannot start its daemon,
  // so there is no honest "skip for now" here: pick a cloud key, or run on
  // this device.
  const BRAINS = [
    { key: 'deepseek', label: 'DeepSeek', note: 'Recommended. Fast and inexpensive.', cloud: true, keyUrl: 'https://platform.deepseek.com/api_keys' },
    { key: 'anthropic', label: 'Anthropic', note: 'Claude models.', cloud: true, keyUrl: 'https://console.anthropic.com/settings/keys' },
    { key: 'openai', label: 'OpenAI', note: '', cloud: true, keyUrl: 'https://platform.openai.com/api-keys' },
    { key: 'moonshot', label: 'Kimi', note: '', cloud: true, keyUrl: 'https://platform.moonshot.ai/console/api-keys' },
    { key: 'ollama', label: 'On this device', note: 'Private and offline. Slower, and less capable.', cloud: false },
  ];

  function renderBrain(screen) {
    screen.appendChild(KayaUI.h('div', { className: 'wizard-title type-title' }, 'What should Kaya think with?'));
    screen.appendChild(KayaUI.h('div', { className: 'wizard-desc type-body text-secondary', style: 'margin-bottom:var(--s-3)' },
      'Kaya needs an AI service to understand you. Pick one, make a free account with them, and copy a \u201ckey\u201d \u2014 ' +
      'a long password that lets your Kaya use that service. You pay them directly for what you use; everyday chatting is usually inexpensive. ' +
      'Not sure? Choose DeepSeek.'));
    screen.appendChild(KayaUI.h('div', { className: 'wizard-desc type-footnote text-tertiary', style: 'margin-bottom:var(--s-5)' },
      'You can change this any time under Intelligence. The key stays on this Kaya and is never shown again.'));

    if (_state.notice) {
      screen.appendChild(KayaUI.h('div', { className: 'wizard-notice', role: 'alert' }, _state.notice));
      _state.notice = '';
    }
    const list = KayaUI.h('div', { className: 'wizard-brains', role: 'radiogroup' });
    const keyWrap = KayaUI.h('div', { className: 'wizard-key' });
    const keyInput = KayaUI.input('Paste your API key', 'password');
    keyInput.value = _state.apiKey;
    keyInput.addEventListener('input', (e) => { _state.apiKey = e.target.value.trim(); });
    keyWrap.appendChild(keyInput);
    const keyHelp = KayaUI.h('div', { className: 'type-footnote text-tertiary', style: 'margin-top:var(--s-2)' });
    keyWrap.appendChild(keyHelp);
    const draw = () => {
      list.innerHTML = '';
      for (const b of BRAINS) {
        const on = _state.brain === b.key;
        const row = KayaUI.h('button', { className: 'wizard-choice' + (on ? ' on' : ''), role: 'radio', 'aria-checked': String(on), type: 'button' });
        row.appendChild(KayaUI.h('span', { className: 'wizard-choice-name' }, b.label));
        if (b.note) row.appendChild(KayaUI.h('span', { className: 'wizard-choice-note' }, b.note));
        row.addEventListener('click', () => { _state.brain = b.key; draw(); });
        list.appendChild(row);
      }
      const cur = BRAINS.find((b) => b.key === _state.brain);
      keyWrap.classList.toggle('hidden', !cur.cloud);
      keyInput.placeholder = 'Paste your ' + cur.label + ' API key';
      keyHelp.innerHTML = '';
      if (cur.keyUrl) {
        keyHelp.appendChild(KayaUI.h('a', { href: cur.keyUrl, target: '_blank', rel: 'noopener noreferrer', style: 'color:var(--accent,#2a38a6);font-weight:600;text-decoration:underline' },
          'Open ' + cur.label + ' to get your key'));
        keyHelp.appendChild(document.createTextNode(' \u2014 sign in, choose \u201cCreate API key\u201d, copy it, and come back here.'));
      }
    };
    draw();
    screen.appendChild(list);
    screen.appendChild(keyWrap);

    screen.appendChild(KayaUI.h('div', { className: 'wizard-actions' },
      KayaUI.h('button', { className: 'kaya-btn kaya-btn-primary', onClick: () => {
        const cur = BRAINS.find((b) => b.key === _state.brain);
        if (cur.cloud && !_state.apiKey) { KayaUI.toast('Paste your ' + cur.label + ' API key, or choose On this device.'); return; }
        goTo('preparing');
      }}, 'Continue')
    ));
  }

  function renderPhone(screen) {
    // Pairing codes are minted by the running gateway (Devices screen), which
    // isn't up yet at this point in setup — so this step points there
    // instead of showing a code that can't be redeemed.
    screen.appendChild(KayaUI.h('div', { className: 'wizard-title type-title' }, 'Bring your phone.'));
    screen.appendChild(KayaUI.h('div', { className: 'wizard-desc type-body text-secondary', style: 'margin-bottom:var(--s-4)' },
      'You talk to Kaya from the Kaya app on your phone, and this page is for looking after it. Connecting your phone takes about a minute:'
    ));
    const how = KayaUI.h('ol', { className: 'type-body text-secondary', style: 'margin:0 auto var(--s-6);padding-left:var(--s-5);max-width:30em;text-align:left;line-height:1.6' });
    for (const line of [
      'Install the Kaya app on your phone.',
      'Come back to this page after setup and open Devices.',
      'Choose \u201cConnect a phone\u201d, then scan the code with the app.',
      'Turn on notifications when the app asks \u2014 that\u2019s how Kaya reaches you with reminders.',
    ]) how.appendChild(KayaUI.h('li', {}, line));
    screen.appendChild(how);

    screen.appendChild(KayaUI.h('div', { className: 'wizard-actions' },
      KayaUI.h('button', { className: 'kaya-btn kaya-btn-primary kaya-btn-lg', onClick: () => goTo('done') }, 'Finish setup')
    ));
  }

  function renderDone(screen) {
    screen.appendChild(brandOrb());
    screen.appendChild(KayaUI.h('div', { className: 'wizard-title type-display' }, 'Kaya is ready.'));
    screen.appendChild(KayaUI.h('div', { className: 'wizard-desc type-body text-secondary', style: 'margin-bottom:var(--s-4)' },
      'This page is where you look after Kaya. To talk to it, use the Kaya app on your phone, or type kaya in a terminal on this machine. Once you are talking, try:'
    ));
    const tries = KayaUI.h('ul', { className: 'type-body text-secondary', style: 'margin:0 auto var(--s-6);padding-left:var(--s-5);max-width:30em;text-align:left;line-height:1.7' });
    for (const line of [
      '\u201cRemind me to call Mum tomorrow at 6.\u201d',
      '\u201cWhat\u2019s the weather like today?\u201d',
      '\u201cI\u2019m flying to Nairobi on Friday.\u201d \u2014 Kaya will remember, and offer to help.',
      '\u201cWhat do you know about me?\u201d \u2014 you can correct anything it got wrong.',
    ]) tries.appendChild(KayaUI.h('li', {}, line));
    screen.appendChild(tries);
    screen.appendChild(KayaUI.h('div', { className: 'wizard-actions' },
      KayaUI.h('button', { className: 'kaya-btn kaya-btn-primary kaya-btn-lg', onClick: () => {
        history.pushState(null, '', '/home');
        location.reload();
      }}, 'Go to Kaya')
    ));
  }

  function goTo(step) {
    _state.step = step;
    renderStep();
  }

  return { render };
})();

KayaApp.registerSection('wizard', (container) => KayaWizard.render(container));
