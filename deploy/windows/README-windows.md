# Salah Board on Windows (stop-gap kiosk)

Zero-reinstall path: use the Windows already on the tablet. Heavier than the
Linux route on 2 GB RAM, but works today. Edge (built into Windows) provides
kiosk mode; the only install is Python for the tiny static server.

## One-time setup

1. **Install Python 3** from <https://www.python.org/downloads/> — tick
   **"Add python.exe to PATH"** during install. (That's the only download.)

2. **Copy the repo folder** anywhere on the tablet, e.g. `C:\salah-board`.

3. **Test it once:** double-click `deploy\windows\start-kiosk.bat`.
   Edge should open fullscreen on the board. Press `Ctrl+Alt+Del` →
   Task Manager, or `Alt+F4`, to get out while testing.

## Make it auto-start on boot

4. **Auto-login** so no password is needed after a restart:
   press `Win+R`, run `netplwiz`, untick *"Users must enter a user name
   and password"*, confirm with the account password.

5. **Auto-launch the board:** press `Win+R`, run `shell:startup`, and drop
   a **shortcut** to `start-kiosk.bat` into that folder.

6. **Never sleep / never blank the screen:** Settings → System → Power &
   sleep → set *Screen* and *Sleep* to **Never** (both battery and plugged
   in). Also worth it: Control Panel → Power Options → your plan → *Advanced*
   → **turn off display: Never**.

7. **External HDMI monitor as the display:** connect HDMI, press
   `Win+P` → **Second screen only** (or *Duplicate*). Windows remembers this.

8. **Tame Windows Update** so it can't reboot mid-prayer-time: Settings →
   Update & Security → set **Active hours** to the whole day the board is
   in use, and pause updates when possible. (This is a big reason the Linux
   route is calmer — see `../README.md`.)

## Power-cut behaviour

The tablet's battery is a built-in UPS: a mains cut doesn't turn it off, it
keeps displaying. After a full shutdown, tap the power button once — auto-login
+ the Startup shortcut then bring the board back with no further interaction.
(No consumer tablet auto-powers-on from cold when mains returns; the battery
is what covers you here.)

## To exit / update

`Alt+F4` closes Edge; close the minimised **salahboard-server** window to stop
the server. Update by replacing the repo folder (or `git pull`) — no rebuild,
it's plain HTML/JS.
