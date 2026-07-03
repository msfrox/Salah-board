# Milestones — build order for Claude Code (Sonnet)

Work top to bottom. One milestone (or one sub-step) per session. Each is
independently useful. Tick checkboxes as acceptance criteria pass. Read only
the docs each milestone lists — keep sessions token-light.

---

## M1 — Web display, complete state machine  `[x] done`
**Read:** SPEC.md (all), CONFIG-SCHEMA.md, CLAUDE.md. Adapt
`E:\GitHub\Prayer Time Site\assets\js\pt-core.js` for the engine.

Build in `display/`: `index.html`, `js/engine.js` (timetable: parse, next
prayer, rollover), `js/state.js` (state machine per SPEC), `js/ui.js`
(render), `js/config.js` (defaults + localStorage), `themes/classic/`
(dark, high-contrast, big-type — inspiration: the classic green/yellow/red
LED boards, but tasteful; TV-safe margins), `content/en.json` (done),
`ta.json`, `si.json` (structure copies of en, machine translation OK,
marked `"reviewed": false`).

Acceptance:
- [x] Serving `display/` statically shows correct times for any `?zone=`
- [x] `?t=` fake clock drives ALL states correctly (walk one full day:
      fajr sequence → sunrise/luha → luhr → ... → night dim)
- [x] Friday `?t=` shows Jumu'ah flow incl. khutbah silence screen
- [x] Ramadan toggle shows imsak/iftar + overridden iqamah
- [x] After-Isha rollover shows tomorrow's Fajr (incl. month boundary)
- [x] Hijri date with offset; flips at Maghrib
- [x] Notices: pinned banner + rotation both work
- [x] Runs 24h+ without memory growth (no interval leaks)
- [x] Looks correct at 1920×1080 and 1280×720 from 10 m away

## M1.5 — Display refinements: hero next-salah, scale, responsive, i18n  `[x] done`
**Read:** M1.5-SPEC.md (all). Design + translations are already done there
and in `display/content/*.json` — pure implementation, no invention.

Rework `display/` only: hero row (clock + next azan/iqamah equally large),
rem/`--sb-scale` sizing with `display.scale` config + `?scale=`, portrait
layouts for 1366×768 / 1920×1080 both orientations, remove all hardcoded
English (`?lang=` debug param, Intl Gregorian, pack-driven Hijri months).

Acceptance (full list with test steps in M1.5-SPEC.md §6):
- [x] Next azan + iqamah times dominant on NORMAL; iqamah matches BETWEEN
- [x] No text below 2.2rem on any state screen
- [x] `?scale=` / `display.scale` scales uniformly, no clipping
- [x] All 4 resolutions (both orientations) pass a full `?t=` day walk
- [x] `?lang=ta|si|en` renders the entire UI in that language
- [x] Still leak-free over 24h (cache Intl formatters)

## M2 — Admin panel (browser-dev mode)  `[x] done`
**Read:** CONFIG-SCHEMA.md, SPEC.md § Settings surface.

Build `admin/` (same no-framework rules): mobile-first form UI covering the
whole settings surface, validation, export/import JSON. In dev it edits the
same localStorage; on Android it will PUT `/api/config`. Write
`admin/api.md` documenting the endpoints (D4 in ARCHITECTURE.md).

Acceptance:
- [x] Every config field editable + validated on a phone-sized screen
- [x] Save → display (open in second tab) reflects changes ≤ 2 s
- [x] Export/import round-trips; garbage import rejected with clear error
- [x] Notices CRUD with date ranges

## M3 — Android shell APK  `[ ] not started`
**Read:** ARCHITECTURE.md (D2–D8, shell responsibilities), android/README.md.

Kotlin, minSdk 26, single activity + WebView. HOME intent filter,
BOOT_COMPLETED, keep-screen-on, immersive fullscreen, watchdog
foreground service, embedded server (NanoHTTPD) serving display + admin +
API from assets, config file persistence, JS bridge, settings overlay
(QR to admin URL) on remote-control long-press/menu key.

Acceptance:
- [ ] APK installs on Android 8+ box; Home → "Always" → survives reboot
      and stays foreground for 48 h unattended
- [ ] Phone on same WiFi edits config via admin URL; display updates live
- [ ] WebView crash/App kill → back on screen within 10 s
- [ ] Release workflow: signed APK via GitHub Actions on tag

## M4 — Time correction + hotspot  `[ ] not started`
**Read:** ARCHITECTURE.md D4, D5.

SNTP client → `time.offsetMs`; periodic re-sync; boot sanity screen with
"set time" QR when clock is implausible and no NTP; manual **date + time**
set via admin (`POST /api/time`) AND via the TV-remote settings overlay
(D-pad steps: ±1 min / ±10 min / ±1 hour / ±1 day); LocalOnlyHotspot
toggle from settings overlay with SSID/password QR on the display.
See SPEC.md § Offline guarantee — M4 closes it out.

Acceptance:
- [ ] Box with wrong system clock + internet → correct within 30 s of boot
- [ ] No internet: set time from phone → correct times; survives app restart
- [ ] Implausible clock + no NTP → sanity screen, never wrong prayer times
- [ ] Hotspot flow: no-WiFi masjid can reach admin panel via QR
- [ ] Airplane test passes: WiFi off + wrong clock → fully configurable
      and correct using ONLY the TV remote (SPEC.md § Offline guarantee)

## M5 — Polish & release  `[ ] not started`
Second + third theme (one close to the classic LED-board look, one minimal
white-on-black) · data refresh from pray.gear.lk (D6) · Tamil/Sinhala
review pass · HARDWARE.md completed with photos · caretaker setup guide
(one page, printable, Tamil/Sinhala/English) · GitHub Release v1.0 with
APK + checksums.

Acceptance:
- [ ] A non-technical caretaker can go from boxed hardware to running
      display using only the printed guide, in under 30 minutes
- [ ] Fresh clone → `tools/sync-data.ps1` → M1 dev flow works on a
      machine without the sibling repo (downloads from pray.gear.lk)

## Later (explicitly deferred)
Companion mobile app · other madhabs/countries · cloud fleet dashboard ·
khutbah/bayan audio streaming to overflow halls · Play Store listing.
