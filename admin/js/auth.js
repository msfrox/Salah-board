/* ============================================================
   Salah Board — auth.js  (caretaker PIN lock for the settings page)

   The board's server (deploy/serve.py + pinauth.py) asks for a PIN on
   every settings route. This file shows the lock screen:
     - no PIN set yet  -> "Set a PIN" (two fields)
     - PIN set, locked -> "Enter the PIN"
   with a click keypad, because the board often has only a mouse.
   Any /api/ call that comes back 401 brings the lock screen back
   (session ended). Off the board (plain static server, no /api/auth)
   it does nothing, so browser-dev keeps working.
   Also wires the header "Lock" button and the "Settings PIN" card.
   ============================================================ */
(function () {
  'use strict';

  const OPEN = ['/api/login', '/api/pin', '/api/auth', '/api/logout'];
  let onBoard = false;   // true once /api/auth answered: the PIN applies
  let shown = false;

  // ── Styles ───────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    .lock { position: fixed; inset: 0; z-index: 2000; background: var(--a-bg, #f5f6f8);
      display: flex; align-items: center; justify-content: center; padding: 16px; overflow: auto; }
    .lock[hidden] { display: none; }
    .lock-card { background: var(--a-card, #fff); border: 1px solid var(--a-border, #dde1e7);
      border-radius: var(--a-radius, 12px); padding: 24px; width: 100%; max-width: 380px;
      box-shadow: 0 8px 30px rgba(0,0,0,.08); }
    .lock-card h2 { margin: 0 0 .4rem; font-size: 1.3rem; }
    .lock-card p { margin: 0 0 1rem; color: var(--a-fg-dim, #5b6472); font-size: .92rem; line-height: 1.4; }
    .lock-card input { width: 100%; box-sizing: border-box; font-size: 1.6rem; letter-spacing: .4em;
      text-align: center; padding: .5rem; border: 1px solid var(--a-border, #dde1e7);
      border-radius: 8px; margin-bottom: .6rem; font-family: inherit; }
    .lock-card input.lock-active, .lock-card input:focus { outline: 2px solid var(--a-accent, #1f7a4d); }
    .lock-keys { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: .4rem 0 1rem; }
    .lock-keys button { font-size: 1.4rem; padding: .7rem 0; border-radius: 8px; cursor: pointer;
      border: 1px solid var(--a-border, #dde1e7); background: var(--a-bg, #f5f6f8); color: inherit; font-family: inherit; }
    .lock-keys button:active { background: var(--a-accent-dim, #e6f3ec); }
    .lock-msg { min-height: 1.3em; color: var(--a-danger, #b3261e); font-size: .92rem; margin: 0 0 .6rem; }
    .lock-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: space-between; }
    .lock-actions .btn { flex: 1; }
    .lock-card .btn:disabled { opacity: .45; cursor: not-allowed; }
    .lock-help { margin-top: 1rem !important; font-size: .82rem !important; }
  `;
  document.head.appendChild(style);

  // ── Lock screen ──────────────────────────────────────────
  const root = document.createElement('div');
  root.className = 'lock';
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.innerHTML = `
    <form class="lock-card" autocomplete="off" novalidate>
      <h2 id="lock-title">Settings are locked</h2>
      <p id="lock-text"></p>
      <input type="password" inputmode="numeric" maxlength="12" id="lock-pin" aria-label="PIN">
      <input type="password" inputmode="numeric" maxlength="12" id="lock-pin2" aria-label="PIN again" placeholder="again" hidden>
      <div class="lock-keys" id="lock-keys"></div>
      <p class="lock-msg" id="lock-msg" role="alert"></p>
      <div class="lock-actions">
        <a href="../display/" class="btn btn--secondary">&larr; Display</a>
        <button type="submit" class="btn btn--primary" id="lock-go">Unlock</button>
      </div>
      <p class="lock-help">Forgot the PIN? It can be cleared only at the board itself, by whoever
        installed it: see "Settings PIN" in the caretaker guide.</p>
    </form>`;
  document.body.appendChild(root);

  const $ = s => root.querySelector(s);
  const pin = $('#lock-pin'), pin2 = $('#lock-pin2'), msg = $('#lock-msg'), go = $('#lock-go');
  let mode = 'login';      // 'login' | 'set'
  let target = pin;
  let waitTimer = null;

  ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', '⌫'].forEach(k => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = k === 'clear' ? 'Clear' : k;
    if (k === 'clear') b.style.fontSize = '1rem';
    b.addEventListener('mousedown', e => e.preventDefault()); // keep focus in the field
    b.addEventListener('click', () => {
      if (k === 'clear') target.value = '';
      else if (k === '⌫') target.value = target.value.slice(0, -1);
      else if (target.value.length < 12) target.value += k;
      if (mode === 'set' && target === pin && pin.value.length >= 12) aim(pin2);
    });
    $('#lock-keys').appendChild(b);
  });
  function aim(el) {
    target = el;
    pin.classList.toggle('lock-active', el === pin);
    pin2.classList.toggle('lock-active', el === pin2);
  }
  [pin, pin2].forEach(el => ['focus', 'click'].forEach(ev => el.addEventListener(ev, () => aim(el))));

  function waitFor(seconds) {
    clearInterval(waitTimer);
    let left = seconds;
    const tick = () => {
      if (left <= 0) { clearInterval(waitTimer); go.disabled = false; msg.textContent = ''; return; }
      go.disabled = true;
      msg.textContent = `Too many wrong PINs. Try again in ${left} s.`;
      left -= 1;
    };
    tick();
    waitTimer = setInterval(tick, 1000);
  }

  function show(asMode, wait) {
    mode = asMode;
    shown = true;
    pin.value = ''; pin2.value = '';
    pin2.hidden = mode !== 'set';
    $('#lock-title').textContent = mode === 'set' ? 'Set a settings PIN' : 'Settings are locked';
    $('#lock-text').textContent = mode === 'set'
      ? 'Choose 6 to 12 digits and type them twice. Until a PIN is set, anyone on the masjid WiFi can change this board. Keep the PIN with the masjid committee.'
      : 'Enter the caretaker PIN to change the board’s settings.';
    go.textContent = mode === 'set' ? 'Save PIN' : 'Unlock';
    msg.textContent = '';
    go.disabled = false;
    root.hidden = false;
    document.body.style.overflow = 'hidden';
    aim(pin);
    pin.focus();
    if (wait > 0) waitFor(wait);
  }

  async function post(path, body) {
    const res = await fetch(path, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    const j = await res.json().catch(() => ({}));
    return { status: res.status, ok: res.ok && j.ok, ...j };
  }

  root.querySelector('form').addEventListener('submit', async e => {
    e.preventDefault();
    if (go.disabled) return;
    if (mode === 'set') {
      if (!/^\d{6,12}$/.test(pin.value)) { msg.textContent = 'The PIN must be 6 to 12 digits.'; return; }
      if (pin.value !== pin2.value) { msg.textContent = 'The two PINs are different.'; pin2.value = ''; aim(pin2); return; }
    }
    go.disabled = true;
    try {
      const r = mode === 'set' ? await post('/api/pin', { pin: pin.value })
                               : await post('/api/login', { pin: pin.value });
      if (r.ok) { location.reload(); return; }
      go.disabled = false;
      if (r.status === 409) { show('set'); return; }       // PIN was reset meanwhile
      if (r.status === 401 && r.pinSet === true && mode === 'set') { show('login'); return; }
      pin.value = ''; pin2.value = '';
      if (r.waitSeconds > 0) waitFor(r.waitSeconds);
      else msg.textContent = r.error || 'That did not work. Try again.';
    } catch (err) {
      go.disabled = false;
      msg.textContent = 'Cannot reach the board.';
    }
  });

  // ── Session ended mid-use -> lock screen again ───────────
  const realFetch = window.fetch.bind(window);
  window.fetch = async function (input, init) {
    const res = await realFetch(input, init);
    if (res.status === 401 && onBoard && !shown) {
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      const path = new URL(url, location.href).pathname;
      if (path.startsWith('/api/') && !OPEN.includes(path)) {
        res.clone().json().then(j => show(j.pinSet === false ? 'set' : 'login', 0)).catch(() => show('login', 0));
      }
    }
    return res;
  };

  // ── Header "Lock" button + "Settings PIN" card ───────────
  function wireExtras() {
    const lockBtn = document.getElementById('lock-btn');
    if (lockBtn) {
      lockBtn.hidden = false;
      lockBtn.addEventListener('click', async () => {
        try { await post('/api/logout'); } catch (e) { /* fall through */ }
        location.reload();
      });
    }
    const card = document.getElementById('pin-card');
    if (!card) return;
    card.hidden = false;
    const status = document.getElementById('pin-status');
    document.getElementById('pin-change').addEventListener('click', async () => {
      const cur = document.getElementById('pin-current').value;
      const a = document.getElementById('pin-new').value;
      const b = document.getElementById('pin-new2').value;
      if (!/^\d{6,12}$/.test(a)) { status.textContent = 'The new PIN must be 6 to 12 digits.'; return; }
      if (a !== b) { status.textContent = 'The two new PINs are different.'; return; }
      const r = await post('/api/pin', { pin: a, current: cur }).catch(() => ({ error: 'Cannot reach the board.' }));
      ['pin-current', 'pin-new', 'pin-new2'].forEach(id => { document.getElementById(id).value = ''; });
      status.textContent = r.ok
        ? 'PIN changed. Every other phone or screen now has to enter the new PIN.'
        : (r.waitSeconds > 0 ? `Too many wrong PINs. Try again in ${r.waitSeconds} s.` : (r.error || 'Not changed.'));
    });
  }

  // ── Start ────────────────────────────────────────────────
  realFetch('/api/auth', { cache: 'no-store' })
    .then(res => (res.ok ? res.json() : null))
    .then(info => {
      if (!info || typeof info.pinSet !== 'boolean') return; // not on the board server
      onBoard = true;
      if (!info.pinSet) show('set', 0);
      else if (!info.loggedIn) show('login', info.waitSeconds || 0);
      else wireExtras();
    })
    .catch(() => { /* browser-dev: no board server, no PIN */ });

  window.SBAuth = { isOnBoard: () => onBoard };
})();
