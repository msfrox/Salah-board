# Salah Board: setup guide for a new masjid

This guide takes you from "buy a box" to "board on the wall". You do not need
to be a programmer, but you do need to be comfortable following steps and
typing a few lines on a keyboard. Plan about an hour for the install, plus
time to mount the screen.

Lines marked **(check)** are things the project's files did not confirm. Treat
them as "look at this on your own board", not as a promise.

---

## 1. What you get

Salah Board is a free prayer-time display for masjids in Sri Lanka. It shows
the official **ACJU** timetable (Shafi'i) on any TV or monitor.

- Live clock, today's prayer times, the next prayer and the iqamah countdown.
- Jumu'ah mode, Ramadan mode, a Luha timer after sunrise, a Hijri date, and
  rotating notices.
- Tamil, Sinhala, English and Arabic.
- **No internet needed.** All 13 ACJU zones for all 12 months are already
  inside it. The internet is used only to fetch updates, if you choose to.
- **No accounts, no cloud, no tracking, no ads.** It is free (GPL-3.0).
- **No azan audio.** The muezzin calls the azan live. The screen only displays.

What it does **not** do yet: a bayan shown *before* the azan on Fridays is not
supported yet. See step 4.

---

## 2. What to buy

Full detail is in [`HARDWARE.md`](HARDWARE.md). In short:

| Item | What you need |
|---|---|
| The board | A spare **x86 PC, laptop or tablet** that can run Debian Linux and has HDMI out (or a way to connect to a TV) |
| Screen | Any TV or monitor with HDMI. 32 inch or larger is recommended for a hall |
| USB keyboard | Only for the install and rare fixes |
| USB stick, 2 GB or more | For the Debian installer. It will be erased |
| WiFi name and password | Needed during the install (a phone hotspot works) |

The **Linux kiosk is what works today.** An **Android TV box** is the planned
future board, but it is not ready, so do not buy one for this yet.
[`HARDWARE.md`](HARDWARE.md) has a shop checklist for Android boxes for when it
is.

Price: the docs give prices for the Android box only (LKR 8,000 to 15,000). They
give no price for a PC or tablet. **(check)**

**Think about power cuts when you choose.** A laptop or tablet with a battery
keeps running through short cuts. After a **full** shutdown, most tablets and
laptops will not turn themselves back on when power returns. Someone has to
press the power button once. A desktop mini-PC with a BIOS option like
"restore on AC power loss" avoids this. The project suggests this is worth
knowing before you pick.

---

## 3. Install the board

The full step-by-step, with the exact boot line, is in
[`deploy/linux/INSTALL-DEBIAN.md`](../deploy/linux/INSTALL-DEBIAN.md). This is
the short version.

**Warning: the install erases the whole disk.** Back up anything you want to
keep first.

1. **Download Debian 13** (64-bit "amd64 netinst"):
   <https://www.debian.org/download>
2. **Write it to the USB stick** with Rufus (Windows) or balenaEtcher
   (<https://etcher.balena.io>) on another computer.
3. **Boot the board from the USB stick.** Plug in the keyboard and the stick,
   power on, and tap the boot-menu key (often `F12`, `F11` or `Esc`; it
   differs by make, so **(check)** yours. If no menu appears, enter the BIOS
   setup, usually `F2` or `Del`, and put USB first in the boot order). The Acer tablet the project was built on has its own quirks,
   described in INSTALL-DEBIAN.md.
4. **Choose how to install:**
   - **Automated (recommended; needs internet during the install):** at the
     installer's first menu, highlight **Install**, press `TAB` (on a newer
     UEFI machine the menu looks different: press `e` instead and add the line
     to the end of the line that starts with `linux`), add the line below at
     the end, then press Enter (UEFI: `Ctrl+X`):
     ```
     auto=true priority=critical preseed/url=https://raw.githubusercontent.com/msfrox/Salah-board/main/deploy/linux/preseed.cfg
     ```
     It asks you for two things:
     1. your **WiFi** network and password, and
     2. a **login password for the user `board`**.

     **Choose your own password and write it down somewhere safe.** There is no
     built-in or shared password, so nobody else's board has the same one. After
     that the install runs by itself: it wipes the disk, sets the Colombo
     timezone, installs Debian with no desktop, then on the first restart it
     downloads Salah Board and sets up the kiosk. Give it a few minutes.
     It installs the newest numbered **release** (a version like `v0.9.0`).
     If none has been published yet it uses the latest code instead, and the
     update button (section 6) says "No release has been published yet"
     until one is.
   - **By hand (also the route with no internet during the install):** if
     the boot line does not work, follow the table in section
     4-B of INSTALL-DEBIAN.md, then run the kiosk installer yourself (section 5
     of that file).
5. **Plug in the screen by HDMI** (before the first boot is best). The board
   starts by itself. After this it needs no keyboard.

If the board did not finish setting itself up, INSTALL-DEBIAN.md ("If
something's off") says where to look.

---

## 4. First start

When the board first shows its screen, it says **"This board is not set up
yet."** That is normal. Prayer times appear once you finish the setup below.

### 4a. Open the settings

Do the first part **on the board's own screen**, with a mouse or by touch.
The first thing the settings page asks for is a new PIN (4b).

- **On the board itself:** touch or click anywhere on the screen. An on-screen
  keyboard appears for typing, with a Show/Hide keyboard button.
- **From a phone:** on the board, open settings → **Network** → **Connect a
  phone** → **Show phone link & QR**. It shows the board's address
  (`http://<board-address>:8080/admin/`) and a QR code; scan it with a phone
  on the same network.
- **No WiFi at the masjid?** The board can run its own WiFi hotspot:
  settings → **Network** → **WiFi hotspot** → **Start**. It is called
  **SalahBoard** and it starts with a random password, different on every
  board. After setting your PIN (4b), open the same WiFi hotspot card: the
  password is shown there. Write it down, or **change both** and press
  **Save & start**. Then join that hotspot
  from the phone and use the phone link above.

### 4b. Set the PIN first

The first time you open the settings, the board asks you to **choose a PIN of
6 to 12 digits** and type it twice. Do this straight away. Until a PIN is set,
anyone on the same network can change the board. The display itself never asks
for the PIN.

Give the PIN to the masjid committee and write it down. You can change it later
under **Network**, then **Settings PIN**.

### 4c. The four setup steps

A setup guide runs across the top of the settings page. Each step shows the
right tab, and you tick a box to say you checked it.

> **Important:** the values already filled in are only an **example**, from the
> first masjid that used the board. They are not rules. Check every one against
> how your own masjid does things.

| Step | What to do |
|---|---|
| **1. Your masjid** (tab **General**) | Type the **masjid name** (required). Tick the **languages** to show. Choose your **ACJU zone** under **Zone & theme**, because your prayer times come from it: each zone in the list shows its districts, so pick the one with your district. Theme and font can be changed any time |
| **2. Iqamah times and Luha** (tab **Prayers**) | For each prayer, set the iqamah either as **minutes after the azan** or as a **fixed clock time**. Set the **Luha** wait after sunrise |
| **3. Jumu'ah (Friday)** (tab **Jumu'ah & Ramadan**) | Check the order of events, the **bayan** time (or switch the bayan off), and the **khutbah** length. The **iqamah** can be a **fixed time** or **minutes after the azan**. Ramadan mode can stay off until Ramadan |
| **4. Finish** | Press **Finish setup**. Prayer times appear on the screen within a few seconds |

Notes on Jumu'ah:

- The board does **not** yet support a bayan *before* the azan. If your masjid
  does that, tell the project (section 7).
- As **an example of one masjid's practice**: the first masjid runs azan, then
  sunnah, then bayan, then khutbah. Its iqamah is a fixed 1:00 PM all year,
  because office workers plan around a lunch hour. Its khutbah is about 7
  minutes. Yours may differ, and that is fine. Set what you do.

Everything can be changed later in the same settings. The clock is under
**Time**. The hotspot and updates are under **Network**.

### 4d. Check it

Watch for a full day, and compare the times with your existing printed
timetable. If they are off, check the **zone** first.

---

## 5. Mounting on the wall

From [`HARDWARE.md`](HARDWARE.md). The project says photos from a real
installation are still missing, so this is general guidance.

- Put the screen where the back rows can read it, away from glare from doors
  and windows. Test at the brightest time of day.
- Keep the board within reach (behind or below the screen, not sealed in a
  wall), so you can reach the power cable without a ladder.
- Run HDMI and power together and clip them down. Do not run them across a
  walkway.
- Put the board and the screen on **the same switched outlet**, so a power cut
  and its return bring both back together.
- A cheap surge protector is worth it for a device that stays on all the time.

**Power-cut caveat:** after a full power cut, a tablet or laptop may need
someone to press its power button once. Once it has started, it logs in,
starts the server and opens the board with no help. A battery usually rides
through short cuts. Tell whoever opens the masjid where the power button is.

Which screen the board uses: it drives the HDMI screen and turns the tablet's
own panel off. To switch, press `Super+P` or `Ctrl+Alt+P` on a keyboard, or use
the **Displays** buttons in settings.

---

## 6. Keeping it running

**Updates.** A board only ever moves to a numbered **release** (a version like
`v1.2.3`), never to unfinished work. Settings, then **Network**:

1. **Check for a new version**
2. **Update to vX.Y.Z**
3. **Reload board** (restarts in a few seconds). Use **Reboot device** only if
   something is stuck.

If the new version's timetable data fails its check, the board refuses it and
stays where it was. **Go back to ...** returns to the version before. Your
settings are not touched by an update. Checking for a new version needs the
board to be online: join it to a WiFi network (or a phone's hotspot) under
**Network** for the update, then switch back. A board that never goes online
keeps working on the version it has.

After some updates the project says to re-run the kiosk installer once and
reboot (INSTALL-DEBIAN.md, "Updating an installed board").

**The Hijri date.** ACJU follows the local moon sighting, so the Hijri date can
differ by a day from the calculated calendar. Check it **every month** and
adjust the **Hijri date offset** (a choice from −2 to +2 days): settings,
tab **Prayers**, section **Clock & Hijri date**, then **Save**.

**If the screen is blank or odd.** The board recovers from most problems on its
own, so wait a moment first. INSTALL-DEBIAN.md, "If something's off", lists the
fixes (server not answering, no picture, WiFi not back).

**Forgotten PIN.** The PIN can only be cleared at the board. This is on purpose.

1. Plug in a keyboard. Press `Ctrl+Alt+F2` and log in as `board` with the login
   password you wrote down at install.
2. Type: `touch ~/.config/salahboard/reset-pin` and press Enter. Nothing is
   printed when it works; that is normal. (If `Ctrl+Alt+F2` shows only a black
   screen, use SSH instead, below.)
3. Press `Ctrl+Alt+F1` to go back to the board.
4. Open the settings. It asks you to choose a new PIN.

(The same command works over SSH.) Run it as the `board` user, not root.

**Wrong PIN guesses.** After five wrong PINs the settings page makes you wait
30 seconds, then longer. This never locks the board's own screen.

---

## 7. Getting help

This is free, open-source software with no company behind it. The code and the
issue tracker are on GitHub: <https://github.com/msfrox/Salah-board>. To ask a
question, report a problem, or say your masjid does something the board does
not support yet (for example, a bayan before the azan), open an **issue** there.
Say what hardware you are using and what you saw on screen.

Religious content (duas and reminders) in the board has sources, but the
project's notes say the language packs still need a scholar's review. Please
have your imam check them before relying on them.

---

## Where to read more

| Doc | What it covers |
|---|---|
| [`deploy/linux/INSTALL-DEBIAN.md`](../deploy/linux/INSTALL-DEBIAN.md) | Full Debian install, updates, fixes |
| [`deploy/README.md`](../deploy/README.md) | How the kiosk works, handy commands |
| [`HARDWARE.md`](HARDWARE.md) | What to buy, wall mounting |
| [`CARETAKER-GUIDE.md`](CARETAKER-GUIDE.md) | Day-to-day care (written for the Android box; the PIN section also applies to Linux) |
