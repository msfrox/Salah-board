# HANDOFF — Salah Board

Target: **Linux Debian kiosk** (`deploy/serve.py` + systemd + Chromium). Android
shell untouched.

## Done & pushed (main)

Session 1 (commit d8409ff): theme resize to fill the screen, 0.2–5× scale,
`/api/config` phone-sync, admin tabs, Time/Network/Preview tabs, hotspot scaffolding.

Session 2: **09b1848** embedded fonts + picker, theme→`default`, name auto-shrink,
SVG icon. **25f3760** time→real device clock (`/api/time`→settime.sh), hotspot iface
binding, Update-from-GitHub + Reboot buttons.

Session 3 (commit 8c98374) — **hotspot now works end-to-end** (verified live on the
board: AP up on 10.42.0.1, dnsmasq serving DHCP, a phone got a lease, reverted clean):
- Root cause of "hotspot shows but can't connect": `dnsmasq-base` was never installed,
  so NM's `ipv4.method shared` had no DHCP server → clients associate but get no IP.
  `install-kiosk.sh` + `fetch-offline-debs.sh` now install it explicitly.
- Root cause of "strictly unmanaged / can't start": Debian ships `[ifupdown]
  managed=false`. Installer now drops `/etc/NetworkManager/conf.d/10-salahboard-managed.conf`.
- `hotspot.sh` forces WPA2 (rsn/ccmp/pmf) for modern-phone compatibility.
- Root cause of "git pull says local changed": the installer `chmod +x`'d the deploy
  scripts but git tracked them 100644 → mode-bit collision every pull. All
  `deploy/linux/*.sh` are now tracked 100755, so pulls are clean. Board pulled to
  8c98374, working tree clean, obsolete stash dropped.

The **live board** already had `dnsmasq-base` + `managed=true` applied manually this
session; a **fresh board** gets both from the updated installer. The existing
`salahboard-hotspot` NM profile picks up the WPA2 settings on its next start (self-heals
via `ensure_profile`).

## Deferred (not started — pick up in a fresh session)

Stopped here to stay within the token window on a committed state; these are the
bigger, board-only pieces:

1. **Preview should show on the BOARD screen, not the phone.** Today the Preview tab
   `window.open`s on the viewing device. Plan: add a preview channel — `serve.py` holds
   `{state,t,until}` (POST `/api/preview`), the display polls `/api/preview` and applies
   `forceState` while active; admin buttons gain "Show on board" + "Resume live".
2. **HDMI hotplug auto-switch + scaling.** When "external only" and HDMI is unplugged,
   nothing switches to the tablet panel (needs a keypress; scaling then wrong). Plan: a
   udev rule / small `systemd` monitor on `drm` hotplug that runs `display-toggle.sh`
   (tablet) on disconnect and re-applies the panel's native mode/scale. Board-only; can't
   verify from dev.
3. **In-panel WiFi connect GUI** (scan + join a network). Plan: `serve.py` `/api/wifi/scan`
   + `/api/wifi/connect` via a `wifi.sh` nmcli helper (same sudoers pattern); admin list UI.
4. **Other themes (classic/led/mono) sizing.** They ALREADY auto-scale to the screen
   (`font-size: calc(1vmin * --sb-scale)`), so "auto-adjust to display size" is technically
   met; only the `default` theme needed the 2.05× bump to match its 1024×576 design. If they
   look small in the hall, bump each theme's coefficient with per-theme screenshot checks
   (don't blanket-apply 2.05 — their layouts weren't designed at that proportion).

## Gotchas
- Privileged features (hotspot / set-clock / reboot / future wifi) need the sudoers
  drop-in from a fresh `sudo bash deploy/linux/install-kiosk.sh`; without it they report
  "unavailable" cleanly. This update also adds `reboot.sh` to sudoers, so a re-run is
  needed to enable the reboot button.
- Masjid settings live in `~/.config/salahboard/config.json` (outside the repo).
- Board is SSH-reachable as `board@<ip>` (pw `12345678`); repo at `~/Salah-board`,
  single wifi radio so starting the hotspot drops any SSH over wifi — test via a
  self-reverting script (see git history, session 3) or accept the drop.
- The mode-bit pull collision is fixed repo-wide; if it recurs on a board, run
  `git checkout -- deploy/linux/ && git pull` (the local changes are only chmod noise).
