# Salah Board — Feature Specification

Everything the display must do. The state machine is the heart; read it first.
All times below are display-time (see Time Correction in ARCHITECTURE.md).

## Terminology

| Term | Meaning |
|---|---|
| Azan | Call to prayer, at the timetable time, called live by the muezzin |
| Iqamah | Second call, immediately before congregation starts |
| Jumu'ah | Friday congregational prayer (replaces Luhr on Fridays) |
| Bayan | Pre-khutbah talk on Fridays (Sri Lanka convention) |
| Ishraq / Luha | Sunrise; Luha (Duha) prayer becomes valid ~20 min after sunrise |
| Imsak | End of suhoor in Ramadan (ACJU: 2 min before Fajr) |

## Display state machine

States, in the order they occur around each of the 5 daily prayers:

| # | State | Enter | Exit | Screen shows |
|---|---|---|---|---|
| 1 | NORMAL | default | next event | Hero row: clock + next-prayer block (name, **azan time and iqamah time equally large**, countdown to azan) — the two most-read values on a masjid board. Plus masjid name, today's full timetable strip, Hijri + Gregorian date, rotating notice cards. Layout per M1.5-SPEC.md |
| 2 | AZAN | at azan time | +`azanScreen.minutes` (default 5) | "Azan — [prayer]" banner, reply-to-muadhin reminder, dua after azan (Arabic + translit + translation), phones-silent icon |
| 3 | BETWEEN | after AZAN | at iqamah time | **Iqamah countdown (dominant)**, rotating duas — "dua between azan & iqamah is not rejected" (Tirmidhi 212), ask-for-afiyah, sunnah prayer reminder |
| 4 | IQAMAH | at iqamah time | +`iqamahScreen.minutes` (default 2) | "Straighten the rows" screen — saff-straightening reminder, fill gaps, phones OFF |
| 5 | SALAH | after IQAMAH | +`salahDuration[prayer]` | Near-black screen, tiny clock, "Salah in progress — phones off". Minimum light spill in the hall |
| 6 | AFTER | after SALAH | +`afterScreen.minutes` (default 10) | Post-salah adhkar rotation (Astaghfirullah ×3, Ayat al-Kursi reminder, tasbih 33/33/34) |

Then back to NORMAL. After Fajr's AFTER screen the board stays on NORMAL until sunrise (there is no separate sunrise countdown screen — sunrise is already in the timetable strip). Special overlay states:

| State | When | Screen shows |
|---|---|---|
| LUHA_WAIT | sunrise → +`luha.waitAfterSunrise` (default 20 min) | "Luha prayer in MM:SS" countdown |
| LUHA_OPEN | wait ends | Brief "Luha (Duha) prayer time has begun" card, then NORMAL |
| NIGHT | Isha AFTER + `night.afterIshaMinutes` → Fajr − `night.beforeFajrMinutes` | Dimmed (config `night.brightness`), small clock + tomorrow's Fajr time |
| JUMUAH | Fridays, from `jumuah.bayan` time | See Jumu'ah mode below |

**NORMAL fine-tuning:** each NORMAL-screen element can be resized (50–250% of the theme size) or hidden per board, via `config.layout.normal` (admin → Advanced, with a live preview that warns when elements no longer fit). This lives in `display/css/layout.css` on top of every theme, so themes don't need to know about it.

**Time always visible:** every full-screen transient state (AZAN, BETWEEN, IQAMAH, AFTER, LUHA_WAIT, LUHA_OPEN, JUMUAH, KHUTBAH) shows a small current-time clock in the top-right corner, in its own row so it never covers the screen's content. NORMAL has the hero clock; SALAH and NIGHT keep their own deliberately dim clock.

Rules:
- State is a **pure function of (config, timetable, now)** — after reboot or
  power cut the display recomputes the correct state. No stored state.
- Transitions re-evaluate every second; all countdowns tick per second.
- If iqamah time has passed but SALAH duration hasn't (e.g. boot mid-salah),
  resolve into SALAH, not BETWEEN.

## Iqamah rules (per prayer, via config)

- `mode: "offset"` → iqamah = azan + `minutes`, optionally rounded UP to the
  next `round` minutes (0 = no rounding). Rounding keeps wall-clock iqamah
  times stable as azan drifts by a minute across days.
- `mode: "fixed"` → iqamah at a fixed wall-clock time (e.g. Fajr 5:03 AM
  daily, adjusted seasonally by the masjid).
- Friday: `luhr` entry is ignored — Jumu'ah config governs.
- Ramadan overrides (see below) take precedence when enabled.
- Sanity: if computed iqamah ≤ azan, fall back to azan + 10 min and show a
  warning badge in the admin panel (never on the main display).

## Jumu'ah mode (Fridays)

Timeline driven by `config.jumuah`. Jumu'ah azan is **not** separately
configured — it's that Friday's own `luhr` azan time from the zone data
(masjids don't ring a distinct Jumu'ah clock). `bayan` and `iqamah` are both
fixed wall-clock times (e.g. "12:30 PM" / "1:15 PM") set by the masjid,
editable in the admin panel:

1. From morning, NORMAL shows "Jumu'ah today" with bayan + azan times and
   rotating Jumu'ah etiquette cards (ghusl, early arrival, Surah al-Kahf,
   salawat, listen silently during khutbah). Both stop at that day's Asr
   azan — Jumu'ah is over by then, so the reminders would only be noise.
   If the masjid entered the bayan speaker and/or topic, the banner becomes
   a one-line carousel that crossfades between the Jumu'ah times and
   "speaker · topic" (6 s each), so it takes no extra height. The speaker/
   topic slide disappears as soon as Jumu'ah salah ends (no longer relevant). Optional `bayanDate` limits it to one
   Friday so a previous week's speaker is never shown by mistake.
2. `bayan` time → card "Bayan in progress", with the speaker and topic
   underneath when set.
3. Azan (today's `luhr` time) → AZAN state as usual.
4. After azan → KHUTBAH state (not BETWEEN): screen shows ONLY "Khutbah in
   progress — remain silent" (talking during khutbah forfeits the reward —
   Bukhari 934). No countdowns, no rotation. Runs until the fixed `iqamah`
   time (however long the khutbah actually takes).
5. `iqamah` time → IQAMAH → SALAH → AFTER as normal. Sanity: if `iqamah` ≤
   azan + `screens.azan`, fall back to azan + 10 min (same rule as regular
   iqamah).
6. Women's/second Jumu'ah variations are out of scope for v1.

## Ramadan mode (`config.ramadan.enabled`)

- NORMAL additionally shows **Imsak** (Fajr − 2 min, ACJU convention) and
  **Iftar** (= Maghrib) prominently.
- Maghrib timing changes: masjids delay iqamah for iftar — use
  `ramadan.iqamahOverrides` (same shape as `iqamah`, sparse — only the
  prayers that change, typically magrib and isha/taraweeh).
- Optional `ramadan.taraweeh` note line after Isha (free text per language).
- Countdown to iftar during the last hour before Maghrib.
- Enabling/disabling is manual via admin (moon-sighting dependent — never
  auto-derive from Hijri date).

## Notices & announcements

- `config.notices[]`: text per language, optional `from`/`to` dates,
  `priority` (`high` pins it as a banner in NORMAL; `normal` joins the
  rotation). Use cases: Eid salah time, janazah announcement, events.
- Notices never interrupt AZAN → AFTER sequence states.

## Content packs & languages

- `display/content/<code>.json` — `en`, `ta`, `si`. Arabic text is embedded
  inside each pack (duas are always shown in Arabic + local translation).
- `config.masjid.languages` — ordered list; UI labels use the first,
  rotating content alternates through the list.
- Every dua/text carries a `source` field (e.g. "Bukhari 614"). Unsourced
  content must not ship.
- No hardcoded English in js: Gregorian date via `Intl` locale (`en-GB`/
  `ta-LK`/`si-LK`), Hijri month names + era label from the pack
  (`hijriMonths[12]`, `labels.hijriEra`). Missing key → `en` pack value.
- Numerals stay Western (0-9) in all languages (Sri Lankan convention).

## Hijri date

- Computed via `Intl.DateTimeFormat('en-u-ca-islamic-umalqura')` (as in
  pt-core.js) **plus `config.hijri.offsetDays` (−2…+2)** — ACJU follows local
  moon sighting which can differ from Umm al-Qura by a day.
- Hijri day flips at Maghrib, not midnight (flag `hijri.flipAtMaghrib`,
  default true).

## Settings surface (admin panel, M2)

Masjid name & languages · zone (13 ACJU zones) · iqamah rules per prayer ·
Jumu'ah times · Ramadan mode + overrides · Luha wait · night dim window &
brightness · azan/iqamah/after screen durations · salah durations · Hijri
offset · theme · notices CRUD · time set/sync (M4) · export/import config
as JSON file (backup / copy to another masjid).

## Non-goals for v1

No azan audio playback. No cloud sync or remote fleet management. No
accounts. No Play Store (sideloaded APK + GitHub Releases). No calculated
prayer times — ACJU tables only. No madhab options yet (Shafi'i only;
structure must not block adding Hanafi tables later).

## Offline guarantee (hard requirement)

The app must run **forever with zero network access**. Specifically:

1. All 13 zones × 12 months of ACJU tables are bundled in the APK (and in
   the repo at `display/data/`). No runtime fetch of timetable data, ever.
   Times are solar-based and valid every year — bundled data never expires.
2. Content packs, themes, fonts, QR generation — all bundled. No CDN, no
   web fonts, no external requests from the display or admin panel.
3. **Manual date & time adjustment** must be possible two ways:
   - Admin panel (phone via WiFi or the box's own hotspot): set current
     date + time → shell stores `offsetMs` vs. system clock.
   - **TV remote fallback** (no phone at all): settings overlay includes a
     D-pad-operable date/time adjust (±1 min / ±10 min / ±1 hour / ±1 day
     steps). Same offset mechanism underneath.
4. Hijri date is bundled math (Intl calendar) + manual `offsetDays` — no
   lookup service.
5. Network, when present, only ever *improves* things: NTP refines the
   offset; a data-refresh check picks up ACJU revisions. Both are optional
   and fail silently into offline behaviour.
6. Acceptance test ("airplane test"): a box with WiFi hardware-disabled and
   a deliberately wrong system clock must be fully configurable and show
   correct times using only the TV remote, and keep them across a power cut
   (re-verify via the boot sanity screen flow, ARCHITECTURE.md D5).
