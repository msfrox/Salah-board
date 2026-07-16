/* ============================================================
   Salah Board — time.js  (admin Time tab)

   Corrects clock drift to the second. The display renders
   now() + config.time.offsetMs (see display/js/main.js), so nudging
   the offset moves the board immediately — no OS privileges needed.

   To show an accurate LIVE board clock even from a phone (whose own
   clock may differ from the board's), we fetch the board's wall time
   once via GET /api/time and track the skew between board and this
   device; the ticking clock is then deviceNow + skew + offset.
     - "Match this device's clock" sets offset so the board shows THIS
       device's time  ->  offset = -skew.
     - Advanced "set system clock" POSTs to /api/time (sudoers helper).
   On a plain dev server /api/time is absent: skew = 0 (admin and board
   share a browser), so everything still behaves sensibly.
   ============================================================ */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const pad2 = n => String(n).padStart(2, '0');

  let offsetMs = 0;          // config.time.offsetMs (what we edit)
  let skewMs = 0;            // boardNow - deviceNow, measured from /api/time
  let loaded = false;

  function fmtOffset(ms) {
    if (!ms) return 'no correction (0 s)';
    const sign = ms > 0 ? '+' : '−';
    const s = Math.abs(ms) / 1000;
    if (s < 60) return `${sign}${s.toFixed(s % 1 ? 1 : 0)} s`;
    const m = Math.floor(s / 60), rem = Math.round(s % 60);
    return `${sign}${m} min ${rem} s`;
  }

  function fmtClock(d) {
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
  }

  function boardNow() {
    return new Date(Date.now() + skewMs + offsetMs);
  }

  function renderLive() {
    const clock = $('#board-clock');
    if (clock) clock.textContent = fmtClock(boardNow());
    const off = $('#board-offset');
    if (off) off.textContent = 'offset ' + fmtOffset(offsetMs);
  }

  async function measureSkew() {
    try {
      const t0 = Date.now();
      const res = await fetch('/api/time', { cache: 'no-store' });
      if (!res.ok) return;
      const t1 = Date.now();
      const info = await res.json();
      // Compensate for round-trip: assume the reading is from mid-flight.
      skewMs = info.nowMs - (t0 + (t1 - t0) / 2);
    } catch (e) { /* no board server (plain dev) — skew stays 0 */ }
  }

  async function loadOffset() {
    const cfg = await window.SBAdmin.loadConfig();
    offsetMs = (cfg.time && cfg.time.offsetMs) || 0;
    loaded = true;
    renderLive();
  }

  // Persist a new offset, re-reading the latest config first so we never
  // clobber a concurrent edit made elsewhere in the form.
  async function saveOffset(newOffset) {
    offsetMs = newOffset;
    renderLive();
    const cfg = await window.SBAdmin.loadConfig();
    cfg.time = cfg.time || {};
    cfg.time.offsetMs = Math.round(offsetMs);
    cfg.time.lastSyncSource = 'manual';
    cfg.time.lastSyncISO = new Date().toISOString();
    await window.SBAdmin.persistConfig(cfg);
    status('Board clock updated.');
  }

  function status(msg) {
    const el = $('#time-status');
    if (el) el.textContent = msg;
  }

  function wire() {
    document.querySelectorAll('[data-nudge]').forEach(btn => {
      btn.addEventListener('click', () => {
        const delta = Number(btn.getAttribute('data-nudge')) * 1000;
        saveOffset(offsetMs + delta);
      });
    });
    const match = $('#time-match-btn');
    if (match) match.addEventListener('click', async () => {
      await measureSkew();               // refresh skew right before matching
      saveOffset(-skewMs);               // board shows THIS device's time
      status("Board clock matched to this device's time.");
    });
    const reset = $('#time-reset-btn');
    if (reset) reset.addEventListener('click', () => { saveOffset(0); status('Offset cleared.'); });

    const setBtn = $('#settime-btn');
    if (setBtn) setBtn.addEventListener('click', async () => {
      const v = $('#settime-input').value;   // "YYYY-MM-DDTHH:MM" or ":SS"
      if (!v) { $('#settime-status').textContent = 'Pick a date & time first.'; return; }
      const iso = v.length === 16 ? v + ':00' : v;
      $('#settime-status').textContent = 'Setting…';
      try {
        const res = await fetch('/api/time', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ iso }),
        });
        const j = await res.json().catch(() => ({}));
        $('#settime-status').textContent = (res.ok && j.ok)
          ? 'System clock set. You may want to clear the offset above.'
          : 'Could not set the clock — ' + (j.error || 'board device only, and only if the installer set it up.');
        await measureSkew();
      } catch (e) {
        $('#settime-status').textContent = 'Could not set the clock — this only works on the board device.';
      }
    });
  }

  async function init() {
    wire();
    await measureSkew();
    await loadOffset();
    setInterval(renderLive, 1000);
    // Re-measure skew occasionally so a long-open panel stays accurate.
    setInterval(measureSkew, 30000);
  }

  document.addEventListener('sb-tab-shown', e => {
    if (e.detail.tab === 'time') { measureSkew(); if (loaded) loadOffset(); }
  });

  init();
})();
