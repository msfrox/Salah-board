# Running Salah Board on a PC (stop-gap kiosk)

This folder turns any spare **x86 PC, laptop or Windows tablet** into a
prayer board, for use until dedicated hardware is chosen. No executable, no
build step — copy the repo folder and run a script.

## Why a server is required

The display uses `fetch()` to load its zone data, content packs and config
(`display/js/engine.js`, `main.js`). Browsers block `fetch()` over `file://`,
so **you cannot just open `index.html`** — the folder must be served over
HTTP. Every option below does the same three things:

1. serve the repo over HTTP (`deploy/serve.py`, Python standard library only)
   — the board at `/display/` and the settings page at `/admin/`,
2. open a browser in **kiosk / fullscreen** mode at the board,
3. make both **auto-start on boot** and auto-recover.

**Settings on the device itself** — no phone needed. **Click/tap anywhere on
the board** to open the settings page (the same gesture the Android shell
uses). It's fully operable with just a mouse — an on-screen keyboard pops up
for the free-text fields, with a floating **Show/Hide keyboard** button so it
never traps a field behind it. Because the board and settings page share the
same browser storage, a Save reaches the display within a couple of seconds.

**Configure from a phone** — the settings page has a **"Connect a phone"**
button that shows a scannable **QR code** (and the URL) for
`http://<device-ip>:8080/admin/`, so a phone on the same WiFi can open the
same settings. (This mirrors the Android shell's settings-overlay QR.)

**Switch which screen is used** — the kiosk drives the external HDMI monitor
and turns the tablet's own panel off. Two ways to switch:
- Press **Super+P** (or **Ctrl+Alt+P**) on a keyboard plugged into the tablet.
- Use the **Displays** buttons on the settings page — *External monitor only*,
  *Tablet screen only*, or *Both (mirror)*.

Both drive `deploy/linux/display-toggle.sh` (the buttons go through serve.py's
`/api/display/<mode>` endpoint, so they only work on the board device itself).

**No internet at all?** Run `deploy/linux/fetch-offline-debs.sh` once on an
online Debian machine to stage every needed `.deb` under
`deploy/linux/offline-debs/`, copy the repo (with that folder) onto your
install media, and `install-kiosk.sh` installs from it offline — the tablet
never needs a network. The prayer-time data is already bundled, so the board
itself is offline-first regardless.

## Which OS?

**Recommended: minimal Linux.** On weak/old hardware (e.g. an Acer Iconia
W500: AMD C-50, 2 GB RAM) a stripped Debian boots in seconds, has no forced
updates, and runs the browser far more smoothly than Windows. It's also
reproducible on *any* x86 box, which matches the project's "use whatever
hardware is available" goal. → [`linux/install-kiosk.sh`](linux/install-kiosk.sh)

**Also fine: Windows.** Zero reinstall if Windows is already there; good for a
quick test. Heavier on RAM and prone to update reboots.
→ [`windows/README-windows.md`](windows/README-windows.md)

Both restore the "auto-boot" convenience that `docs/HARDWARE.md` notes you'd
otherwise lose without the Android shell.

## Power-cut recovery (read this)

Requirement: *"restart with no intervention after a sudden power off."*

- **Once the machine boots**, auto-login + auto-start take it straight to the
  fullscreen board — fully unattended. ✔
- **A laptop/tablet with a battery is a built-in UPS:** a mains cut doesn't
  turn it off at all, so the board keeps showing through short outages. ✔
- **The one gap:** no consumer tablet/laptop auto-powers-on from *cold* when
  mains returns (unlike a desktop BIOS "Restore on AC power loss"). After a
  full shutdown someone taps the power button once. On this tablet the battery
  makes that rare. A desktop mini-PC with that BIOS option closes the gap
  completely — worth knowing when you pick final hardware.

---

## Linux quick start (Debian recommended)

1. **Install Debian minimal.** Use the netinst image; at the *"Software
   selection"* (tasksel) screen **untick everything** — no desktop, no
   GNOME. You want just "standard system utilities". This is your
   "strip it to the minimum" install.

2. **Copy the repo** onto the box, e.g. to `~/salah-board`, and get a shell
   (SSH in, or log in at the console).

3. **Run the installer** and reboot:
   ```sh
   cd ~/salah-board
   sudo bash deploy/linux/install-kiosk.sh
   sudo reboot
   ```
   It installs X + Openbox + Chromium, sets up console auto-login, a
   crash-restarting Chromium kiosk, a systemd service for the server, and
   routes the picture to HDMI (switching the tablet's own panel off).

4. It boots straight into the board on the HDMI monitor.

**Pin a zone/language** (optional): re-run the installer with, e.g.
`sudo KIOSK_QUERY='?zone=11&lang=ta' bash deploy/linux/install-kiosk.sh`.
The debug params (`?zone=`, `?lang=`, `?t=`, `?state=`) are the same ones
documented in `README.md` / `CLAUDE.md`.

### Handy commands on the box

```sh
systemctl status salahboard-server        # is the server up?
curl -sI http://localhost:8080/display/   # should print HTTP/1.0 200 OK
journalctl -u salahboard-server -f        # server logs
```

To leave kiosk mode temporarily: switch to another VT with
`Ctrl+Alt+F2`, log in, and `sudo systemctl stop getty@tty1` (or just edit
`~/.config/openbox/autostart`).

---

## Test the server on your dev machine first

From the repo root, on any OS with Python 3:

```sh
python3 deploy/serve.py 8080
# board:    http://localhost:8080/display/   (add ?t=2026-07-02T12:10 to fake the clock)
# settings: http://localhost:8080/admin/
```

This is the same server the kiosk uses — good for confirming the board looks
right before touching the tablet.
