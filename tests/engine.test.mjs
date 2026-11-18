// Characterisation tests for display/js/engine.js (+ state.js resolve).
// Dev-only. Run:  node --test tests/        (no dependencies, no build step)
// They pin what the engine does TODAY so the SB-3 swap to the vendored pt-core.js
// can be proven behaviour-preserving. Values were checked by hand against
// display/data/zone01-*.json; where today's behaviour is odd it is pinned and
// commented "QUIRK" (do not "fix" it inside this swap).
process.env.TZ = 'Asia/Colombo';  // must be set before the first Date is built

import { test } from 'node:test';
import assert from 'node:assert';  // loose deepEqual: arrays built inside the vm sandbox have a different prototype
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DISPLAY = path.join(ROOT, 'display');

// Load the display's own scripts, unmodified, into a window-like sandbox.
const sandbox = {
  console, Intl, Date, Promise, URLSearchParams,
  location: { search: '' },
  fetch: async (url) => {
    const file = path.join(DISPLAY, String(url));
    if (!fs.existsSync(file)) return { ok: false, json: async () => { throw new Error('404'); } };
    const text = fs.readFileSync(file, 'utf8');
    return { ok: true, json: async () => JSON.parse(text) };
  },
};
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const f of ['config.js', 'pt-core.js', 'engine.js', 'state.js']) {
  vm.runInContext(fs.readFileSync(path.join(DISPLAY, 'js', f), 'utf8'), sandbox, { filename: f });
}
const E = sandbox.SBEngine, S = sandbox.SBState, C = sandbox.SBConfig;

const at = (s) => new Date(s + (s.length === 16 ? ':00' : '') + '+05:30');   // wall time in Sri Lanka
const hm = (d) => E.formatTime(d, { clock: { format: '24h' } });
const ymd = (d) => `${d.getFullYear()}-${E.pad2(d.getMonth() + 1)}-${E.pad2(d.getDate())}`;
const cfg = (patch) => C.deepMerge(C.defaults(), patch || {});
const timeline = (now, patch) => E.loadTimeline('01', now, cfg(patch));
const seg = (tl, state, prayer) => tl.segments.filter(s => s.state === state && (!prayer || s.prayer === prayer));

// ── parsing / helpers ────────────────────────────────────
test('parseTime: 12-hour strings incl. 12 AM / 12 PM; bad input is null', () => {
  const base = at('2026-07-02T00:00');
  assert.equal(hm(E.parseTime('12:16 PM', base)), '12:16');
  assert.equal(hm(E.parseTime('12:05 AM', base)), '00:05');
  assert.equal(hm(E.parseTime('4:35 AM', base)), '04:35');
  assert.equal(hm(E.parseTime('7:47 PM', base)), '19:47');
  assert.equal(E.parseTime('25:00', base), null);
  assert.equal(E.parseTime('', base), null);
});

test('roundUpTo rounds up to the next multiple, leaves exact multiples', () => {
  assert.equal(hm(E.roundUpTo(at('2026-07-02T12:36'), 5)), '12:40');
  assert.equal(hm(E.roundUpTo(at('2026-07-02T12:40'), 5)), '12:40');
  assert.equal(hm(E.roundUpTo(at('2026-07-02T12:36'), 0)), '12:36');
});

test('computeIqamah: offset, offset+round, fixed, and the "must be after azan" fallback', () => {
  const azan = at('2026-07-02T12:16');
  assert.equal(hm(E.computeIqamah(azan, { mode: 'offset', minutes: 20, round: 0 })), '12:36');
  assert.equal(hm(E.computeIqamah(azan, { mode: 'offset', minutes: 20, round: 5 })), '12:40');
  assert.equal(hm(E.computeIqamah(azan, { mode: 'fixed', time: '1:00 PM' })), '13:00');
  assert.equal(hm(E.computeIqamah(azan, { mode: 'fixed', time: '12:00 PM' })), '12:26'); // before azan -> azan+10
  assert.equal(hm(E.computeIqamah(azan, undefined)), '12:26');
});

// ── iqamah for each prayer (default config, Thu 2 Jul, zone 01) ──
test('iqamah per prayer with the default config', async () => {
  const tl = await timeline(at('2026-07-02T10:00'));
  const iq = (p) => hm(seg(tl, 'AZAN', p).find(s => ymd(s.start) === '2026-07-02').meta.iqamahTime);
  assert.equal(iq('fajr'), '05:05');   // 4:35 +30 -> 5:05, round 5
  assert.equal(iq('luhr'), '12:40');   // 12:16 +20 -> 12:36 -> 12:40
  assert.equal(iq('asr'), '16:05');    // 3:43 +20 -> 4:03 -> 4:05
  assert.equal(iq('magrib'), '18:42'); // 6:32 +10, no rounding
  // QUIRK: default isha is fixed 7:15 PM but Isha azan today is 7:47 PM, so the
  // "iqamah must be after azan" rule replaces it with azan+10.
  assert.equal(iq('isha'), '19:57');
});

test('a fixed isha iqamah later than azan is honoured', async () => {
  const tl = await timeline(at('2026-07-02T10:00'), { iqamah: { isha: { mode: 'fixed', time: '8:15 PM' } } });
  const s = seg(tl, 'AZAN', 'isha').find(x => ymd(x.start) === '2026-07-02');
  assert.equal(hm(s.meta.iqamahTime), '20:15');
});

// ── cycle shape ──────────────────────────────────────────
test('one prayer cycle: AZAN → BETWEEN → IQAMAH → SALAH → AFTER, contiguous, correct lengths', async () => {
  const tl = await timeline(at('2026-07-02T10:00'));
  const cyc = tl.segments.filter(s => s.prayer === 'asr' && ymd(s.start) === '2026-07-02');
  assert.deepEqual(cyc.map(s => s.state), ['AZAN', 'BETWEEN', 'IQAMAH', 'SALAH', 'AFTER']);
  assert.deepEqual(cyc.map(s => [hm(s.start), hm(s.end)]), [
    ['15:43', '15:48'], ['15:48', '16:05'], ['16:05', '16:07'], ['16:07', '16:17'], ['16:17', '16:27']]);
});

test('LUHA: wait after sunrise, then a brief open card; disabled removes both', async () => {
  const tl = await timeline(at('2026-07-02T10:00'));
  const w = seg(tl, 'LUHA_WAIT').find(s => ymd(s.start) === '2026-07-02');
  const o = seg(tl, 'LUHA_OPEN').find(s => ymd(s.start) === '2026-07-02');
  assert.deepEqual([hm(w.start), hm(w.end), hm(o.start), hm(o.end)], ['05:59', '06:19', '06:19', '06:21']);
  const off = await timeline(at('2026-07-02T10:00'), { luha: { enabled: false } });
  assert.equal(seg(off, 'LUHA_WAIT').length, 0);
});

// ── next prayer & after-Isha rollover ────────────────────
async function nextAt(now, patch) {
  const tl = await timeline(now, patch);
  const n = E.nextAzan(now, E.azanEvents(tl));
  return { prayer: n.prayer, when: `${ymd(n.time)} ${hm(n.time)}`, jumuah: n.jumuah };
}

test('next prayer through an ordinary day', async () => {
  assert.deepEqual(await nextAt(at('2026-07-02T03:00')), { prayer: 'fajr', when: '2026-07-02 04:35', jumuah: false });
  assert.deepEqual(await nextAt(at('2026-07-02T12:00')), { prayer: 'luhr', when: '2026-07-02 12:16', jumuah: false });
  assert.deepEqual(await nextAt(at('2026-07-02T16:00')), { prayer: 'magrib', when: '2026-07-02 18:32', jumuah: false });
});

test('after Isha rolls over to tomorrow\'s Fajr', async () => {
  assert.deepEqual(await nextAt(at('2026-07-02T21:00')), { prayer: 'fajr', when: '2026-07-03 04:35', jumuah: false });
});

test('rollover across a month end (31 Jul → 1 Aug files)', async () => {
  assert.deepEqual(await nextAt(at('2026-07-31T22:30')), { prayer: 'fajr', when: '2026-08-01 04:43', jumuah: false });
});

test('rollover across the year end (31 Dec → 1 Jan)', async () => {
  assert.deepEqual(await nextAt(at('2026-12-31T22:30')), { prayer: 'fajr', when: '2027-01-01 05:00', jumuah: false });
});

test('yesterday is loaded across a month start (1 Aug sees 31 Jul rows)', async () => {
  const tl = await timeline(at('2026-08-01T01:00'));
  assert.equal(tl.rows.yesterday.date, '31-Jul');
  assert.equal(tl.rows.today.date, '1-Aug');
  assert.equal(tl.rows.tomorrow.date, '2-Aug');
});

test('NIGHT segment runs from after Isha (+60 min) to 45 min before Fajr', async () => {
  const tl = await timeline(at('2026-07-02T10:00'));
  const n = seg(tl, 'NIGHT').find(s => ymd(s.start) === '2026-07-02');
  // Isha cycle: azan 19:47, iqamah 19:57, +2 warn, +12 salah, +10 after = 20:21 → +60 = 21:21
  assert.deepEqual([`${ymd(n.start)} ${hm(n.start)}`, `${ymd(n.end)} ${hm(n.end)}`], ['2026-07-02 21:21', '2026-07-03 03:50']);
});

// ── Ramadan ──────────────────────────────────────────────
test('Ramadan: iqamah override applies only when enabled; imsak/iftar times', async () => {
  const off = await timeline(at('2026-07-02T10:00'));
  const on = await timeline(at('2026-07-02T10:00'), { ramadan: { enabled: true } });
  const mg = (tl) => hm(seg(tl, 'AZAN', 'magrib').find(s => ymd(s.start) === '2026-07-02').meta.iqamahTime);
  assert.equal(mg(off), '18:42');
  assert.equal(mg(on), '18:52');  // override: +20, no rounding
  const row = on.rows.today;
  const r = E.ramadanTimes(row, on.dates.today, cfg());
  assert.equal(hm(r.imsakDate), '04:33');   // fajr 4:35 − 2
  assert.equal(hm(r.iftarDate), '18:32');
});

// ── Jumu'ah (docs/LOCAL-CONTEXT.md §2) ───────────────────
// Order: azan → sunnah reminder → bayan → khutbah → iqamah. Iqamah is a fixed
// 1:00 PM; the 7-minute khutbah ends at it; the bayan starts at 12:15 PM, or
// later on a late-azan Friday (azan screen + 5 min sunnah), iqamah unchanged.
// Re-pinned 2026-11-18 when origin/main's Jumu'ah rework was merged.
const luhrDay = async (d, over) => {
  const tl = await timeline(at(d + 'T10:00'), over);
  return tl.segments.filter(s => s.prayer === 'luhr' && ymd(s.start) === d);
};
const shape = (day) => day.map(s => [s.state, s.meta.phase || '', hm(s.start), hm(s.end)]);

test("Jumu'ah, early-azan Friday (6 Nov): bayan at its usual 12:15, khutbah 12:53, iqamah 1:00", async () => {
  const day = await luhrDay('2026-11-06');
  assert.deepEqual(shape(day), [
    ['AZAN', '', '11:56', '12:01'], ['JUMUAH', 'sunnah', '12:01', '12:15'],
    ['JUMUAH', 'bayan', '12:15', '12:53'], ['KHUTBAH', '', '12:53', '13:00'],
    ['IQAMAH', '', '13:00', '13:02'], ['SALAH', '', '13:02', '13:17'], ['AFTER', '', '13:17', '13:27']]);
  assert.ok(day.every(s => s.meta.jumuah));
  assert.equal((await nextAt(at('2026-11-06T11:30'))).jumuah, true);
});

test("Jumu'ah, late-azan Friday (3 Jul): bayan waits for azan + sunnah, iqamah stays 1:00", async () => {
  assert.deepEqual(shape(await luhrDay('2026-07-03')), [
    ['AZAN', '', '12:16', '12:21'], ['JUMUAH', 'sunnah', '12:21', '12:26'],
    ['JUMUAH', 'bayan', '12:26', '12:53'], ['KHUTBAH', '', '12:53', '13:00'],
    ['IQAMAH', '', '13:00', '13:02'], ['SALAH', '', '13:02', '13:17'], ['AFTER', '', '13:17', '13:27']]);
  // No bayan configured: the sunnah reminder runs until the khutbah.
  assert.deepEqual(shape(await luhrDay('2026-07-03', { jumuah: { bayan: null } })).slice(0, 3), [
    ['AZAN', '', '12:16', '12:21'], ['JUMUAH', 'sunnah', '12:21', '12:53'], ['KHUTBAH', '', '12:53', '13:00']]);
});

test("Jumu'ah iqamah after the azan (SB-10): iqamah = azan + N, khutbah before it", async () => {
  const over = { jumuah: { iqamahMode: 'afterAzan', iqamahAfterAzan: 40, bayan: null } };
  assert.deepEqual(shape(await luhrDay('2026-07-03', over)).slice(0, 4), [
    ['AZAN', '', '12:16', '12:21'], ['JUMUAH', 'sunnah', '12:21', '12:49'],
    ['KHUTBAH', '', '12:49', '12:56'], ['IQAMAH', '', '12:56', '12:58']]);
  // Too short to fit after the azan screen: falls back to azan screen + 10.
  const short = shape(await luhrDay('2026-07-03', { jumuah: { iqamahMode: 'afterAzan', iqamahAfterAzan: 2 } }));
  assert.deepEqual(short.find(r => r[0] === 'IQAMAH').slice(2, 3), ['12:31']);
});

test("Jumu'ah disabled: Friday is an ordinary Luhr; weekday never gets Jumu'ah", async () => {
  const off = await timeline(at('2026-07-03T10:00'), { jumuah: { enabled: false } });
  assert.equal(seg(off, 'KHUTBAH').length, 0);
  const thu = await timeline(at('2026-07-02T10:00'));
  assert.equal(seg(thu, 'KHUTBAH').filter(s => ymd(s.start) === '2026-07-02').length, 0);
});

// ── state resolution (the display's view of "now") ───────
test('SBState.resolve: state at key moments of Thu 2 Jul', async () => {
  const c = cfg();
  const tl = await E.loadTimeline('01', at('2026-07-02T12:00'), c);
  const st = (t) => { const r = S.resolve(c, tl, at(t), null); return [r.state, r.prayer]; };
  assert.deepEqual(st('2026-07-02T12:00'), ['NORMAL', null]);
  assert.deepEqual(st('2026-07-02T12:16'), ['AZAN', 'luhr']);
  assert.deepEqual(st('2026-07-02T12:30'), ['BETWEEN', 'luhr']);
  assert.deepEqual(st('2026-07-02T12:40'), ['IQAMAH', 'luhr']);
  assert.deepEqual(st('2026-07-02T12:43'), ['SALAH', 'luhr']);
  assert.deepEqual(st('2026-07-02T12:55'), ['AFTER', 'luhr']);
  assert.deepEqual(st('2026-07-02T13:10'), ['NORMAL', null]);
  assert.deepEqual(st('2026-07-02T06:10'), ['LUHA_WAIT', null]);
  assert.deepEqual(st('2026-07-02T06:20'), ['LUHA_OPEN', null]);
  assert.deepEqual(st('2026-07-02T23:00'), ['NIGHT', null]);
});

test('SBState.resolve: a full 5-minute walk produces no gaps inside a prayer cycle', async () => {
  const c = cfg();
  const tl = await E.loadTimeline('01', at('2026-07-02T12:00'), c);
  for (let t = at('2026-07-02T12:16'); t < at('2026-07-02T12:55'); t = E.addMinutes(t, 1)) {
    assert.notEqual(S.resolve(c, tl, t, null).state, 'NORMAL', hm(t));
  }
});

// ── Hijri ────────────────────────────────────────────────
test('hijriInfo flips to the next Hijri day after Maghrib when flipAtMaghrib', () => {
  const c = cfg(), mag = at('2026-07-02T18:32');
  const before = E.hijriInfo(at('2026-07-02T12:00'), c, mag, null);
  const after = E.hijriInfo(at('2026-07-02T19:00'), c, mag, null);
  const noflip = E.hijriInfo(at('2026-07-02T19:00'), cfg({ hijri: { flipAtMaghrib: false } }), mag, null);
  assert.equal(noflip.text, before.text);
  assert.notEqual(after.text, before.text);
  assert.match(before.text, /^\d+ .+ \d{4} AH$/);
});
