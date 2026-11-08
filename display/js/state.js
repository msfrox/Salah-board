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
    const ramadan = (config.ramadan.enabled && todayRow) ? E.ramadanTimes(todayRow, timeline.dates.today, config) : null;

    const base = {
      now, hijri, isJumuahDay, jumuahAlerts, ramadan,
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
  function forceState(result, stateParam) {
    const E = global.SBEngine;
    const key = String(stateParam).toUpperCase().replace(/-/g, '_');
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
    else if (key === 'JUMUAH') meta = { phase: 'bayan' };
    return Object.assign({}, result, {
      state: key,
      prayer,
      meta,
      segStart: fakeStart,
      segEnd: fakeEnd,
    });
  }

  global.SBState = { resolve, forceState, VALID_STATES };

})(window);
