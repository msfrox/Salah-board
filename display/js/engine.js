/* ============================================================
   Salah Board — engine.js
   DOM-agnostic timetable engine. Adapted from the sibling project
   pray.gear.lk's assets/js/pt-core.js (parsing, rollover, Hijri) —
   extended with iqamah computation and full day-plan segment
   building per docs/SPEC.md's state machine. No dependencies.
   ============================================================ */
(function (global) {
  'use strict';

  const DATA_BASE = './data';
  const MON_SHORT = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const HIJRI_MONTHS = ['Muharram', 'Safar', "Rabi' al-Awwal", "Rabi' al-Thani", 'Jumada al-Ula',
    'Jumada al-Akhirah', 'Rajab', "Sha'ban", 'Ramadan', 'Shawwal', "Dhu al-Qi'dah", 'Dhu al-Hijjah'];

  const PRAYERS = ['fajr', 'sunrise', 'luhr', 'asr', 'magrib', 'isha'];
  const SALAH = ['fajr', 'luhr', 'asr', 'magrib', 'isha'];
  const LUHA_OPEN_MINUTES = 2; // brief "Luha time has begun" card — not in config, spec calls it "brief"

  const pad2 = n => String(n).padStart(2, '0');
  const padZone = z => String(z).padStart(2, '0');

  // ── Time parsing / formatting ───────────────────────────
  // Parses a "h:mm AM" string onto the calendar date of `base` (Date).
  function parseTime(str, base) {
    if (!str) return null;
    const m = String(str).match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
    if (!m) return null;
    let h = +m[1], min = +m[2];
    const pm = m[3].toUpperCase() === 'PM';
    if (pm && h !== 12) h += 12;
    if (!pm && h === 12) h = 0;
    const d = base ? new Date(base) : new Date();
    d.setHours(h, min, 0, 0);
    return d;
  }

  function addMinutes(date, mins) {
    const d = new Date(date);
    d.setMinutes(d.getMinutes() + mins);
    return d;
  }

  function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function roundUpTo(date, roundMins) {
    if (!roundMins) return date;
    const d = new Date(date);
    d.setSeconds(0, 0);
    const mins = d.getHours() * 60 + d.getMinutes();
    const rem = mins % roundMins;
    if (rem !== 0) d.setMinutes(d.getMinutes() + (roundMins - rem));
    return d;
  }

  // No AM/PM suffix in either mode — on a masjid board the time of day is
  // always obvious from context, so the toggle only decides hour numbering.
  function formatTime(date, config) {
    if (!date) return '--:--';
    const fmt = (config && config.clock && config.clock.format) === '24h' ? '24h' : '12h';
    const m = pad2(date.getMinutes());
    let h = date.getHours();
    if (fmt === '24h') return `${pad2(h)}:${m}`;
    h = h % 12; if (h === 0) h = 12;
    return `${h}:${m}`;
  }

  function formatClock(date, config) {
    const fmt = (config && config.clock && config.clock.format) === '24h' ? '24h' : '12h';
    const showSec = !config || !config.clock || config.clock.showSeconds !== false;
    const m = pad2(date.getMinutes());
    const s = pad2(date.getSeconds());
    if (fmt === '24h') {
      const hh = pad2(date.getHours());
      return showSec ? `${hh}:${m}:${s}` : `${hh}:${m}`;
    }
    let h = date.getHours();
    h = h % 12; if (h === 0) h = 12;
    return showSec ? `${h}:${m}:${s}` : `${h}:${m}`;
  }

  function fmtCountdown(ms) {
    if (ms < 0) ms = 0;
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return h > 0 ? `${h}:${pad2(m)}:${pad2(s)}` : `${pad2(m)}:${pad2(s)}`;
  }

  // ── Zone data loading (cached, month-boundary aware) ────
  const _monthCache = {};
  async function loadMonth(zone, monthNum) {
    const key = `${padZone(zone)}-${pad2(monthNum)}`;
    if (_monthCache[key]) return _monthCache[key];
    const res = await fetch(`${DATA_BASE}/zone${key}.json`);
    if (!res.ok) throw new Error(`No data for zone${key}`);
    const json = await res.json();
    _monthCache[key] = json;
    return json;
  }

  function rowForDate(monthData, dateObj) {
    if (!monthData || !monthData.days) return null;
    const s = `${dateObj.getDate()}-${MON_SHORT[dateObj.getMonth() + 1]}`;
    return monthData.days.find(r => r.date === s) || null;
  }

  async function loadRowForDate(zone, dateObj) {
    const monthNum = dateObj.getMonth() + 1;
    const data = await loadMonth(zone, monthNum);
    return rowForDate(data, dateObj);
  }

  // ── Iqamah computation ───────────────────────────────────
  function resolveIqamahRule(prayerKey, config) {
    if (config.ramadan && config.ramadan.enabled &&
        config.ramadan.iqamahOverrides && config.ramadan.iqamahOverrides[prayerKey]) {
      return config.ramadan.iqamahOverrides[prayerKey];
    }
    return config.iqamah[prayerKey];
  }

  function computeIqamah(azanDate, rule) {
    if (!rule) return addMinutes(azanDate, 10);
    let iq;
    if (rule.mode === 'fixed') {
      iq = parseTime(rule.time, azanDate);
    } else {
      iq = addMinutes(azanDate, rule.minutes || 0);
      if (rule.round) iq = roundUpTo(iq, rule.round);
    }
    // Sanity per SPEC.md: computed iqamah must be after azan.
    if (!iq || iq <= azanDate) iq = addMinutes(azanDate, 10);
    return iq;
  }

  // ── Day-plan segment building ───────────────────────────
  function buildCycle(prayerKey, azanDate, iqamahDate, config, salahDurationMin, extraMeta) {
    const azanEnd = addMinutes(azanDate, config.screens.azan);
    const iqamahWarnEnd = addMinutes(iqamahDate, config.screens.iqamahWarning);
    const salahEnd = addMinutes(iqamahWarnEnd, salahDurationMin);
    const afterEnd = addMinutes(salahEnd, config.screens.after);
    const meta = Object.assign({ iqamahTime: iqamahDate }, extraMeta || {});
    return [
      { state: 'AZAN', start: azanDate, end: azanEnd, prayer: prayerKey, meta },
      { state: 'BETWEEN', start: azanEnd, end: iqamahDate, prayer: prayerKey, meta },
      { state: 'IQAMAH', start: iqamahDate, end: iqamahWarnEnd, prayer: prayerKey, meta },
      { state: 'SALAH', start: iqamahWarnEnd, end: salahEnd, prayer: prayerKey, meta },
      { state: 'AFTER', start: salahEnd, end: afterEnd, prayer: prayerKey, meta },
    ].filter(s => s.end > s.start);
  }

  // Jumu'ah azan is Zuhr's own azan time for that day (masjid convention —
  // there's no separate Jumu'ah azan clock). Iqamah is a fixed wall-clock
  // time set by the masjid (like bayan), not an offset from khutbah length,
  // since khutbah runs however long the imam takes.
  function buildJumuahCycle(dateObj, row, config) {
    const segs = [];
    const azanDate = row ? parseTime(row.luhr, dateObj) : null;
    if (!azanDate) return segs;
    const azanEnd = addMinutes(azanDate, config.screens.azan);
    const iqamahDate = computeIqamah(azanEnd, { mode: 'fixed', time: config.jumuah.iqamah });
    const iqamahWarnEnd = addMinutes(iqamahDate, config.screens.iqamahWarning);
    const salahEnd = addMinutes(iqamahWarnEnd, config.jumuah.salahDuration);
    const afterEnd = addMinutes(salahEnd, config.screens.after);
    const jm = { jumuah: true, iqamahTime: iqamahDate };
    if (config.jumuah.bayan) {
      const bayanDate = parseTime(config.jumuah.bayan, dateObj);
      if (bayanDate && bayanDate < azanDate) {
        segs.push({ state: 'JUMUAH', start: bayanDate, end: azanDate, prayer: 'luhr', meta: Object.assign({ phase: 'bayan' }, jm) });
      }
    }
    segs.push(
      { state: 'AZAN', start: azanDate, end: azanEnd, prayer: 'luhr', meta: jm },
      { state: 'KHUTBAH', start: azanEnd, end: iqamahDate, prayer: 'luhr', meta: jm },
      { state: 'IQAMAH', start: iqamahDate, end: iqamahWarnEnd, prayer: 'luhr', meta: jm },
      { state: 'SALAH', start: iqamahWarnEnd, end: salahEnd, prayer: 'luhr', meta: jm },
      { state: 'AFTER', start: salahEnd, end: afterEnd, prayer: 'luhr', meta: jm },
    );
    return segs.filter(s => s.end > s.start);
  }

  function buildDayPlan(dateObj, row, config) {
    if (!row) return [];
    const isFriday = dateObj.getDay() === 5;
    const segs = [];
    const at = str => parseTime(str, dateObj);

    // Fajr
    const fajrAzan = at(row.fajr);
    const fajrIqamah = computeIqamah(fajrAzan, resolveIqamahRule('fajr', config));
    const fajrSegs = buildCycle('fajr', fajrAzan, fajrIqamah, config, config.screens.salahDuration.fajr);
    segs.push(...fajrSegs);

    // Luha. (No sunrise countdown: from the end of Fajr's AFTER screen until
    // sunrise the board stays on NORMAL — sunrise is already in the timetable.)
    const sunrise = at(row.sunrise);
    if (config.luha.enabled && sunrise) {
      const luhaOpenStart = addMinutes(sunrise, config.luha.waitAfterSunrise);
      if (luhaOpenStart > sunrise) {
        segs.push({ state: 'LUHA_WAIT', start: sunrise, end: luhaOpenStart, prayer: null, meta: { luhaOpenStart } });
      }
      const luhaOpenEnd = addMinutes(luhaOpenStart, LUHA_OPEN_MINUTES);
      segs.push({ state: 'LUHA_OPEN', start: luhaOpenStart, end: luhaOpenEnd, prayer: null, meta: {} });
    }

    // Luhr / Jumu'ah
    if (isFriday && config.jumuah.enabled) {
      segs.push(...buildJumuahCycle(dateObj, row, config));
    } else {
      const luhrAzan = at(row.luhr);
      const luhrIqamah = computeIqamah(luhrAzan, resolveIqamahRule('luhr', config));
      segs.push(...buildCycle('luhr', luhrAzan, luhrIqamah, config, config.screens.salahDuration.luhr));
    }

    // Asr
    const asrAzan = at(row.asr);
    const asrIqamah = computeIqamah(asrAzan, resolveIqamahRule('asr', config));
    segs.push(...buildCycle('asr', asrAzan, asrIqamah, config, config.screens.salahDuration.asr));

    // Magrib
    const magribAzan = at(row.magrib);
    const magribIqamah = computeIqamah(magribAzan, resolveIqamahRule('magrib', config));
    segs.push(...buildCycle('magrib', magribAzan, magribIqamah, config, config.screens.salahDuration.magrib));

    // Isha
    const ishaAzan = at(row.isha);
    const ishaIqamah = computeIqamah(ishaAzan, resolveIqamahRule('isha', config));
    segs.push(...buildCycle('isha', ishaAzan, ishaIqamah, config, config.screens.salahDuration.isha));

    return segs.sort((a, b) => a.start - b.start);
  }

  function nightSegment(prevPlan, nextPlan, config) {
    const prevIshaAfter = prevPlan.find(s => s.prayer === 'isha' && s.state === 'AFTER');
    const nextFajrAzan = nextPlan.find(s => s.prayer === 'fajr' && s.state === 'AZAN');
    if (!prevIshaAfter || !nextFajrAzan) return null;
    const start = addMinutes(prevIshaAfter.end, config.night.afterIshaMinutes);
    const end = addMinutes(nextFajrAzan.start, -config.night.beforeFajrMinutes);
    if (end <= start) return null;
    return { state: 'NIGHT', start, end, prayer: null, meta: { nextFajr: nextFajrAzan.start } };
  }

  // Builds the merged, sorted segment timeline covering yesterday →
  // tomorrow for `now`'s zone, handling month-boundary data loads.
  async function loadTimeline(zone, now, config) {
    const dates = [addDays(now, -1), addDays(now, 0), addDays(now, 1)];
    const rows = await Promise.all(dates.map(d => loadRowForDate(zone, d).catch(() => null)));
    const plans = dates.map((d, i) => buildDayPlan(d, rows[i], config));
    const segments = [...plans[0], ...plans[1], ...plans[2]];
    const n1 = nightSegment(plans[0], plans[1], config); if (n1) segments.push(n1);
    const n2 = nightSegment(plans[1], plans[2], config); if (n2) segments.push(n2);
    segments.sort((a, b) => a.start - b.start);
    return {
      segments,
      rows: { yesterday: rows[0], today: rows[1], tomorrow: rows[2] },
      dates: { yesterday: dates[0], today: dates[1], tomorrow: dates[2] },
    };
  }

  function resolveSegment(now, timeline) {
    return timeline.segments.find(s => s.start <= now && now < s.end) || null;
  }

  function azanEvents(timeline) {
    return timeline.segments
      .filter(s => s.state === 'AZAN')
      .map(s => ({ prayer: s.prayer, jumuah: !!(s.meta && s.meta.jumuah),
                   time: s.start, iqamahTime: (s.meta && s.meta.iqamahTime) || null }));
  }

  function nextAzan(now, events) {
    return events.find(e => e.time > now) || null;
  }

  function prevAzan(now, events) {
    let prev = null;
    for (const e of events) { if (e.time <= now) prev = e; else break; }
    return prev;
  }

  // ── Hijri date (flip-at-Maghrib trick: nudge input +1 day once
  //    local Maghrib has passed, since Intl's islamic-umalqura
  //    calendar rolls over at Gregorian midnight) ───────────
  // Formatters are locale-fixed ('en-u-ca-islamic-umalqura' gives stable
  // numeric fields regardless of display language) so they're built once
  // and reused — ticking every second must not allocate new Intl objects.
  let _hijriFmts = null;
  function hijriFormatters() {
    if (!_hijriFmts) {
      _hijriFmts = {
        day: new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { day: 'numeric' }),
        month: new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { month: 'numeric' }),
        year: new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { year: 'numeric' }),
      };
    }
    return _hijriFmts;
  }

  function hijriInfo(now, config, todayMaghrib, pack) {
    let ref = new Date(now);
    if (config.hijri.flipAtMaghrib && todayMaghrib && now >= todayMaghrib) {
      ref = new Date(ref.getTime() + 86400000);
    }
    ref = new Date(ref.getTime() + (config.hijri.offsetDays || 0) * 86400000);
    try {
      const fmt = hijriFormatters();
      const day = fmt.day.format(ref);
      const monNum = +fmt.month.format(ref);
      const year = fmt.year.format(ref).replace(/\s*AH\s*$/i, '').trim();
      const months = (pack && Array.isArray(pack.hijriMonths) && pack.hijriMonths.length === 12) ? pack.hijriMonths : HIJRI_MONTHS;
      const era = (pack && pack.labels && pack.labels.hijriEra) || 'AH';
      const monthName = months[monNum - 1] || '';
      return { day, monthName, year, text: `${day} ${monthName} ${year} ${era}` };
    } catch (e) {
      return { day: '', monthName: '', year: '', text: '' };
    }
  }

  function ramadanTimes(row, dateObj, config) {
    const fajr = parseTime(row.fajr, dateObj);
    const imsak = addMinutes(fajr, -2);
    const iftar = parseTime(row.magrib, dateObj);
    return { imsak: formatTime(imsak, config), iftar: formatTime(iftar, config), imsakDate: imsak, iftarDate: iftar };
  }

  global.SBEngine = {
    DATA_BASE, MON_SHORT, PRAYERS, SALAH, LUHA_OPEN_MINUTES,
    pad2, padZone,
    parseTime, addMinutes, addDays, roundUpTo,
    formatTime, formatClock, fmtCountdown,
    loadMonth, rowForDate, loadRowForDate,
    resolveIqamahRule, computeIqamah,
    buildDayPlan, buildJumuahCycle, nightSegment,
    loadTimeline, resolveSegment, azanEvents, nextAzan, prevAzan,
    hijriInfo, ramadanTimes,
  };

})(window);
