# Salah Board — instructions for Claude

Open-source masjid prayer display for Sri Lanka (ACJU timetable, Shafi'i).
Web display (`display/`) wrapped by a thin Android kiosk shell (`android/`).
Sister project: **pray.gear.lk** (`~/Projects/Prayer-Time-Site`) — same data,
same ethos.

## Golden rules — do not violate

1. **The display is plain HTML/CSS/JS.** No framework, no bundler, no build
   step. It must run by serving `display/` with any static server.
2. **Offline-first.** All 13 zones × 12 months of ACJU data are bundled in
   `display/data/`. The app must never *require* internet. Online is only
   for NTP time sync and optional data refresh from pray.gear.lk.
3. **The shell stays thin.** Kotlin code only does what the web layer can't:
   kiosk/boot/WebView, admin HTTP server, hotspot, time offset, brightness,
   watchdog. Display logic never goes in Kotlin.
4. **`config.json` is the single contract** between display, admin panel and
   shell. Schema lives in `docs/CONFIG-SCHEMA.md`. Change schema → update
   that doc in the same commit.
5. **No accounts, no cloud, no tracking, no ads.** GPL-3.0.
6. **No azan audio by default.** The muezzin calls live; the screen displays.
7. **Religious content** (duas, texts) lives in `display/content/<lang>.json`
   with source references (hadith numbers). Never invent content; flag
   anything unsourced for review. Shafi'i / ACJU conventions apply.
8. **Prayer keys everywhere:** `fajr, sunrise, luhr, asr, magrib, isha` —
   exactly matching the pray.gear.lk data files. Don't rename.

## How to work (every session)

1. Read `docs/MILESTONES.md`, find the current milestone (first one not
   marked done). Read ONLY the spec sections it links. Keep sessions small.
2. Implement against the milestone's acceptance criteria. All must pass
   before marking it done (tick the checkbox in MILESTONES.md).
3. Test in a normal desktop browser first. Use the debug URL params:
   `?t=2026-07-02T12:10` (fake clock), `?state=between` (force a state),
   `?zone=01` (override zone). Implement these params in M1 and keep them.
4. Don't start Android work (M3) until M1–M2 are done and reviewed.

## Repo layout

```
display/            The screen. index.html + js/ + themes/ + content/ + data/
display/data/       ACJU zone JSONs — synced by tools/sync-data.ps1. NEVER hand-edit.
display/content/    Language packs (duas, labels, screens) — en/ta/si + Arabic inline.
display/themes/     One folder per theme (CSS + optional layout overrides).
android/            Kotlin shell (M3+). See android/README.md for responsibilities.
docs/               SPEC, ARCHITECTURE, CONFIG-SCHEMA, MILESTONES, HARDWARE.
tools/sync-data.ps1 Copies data from sibling Prayer Time Site repo, or
                    downloads from https://pray.gear.lk/data/.
```

## Data notes

- Zone files: `zoneNN-MM.json` → `{ zone, monthNum, days: [{ date:"1-Jan",
  fajr:"5:00 AM", sunrise, luhr, asr, magrib, isha }] }`. Times are 12-hour
  strings, Asia/Colombo, valid every year (solar). `year` field is metadata.
- The sister repo has a proven DOM-agnostic engine (`assets/js/pt-core.js`):
  parsing, current/next prayer, after-Isha rollover to tomorrow's Fajr,
  Hijri via Intl. **Adapt it, don't rewrite it.** Attribute in the header.
- After-Isha rollover must fetch next month's file when crossing month end.
