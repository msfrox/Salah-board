/* ============================================================
   Salah Board — osk.js  (on-screen keyboard for the admin panel)

   The masjid device usually has ONLY a mouse attached. Native
   selects, checkboxes, sliders and number/time steppers are already
   mouse-operable; the one gap is free-text fields (masjid name,
   notice text, Taraweeh note). This gives a click-only keyboard for
   exactly those, so every setting can be changed with a mouse.

   UX: the keyboard is HIDDEN by default. Focusing a text field reveals
   a floating "Show keyboard" button; the keyboard only appears when you
   press it, and "Hide keyboard" / "Done" put it away again — so it never
   traps the Save/Export buttons behind it.

   Self-contained: no dependencies, injects its own styles.
   ============================================================ */
(function () {
  'use strict';

  const isTextField = el =>
    el && !el.disabled && !el.readOnly && (
      el.tagName === 'TEXTAREA' ||
      (el.tagName === 'INPUT' &&
        ['text', 'search', 'tel', 'url', 'email', 'password', 'number'].includes(el.type))
    );

  const ROWS = [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
    ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
  ];

  // ── Styles ───────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    body.osk-open { padding-bottom: 50vh; }
    .osk {
      position: fixed; left: 0; right: 0; bottom: 0; z-index: 1000;
      background: #1f2430; padding: 8px; box-shadow: 0 -6px 24px rgba(0,0,0,.35);
      display: flex; flex-direction: column; gap: 6px;
      user-select: none; -webkit-user-select: none; touch-action: manipulation;
    }
    /* IMPORTANT: a class rule (display:flex above) beats the [hidden]
       attribute, so we must hide explicitly or the keyboard never goes away. */
    .osk[hidden] { display: none; }
    .osk-row { display: flex; gap: 6px; justify-content: center; }
    .osk-key {
      flex: 1 1 0; min-width: 0; max-width: 64px; height: 52px;
      border: none; border-radius: 8px; background: #3a4152; color: #fff;
      font-size: 20px; font-family: inherit; cursor: pointer;
    }
    .osk-key:active { background: #565f75; }
    .osk-wide { flex: 1.6 1 0; max-width: 110px; font-size: 15px; }
    .osk-space { flex: 6 1 0; max-width: none; font-size: 15px; }
    .osk-done { background: #2f7d4f; }
    .osk-done:active { background: #3c9a63; }
    .osk-key[data-act="shift"].on { background: #2b6ccb; }
    .osk-toggle {
      position: fixed; top: 10px; right: 10px; z-index: 1001;
      border: none; border-radius: 999px; padding: 10px 16px;
      background: #1f2430; color: #fff; font: inherit; font-size: 15px;
      box-shadow: 0 2px 10px rgba(0,0,0,.3); cursor: pointer;
    }
    .osk-toggle[hidden] { display: none; }
    .osk-toggle:active { background: #3a4152; }
  `;
  document.head.appendChild(style);

  // ── Keyboard DOM ─────────────────────────────────────────
  const osk = document.createElement('div');
  osk.className = 'osk';
  osk.hidden = true;
  osk.setAttribute('aria-hidden', 'true');
  const keyBtn = (label, attrs) =>
    `<button type="button" class="osk-key ${attrs.cls || ''}" ${attrs.k != null ? `data-k="${attrs.k}"` : ''} ${attrs.act ? `data-act="${attrs.act}"` : ''}>${label}</button>`;
  osk.innerHTML =
    ROWS.map(r => `<div class="osk-row">${r.map(k => keyBtn(k, { k })).join('')}</div>`).join('') +
    `<div class="osk-row">
       ${keyBtn('Shift', { act: 'shift', cls: 'osk-wide' })}
       ${keyBtn('-', { k: '-' })}${keyBtn("'", { k: "'" })}${keyBtn('.', { k: '.' })}${keyBtn(',', { k: ',' })}
       ${keyBtn('&#9003;', { act: 'back', cls: 'osk-wide' })}
     </div>
     <div class="osk-row">
       ${keyBtn('space', { k: ' ', cls: 'osk-space' })}
       ${keyBtn('Done', { act: 'done', cls: 'osk-wide osk-done' })}
     </div>`;
  document.body.appendChild(osk);

  // Floating show/hide toggle (only visible while a text field is active).
  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.className = 'osk-toggle';
  toggleBtn.hidden = true;
  toggleBtn.textContent = '⌨️  Show keyboard';
  document.body.appendChild(toggleBtn);

  let field = null;
  let visible = false;   // is the keyboard currently shown?
  let caps = false;

  // Keep the target field focused — stop the keys/toggle from stealing focus.
  osk.addEventListener('mousedown', e => e.preventDefault());
  toggleBtn.addEventListener('mousedown', e => e.preventDefault());
  toggleBtn.addEventListener('click', () => (visible ? hideKb() : showKb()));

  // ── Text editing ─────────────────────────────────────────
  function edit(fn) {
    if (!field) return;
    try {
      const s = field.selectionStart, e = field.selectionEnd;
      if (typeof s === 'number' && field.setRangeText) { fn.caret(s, e); }
      else fn.plain();
    } catch (_) { fn.plain(); }
    field.dispatchEvent(new Event('input', { bubbles: true }));
  }
  const insert = txt => edit({
    caret: (s, e) => field.setRangeText(txt, s, e, 'end'),
    plain: () => { field.value += txt; },
  });
  const backspace = () => edit({
    caret: (s, e) => (s === e && s > 0) ? field.setRangeText('', s - 1, s, 'end') : field.setRangeText('', s, e, 'end'),
    plain: () => { field.value = field.value.slice(0, -1); },
  });

  function setCaps(on) {
    caps = on;
    osk.querySelector('[data-act="shift"]').classList.toggle('on', caps);
    osk.querySelectorAll('.osk-key[data-k]').forEach(b => {
      const k = b.dataset.k;
      if (/^[a-z]$/i.test(k)) b.textContent = caps ? k.toUpperCase() : k.toLowerCase();
    });
  }

  osk.addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === 'done') { if (field) field.dispatchEvent(new Event('change', { bubbles: true })); hideKb(); return; }
    if (act === 'back') return backspace();
    if (act === 'shift') return setCaps(!caps);
    let k = btn.dataset.k;
    if (k == null) return;
    if (caps && /^[a-z]$/.test(k)) k = k.toUpperCase();
    insert(k);
  });

  // ── Show / hide ──────────────────────────────────────────
  function scrollFieldAboveKb() {
    if (!field || osk.hidden) return;
    const kbTop = osk.getBoundingClientRect().top;
    const r = field.getBoundingClientRect();
    const overlap = r.bottom - (kbTop - 12);
    if (overlap > 0) window.scrollBy({ top: overlap, behavior: 'smooth' });
  }
  function showKb() {
    if (!field) return;             // nothing to type into
    visible = true;
    osk.hidden = false;
    document.body.classList.add('osk-open');
    toggleBtn.textContent = '⌨️  Hide keyboard';
    requestAnimationFrame(scrollFieldAboveKb);
  }
  function hideKb() {
    visible = false;
    osk.hidden = true;
    document.body.classList.remove('osk-open');
    toggleBtn.textContent = '⌨️  Show keyboard';
  }

  // ── Focus tracking — reveal the toggle, but DON'T auto-open ──
  function attach(el) {
    field = el;
    toggleBtn.hidden = false;
    if (visible) requestAnimationFrame(scrollFieldAboveKb); // keep showing for the new field
  }
  function detach() {
    field = null;
    toggleBtn.hidden = true;
    if (visible) hideKb();
  }

  document.addEventListener('focusin', e => {
    if (isTextField(e.target)) attach(e.target);
    else if (e.target !== toggleBtn && !osk.contains(e.target)) detach();
  });

  // Expose for debugging / tests
  window.SBOsk = { showKb, hideKb, attach, detach, isVisible: () => visible };
})();
