/* ============================================================
   Salah Board — advanced.js  (admin Advanced tab: live preview)

   Embeds the board (display/?state=normal) in a frame and posts the
   form's *unsaved* config into it whenever anything on the page changes,
   so a caretaker sees each size slider take effect immediately. Nothing
   is saved here — the normal Save button persists the config and the
   real board picks it up within a few seconds.
   ============================================================ */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const frame = $('#layout-preview');
  const box = $('#layout-preview-frame');
  if (!frame || !box) return;

  let loaded = false;
  let timer = null;

  async function push() {
    if (!loaded || !window.SBAdmin || !frame.contentWindow) return;
    try {
      const config = await window.SBAdmin.currentFormConfig();
      frame.contentWindow.postMessage({ type: 'sb-preview-config', config }, location.origin);
    } catch (e) { /* form mid-build — next change will retry */ }
  }
  // Debounced: a slider drag fires many input events.
  function schedule() { clearTimeout(timer); timer = setTimeout(push, 120); }

  const warning = $('#layout-fit-warning');
  window.addEventListener('message', e => {
    if (e.origin !== location.origin || !e.data || e.data.type !== 'sb-preview-fit') return;
    if (warning) warning.hidden = !!e.data.fits;
  });

  frame.addEventListener('load', () => { loaded = frame.src !== 'about:blank'; push(); });

  // Load the board lazily, the first time the tab is opened (it runs its own
  // 1 s tick loop — no point paying for it on the other tabs).
  document.addEventListener('sb-tab-shown', e => {
    if (e.detail.tab !== 'advanced') return;
    if (frame.src === 'about:blank' || !frame.src) frame.src = '../display/?state=normal';
    else schedule();
  });

  document.addEventListener('input', schedule);
  document.addEventListener('change', schedule);
  document.addEventListener('sb-layout-changed', schedule);

  // Landscape / portrait preview shape. The board sizes everything from the
  // screen's shorter side, so the frame's shape is what matters, not its pixels.
  document.querySelectorAll('[data-preview-shape]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-preview-shape]').forEach(b => b.classList.toggle('active', b === btn));
      box.classList.toggle('landscape', btn.dataset.previewShape === 'landscape');
      box.classList.toggle('portrait', btn.dataset.previewShape === 'portrait');
      schedule(); // re-check the fit warning for the new shape
    });
  });
})();
