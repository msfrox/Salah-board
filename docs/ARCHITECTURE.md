# Architecture & Design Decisions

## Layers

```
┌─────────────────────────────────────────────────────────┐
│ Android shell (Kotlin, thin)                             │
│  HOME launcher · boot receiver · watchdog · WebView      │
│  admin HTTP server · LocalOnlyHotspot · NTP · brightness │
│        │ serves & bridges                                │
│  ┌─────▼──────────────────────────────────────────────┐  │
│  │ display/ (pure web app)                            │  │
│  │  state machine · timetable engine (from pt-core)   │  │
│  │  themes (CSS) · content packs (JSON) · data (JSON) │  │
│  └────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
   Phone browser ──WiFi/hotspot──▶ admin panel (port 8080)
```

## Decision log (what & why)

**D1 — Separate repo from the Prayer Time Site.** Different product
(kiosk APK + releases vs. static public site). Shared data flows one way:
site repo → `tools/sync-data.ps1` → `display/data/`. Site's design
principles (static JSON, solar-valid-every-year) are inherited.

**D2 — Web display + thin native shell, not a native UI.** Themes become
HTML/CSS anyone can contribute; the display runs in any browser as a
fallback (Raspberry Pi, smart TV browser, old laptop → usable before the
APK exists, and a migration path off Android entirely). Native code stays
small, auditable, and rarely changes.

**D3 — Kiosk via HOME-launcher registration (no root, no MDM).** The app
declares `CATEGORY_HOME` + `CATEGORY_DEFAULT`; the caretaker presses Home
once and picks "Always". Survives reboots. Backups: `BOOT_COMPLETED`
receiver, `FLAG_KEEP_SCREEN_ON`, foreground-service watchdog that relaunches
the activity if it dies. Documented optional hard-lock for those who want
it: `adb dpm set-device-owner` + lock-task mode. Never require it.

**D4 — Admin is a web panel served by the box itself.** Embedded HTTP
server (NanoHTTPD or Ktor CIO) on port 8080 serving `admin/` and a tiny
JSON API: `GET/PUT /api/config`, `GET /api/status`, `POST /api/time`,
`POST /api/preview?state=...`. Phone joins the masjid WiFi and opens the
URL shown as a QR in the display's settings overlay (remote-control long
press / settings button). **No WiFi at the masjid?** The shell starts an
Android `LocalOnlyHotspot` (API 26+) and shows its SSID/password as a QR.
No separate companion APK to build, works from iPhones too. A dedicated
companion app can come later without changing the API.

**D5 — Time correction via offset, not system clock.** Cheap boxes have no
RTC battery; after a power cut they boot at epoch until NTP (which needs
internet). Apps can't set the system clock without privileged perms. So:
`displayTime = System.currentTimeMillis() + offsetMs`. The shell updates
`offsetMs` from direct SNTP queries when online (don't trust the system
clock) and re-checks periodically. Offline masjids set the time from the
phone admin panel → shell computes and persists the offset. A boot-time
sanity check (system year < 2025 and no NTP) shows a full-screen "set the
time from your phone" QR instead of wrong times. `offsetMs` is persisted
but a stale offset over a reboot on a dead clock is garbage — hence the
sanity screen rather than silent wrongness.

**D6 — Data bundled, refresh optional.** All 156 zone files (~600 KB) ship
inside the APK/repo. Online refresh (M5) compares a version/hash from
pray.gear.lk and updates local copies — needed only if ACJU revises tables.

**D7 — Config lives on the device as one JSON file.** Read by the display
at boot and on admin save (shell tells the WebView to reload config).
Export/import via admin panel = whole-file download/upload.

**D8 — WebView serves from the same embedded HTTP server (localhost)**, not
`file://` — avoids CORS/fetch quirks, one code path for assets in browser
dev and production, and the admin panel is just another route on the
same server (LAN-bound; localhost + LAN interface only, never public).

## Shell responsibilities (complete list — keep it this small)

1. HOME/boot/foreground + watchdog + keep-screen-on
2. Embedded HTTP server: display assets, admin panel, JSON API
3. Config persistence (app-private file), export/import
4. SNTP client + `offsetMs` management
5. LocalOnlyHotspot on demand + QR payload to display
6. Screen brightness control (window attribute) for NIGHT dim
7. JS bridge: `getConfig / getTimeOffset / setBrightness / getStatus`

## Failure modes

| Failure | Behaviour |
|---|---|
| Power cut, no RTC, no internet | Sanity screen with "set time" QR (D5) |
| Display JS crashes | Watchdog reloads WebView within seconds |
| Wrong/missing zone file | Error card + admin warning, clock still shows |
| Admin phone lost | Settings also reachable via TV remote (basic subset) |
| Box dies | Config export/import → new box running in minutes |
