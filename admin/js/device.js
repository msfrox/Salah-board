/* ============================================================
   Salah Board — device.js  (admin panel: phone QR + display control)

   Two device-level helpers that talk to serve.py on the board:
     - "Connect a phone": GET /api/whoami -> show the LAN admin URL + a QR
       (scan it to open these settings on a phone; same idea as the Android
       shell's settings overlay).
     - "Displays": POST /api/display/<mode> -> switch which screen shows the
       board (external monitor / tablet panel / both).

   Both degrade gracefully: if the endpoints aren't there (a plain dev
   server, or the Android build which has its own overlay), the buttons just
   report that the feature is only available on the board device.
   ============================================================ */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);

  const style = document.createElement('style');
  style.textContent = `
    .display-btns { display: flex; flex-wrap: wrap; gap: 8px; }
    .phone-qr { margin: 12px 0 6px; }
    .phone-qr svg { width: 180px; height: 180px; max-width: 60vw; }
    .phone-url { font-family: monospace; word-break: break-all; }
  `;
  document.head.appendChild(style);

  // ── Connect a phone: URL + QR ────────────────────────────
  const phoneBtn = $('#phone-link-btn');
  if (phoneBtn) {
    phoneBtn.addEventListener('click', async () => {
      const wrap = $('#phone-link');
      const qc = $('#phone-qr');
      const urlEl = $('#phone-url');
      qc.innerHTML = '';
      try {
        const res = await fetch('/api/whoami', { cache: 'no-store' });
        if (!res.ok) throw new Error('no endpoint');
        const info = await res.json();
        urlEl.textContent = info.adminUrl;
        if (window.qrcode) {
          const qr = window.qrcode(0, 'M');
          qr.addData(info.adminUrl);
          qr.make();
          qc.innerHTML = qr.createSvgTag({ cellSize: 5, margin: 2, scalable: true });
        }
      } catch (e) {
        urlEl.textContent =
          'Available only when running on the board device (served by serve.py). ' +
          'On this device the settings are already on screen.';
      }
      wrap.hidden = false;
    });
  }

  // ── Displays: switch which screen shows the board ────────
  document.querySelectorAll('[data-display]').forEach(b => {
    b.addEventListener('click', async () => {
      const mode = b.getAttribute('data-display');
      const status = $('#display-status');
      status.textContent = 'Switching…';
      try {
        const res = await fetch('/api/display/' + mode, { method: 'POST' });
        const j = await res.json().catch(() => ({}));
        status.textContent = (res.ok && j.ok)
          ? 'Switched to: ' + labelFor(mode)
          : 'Could not switch — ' + (j.error || j.output || 'is this the board device?');
      } catch (e) {
        status.textContent = 'Could not switch — this only works on the board device.';
      }
    });
  });

  function labelFor(mode) {
    return { external: 'external monitor only', tablet: 'tablet screen only', both: 'both (mirror)' }[mode] || mode;
  }
})();
