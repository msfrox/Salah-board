# Android shell (M3–M5)

Thin Kotlin kiosk wrapper — see `docs/ARCHITECTURE.md` D2–D8 for the design.
Nothing display-related lives here; the WebView just points at the
embedded server, which serves `display/` and `admin/` unmodified from
`../display` and `../admin` (see `:app:copyWebAssets` in `app/build.gradle.kts`).

## Build

```sh
cd android
./gradlew :app:assembleDebug      # unsigned debug APK
./gradlew :app:assembleRelease    # release build; unsigned unless SALAH_KEYSTORE_* env vars are set
```

Signed releases are built by `.github/workflows/release.yml` on a `v*` tag,
using these repo secrets: `SALAH_KEYSTORE_BASE64` (base64 of the `.jks`),
`SALAH_KEYSTORE_PASSWORD`, `SALAH_KEY_ALIAS`, `SALAH_KEY_PASSWORD`.

## Module layout

- `MainActivity.kt` — single activity: WebView, fullscreen/keep-awake,
  boot sanity check (D5), remote-control key handling
- `WatchdogService.kt` / `BootReceiver.kt` — D3 (kiosk survives crashes/reboots)
- `server/SalahHttpServer.kt` — NanoHTTPD server: static `display/`+`admin/`
  plus the `/api/*` routes documented in `admin/api.md`
- `config/ConfigStore.kt` — the on-disk `config.json` (D7)
- `time/SntpClient.kt`, `time/TimeSync.kt` — D5 offset tracking
- `net/HotspotManager.kt` — LocalOnlyHotspot for the no-WiFi fallback (D4)
- `data/DataRefresh.kt` — optional, admin-triggered ACJU data refresh (D6)
- `ui/SettingsOverlay.kt` + `res/layout/overlay_settings.xml` — the
  TV-remote settings screen (D-pad time adjust, hotspot QR, admin URL QR)
- `JsBridge.kt` — `window.SalahBridge` (brightness only; config goes
  through the HTTP API, not the bridge — see D8)

Facts that don't change:
- minSdk 26 (Android 8.0 — LocalOnlyHotspot API floor), target 34
- Single activity + WebView, server bound to localhost + LAN, never public
- SNTP is a small vendored client (adapted AOSP), not a library dependency

## What's unverified

This was written and code-reviewed without access to a physical Android
device or emulator in this environment. Before ticking the M3/M4
acceptance boxes in `docs/MILESTONES.md`, run through them on real
hardware:

- Install on an Android 8+ box, set as Home, reboot, confirm it survives
  and stays foregrounded (watchdog relaunch, `WatchdogService`)
- Force-kill the WebView process and confirm recovery within 10s
- Edit config from a phone on the same WiFi and from the box's own
  hotspot; confirm the display reloads
- Pull the WiFi antenna + set the system clock wrong; confirm the boot
  sanity overlay appears and the D-pad time controls fix it with zero
  network (the "airplane test", SPEC.md § Offline guarantee)
- Tag a release and confirm the GitHub Actions signing workflow produces
  an installable APK
