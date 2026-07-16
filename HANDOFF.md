# HANDOFF — Salah Board

Target: **Linux Debian kiosk** (`deploy/serve.py` + systemd + Chromium). Android
shell untouched.

## Done & pushed (main)

Session 1 (commit d8409ff): theme resize to fill the screen, 0.2–5× scale,
`/api/config` phone-sync, admin tabs, Time/Network/Preview tabs, hotspot scaffolding.

Session 2 follow-ups:
- **09b1848** — embedded modern variable fonts (Google Sans Flex default, Manrope,
  Figtree) + admin font picker (`config.display.font`); renamed theme
  `highcontrast`→`default` (with transparent migration); masjid name auto-shrinks to
  one line (`ui.js fitMasjidName` + reduced letter-spacing); emoji icon → inline SVG;
  admin tabs wrap on desktop; serve.py pins font/woff2/svg MIME.
- **25f3760** — time unified to the **real device clock** (display shows system time;
  admin Time tab reads the board's own wall clock and SETS the OS clock via
  `/api/time`→`settime.sh`; fixes the "4:30 ahead" skew and the dual-time confusion);
  fixed hotspot `lo`/"no suitable device" (bind `connection.interface-name` + explicit
  `ifname`); **Update-from-GitHub** + Reboot buttons (`/api/update` git pull,
  `/api/reboot`→`reboot.sh`; sudoers extended).

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
