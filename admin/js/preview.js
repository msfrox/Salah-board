/* ============================================================
   Salah Board — preview.js  (admin Preview tab: dev/test states)

   Two ways to eyeball any of the display states without waiting for that time
   of day:
     • New tab (default): opens the display with the existing ?state= / ?t=
       debug params — good for a phone/dev browser.
     • "Show on the board screen": POSTs the state to serve.py /api/preview;
       the board itself polls that channel and forces the state (auto-expires
       after 5 min so the board can never get stuck). Board device only.
   ============================================================ */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);

  // Ordered to match README-designs.md's 13 states (LUHA_OPEN etc.).
  const STATES = [
    ['normal', 'Normal'],
    ['azan', 'Azan'],
    ['between', 'Between (iqamah countdown)'],
    ['iqamah', 'Iqamah (straighten rows)'],
    ['salah', 'Salah in progress'],
    ['after', 'After salah (adhkar)'],
    ['luha-wait', 'Luha wait'],
    ['luha-open', 'Luha open'],
    ['night', 'Night'],
    ['jumuah', "Jumu'ah (bayan)"],
    ['khutbah', 'Khutbah'],
  ];
  const LABELS = Object.fromEntries(STATES);
  const PREVIEW_SECONDS = 300; // board auto-reverts to live after this

  const onBoard = () => $('#preview-on-board') && $('#preview-on-board').checked;
  function setStatus(msg) { const el = $('#preview-board-status'); if (el) el.textContent = msg || ''; }

  function previewUrl(state) {
    const params = new URLSearchParams();
    if (state) params.set('state', state);
    const t = $('#preview-time') && $('#preview-time').value;
    if (t) params.set('t', t); // "YYYY-MM-DDTHH:MM" — exactly what main.js expects
    const qs = params.toString();
    return '../display/' + (qs ? '?' + qs : '');
  }

  async function postPreview(body) {
    try {
      const res = await fetch('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      return { ok: res.ok && j.ok !== false, active: j.active, error: j.error };
    } catch (e) {
      return { ok: false, error: 'board device only' };
    }
  }

  async function sendToBoard(state) {
    setStatus(`Sending "${LABELS[state] || state}" to the board…`);
    const t = ($('#preview-time') && $('#preview-time').value) || undefined;
    const r = await postPreview({ state, t, seconds: PREVIEW_SECONDS });
    if (r.ok && r.active) {
      setStatus(`Board is showing "${LABELS[state] || state}" (reverts to live in ${PREVIEW_SECONDS / 60} min). Use "Resume live board" to stop now.`);
    } else {
      setStatus('Could not preview on the board — ' + (r.error || 'board device only.'));
    }
  }

  async function resumeLive() {
    setStatus('Resuming the live board…');
    const r = await postPreview({ clear: true });
    setStatus(r.ok ? 'Board is back to live.' : 'Could not reach the board — ' + (r.error || 'board device only.'));
  }

  async function refreshStatus() {
    if (!$('#preview-board-status')) return;
    try {
      const res = await fetch('/api/preview', { cache: 'no-store' });
      const j = await res.json();
      if (j && j.active) setStatus(`Board is currently previewing "${LABELS[j.state] || j.state}" (${j.remaining}s left).`);
      else setStatus('');
    } catch (e) { /* off-board — leave status blank */ }
  }

  function syncMode() {
    const board = onBoard();
    const resume = $('#preview-resume-live');
    if (resume) resume.hidden = !board;
    if (board) refreshStatus(); else setStatus('');
  }

  function build() {
    const grid = $('#preview-grid');
    if (!grid) return;
    grid.innerHTML = STATES.map(([key, label]) =>
      `<button type="button" class="btn btn--secondary preview-btn" data-state="${key}">${label}</button>`
    ).join('');
    grid.addEventListener('click', e => {
      const btn = e.target.closest('[data-state]');
      if (!btn) return;
      const state = btn.getAttribute('data-state');
      if (onBoard()) sendToBoard(state);
      else window.open(previewUrl(state), '_blank');
    });

    const live = $('#preview-open-live');
    if (live) live.addEventListener('click', () => window.open(previewUrl(null), '_blank'));

    const resume = $('#preview-resume-live');
    if (resume) resume.addEventListener('click', resumeLive);

    const cb = $('#preview-on-board');
    if (cb) cb.addEventListener('change', syncMode);

    document.addEventListener('sb-tab-shown', e => { if (e.detail.tab === 'preview' && onBoard()) refreshStatus(); });
    syncMode();
  }

  build();
})();
