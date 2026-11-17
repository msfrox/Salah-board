/* ============================================================
   Salah Board — config.js
   Defaults (mirrors docs/CONFIG-SCHEMA.md exactly) + localStorage
   persistence + debug-param overrides. Browser-dev storage only;
   Android (M3+) will swap the load/save internals for /api/config
   without changing the public shape.
   ============================================================ */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'sb_config';

  // ── Every element a caretaker can resize (admin → Advanced) ──────────
  // The single source of truth: config defaults, the admin sliders and the
  // display's zoom rules (main.js injects `selector { zoom: var(--sb-z-key) }`)
  // are all generated from this list. `store` says where the size lives:
  // layout.normal.sizes (NORMAL screen) or layout.screens.sizes (the rest).
  // `state` is the screen the admin preview switches to for that group.
  // masjidName has no selector: ui.js scales it (its auto-fit measures it).
  const LAYOUT_GROUPS = [
    { id: 'normal', title: 'Normal screen', state: 'normal', store: 'normal', items: [
      { key: 'masjidName', label: 'Masjid name (still auto-shrinks to fit on one line)' },
      { key: 'dates', label: 'Dates (Gregorian · Hijri)', selector: '.screen--normal .dates' },
      { key: 'clock', label: 'Clock', selector: '.screen--normal .clock-big' },
      { key: 'nextLabel', label: '"Next prayer" label', selector: '.screen--normal .np-label' },
      { key: 'nextName', label: 'Next prayer name', selector: '.screen--normal .np-name' },
      { key: 'timeLabels', label: '"Azan" / "Iqamah" labels', selector: '.screen--normal .np-time-label' },
      { key: 'prayerTimes', label: 'Azan & iqamah times (big numbers)', selector: '.screen--normal .np-time' },
      { key: 'countdown', label: 'Countdown to azan', selector: '.screen--normal .np-countdown' },
      { key: 'ttLabels', label: 'Timetable — prayer names', selector: '.screen--normal .tt-label' },
      { key: 'ttTimes', label: 'Timetable — times', selector: '.screen--normal .tt-time' },
      { key: 'jumuahBanner', label: "Jumu'ah banner (Fridays)", selector: '.screen--normal .jumuah-day-banner' },
      { key: 'pinnedBanner', label: 'Pinned (high-priority) notice', selector: '.screen--normal .pinned-banner' },
      { key: 'ramadanBlock', label: 'Ramadan Imsak / Iftar', selector: '.screen--normal .ramadan-block' },
      { key: 'cards', label: 'Rotating notice cards', selector: '.screen--normal .card--notice, .screen--normal .card--etiquette' },
    ] },
    { id: 'clock', title: 'Time on all other screens', state: 'azan', store: 'screens', items: [
      { key: 'cornerClock', label: 'Corner clock (Azan, Iqamah, Luha, Jumu\'ah…)', selector: '.corner-clock' },
    ] },
    { id: 'azan', title: 'Azan', state: 'azan', store: 'screens', items: [
      { key: 'azanTitle', label: '"Azan — prayer" title', selector: '.screen--azan .azan-banner' },
      { key: 'azanReply', label: 'Reply-to-muadhin reminder', selector: '.screen--azan .reminder-text' },
      { key: 'azanArabic', label: 'Arabic text', selector: '.screen--azan .arabic' },
      { key: 'azanTranslation', label: 'Translations', selector: '.screen--azan .translation' },
      { key: 'azanDuaTitle', label: '"Dua after the Azan" heading', selector: '.screen--azan .azan-dua h3' },
      { key: 'azanIcon', label: 'Phones-off icon', selector: '.screen--azan .phones-silent-icon' },
    ] },
    { id: 'between', title: 'Iqamah countdown', state: 'between', store: 'screens', items: [
      { key: 'iqamahLabel', label: '"Iqamah" label', selector: '.icd-label' },
      { key: 'iqamahCountdown', label: 'Countdown', selector: '.icd-countdown' },
      { key: 'betweenReminder', label: 'Reminder text', selector: '.between-reminder' },
      { key: 'betweenArabic', label: 'Dua — Arabic', selector: '.screen--between .arabic' },
      { key: 'betweenTranslation', label: 'Dua — translation', selector: '.screen--between .translation, .screen--between .dua-text' },
      { key: 'sunnahReminder', label: 'Sunnah prayer reminder', selector: '.sunnah-reminder' },
    ] },
    { id: 'iqamah', title: '"Straighten the rows" (Iqamah)', state: 'iqamah', store: 'screens', items: [
      { key: 'iqamahTitle', label: 'Title', selector: '.iqamah-title' },
      { key: 'iqamahLines', label: 'Reminder lines', selector: '.iqamah-lines' },
    ] },
    { id: 'salah', title: 'Salah in progress', state: 'salah', store: 'screens', items: [
      { key: 'salahClock', label: 'Clock', selector: '.salah-clock' },
      { key: 'salahLine', label: '"Salah in progress" line', selector: '.salah-line' },
    ] },
    { id: 'after', title: 'After salah (adhkar)', state: 'after', store: 'screens', items: [
      { key: 'afterArabic', label: 'Arabic text', selector: '.screen--after .arabic' },
      { key: 'afterText', label: 'Translation', selector: '.screen--after .translation, .screen--after .dua-text' },
    ] },
    { id: 'luha', title: 'Luha countdown', state: 'luha-wait', store: 'screens', items: [
      { key: 'luhaLabel', label: '"Luha" label', selector: '.screen--luha-wait .countdown-label' },
      { key: 'luhaCountdown', label: 'Countdown', selector: '.screen--luha-wait .countdown' },
    ] },
    { id: 'luhaOpen', title: 'Luha time has begun', state: 'luha-open', store: 'screens', items: [
      { key: 'luhaOpen', label: 'Message', selector: '.luha-open-card' },
    ] },
    { id: 'night', title: 'Night', state: 'night', store: 'screens', items: [
      { key: 'nightClock', label: 'Clock', selector: '.night-clock' },
      { key: 'nightFajr', label: "Tomorrow's Fajr", selector: '.night-next-fajr' },
    ] },
    { id: 'jumuah', title: "Jumu'ah sunnah & bayan", state: 'jumuah', store: 'screens', items: [
      { key: 'bayanTitle', label: '"Bayan in progress" / "Sunnah prayer"', selector: '.jumuah-banner' },
      { key: 'bayanSpeaker', label: 'Speaker', selector: '.jumuah-speaker' },
      { key: 'bayanTopic', label: 'Topic / sunnah reminder', selector: '.jumuah-topic' },
      { key: 'bayanTimes', label: 'Times & minutes left', selector: '.jumuah-times, .jumuah-countdown' },
      { key: 'jumuahQuiet', label: '"Switch off your phones · remain silent"', selector: '.screen--jumuah .jm-quiet' },
    ] },
    { id: 'khutbah', title: 'Khutbah', state: 'khutbah', store: 'screens', items: [
      { key: 'khutbahTitle', label: '"Khutbah in progress"', selector: '.khutbah-title' },
      { key: 'khutbahLine', label: '"Remain silent"', selector: '.khutbah-line' },
      { key: 'khutbahQuiet', label: '"Switch off your phones"', selector: '.screen--khutbah .jm-quiet' },
    ] },
  ];

  // ── Background pattern + glow (default theme) ─────────────────────────
  // Per screen (keys = LAYOUT_GROUPS ids):
  //   visibility 0–100, size 50–200 % — the masjid's rosette;
  //   glow 0–100 — a soft glow of the screen's colour behind its content
  //     (the khutbah screen's look, available on every screen);
  //   custom false → pattern + glow use the screen's own text colour
  //     (theme.css), true → hue 0–360 + saturation 0–100 instead.
  // Defaults follow the design: clear on the main and information screens,
  // faint on the calm Jumu'ah ones, barely there on salah and night.
  const pg = (visibility, glow) => ({ visibility, size: 100, glow, custom: false, hue: 40, saturation: 55 });
  const PATTERN_DEFAULTS = {
    pages: {
      normal:   pg(45, 10),
      azan:     pg(35, 25),
      between:  pg(35, 30),
      iqamah:   pg(35, 35),
      salah:    pg(5, 0),
      after:    pg(35, 25),
      luha:     pg(35, 30),
      luhaOpen: pg(35, 35),
      night:    pg(10, 0),
      jumuah:   pg(15, 25),
      khutbah:  pg(10, 40),
    },
  };
  // Alpha at 100 — "as strong as it should ever get" (a full-strength
  // stencil or glow would compete with the text).
  const PATTERN_MAX_ALPHA = 0.5;
  const GLOW_MAX_ALPHA = 0.45;

  function layoutSizeDefaults(store) {
    const out = {};
    LAYOUT_GROUPS.filter(g => g.store === store).forEach(g => g.items.forEach(i => { out[i.key] = 100; }));
    return out;
  }

  // Older saved configs had one "banners" size for all three NORMAL banners.
  // "1:00 PM" ± minutes → "12:53 PM" (config-only helper; the engine isn't
  // loaded yet when the display reads its config).
  function shiftAmpm(str, minutes) {
    const m = /^\s*(\d{1,2}):(\d{2})\s*([AP]M)\s*$/i.exec(String(str || ''));
    if (!m) return null;
    let h = Number(m[1]) % 12 + (m[3].toUpperCase() === 'PM' ? 12 : 0);
    let t = ((h * 60 + Number(m[2]) + minutes) % 1440 + 1440) % 1440;
    h = Math.floor(t / 60);
    const ap = h < 12 ? 'AM' : 'PM';
    return `${h % 12 === 0 ? 12 : h % 12}:${String(t % 60).padStart(2, '0')} ${ap}`;
  }

  function migrateStored(stored) {
    const s = stored && stored.layout && stored.layout.normal && stored.layout.normal.sizes;
    if (s && s.banners !== undefined) {
      ['jumuahBanner', 'pinnedBanner', 'ramadanBlock'].forEach(k => { if (s[k] === undefined) s[k] = s.banners; });
      delete s.banners;
    }
    // Jumu'ah settings history (keep old saved configs working):
    // For a short while (Nov 2026) the khutbah START was stored instead of the
    // iqamah; iqamah is the fixed time again → iqamah = khutbah + length, so a
    // masjid's iqamah never moves on upgrade.
    const j = stored && stored.jumuah;
    if (j) {
      // The bayan is a fixed TIME again (it was on/off for a few days):
      // on → the default 12:15 PM, off → null (no bayan).
      if (j.bayan === true) j.bayan = '12:15 PM';
      else if (j.bayan === false) j.bayan = null;
      if (typeof j.khutbah === 'string') {
        if (typeof j.iqamah !== 'string') {
          const len = Number(j.khutbahMinutes) > 0 ? Number(j.khutbahMinutes) : 7;
          const iq = shiftAmpm(j.khutbah, len);
          if (iq) { j.iqamah = iq; j.khutbahMinutes = len; }
        }
        delete j.khutbah;
      }
    }
    return stored;
  }

  function defaults() {
    return {
      configVersion: 1,
      masjid: {
        name: '',
        languages: ['en'],
      },
      zone: '01',            // ACJU Zone 01 = Colombo / Gampaha / Kalutara
      theme: 'default',
      display: { scale: 1.0, font: 'google-sans-flex' },
      clock: { format: '12h', showSeconds: true },
      hijri: { offsetDays: 0, flipAtMaghrib: true },

      iqamah: {
        fajr:   { mode: 'offset', minutes: 30, round: 5 },
        luhr:   { mode: 'offset', minutes: 20, round: 5 },
        asr:    { mode: 'offset', minutes: 20, round: 5 },
        magrib: { mode: 'offset', minutes: 10, round: 0 },
        isha:   { mode: 'fixed', time: '7:15 PM' },
      },

      screens: {
        azan: 5,
        iqamahWarning: 2,
        after: 10,
        salahDuration: { fajr: 10, luhr: 10, asr: 10, magrib: 10, isha: 12 },
      },

      // Friday sequence: azan (that Friday's luhr time) → azan screen →
      // sunnah reminder → bayan → khutbah (khutbahMinutes, ending at the
      // fixed iqamah) → iqamah. The bayan starts at its set time, or after
      // the azan screen + sunnahMinutes if that's later (late-azan months);
      // the iqamah never moves. Khutbah start = iqamah − khutbahMinutes.
      jumuah: {
        enabled: true,
        bayan: '12:15 PM',       // bayan start time; null = no bayan
        sunnahMinutes: 5,        // at least this much sunnah time after the azan screen
        iqamah: '1:00 PM',       // fixed set time
        khutbahMinutes: 7,       // khutbah length → khutbah starts at iqamah − this
        salahDuration: 15,
        // Who gives the bayan and on what — shown in the "Jumu'ah today"
        // banner and on the bayan screen, until Jumu'ah salah ends.
        bayanSpeaker: '',
        bayanTopic: '',
        bayanDate: null,         // optional ISO date: only show on that Friday
      },

      // enabled: full-screen "Luha in MM:SS" countdown from sunrise.
      // showOnMain: after Fajr, the main screen's next prayer is Luha, with
      // Sunrise | Luha (sunrise + waitAfterSunrise) as its two big times.
      luha: { enabled: true, showOnMain: true, waitAfterSunrise: 20 },

      ramadan: {
        enabled: false,
        showImsak: true,
        iqamahOverrides: {
          magrib: { mode: 'offset', minutes: 20, round: 0 },
        },
        taraweehNote: {},
      },

      night: {
        dim: true,
        afterIshaMinutes: 60,
        beforeFajrMinutes: 45,
        brightness: 10,
      },

      notices: [],

      rotation: {
        seconds: 20,
        cards: ['timetable', 'notices', 'jumuah-etiquette'],
      },

      // Per-board fine-tuning (admin → Advanced). sizes: percent of the
      // theme's own size (100 = unchanged), 50–250, one per element in
      // LAYOUT_GROUPS above. show (NORMAL only): false hides that element.
      layout: {
        screens: { sizes: layoutSizeDefaults('screens') },
        normal: {
          sizes: layoutSizeDefaults('normal'),
          show: {
            masjidName: true, dates: true, nextLabel: true, countdown: true,
            timetable: true, cards: true,
          },
        },
        pattern: JSON.parse(JSON.stringify(PATTERN_DEFAULTS)),
      },

      time: {
        offsetMs: 0,
        ntpEnabled: true,
        lastSyncISO: null,
        lastSyncSource: null,
      },
    };
  }

  function isPlainObject(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
  }

  // Deep-merge `patch` onto `base`, patch wins on conflicts. Arrays and
  // primitives are replaced wholesale (config never partial-patches arrays).
  function deepMerge(base, patch) {
    if (!isPlainObject(base) || !isPlainObject(patch)) return patch === undefined ? base : patch;
    const out = Object.assign({}, base);
    for (const k of Object.keys(patch)) {
      out[k] = isPlainObject(base[k]) && isPlainObject(patch[k])
        ? deepMerge(base[k], patch[k])
        : patch[k];
    }
    return out;
  }

  function loadStored() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? migrateStored(JSON.parse(raw)) : {};
    } catch (e) {
      return {};
    }
  }

  function save(config) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      return true;
    } catch (e) {
      return false;
    }
  }

  // Debug params (SPEC/CLAUDE.md "How to work" step 3) — never persisted,
  // only affect the current page view. Parsed once per load.
  function debugParams() {
    const p = new URLSearchParams(global.location.search);
    return {
      t: p.get('t'),           // fake clock, e.g. 2026-07-02T12:10
      state: p.get('state'),   // force a state, e.g. between
      zone: p.get('zone'),     // override zone, e.g. 01
      scale: p.get('scale'),   // override display.scale, e.g. 1.3
      lang: p.get('lang'),     // reorder primary language, e.g. ta
      theme: p.get('theme'),   // override theme, e.g. led
    };
  }

  // Wide range (0.2–5×) so the same board suits a tiny tablet panel up to a
  // large hall TV; the theme is already resolution-independent (vmin), so
  // scale is a *fine* preference on top, not the thing that makes it readable.
  function clampScale(v) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0.2, Math.min(5.0, n)) : 1.0;
  }

  // Layout size percents → multipliers, clamped so a typo can't blow the
  // screen up or make an element vanish (hiding is the `show` toggle's job).
  const LAYOUT_MIN = 50, LAYOUT_MAX = 250;
  function layoutFactor(pct) {
    const n = Number(pct);
    if (!Number.isFinite(n)) return 1;
    return Math.max(LAYOUT_MIN, Math.min(LAYOUT_MAX, n)) / 100;
  }

  function applyOverrides(merged) {
    merged.display = merged.display || {};
    merged.display.scale = clampScale(merged.display.scale);
    const dbg = debugParams();
    if (dbg.zone) merged.zone = dbg.zone;
    if (dbg.theme) merged.theme = dbg.theme;
    if (dbg.scale) merged.display.scale = clampScale(dbg.scale);
    if (dbg.lang) {
      const rest = (merged.masjid.languages || []).filter(l => l !== dbg.lang);
      merged.masjid.languages = [dbg.lang, ...rest];
    }
    return merged;
  }

  function getConfig() {
    return applyOverrides(deepMerge(defaults(), loadStored()));
  }

  // Android shell (M3) serves config from its embedded server instead of
  // localStorage (docs/ARCHITECTURE.md D7/D8, admin/api.md). Browser dev
  // has no /api/config route, so the fetch 404s/fails and this falls back
  // to the same localStorage path getConfig() uses — one code path either
  // way, per D8. Shared by the display (getConfigAsync, debug overrides
  // applied) and the admin panel (getStoredAsync, raw — the admin form
  // must never bake ?zone=/?scale= debug overrides into a saved config).
  async function getStoredAsync() {
    try {
      const res = await fetch('/api/config', { cache: 'no-store' });
      if (res.ok) return migrateStored(await res.json());
    } catch (e) { /* not running under the shell server — fall through */ }
    return loadStored();
  }

  async function getConfigAsync() {
    return applyOverrides(deepMerge(defaults(), await getStoredAsync()));
  }

  global.SBConfig = { defaults, deepMerge, getConfig, getConfigAsync, getStoredAsync, save, debugParams,
    applyOverrides, layoutFactor, LAYOUT_MIN, LAYOUT_MAX, LAYOUT_GROUPS, STORAGE_KEY,
    PATTERN_DEFAULTS, PATTERN_MAX_ALPHA, GLOW_MAX_ALPHA };

})(window);
