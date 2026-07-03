# Admin API — browser-dev vs. Android (M3)

`admin/js/admin.js` talks to config through two functions only:
`loadConfig()` and `persistConfig(config)`. Everything else (form
binding, validation, notices CRUD, export/import) is storage-agnostic.
Swapping these two functions is the entire M3 migration — no other
file in `admin/` should need to change.

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
