# Installing Debian + Salah Board kiosk on an Acer Iconia W500

Step-by-step to wipe Windows off the tablet and turn it into a minimal Linux
prayer board. ~45–60 min. Written for the Acer Iconia W500, but the Debian
steps apply to any x86-64 machine.

> **⚠️ This ERASES the tablet.** Guided partitioning wipes the whole 32 GB
> SSD — Windows and all files on it are gone. Back up anything you want to
> keep first. (That's the intended "strip it down" outcome here.)

## Two ways to do the Debian install

- **Automated (recommended):** a preseed file answers every installer
  question for you (hostname, user, timezone, full-disk wipe, no desktop) and
  can even auto-install the board on first boot. You only pick your WiFi. See
  **[§4-A Automated install](#4-a-automated-install-preseed)**.
- **Manual:** click through the installer yourself following the table in
  **[§4-B Manual install](#4-b-manual-install)**. Use this if the automated
  boot line doesn't take, or you want to watch each step.

Steps 0–3 (gather kit, make the USB, boot from it) are the same either way.

## 0. What you need

- The tablet + its **charger** (keep it plugged in the whole time).
- A **USB keyboard** — the keyboard dock it came with, or any USB keyboard
  in the tablet's USB port. Required for BIOS keys and the installer.
- A **USB stick, 2 GB+** (will be erased) for the installer.
- Another computer to write the USB stick (your CachyOS machine, or any PC).
- Optional: the **HDMI monitor** connected — you can install on the tablet's
  own screen and attach HDMI at the end.
- Your **WiFi name + password** (you'll enter them during install).

## 1. Download Debian

Get the **64-bit (amd64) netinst** image (~700 MB), current stable Debian 13:

- Download page: <https://www.debian.org/download>
- Direct folder (pick `debian-13.x.x-amd64-netinst.iso`):
  <https://cdimage.debian.org/debian-cd/current/amd64/iso-cd/>

The netinst downloads the rest during install, so WiFi at install time is
handy — Debian 13 bundles the WiFi firmware, so the Atheros card in the W500
just works.

## 2. Write the ISO to the USB stick

**On Windows** — use Rufus (<https://rufus.ie>): select the ISO, select your
USB stick, keep "DD Image" mode if asked, Start.

**On Linux (your CachyOS machine)** — either balenaEtcher
(<https://etcher.balena.io>), or `dd`:

```sh
lsblk                      # find your USB, e.g. /dev/sdb — be 100% sure
sudo dd if=debian-13.6.0-amd64-netinst.iso of=/dev/sdX bs=4M status=progress oflag=sync
#                                              ^^^^ the WHOLE disk, not sdX1
```

Getting `of=` wrong overwrites the wrong disk — double-check with `lsblk`.

## 3. Boot the tablet from the USB stick

The W500 has a quirk: to get keyboard + F-keys working at power-on you must
do a "normal boot":

1. Plug in the USB keyboard and the installer USB stick.
2. **Hold the physical Windows button on the bezel and press the Power
   button at the same time.** This boots with USB-keyboard/F-key support.
3. As it starts, **tap `F12` repeatedly** to open the boot menu.
   (`F2` opens BIOS setup if you ever need it.)
4. Choose your **USB stick** from the list.

If F12 does nothing, enter BIOS with `F2`, turn on "F12 Boot Menu", set the
USB as first boot device, save & exit.

The W500 is legacy BIOS (no UEFI/Secure Boot), so there's nothing to disable.

## 4-A. Automated install (preseed)

Do this instead of §4-B to skip all the installer questions.

1. At the installer's first menu, highlight **"Install"** but **don't press
   Enter yet** — press **`TAB`** (or **`ESC`** then edit the boot line) to
   edit the boot command.
2. Append this to the end of the line, then Enter:
   ```
   auto=true priority=critical preseed/url=https://raw.githubusercontent.com/msfrox/Salah-board/main/deploy/linux/preseed.cfg
   ```
3. The only thing it asks you is your **WiFi network + password** (the
   installer must get online before it can download the preseed file).
   After that it's hands-off: it wipes the disk, creates user `board`, sets
   the timezone to Colombo, installs a no-desktop base, and — thanks to the
   preseed's first-boot hook — clones this repo and runs the kiosk installer
   automatically on the first reboot. Give it a few minutes, connect HDMI,
   and the board comes up on its own. **Skip to §6.**

Notes:
- The default password for user `board` is `salahboard`. **Change it** after
  first login (`passwd`), especially since SSH is enabled.
- Prefer to run the kiosk installer yourself? Open `deploy/linux/preseed.cfg`
  and comment out the `preseed/late_command` block before hosting/using it;
  then follow §5 after it reboots.
- If the boot line won't take (some installers ignore it), just use §4-B.

## 4-B. Manual install

Pick **"Install"** (the plain text installer is fine). Then:

| Prompt | What to choose |
|---|---|
| Language / location / keyboard | your choices (English / Sri Lanka / US keyboard) |
| Hostname | `salah-board` |
| Domain name | leave blank |
| Configure WiFi | pick your network, enter the password |
| **Root password** | **leave BLANK** (press Enter twice) — this makes your user an admin (`sudo` works, which the kiosk script needs) |
| New user — full name / username | e.g. username `board` — **remember this name** |
| User password | set one |
| Clock / timezone | `Colombo` |
| Partition disks | **Guided – use entire disk** → **All files in one partition** → **Finish** → **Yes**, write changes |
| Package manager / mirror | pick Sri Lanka (or the default); no proxy — Enter |
| Popularity contest | No |
| **Software selection** | **This step matters.** Use the arrow keys + **Spacebar** to **UNTICK every desktop environment** (GNOME, etc.). Leave only **"standard system utilities"** ticked, and tick **"SSH server"** (handy for remote access). Then Tab → OK. |
| Install GRUB boot loader | **Yes** → choose the disk (`/dev/sda`) |

Let it finish, choose **Continue** to reboot, and **pull out the USB stick**
when it restarts.

## 5. First boot — set up the board (manual path only)

*If you used the automated install (§4-A), this already happened by itself —
skip to §6.*

At the black login screen, log in as the user you made (`board` + password).
Confirm you have internet, then:

```sh
sudo apt update
sudo apt install -y git
git clone https://github.com/msfrox/Salah-board.git
cd Salah-board
sudo bash deploy/linux/install-kiosk.sh
```

The script installs X, Openbox, Chromium and the server, wires up auto-login
and the fullscreen kiosk, and routes the picture to HDMI. When it finishes:

```sh
sudo reboot
```

**Pin your masjid's zone** (optional) by running the script like this instead:

```sh
sudo KIOSK_QUERY='?zone=11&lang=ta' bash deploy/linux/install-kiosk.sh
```

(Zone numbers/params are the ones in the project `README.md`.)

## 6. Done

Connect the HDMI monitor. After the reboot the tablet logs in by itself,
starts the server, and opens the board fullscreen on the HDMI screen — no
keyboard needed from here on. On every future power-on it does the same.

**Changing settings later** needs only the mouse: **click anywhere on the
board** to open the settings page on the device itself (zone, theme, iqamah
times, notices, etc.). An on-screen keyboard appears for the text fields, with
a floating Show/Hide button so it never covers a field. No phone required — but
if you want one, the settings page has a **"Connect a phone"** button with a
scannable QR to `http://<tablet-ip>:8080/admin/`.

**Use the tablet's own screen** instead of the HDMI monitor at any time:
press **Super+P** (or **Ctrl+Alt+P**), or use the **Displays** buttons on the
settings page (External only / Tablet only / Both).

**Fully offline setup:** if the tablet will never have internet, first run
`bash deploy/linux/fetch-offline-debs.sh` on an online Debian 13 amd64
machine, then copy the repo (including the generated
`deploy/linux/offline-debs/` folder) onto the tablet — `install-kiosk.sh`
detects it and installs without any network. Do the §4-B manual install
(the automated §4-A path clones over the internet, so it needs a connection).

## Updating an installed board to the latest code

The board is a git clone (this guide put it at `~/Salah-board`), so an update is
a `git pull`. Log in on the tablet (`Ctrl+Alt+F2` for a text console), then:

```bash
cd ~/Salah-board            # wherever you cloned it
git pull                    # fetch the latest code
```

Then apply it, depending on what changed:

- **Display / admin / server changes only** (the common case):
  ```bash
  sudo systemctl restart salahboard-server   # picks up serve.py changes
  sudo reboot                                # relaunch Chromium on the new code
  ```
  (The display auto-reloads *config* changes live, but new HTML/CSS/JS needs the
  browser to reload — a reboot is the simplest way on a keyboard-less board.)

- **After an update that adds device features** (e.g. the WiFi-hotspot / clock
  controls, which need NetworkManager + a sudoers rule), re-run the installer
  once so those are set up, then reboot:
  ```bash
  sudo bash deploy/linux/install-kiosk.sh
  sudo reboot
  ```
  Re-running is safe and idempotent — it just refreshes packages, the service and
  the sudoers drop-in. Your masjid settings live in
  `~/.config/salahboard/config.json` (outside the repo), so a pull never touches
  them.

If `git pull` complains about local changes, you didn't edit tracked files on
purpose — run `git stash` first, or `git reset --hard` to take the new code as-is
(your `config.json` is safe either way, being outside the repo).

## If something's off

- **Server not answering:** log in on the tablet (`Ctrl+Alt+F2` for a text
  console), then `systemctl status salahboard-server` and
  `curl -sI http://localhost:8080/display/`.
- **Automated install didn't finish setting up the board:** check the
  first-boot log — `cat /var/log/salahboard-firstboot.log` — then just run
  `sudo bash /home/board/Salah-board/deploy/linux/install-kiosk.sh` yourself.
- **No picture on HDMI:** make sure it's plugged in before boot; the setup
  auto-detects HDMI and turns the tablet panel off.
- **WiFi didn't come back:** `sudo apt install -y network-manager` then
  `nmtui` to reconnect.
- **Get out of kiosk mode:** `Ctrl+Alt+F2`, log in, edit
  `~/.config/openbox/autostart`.

Full reference and the Windows alternative: [`../README.md`](../README.md).
