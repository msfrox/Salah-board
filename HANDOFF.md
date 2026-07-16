# HANDOFF — Salah Board

## State (this session)

Shipped a display + admin + deploy overhaul for the **Linux Debian kiosk**
(`deploy/serve.py`, systemd, Chromium). All verified with screenshots on a running
`serve.py` at :8422. Committed on `main`.

Done:
- **High-contrast theme resized** — base is now `font-size: calc(2.05vmin * --sb-scale)`
  so the hero azan/iqamah times fill the board (~30vmin, matching the 1024×576 design)
  instead of the old half-size port. Still resolution-independent (vmin); `--sb-scale`
  is the fine adjustment. Removed the 720p hero-shrink media query.
- **Scale range 0.2–5× / 0.1 steps** — `config.js` clamp, admin slider, validator, schema doc.
- **Time offset works everywhere** — display renders `now() + config.time.offsetMs`;
  new admin **Time** tab: live board clock (skew-corrected via `/api/time`), ±1s/10s/1min
  nudges, "match this device", and an advanced "set system clock" (`/api/time` POST → `settime.sh`).
- **Phone→board config sync fixed** — `serve.py` now has real `/api/config` GET/PUT
  (persists to `~/.config/salahboard/config.json`, outside the repo). Display polls it
  every 3s, so a phone save shows on the board within seconds. Verified live.
- **WiFi hotspot from admin** — new **Network** tab; `serve.py` `/api/hotspot` → `hotspot.sh`
  (nmcli) via `sudo -n`. install-kiosk.sh installs NetworkManager + a scoped sudoers drop-in.
  Change SSID/password + start/stop from the UI.
- **Admin reorganised into tabs** — General / Prayers / Jumu'ah&Ramadan / Display / Time /
  Network / Preview. Hidden panels stay in the DOM so the single Save still covers everything.
- **Dev/Preview tab** — opens the live board forced into any of the 13 states (`?state=`/`?t=`).
- **Docs** — CONFIG-SCHEMA (scale + time), INSTALL-DEBIAN "Updating an installed board".

## Gotchas / notes
- Privileged features (hotspot, set-clock) need the sudoers drop-in from a fresh
  `sudo bash deploy/linux/install-kiosk.sh` run; without it they report "unavailable"
  cleanly. Off the board device they always degrade gracefully.
- The time OFFSET (privilege-free) is the primary drift fix; the system-clock setter is
  the offline heavy option and turns off NTP.
- Android shell (`android/`) was NOT updated — it has its own server/bridge and would need
  the same `/api/config` + hotspot/time parity if that path is ever revived.

## Resume
Work is complete and pushed. Next natural task: Android-shell parity, or field-test the
hotspot/set-clock on the actual Acer tablet.
