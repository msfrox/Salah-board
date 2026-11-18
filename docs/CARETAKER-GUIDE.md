# Salah Board — caretaker setup guide

*One page. Print this. No technical knowledge needed.*

> **Which board is this for?** The board in use **today** is the Linux
> kiosk (a spare PC or tablet). The Android box is the target and is still
> waiting for a suitable box to be chosen (ADR 0001, Amendment 1). Each
> section below is marked **Linux board (today)**, **Android box (later)**
> or **Both**. The Android sections apply once a box is chosen. Buying one?
> See "Choosing an Android box" in `docs/HARDWARE.md`.

> **Tamil/Sinhala translations of this guide are not included yet** — they
> need a native-speaking reviewer, same as the on-screen content packs
> (`display/content/ta.json` / `si.json`, both marked `"reviewed": false`).
> Don't print/distribute a machine-translated version of this page as-is.

## What you need

*For: Android box (later). Linux board (today): see `deploy/README.md` for the hardware.*

- The Salah Board box (any Android TV box, 2GB+ RAM) and a TV/monitor
- The remote that came with the box
- Power for both, on the same switch
- *Optional:* a phone, and masjid WiFi (or none — see step 5)

## Setup

*For: Android box (later).*

1. **Connect** the box to the TV (HDMI) and power. Turn both on.
2. **Install the app**, if not already installed: use a USB stick with
   `salah-board.apk` on it, or ask whoever set up the box to sideload it.
3. **Press Home** on the remote. Choose **Salah Board**. When asked
   "Use as Home app?", choose **Always**. This step is one-time — the box
   now boots straight into the prayer display, even after power cuts.
4. **Open settings**: long-press the OK/Enter button (or the Menu button)
   on the remote. A settings screen appears with a QR code.
5. **Set up from your phone** (recommended):
   - If the masjid has WiFi: connect the box to it first (Android's own
     WiFi settings), then scan the QR code shown — it opens the admin
     page in your phone's browser.
   - If there's **no WiFi at all**: on the settings screen, press
     **Start hotspot**. A second QR code appears — scan it with your
     phone's camera to join, then open the admin page link shown
     underneath.
   - In the admin page: set the masjid name, pick the ACJU zone, and
     check the iqamah times. Save.
6. **No phone available?** Everything in step 5 can also be done with
   just the remote, from the same settings screen: masjid name and zone
   need the phone/admin page, but **date and time** can be set entirely
   with the remote's arrow buttons (±1 minute / ±10 minutes / ±1 hour /
   ±1 day) if the clock looks wrong and there's no internet.
7. **Watch a full day** before trusting it unattended — the times should
   match your existing Fajr-to-Isha schedule. If anything looks off,
   double check the zone you picked in step 5.
8. **Done.** The box needs no daily attention. If the screen ever goes
   blank or freezes, it recovers itself within seconds — just wait; if it
   doesn't, unplug and replug the power.

## If the clock was wrong after a power cut

*For: Both (the on-screen prompt is the same; the remote buttons are Android box, later).*

Cheap boxes without a battery-backed clock can forget the time after a
power cut. Salah Board detects this on its own: if the clock looks wrong
and there's no internet, the settings screen (step 4) opens by itself
with a "set the time" prompt. Use the remote's ±1m/±10m/±1h/±1d buttons,
or scan the QR from your phone — either way, prayer times shown are
never wrong, the screen just waits for you to confirm the time.

## Settings PIN (Linux kiosk)

*For: Linux board (today).*

The settings page asks for a PIN of 6 to 12 digits, so nobody on the masjid
WiFi can change the board. The display itself never needs it.

- **First time:** if no PIN was set when the board was installed, the settings
  page asks you to choose one. Do it straight away, and give the PIN to the
  masjid committee.
- **Change it:** settings → Network → *Settings PIN*. Every other phone is
  signed out.
- **Wrong PIN five times:** the page makes you wait 30 seconds, then longer
  after each further wrong PIN. Guessing from a phone never locks the board's
  own screen.
- **Forgot it:** whoever installed the board clears it at the board. With a
  keyboard: press `Ctrl+Alt+F2`, log in, type
  `touch ~/.config/salahboard/reset-pin`, then `Ctrl+Alt+F1` to go back. (Or
  the same command over SSH.) The settings page then asks for a new PIN.

## Getting help

*For: Both.*

This is free, open-source software with no company behind it. For setup
problems, check the project's GitHub page (the same place you got the
APK from) and open an issue there.
