# HANDOFF — Salah Board

Target: **Linux Debian kiosk** (`deploy/serve.py` + systemd + Openbox +
Chromium `--kiosk`). Android shell untouched.

## Done & pushed (main)

- **Sessions 1–3** (through `c67d2bc`): theme fill-the-screen scaling, admin
  tabs (Time/Network/Preview), embedded fonts + picker, board time = real device
  clock, Update-from-GitHub + Reboot buttons, and the **WiFi hotspot working
  end-to-end** (dnsmasq-base + `managed=true` + WPA2; `deploy/linux/*.sh` tracked
  100755 so pulls are clean). See git history for the detail.

- **Session 4** — the three big deferred items, all **verified live on the board**:
  - `eb99334` **Preview on the BOARD screen** + **in-panel WiFi join**.
    - Preview channel: `serve.py` holds `{state,t,until}` in memory
      (`GET/POST /api/preview`, auto-expires, default 300 s). The display polls
      it every 2 s (`display/js/main.js`) and forces the state via the existing
      `forceState` path; an optional `t` re-anchors the clock. Admin Preview tab
      gained a **"Show on the board screen"** toggle + **"Resume live board"**.
      Live-verified: pushing `night` flipped the board; clear reverted to live.
    - WiFi join: `GET /api/wifi/scan` (read-only nmcli, parsed in Python —
      colon-safe, strongest-signal dedup, in-use flag; **no sudo needed**) +
      `POST /api/wifi/connect` via new `deploy/linux/wifi.sh` (sudo helper).
      Admin Network tab has a Scan → list → tap → password → Connect card.
      Scan verified on the board; connect permission granted (see below).
  - `b7d445a` **HDMI hotplug auto-switch**. `deploy/linux/hdmi-watch.sh` polls
    xrandr and, on unplug, switches the picture to the tablet **LVDS** panel via
    `display-toggle.sh` (and back to **HDMI-0** on replug). Launched from the
    Openbox autostart. Live-verified: unplug → tablet, replug → HDMI.

## Live board state (192.168.1.124, `board` / pw `12345678`, repo `~/Salah-board`)

- Pulled to **`b7d445a`**, tree clean. `salahboard-server` restarted → preview +
  wifi endpoints live. Chromium reloaded (runs the new `main.js`).
- Two persistence edits were applied **directly on the board** this session
  (a fresh board gets both from the updated `install-kiosk.sh`, so no drift):
  1. `~/.config/openbox/autostart` now launches `hdmi-watch.sh` on boot (it is
     also running manually right now via `setsid`, until the next reboot).
  2. `/etc/sudoers.d/salahboard` now includes `wifi.sh *` (validated). WiFi
     **connect** works; `sudo -n wifi.sh` confirmed permitted.
- Board is currently on **external HDMI**, showing live.

## Deferred (remaining)

1. **Other themes (classic/led/mono) sizing** — a judgment call, not a bug. They
   already auto-scale (`font-size: calc(1vmin * --sb-scale)`); only `default`
   needed its 2.05× design bump. **Only** bump a theme's coefficient if it looks
   small in the actual hall, with **per-theme screenshot checks** — do NOT
   blanket-apply 2.05 (their layouts weren't designed at that proportion).

## Gotchas

- Privileged features (hotspot / set-clock / reboot / **wifi connect**) need the
  sudoers drop-in from `install-kiosk.sh`; without it they report "unavailable"
  cleanly. A fresh board must run `sudo bash deploy/linux/install-kiosk.sh`.
- Masjid settings live in `~/.config/salahboard/config.json` (outside the repo).
- Preview is in-memory + auto-expiring; a board reboot or 5-min timeout clears it.
- Single WiFi radio: joining a network (or starting the hotspot) drops any SSH
  carried over WiFi. Scanning is safe.
- Board has **no `curl`** — hit endpoints with `python3 -c 'urllib…'` or wget.
- `pkill -f "chromium…"` over SSH also matches your own command line (self-kill);
  match a narrower pattern or `kill <pid>`.
- Optional: reboot the board once to confirm `hdmi-watch` starts from the
  autostart (it's proven working manually; this just confirms boot persistence).
- `deploy/linux/*.sh` are tracked 100755; if a pull ever complains of local
  changes, `git checkout -- deploy/linux/ && git pull` (chmod noise only).
