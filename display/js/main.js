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
  function now() {
    return fakeBase ? new Date(fakeBase.getTime() + (Date.now() - realBase)) : new Date();
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

  // Themes are plain CSS folders (docs/MILESTONES.md M5) — swapping the
  // stylesheet href is the entire mechanism, no JS per theme.
  let currentTheme = null;
  function applyTheme() {
    const theme = config.theme || 'classic';
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

  let ticking = false;
  async function tick() {
    if (ticking) return; // guard against overlapping async ticks at a date rollover
    ticking = true;
    try {
      const n = now();
      await ensureTimeline(n);
      let result = SBState.resolve(config, timeline, n, contentPack);
      if (dbg.state) result = SBState.forceState(result, dbg.state);
      SBUi.render(root, result, config, contentByLang);
      SBUi.applyNightDim(nightOverlay, result.state === 'NIGHT' && config.night.dim, config.night.brightness);
    } finally {
      ticking = false;
    }
  }

  async function boot() {
    config = await SBConfig.getConfigAsync();
    applyScale();
    applyTheme();
    await Promise.all([loadContent(), ensureTimeline(now())]);
    await tick();
    setInterval(tick, 1000); // single interval for the app's lifetime — no leaks
  }

  boot();
})();
