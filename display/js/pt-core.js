/* ============================================================
   Sri Lanka Prayer Times — Shared Core Engine (pt-core.js)
   VERSION 1.0.0 (PT.VERSION) — see assets/js/PT-CORE.md
   DOM-agnostic data + time logic for the experimental UIs in
   /labs.  Reuses the proven logic from the live site's app.js
   (parse, status, after-Isha rollover, Hijri) and adds
   geofencing + Qibla helpers. Exposes a single global: PT.
   No build step, no dependencies. Matches the site's ethos.
   ============================================================ */
(function (global) {
  'use strict';

  const VERSION = '1.0.0';
  let DATA_BASE = './data';

  // ── Zone list (inlined — no extra request) ──────────────
  // GENERATED BLOCK: copied from data/zones.json, which is the only zone list.
  // Do not edit by hand; `node build/sync-zones.js` rewrites it and a test compares it.
  // <generated:zones>
  const ZONES = [
    { id:'01', name:'Zone 01', districts:['Colombo','Gampaha','Kalutara'] },
    { id:'02', name:'Zone 02', districts:['Jaffna','Nallur'] },
    { id:'03', name:'Zone 03', districts:['Mullaitivu (excl. Nallur)','Kilinochchi','Vavuniya'] },
    { id:'04', name:'Zone 04', districts:['Mannar','Puttalam'] },
    { id:'05', name:'Zone 05', districts:['Anuradhapura','Polonnaruwa'] },
    { id:'06', name:'Zone 06', districts:['Kurunegala'] },
    { id:'07', name:'Zone 07', districts:['Kandy','Matale','Nuwara Eliya'] },
    { id:'08', name:'Zone 08', districts:['Batticaloa','Ampara'] },
    { id:'09', name:'Zone 09', districts:['Trincomalee'] },
    { id:'10', name:'Zone 10', districts:['Badulla','Monaragala','Padiyatalawa','Dehiattakandiya'] },
    { id:'11', name:'Zone 11', districts:['Ratnapura','Kegalle'] },
    { id:'12', name:'Zone 12', districts:['Galle','Matara'] },
    { id:'13', name:'Zone 13', districts:['Hambantota'] },
  ];
  // </generated:zones>

  // Approx centroids (representative town) — used for Qibla when no GPS.
  const ZONE_CENTROID = {
    '01':[6.93,79.86], '02':[9.66,80.02], '03':[8.75,80.50], '04':[8.03,79.83],
    '05':[8.31,80.40], '06':[7.49,80.36], '07':[7.29,80.64], '08':[7.72,81.70],
    '09':[8.59,81.21], '10':[6.99,81.06], '11':[6.68,80.40], '12':[6.05,80.22],
    '13':[6.12,81.12],
  };

  const PRAYERS = ['fajr','sunrise','luhr','asr','magrib','isha'];
  const P_LABEL = { fajr:'Fajr', sunrise:'Sunrise', luhr:'Zuhr', asr:'Asr', magrib:'Maghrib', isha:'Isha' };
  const P_ICON  = { fajr:'🌙', sunrise:'🌅', luhr:'☀️', asr:'🌤️', magrib:'🌇', isha:'🌙' };
  // Prayers excluding sunrise (sunrise is informational, not a salah)
  const SALAH   = ['fajr','luhr','asr','magrib','isha'];

  const MON_FULL  = ['','January','February','March','April','May','June','July','August','September','October','November','December'];
  const MON_SHORT = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const WDAY_S    = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const WDAY_F    = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const IDAY_F    = ["Al-Ahad","Al-Ithnayn","Ath-Thulathaa","Al-Arbi'aa","Al-Khamees","Al-Jumu'ah","As-Sabt"];
  const HIJ_MON   = ['Muharram','Safar',"Rabi' al-Awwal","Rabi' al-Thani",'Jumada al-Ula','Jumada al-Akhirah','Rajab',"Sha'ban",'Ramadan','Shawwal',"Dhu al-Qi'dah",'Dhu al-Hijjah'];

  const LS_ZONE = 'slpt_zone';

  // ── Small utils ─────────────────────────────────────────
  const pad = n => String(n).padStart(2,'0');

  function parseTime(str, base) {
    if (!str) return null;
    const m = str.match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
    if (!m) return null;
    let h = +m[1], min = +m[2];
    const pm = m[3].toUpperCase() === 'PM';
    if (pm && h !== 12) h += 12;
    if (!pm && h === 12) h = 0;
    const d = base ? new Date(base) : new Date();
    d.setHours(h, min, 0, 0);
    return d;
  }

  // Minutes since midnight for a "h:mm AM" string (for layout math)
  function minutesOfDay(str) {
    const d = parseTime(str);
    return d ? d.getHours() * 60 + d.getMinutes() : null;
  }

  function splitTime(str) {
    if (!str) return { hm:'--:--', ap:'' };
    const m = str.match(/^(\d{1,2}:\d{2})\s*([AP]M)$/i);
    return m ? { hm:m[1], ap:m[2].toUpperCase() } : { hm:str, ap:'' };
  }

  function minusMins(timeStr, mins) {
    const d = parseTime(timeStr); if (!d) return '';
    d.setMinutes(d.getMinutes() - mins);
    let h = d.getHours(), mm = d.getMinutes();
    const pm = h >= 12;
    if (h > 12) h -= 12; if (h === 0) h = 12;
    return `${h}:${pad(mm)} ${pm ? 'PM' : 'AM'}`;
  }

  function fmtHMS(ms) {
    if (ms < 0) ms = 0;
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }
  function fmtHM(ms) {
    if (ms < 0) ms = 0;
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  // ── Data fetch ──────────────────────────────────────────
  const _cache = {};
  async function loadMonth(zone, month) {
    const k = `zone${pad(zone)}-${pad(month)}`;
    if (_cache[k]) return _cache[k];
    const r = await fetch(`${DATA_BASE}/${k}.json`);
    if (!r.ok) throw new Error(`No data: ${k}`);
    const j = await r.json();
    _cache[k] = j;
    return j;
  }

  function rowForDate(data, dateObj) {
    if (!data || !data.days) return null;
    const s = `${dateObj.getDate()}-${MON_SHORT[dateObj.getMonth() + 1]}`;
    return data.days.find(r => r.date === s) || null;
  }
  function todayRow(data) { return rowForDate(data, new Date()); }

  // ── Prayer status (mirrors app.js) ──────────────────────
  function status(row) {
    if (!row) return { current:null, next:'fajr', isNextDay:true };
    const now = new Date();
    const times = PRAYERS.map(k => ({ key:k, t:parseTime(row[k]) }));
    let cur = null, nxt = null;
    for (let i = 0; i < times.length; i++) {
      if (times[i].t && now >= times[i].t) { cur = times[i].key; nxt = times[i + 1]?.key || null; }
    }
    if (!cur) return { current:null, next:'fajr', isNextDay:false };
    if (cur === 'isha' && !nxt) return { current:'isha', next:'fajr', isNextDay:true };
    return { current:cur, next:nxt, isNextDay:false };
  }

  // Resolve the row that holds the NEXT prayer time, handling
  // after-Isha rollover into tomorrow (and across a month boundary).
  async function nextTarget(zone, todayData, st) {
    const row = todayRow(todayData);
    if (!st.isNextDay) return { row, key:st.next, isNextDay:false };
    const tmrw = new Date(); tmrw.setDate(tmrw.getDate() + 1);
    let tRow = rowForDate(todayData, tmrw);
    if (!tRow) {
      try { tRow = rowForDate(await loadMonth(zone, tmrw.getMonth() + 1), tmrw); }
      catch (e) { /* keep today's row as fallback */ }
    }
    return { row: tRow || row, key: st.next, isNextDay:true };
  }

  function msUntil(targetRow, key, isNextDay) {
    const t = parseTime(targetRow?.[key]);
    if (!t) return 0;
    let diff = t - new Date();
    if (isNextDay) diff += 86400000;
    return diff;
  }

  // Fraction [0..1] of the way from the current prayer to the next,
  // used to fill progress arcs/bars. Handles next-day wrap.
  function segmentProgress(row, st) {
    if (!row) return 0;
    const now = new Date();
    const startKey = st.current;
    const endT = parseTime(row[st.next]);
    if (!endT) return 0;
    let end = endT.getTime();
    if (st.isNextDay) end += 86400000;
    let start;
    if (!startKey) { // before Fajr — start at midnight
      const m = new Date(); m.setHours(0,0,0,0); start = m.getTime();
    } else {
      start = parseTime(row[startKey]).getTime();
    }
    const p = (now.getTime() - start) / (end - start);
    return Math.max(0, Math.min(1, p));
  }

  // ── Hijri ───────────────────────────────────────────────
  function _hijri(date, opts) {
    try {
      const f = k => new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', k).format(date);
      const day  = f({ day:'numeric' });
      const mon  = f({ month:'numeric' });
      const year = f({ year:'numeric' }).replace(/\s*AH\s*$/i,'').trim();
      const name = HIJ_MON[+mon - 1] || '';
      return { day, monthName: opts && opts.short ? name.slice(0,7) : name, year, text:`${day} ${name} ${year} AH` };
    } catch { return { day:'', monthName:'', year:'', text:'' }; }
  }
  const hijriToday = () => _hijri(new Date()).text;
  const hijriShort = () => { const h = _hijri(new Date(), { short:true }); return `${h.day} ${h.monthName} ${h.year} AH`; };
  const hijriFor   = d => _hijri(d).text;

  // ── Zone storage ────────────────────────────────────────
  function getZone() { try { return localStorage.getItem(LS_ZONE) || '01'; } catch { return '01'; } }
  function setZone(z) { try { localStorage.setItem(LS_ZONE, z); } catch {} }
  function zoneById(id) { return ZONES.find(z => z.id === id) || ZONES[0]; }
  function districtsLabel(id) { return zoneById(id).districts.join(' • '); }

  // ── Geofencing (point-in-polygon, copied from app.js) ───
  const zonesGeoUrl = () => `${DATA_BASE}/zones.geojson`;
  const SEA_BUFFER_KM = 8;
  let _geo = null;

  function pointInRing(lng, lat, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      const hit = ((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);
      if (hit) inside = !inside;
    }
    return inside;
  }
  function pointInPoly(lng, lat, poly) {
    if (!pointInRing(lng, lat, poly[0])) return false;
    for (let h = 1; h < poly.length; h++) if (pointInRing(lng, lat, poly[h])) return false;
    return true;
  }
  function pointInFeature(lng, lat, g) {
    if (g.type === 'Polygon') return pointInPoly(lng, lat, g.coordinates);
    if (g.type === 'MultiPolygon') return g.coordinates.some(p => pointInPoly(lng, lat, p));
    return false;
  }
  function distSegKm(lng, lat, ax, ay, bx, by) {
    const kx = 111.32 * Math.cos(lat * Math.PI / 180), ky = 110.57;
    const px = lng * kx, py = lat * ky, x1 = ax * kx, y1 = ay * ky, x2 = bx * kx, y2 = by * ky;
    const dx = x2 - x1, dy = y2 - y1, len2 = dx * dx + dy * dy;
    let t = len2 ? ((px - x1) * dx + (py - y1) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }
  function distFeatureKm(lng, lat, g) {
    const polys = g.type === 'MultiPolygon' ? g.coordinates : g.type === 'Polygon' ? [g.coordinates] : [];
    let min = Infinity;
    for (const poly of polys) for (const ring of poly)
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const d = distSegKm(lng, lat, ring[j][0], ring[j][1], ring[i][0], ring[i][1]);
        if (d < min) min = d;
      }
    return min;
  }
  async function loadGeo() {
    if (_geo) return _geo;
    const r = await fetch(zonesGeoUrl());
    if (!r.ok) throw new Error('zones.geojson failed');
    _geo = (await r.json()).features;
    return _geo;
  }
  function resolveZone(lat, lng) {
    const feats = _geo || [];
    for (const f of feats) if (pointInFeature(lng, lat, f.geometry)) return { zone:f.properties.zone, status:'exact' };
    let best = null, bestKm = Infinity;
    for (const f of feats) { const d = distFeatureKm(lng, lat, f.geometry); if (d < bestKm) { bestKm = d; best = f.properties.zone; } }
    if (best && bestKm <= SEA_BUFFER_KM) return { zone:best, status:'nearshore' };
    return { zone:null, status:'outside' };
  }

  // Promise wrapper around geolocation → zone
  function locate() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('no-geo'));
      navigator.geolocation.getCurrentPosition(async pos => {
        try { await loadGeo(); } catch (e) { return reject(e); }
        const { latitude:lat, longitude:lng } = pos.coords;
        const r = resolveZone(lat, lng);
        r.coords = { lat, lng };
        resolve(r);
      }, err => reject(err), { enableHighAccuracy:true, timeout:10000, maximumAge:300000 });
    });
  }

  // ── Qibla ───────────────────────────────────────────────
  const KAABA = { lat:21.4225, lng:39.8262 };
  function qiblaBearing(lat, lng) {
    const toR = d => d * Math.PI / 180, toD = r => r * 180 / Math.PI;
    const φ1 = toR(lat), φ2 = toR(KAABA.lat), Δλ = toR(KAABA.lng - lng);
    const y = Math.sin(Δλ);
    const x = Math.cos(φ1) * Math.tan(φ2) - Math.sin(φ1) * Math.cos(Δλ);
    return (toD(Math.atan2(y, x)) + 360) % 360;
  }
  function qiblaForZone(id) {
    const c = ZONE_CENTROID[id] || ZONE_CENTROID['01'];
    return qiblaBearing(c[0], c[1]);
  }

  // ── Time-of-day phase (for ambient UI) ──────────────────
  // Returns a phase key describing the sky right now, derived from
  // today's actual sun/prayer times.
  function dayPhase(row) {
    if (!row) return 'night';
    const now = new Date().getHours() * 60 + new Date().getMinutes();
    const m = k => minutesOfDay(row[k]);
    const fajr = m('fajr'), sr = m('sunrise'), luhr = m('luhr'),
          asr = m('asr'), mag = m('magrib'), isha = m('isha');
    if (now < fajr) return 'night';
    if (now < sr)   return 'dawn';
    if (now < luhr) return 'morning';
    if (now < asr)  return 'noon';
    if (now < mag)  return 'afternoon';
    if (now < isha) return 'dusk';
    return 'night';
  }

  // ── Build a shareable plain-text day card ───────────────
  function shareToday(data, row, year) {
    if (!data || !row) return '';
    const yr = year || new Date().getFullYear();
    const dNum = +row.date.split('-')[0];
    const d = new Date(yr, data.monthNum - 1, dNum);
    return [
      `Sri Lankan Prayer Times - ${data.districts.join(', ')}`,
      `${WDAY_F[d.getDay()]} ${dNum} ${data.monthName} ${yr} / ${IDAY_F[d.getDay()]} ${hijriFor(d)}`,
      `  Fajr ───── ${row.fajr}`,
      `  Sunrise ─── ${row.sunrise}`,
      `  Zuhr ──── ${row.luhr}`,
      `  Asr ───── ${row.asr}`,
      `  Maghrib ─── ${row.magrib}`,
      `  Isha ───── ${row.isha}`,
      `Shared from - pray.gear.lk`,
      `Source: ACJU Official - www.acju.lk/prayer-times/`,
    ].join('\n');
  }

  // Let a consumer point the engine at its own copy of the data folder.
  // Month data already loaded is kept; geometry is re-fetched from the new base.
  function configure(opts) {
    if (opts && typeof opts.dataBase === 'string') {
      DATA_BASE = opts.dataBase.replace(/\/+$/, '');
      for (const k of Object.keys(_cache)) delete _cache[k];
      _geo = null;
      global.PT.DATA_BASE = DATA_BASE;
    }
    return global.PT;
  }

  // ── Public API ──────────────────────────────────────────
  global.PT = {
    VERSION, configure,
    DATA_BASE, ZONES, ZONE_CENTROID,
    PRAYERS, SALAH, P_LABEL, P_ICON,
    MON_FULL, MON_SHORT, WDAY_S, WDAY_F, IDAY_F, HIJ_MON,
    pad, parseTime, minutesOfDay, splitTime, minusMins, fmtHMS, fmtHM,
    loadMonth, rowForDate, todayRow,
    status, nextTarget, msUntil, segmentProgress, dayPhase,
    hijriToday, hijriShort, hijriFor,
    getZone, setZone, zoneById, districtsLabel,
    loadGeo, resolveZone, locate,
    qiblaBearing, qiblaForZone,
    shareToday,
    nowYear: () => new Date().getFullYear(),
  };

})(window);
