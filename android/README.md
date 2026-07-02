# Android shell (M3)

Thin Kotlin kiosk wrapper. Build starts at milestone M3 — read
`docs/ARCHITECTURE.md` D2–D8 and the shell responsibilities list first.
Nothing here yet by design; do not add display logic to this module, ever.

Planned module facts:
- minSdk 26 (Android 8.0 — LocalOnlyHotspot API floor), target latest
- Single activity + WebView (WebViewAssetLoader NOT needed — assets served
  by the embedded localhost HTTP server, see D8)
- Manifest: HOME + DEFAULT launcher intent filter, BOOT_COMPLETED receiver,
  foreground-service watchdog, INTERNET + ACCESS_WIFI_STATE +
  CHANGE_WIFI_STATE (hotspot) + FOREGROUND_SERVICE permissions
- Embedded server: NanoHTTPD, bound to localhost + LAN interface, port 8080
- SNTP: small vendored client (e.g. adapted AOSP SntpClient), never a
  heavyweight dependency
- Release: signed APK via GitHub Actions on tag; keystore in repo secrets
