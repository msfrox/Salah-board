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

  function defaults() {
    return {
      configVersion: 1,
      masjid: {
        name: '',
        languages: ['ta', 'en'],
      },
      zone: '01',
      theme: 'classic',
      display: { scale: 1.0 },
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

      jumuah: {
        enabled: true,
        bayan: '12:30 PM',       // fixed set time; null = no bayan card
        iqamah: '1:15 PM',       // fixed set time (azan is that Friday's luhr time)
        salahDuration: 15,
      },

      luha: { enabled: true, waitAfterSunrise: 20 },

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
      return raw ? JSON.parse(raw) : {};
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

  function clampScale(v) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0.5, Math.min(2.0, n)) : 1.0;
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
      if (res.ok) return await res.json();
    } catch (e) { /* not running under the shell server — fall through */ }
    return loadStored();
  }

  async function getConfigAsync() {
    return applyOverrides(deepMerge(defaults(), await getStoredAsync()));
  }

  global.SBConfig = { defaults, deepMerge, getConfig, getConfigAsync, getStoredAsync, save, debugParams, STORAGE_KEY };

})(window);
