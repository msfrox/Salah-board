# Milestones — build order for Claude Code (Sonnet)

Work top to bottom. One milestone (or one sub-step) per session. Each is
independently useful. Tick checkboxes as acceptance criteria pass. Read only
the docs each milestone lists — keep sessions token-light.

---

## M1 — Web display, complete state machine  `[ ] not started`
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
- [ ] Serving `display/` statically shows correct times for any `?zone=`
- [ ] `?t=` fake clock drives ALL states correctly (walk one full day:
      fajr sequence → sunrise/luha → luhr → ... → night dim)
- [ ] Friday `?t=` shows Jumu'ah flow incl. khutbah silence screen
- [ ] Ramadan toggle shows imsak/iftar + overridden iqamah
- [ ] After-Isha rollover shows tomorrow's Fajr (incl. month boundary)
- [ ] Hijri date with offset; flips at Maghrib
- [ ] Notices: pinned banner + rotation both work
- [ ] Runs 24h+ without memory growth (no interval leaks)
- [ ] Looks correct at 1920×1080 and 1280×720 from 10 m away

## M2 — Admin panel (browser-dev mode)  `[ ] not started`
**Read:** CONFIG-SCHEMA.md, SPEC.md § Settings surface.

Build `admin/` (same no-framework rules): mobile-first form UI covering the
whole settings surface, validation, export/import JSON. In dev it edits the
same localStorage; on Android it will PUT `/api/config`. Write
`admin/api.md` documenting the endpoints (D4 in ARCHITECTURE.md).

Acceptance:
- [ ] Every config field editable + validated on a phone-sized screen
- [ ] Save → display (open in second tab) reflects changes ≤ 2 s
- [ ] Export/import round-trips; garbage import rejected with clear error
- [ ] Notices CRUD with date ranges

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
