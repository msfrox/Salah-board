# Admin API — browser-dev vs. Android (M3)

`admin/js/admin.js` talks to config through two functions only:
`loadConfig()` and `persistConfig(config)`. Everything else (form
binding, validation, notices CRUD, export/import) is storage-agnostic.
Swapping these two functions is the entire M3 migration — no other
file in `admin/` should need to change.

## The Linux kiosk (`deploy/serve.py`, v1.0) — access and the PIN

The full route list is the docstring at the top of `deploy/serve.py`. Since
SB-4 every route needs the caretaker's session except these:

| Route | Who calls it | Why it is open |
|---|---|---|
| `GET /api/config` | the display, every 3 s | holds no secrets (`docs/CONFIG-SCHEMA.md`) |
| `GET /api/preview` | the display | a state name and a time, nothing else |
| `GET /api/time` | the display, Time tab | the board's clock |
| `GET /api/auth` | `admin/js/auth.js` | `{pinSet, loggedIn, waitSeconds}` |
| `POST /api/login` | lock screen | `{pin}` → `200` + `sb_session` cookie, `401` wrong, `429` wait, `409` no PIN yet |
| `POST /api/logout` | "Lock settings" | clears the cookie |
| `POST /api/pin` | lock screen, Network → Settings PIN | `{pin}` sets the first PIN while none is set; afterwards `{pin, current}` with a session |

Everything else (`PUT /api/config`, hotspot, WiFi, clock, display switch,
preview push, update, reboot, `whoami`) answers `401 {"pinSet": …}` without a
session. The cookie is `HttpOnly; SameSite=Strict`; a request whose `Origin`
is another site gets `403`. Sessions end after 30 idle minutes or 12 hours and
are in memory only. Wrong PINs: four free, then 30 s, doubling to an hour,
counted separately for the board's own screen (loopback) and the network.

`admin/js/auth.js` loads first: it shows the lock (or "set a PIN") screen,
and any later `401` from `/api/` brings it back. `persistConfig()` returns
`false` on a refused save instead of writing localStorage. Off the board
(`/api/auth` missing) none of this runs. Only `/display/` and `/admin/` are
served as files. Tests: `python3 -m unittest discover -s tests -p 'test_*.py'`.

## Browser-dev (M2, current)

- `loadConfig()` reads `localStorage['sb_config']` (same key the display
  uses, `SBConfig.STORAGE_KEY`), deep-merged onto defaults.
- `persistConfig(config)` writes the same key via `SBConfig.save()`.
- Live update: the display tab already listens for the `storage` event
  (`display/js/main.js`) and reloads config automatically — no polling
  needed. This only fires cross-tab, which is exactly the M2 setup
  (admin in one tab, display in another).

## Android shell (M3) — HTTP API the embedded server must expose

Per `docs/ARCHITECTURE.md` D4/D8, the shell serves `display/`, `admin/`
and this API from the same embedded HTTP server (NanoHTTPD/Ktor CIO),
bound to localhost + LAN interface only (never public).

| Method & path | Body | Response | Notes |
|---|---|---|---|
| `GET /api/config` | — | `200` full config JSON | Same shape as `sb_config` / `docs/CONFIG-SCHEMA.md` |
| `PUT /api/config` | full config JSON | `200` `{ "ok": true }` or `400` `{ "error": "..." }` | Shell validates + persists to its config file, then tells the WebView to reload (JS bridge or it just re-fetches) |
| `GET /api/status` | — | `200` `{ "version", "uptimeMs", "lastConfigSaveISO", "dataZones": [...] }` | Diagnostics only, no admin form field maps to it |
| `POST /api/time` | `{ "iso": "2026-07-03T18:30:00" }` | `200` `{ "ok": true, "offsetMs": ... }` | M4. Shell computes `offsetMs` vs. system clock, persists it |
| `POST /api/preview?state=AZAN` | — | `200` `{ "ok": true }` | Optional QA helper mirroring the `?state=` debug param, for testing from the admin UI without touching the TV |
| `POST /api/data-refresh` | — | `200` `{ "checked", "updated": [...], "error"? }` | M5/D6. Downloads the configured zone's 12 month files from pray.gear.lk, SHA-256-compares against the active copy, writes only files that changed. Manual trigger only — never runs automatically |

`admin.js`'s `loadConfig`/`persistConfig` become:

```js
async function loadConfig() {
  const res = await fetch('/api/config');
  return SBConfig.deepMerge(SBConfig.defaults(), await res.json());
}
async function persistConfig(config) {
  const res = await fetch('/api/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  return res.ok;
}
```

Everything upstream of these two functions (`collectForm`, `validate`,
`populateForm`, notices CRUD, export/import) is unchanged — validation
stays client-side so the admin UI never shows a raw server error on
what could be a shared/slow LAN connection; the server-side check in
`PUT /api/config` is a defensive backstop, not the primary UX.

## Export / import

Both modes export/import a plain `config.json` file via the browser's
File API (`Blob` + `<a download>` / `<input type=file>`) — this doesn't
touch the API at all, so it works identically in dev and on-device.
