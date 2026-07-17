/* ============================================================
   Salah Board — main.js
   Boot + single 1s tick loop. Wires config.js + engine.js +
   state.js + ui.js together. Debug params (?t= ?state= ?zone=)
   are parsed once here per docs/MILESTONES.md M1's "How to work".
   ============================================================ */
(function () {
  'use strict';

  const root = document.getElementById('screen-root');
  const nightOverlay = document.getElementById('night-overlay');

  const dbg = SBConfig.debugParams();

  // Fake clock: anchors to ?t= but keeps ticking forward with real
  // elapsed time, so transitions can still be watched live.
  let fakeBase = null, realBase = 0;
  if (dbg.t) {
    const parsed = new Date(dbg.t);
    if (!isNaN(parsed.getTime())) { fakeBase = parsed; realBase = Date.now(); }
  }
  // Live preview channel (admin "Preview" tab → serve.py /api/preview). When a
  // caretaker pushes a state to the BOARD, `preview` holds {state, tMs?, base}
  // and the board forces that state (and optional fake clock) until it expires.
  // Null on a plain dev server (endpoint 404s) — harmless.
  let preview = null;
  let lastPreviewSig = null;

  // The board shows the real device clock — a single source of truth. The
  // admin Time tab adjusts the actual OS clock (not a display-only offset), so
  // there is never a second "board time" to reconcile. The ?t= fake clock is
  // the only exception, and only for dev/QA. A live preview with its own ?t=
  // takes precedence while active.
  function now() {
    if (preview && preview.tMs != null) return new Date(preview.tMs + (Date.now() - preview.base));
    if (fakeBase) return new Date(fakeBase.getTime() + (Date.now() - realBase));
    return new Date();
  }

  let config = SBConfig.getConfig(); // sync default so applyScale()/render() never see undefined before boot() resolves
  let contentByLang = {};
  let contentPack = {}; // primary-language content, en-fallback-merged — cached, rebuilt only on (re)load
  let timeline = null;
  let timelineDateKey = null;

  function dateKey(d) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }

  function applyScale() {
    document.documentElement.style.setProperty('--sb-scale', config.display.scale);
  }

  // Selectable modern UI font (config.display.font) — becomes the first
  // family in the theme's --sb-font stack, so Latin uses it and the bundled
  // Noto faces still cover Sinhala/Tamil/Arabic. See display/fonts/fonts.css.
  const UI_FONTS = {
    'google-sans-flex': "'Google Sans Flex'",
    'manrope': "'Manrope'",
    'figtree': "'Figtree'",
    'noto': "'Salah Sans'",
  };
  function applyFont() {
    const f = UI_FONTS[(config.display && config.display.font)] || UI_FONTS['google-sans-flex'];
    document.documentElement.style.setProperty('--sb-font-ui', f);
  }

  // Themes are plain CSS folders (docs/MILESTONES.md M5) — swapping the
  // stylesheet href is the entire mechanism, no JS per theme. 'highcontrast'
  // was renamed to 'default'; keep old saved configs working transparently.
  let currentTheme = null;
  function applyTheme() {
    let theme = config.theme || 'default';
    if (theme === 'highcontrast') theme = 'default';
    if (theme === currentTheme) return;
    currentTheme = theme;
    document.getElementById('theme-css').href = `./themes/${theme}/theme.css`;
  }

  async function loadContent() {
    const wanted = Array.from(new Set([...(config.masjid.languages || []), 'en']));
    const entries = await Promise.all(wanted.map(async lang => {
      try {
        const res = await fetch(`./content/${lang}.json`);
        if (!res.ok) throw new Error('missing content pack: ' + lang);
        return [lang, await res.json()];
      } catch (e) {
        return [lang, {}];
      }
    }));
    contentByLang = Object.fromEntries(entries);
    contentPack = SBUi.primaryContent(contentByLang, config);
  }

  async function ensureTimeline(n) {
    const key = dateKey(n);
    if (timeline && timelineDateKey === key) return;
    timeline = await SBEngine.loadTimeline(config.zone, n, config);
    timelineDateKey = key;
  }

  async function reloadConfig() {
    config = await SBConfig.getConfigAsync();
    applyScale();
    applyFont();
    applyTheme();
    timeline = null;
    timelineDateKey = null;
    await Promise.all([loadContent(), ensureTimeline(now())]);
  }

  // Admin panel (M2) writes localStorage in another tab; `storage`
  // fires here so the display updates live without a manual reload.
  window.addEventListener('storage', e => {
    if (e.key === SBConfig.STORAGE_KEY) reloadConfig();
  });

  // Server-backed config (Linux kiosk / Android shell): a save from a *phone*
  // hits /api/config on the board, which the `storage` event above can't see
  // (different browser). Poll the stored config and reload on any change, so
  // phone edits show on the board within a few seconds. Falls back to the same
  // localStorage read on a plain dev server, so this is harmless there too.
  let lastConfigJson = null;
  async function pollConfig() {
    try {
      const stored = await SBConfig.getStoredAsync();
      const json = JSON.stringify(stored);
      if (lastConfigJson === null) { lastConfigJson = json; return; }
      if (json !== lastConfigJson) { lastConfigJson = json; await reloadConfig(); }
    } catch (e) { /* transient fetch error — try again next tick */ }
  }

  // Poll the preview channel; re-anchor the fake clock only when the directive
  // actually changes, so a preview with ?t= keeps advancing smoothly instead of
  // jumping back to `t` on every poll.
  async function pollPreview() {
    try {
      const res = await fetch('/api/preview', { cache: 'no-store' });
      if (!res.ok) { if (preview) { preview = null; lastPreviewSig = null; } return; }
      const p = await res.json();
      if (!p || !p.active) { if (preview) { preview = null; lastPreviewSig = null; } return; }
      const sig = (p.state || '') + '|' + (p.t || '');
      if (sig !== lastPreviewSig) {
        lastPreviewSig = sig;
        const tMs = p.t ? Date.parse(p.t) : NaN;
        preview = { state: p.state || null, tMs: isNaN(tMs) ? null : tMs, base: Date.now() };
      }
    } catch (e) { /* not on the board / transient — leave current preview state */ }
  }

  let ticking = false;
  async function tick() {
    if (ticking) return; // guard against overlapping async ticks at a date rollover
    ticking = true;
    try {
      const n = now();
      await ensureTimeline(n);
      let result = SBState.resolve(config, timeline, n, contentPack);
      // A live preview (board) or ?state= (dev URL) forces the shown state.
      const forced = (preview && preview.state) || dbg.state;
      if (forced) result = SBState.forceState(result, forced);
      SBUi.render(root, result, config, contentByLang);
      SBUi.applyNightDim(nightOverlay, result.state === 'NIGHT' && config.night.dim, config.night.brightness);
    } finally {
      ticking = false;
    }
  }

  async function boot() {
    config = await SBConfig.getConfigAsync();
    applyScale();
    applyFont();
    applyTheme();
    await Promise.all([loadContent(), ensureTimeline(now())]);
    await tick();
    lastConfigJson = JSON.stringify(await SBConfig.getStoredAsync());
    setInterval(tick, 1000); // single interval for the app's lifetime — no leaks
    setInterval(pollConfig, 3000); // pick up phone/admin saves on the board
    setInterval(pollPreview, 2000); // pick up admin "show on board" previews
  }

  boot();
})();
