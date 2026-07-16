/* ============================================================
   Salah Board — time.js  (admin Time tab)

   ONE clock: the board's real system time. The live display reads it from
   GET /api/time (the board's own wall clock, ticked locally between fetches
   so it's smooth and timezone-correct on any phone). Every control SETS the
   device clock via POST /api/time -> settime.sh, so "what you set is the
   actual device time" — no separate display offset to reconcile.
   ============================================================ */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const pad2 = n => String(n).padStart(2, '0');

  // The board's wall time captured at the last /api/time fetch, plus the local
  // performance timestamp then, so we can tick it forward smoothly.
  let boardWallAtFetch = null;   // Date carrying the board's H:M:S/Y-M-D
  let fetchLocalMs = 0;
  let available = false;

  function isoLocal(d) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` +
           `T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
  }
  function boardNow() {
    if (!boardWallAtFetch) return new Date();
    return new Date(boardWallAtFetch.getTime() + (Date.now() - fetchLocalMs));
  }
  function status(msg) { const el = $('#time-status'); if (el) el.textContent = msg; }

  function renderLive() {
    const d = boardNow();
    const clock = $('#board-clock');
    if (clock) clock.textContent = `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
    const dateEl = $('#board-date');
    if (dateEl) dateEl.textContent = boardWallAtFetch
      ? d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
      : 'board clock unavailable here';
  }

  async function fetchBoardTime() {
    try {
      const res = await fetch('/api/time', { cache: 'no-store' });
      if (!res.ok) return;
      const info = await res.json();
      // info.iso is the board's local wall time — parse its components only.
      boardWallAtFetch = new Date(info.iso);
      fetchLocalMs = Date.now();
      available = true;
      renderLive();
    } catch (e) { available = false; }
  }

  // Set the board's OS clock to a wall-clock target (a Date whose local
  // components are the desired board time).
  async function setBoardClock(target, label) {
    status('Setting…');
    try {
      const res = await fetch('/api/time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ iso: isoLocal(target) }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.ok) {
        status(label || 'Board clock updated.');
        await fetchBoardTime();
      } else {
        status('Could not set the clock — ' + (j.error ||
          'this works on the board device once the installer has set it up.'));
      }
    } catch (e) {
      status('Could not set the clock — this only works on the board device.');
    }
  }

  function wire() {
    document.querySelectorAll('[data-nudge]').forEach(btn => {
      btn.addEventListener('click', () => {
        const delta = Number(btn.getAttribute('data-nudge')) * 1000;
        setBoardClock(new Date(boardNow().getTime() + delta), 'Board clock nudged.');
      });
    });
    const match = $('#time-match-btn');
    if (match) match.addEventListener('click', () => setBoardClock(new Date(), "Board clock matched to this device."));
    const setBtn = $('#settime-btn');
    if (setBtn) setBtn.addEventListener('click', () => {
      const v = $('#settime-input').value;      // "YYYY-MM-DDTHH:MM[:SS]"
      if (!v) { status('Pick a date & time first.'); return; }
      setBoardClock(new Date(v), 'Board clock set.');
    });
  }

  async function init() {
    wire();
    await fetchBoardTime();
    setInterval(renderLive, 1000);
    setInterval(fetchBoardTime, 30000);  // resync to the OS clock periodically
  }

  document.addEventListener('sb-tab-shown', e => { if (e.detail.tab === 'time') fetchBoardTime(); });

  init();
})();
