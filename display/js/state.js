/* ============================================================
   Salah Board — state.js
   Pure state resolution: (config, timeline, now) -> state result.
   No stored state — after reboot/power-cut the display recomputes
   the correct state straight from config + timetable + clock, per
   docs/SPEC.md "State is a pure function of (config, timetable, now)".
   ============================================================ */
(function (global) {
  'use strict';

  const VALID_STATES = ['NORMAL', 'AZAN', 'BETWEEN', 'IQAMAH', 'SALAH', 'AFTER',
    'LUHA_WAIT', 'LUHA_OPEN', 'NIGHT', 'JUMUAH', 'KHUTBAH'];

  // Bayan speaker/topic for today's Jumu'ah, or null. Shown only while it is
  // still useful: a bayan is configured, today matches the optional
  // `bayanDate`, and Jumu'ah salah hasn't finished yet (end of today's
  // Jumu'ah SALAH segment; if that can't be found, fall back to "not over").
  function localISO(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function resolveBayanInfo(config, timeline, now) {
    const j = config.jumuah || {};
    const speaker = String(j.bayanSpeaker || '').trim();
    const topic = String(j.bayanTopic || '').trim();
    if (!j.bayan || (!speaker && !topic)) return null;
    if (j.bayanDate && j.bayanDate !== localISO(timeline.dates.today)) return null;
    const today = localISO(timeline.dates.today);
    const salah = timeline.segments.find(s => s.state === 'SALAH' && s.meta && s.meta.jumuah && localISO(s.start) === today);
    if (salah && now >= salah.end) return null;
    return { speaker, topic };
  }

  // Sunrise + Luha for the main screen's hero, or null. From today's Fajr
  // azan until Luha begins (sunrise + luha.waitAfterSunrise) the next thing
  // the congregation waits for is Luha, not Zuhr — so, when enabled, NORMAL
  // shows "Next prayer: Luha" with Sunrise | Luha in place of Azan | Iqamah.
  function resolveLuhaNext(config, timeline, now) {
    const E = global.SBEngine;
    const luha = config.luha || {};
    const row = timeline.rows.today;
    if (!luha.showOnMain || !row) return null;
    const day = timeline.dates.today;
    const fajr = E.parseTime(row.fajr, day);
    const sunrise = E.parseTime(row.sunrise, day);
    if (!fajr || !sunrise) return null;
    const wait = Math.max(0, Number(luha.waitAfterSunrise) || 0);
    const luhaTime = E.addMinutes(sunrise, wait);
    if (now < fajr || now >= luhaTime) return null;
    return { sunrise, luha: luhaTime };
  }

  function resolve(config, timeline, now, pack) {
    const E = global.SBEngine;
    const seg = E.resolveSegment(now, timeline);
    const events = E.azanEvents(timeline);
    const next = E.nextAzan(now, events);
    const prev = E.prevAzan(now, events);
    const todayRow = timeline.rows.today;
    const todayMaghrib = todayRow ? E.parseTime(todayRow.magrib, timeline.dates.today) : null;
    const hijri = E.hijriInfo(now, config, todayMaghrib, pack);
    const isFriday = timeline.dates.today.getDay() === 5;
    const isJumuahDay = isFriday && config.jumuah.enabled;
    // Jumu'ah reminders (the "Jumu'ah today" banner and the etiquette cards)
    // are only useful until Jumu'ah is over — they stop once Asr azan arrives.
    const todayAsr = todayRow ? E.parseTime(todayRow.asr, timeline.dates.today) : null;
    const jumuahAlerts = isJumuahDay && !(todayAsr && now >= todayAsr);
    const bayanInfo = jumuahAlerts ? resolveBayanInfo(config, timeline, now) : null;
    const ramadan = (config.ramadan.enabled && todayRow) ? E.ramadanTimes(todayRow, timeline.dates.today, config) : null;
    // Today's Jumu'ah timings (bayan start, khutbah, iqamah) for the banner.
    const jumuahPlan = isJumuahDay ? E.jumuahPlan(timeline.dates.today, todayRow, config) : null;

    const luhaNext = resolveLuhaNext(config, timeline, now);

    const base = {
      now, hijri, isJumuahDay, jumuahAlerts, bayanInfo, ramadan, luhaNext, jumuahPlan,
      nextAzan: next, prevAzan: prev,
      rows: timeline.rows, dates: timeline.dates,
    };

    if (seg) {
      return Object.assign(base, {
        state: seg.state,
        prayer: seg.prayer,
        meta: seg.meta || {},
        segStart: seg.start,
        segEnd: seg.end,
      });
    }
    return Object.assign(base, { state: 'NORMAL', prayer: null, meta: {}, segStart: null, segEnd: null });
  }

  // Debug-only (?state=) override for styling/QA without time-travel.
  // Fabricates a plausible ~5 min window around `now` so countdowns
  // render sensibly; never used outside ?state= debug mode.
  function forceState(result, stateParam, config) {
    const E = global.SBEngine;
    let key = String(stateParam).toUpperCase().replace(/-/g, '_');
    // "sunnah" previews the Jumu'ah sunnah-reminder screen (a JUMUAH phase).
    const sunnahPreview = key === 'SUNNAH';
    if (sunnahPreview) key = 'JUMUAH';
    if (!VALID_STATES.includes(key)) return result;
    const now = result.now;
    const overlay = ['LUHA_WAIT', 'LUHA_OPEN', 'NIGHT'].includes(key);
    const prayer = overlay ? null : (result.prayer || (result.nextAzan && result.nextAzan.prayer) || 'luhr');
    const fakeStart = E.addMinutes(now, -1);
    const fakeEnd = E.addMinutes(now, 4);
    let meta = {};
    if (key === 'BETWEEN') meta = { iqamahTime: fakeEnd };
    else if (key === 'NIGHT') meta = { nextFajr: fakeEnd };
    else if (key === 'AZAN' && prayer === 'luhr' && result.isJumuahDay) meta = { jumuah: true };
    else if (key === 'JUMUAH' || key === 'KHUTBAH') {
      // Show this Friday's real times when we have them, else plausible ones.
      const p = result.jumuahPlan || E.jumuahPlan(result.dates.today, result.rows && result.rows.today, config) || {};
      const hasBayan = !!(config && config.jumuah && config.jumuah.bayan);
      meta = { jumuah: true, phase: sunnahPreview ? 'sunnah' : 'bayan', bayan: hasBayan,
        bayanStart: hasBayan ? (p.sunnahEnd || E.addMinutes(now, 4)) : null,
        khutbah: p.khutbah || E.addMinutes(now, 30), iqamahTime: p.iqamah || E.addMinutes(now, 37) };
    }
    // Previewing the bayan / Jumu'ah screens on any weekday should still show
    // the configured speaker & topic, so the caretaker can check them.
    let bayanInfo = result.bayanInfo;
    if (!bayanInfo && key === 'JUMUAH' && config && config.jumuah) {
      const speaker = String(config.jumuah.bayanSpeaker || '').trim();
      const topic = String(config.jumuah.bayanTopic || '').trim();
      if (config.jumuah.bayan && (speaker || topic)) bayanInfo = { speaker, topic };
    }
    return Object.assign({}, result, {
      bayanInfo,
      state: key,
      prayer,
      meta,
      segStart: fakeStart,
      segEnd: fakeEnd,
    });
  }

  global.SBState = { resolve, forceState, VALID_STATES };

})(window);
