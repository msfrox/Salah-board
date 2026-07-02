# Hardware guide (skeleton — completed at M5)

## What to buy

| Item | Requirement | Typical cost (LKR) |
|---|---|---|
| Android TV box | Android 8.0+, 2 GB RAM, WiFi, HDMI. Any brand. RTC battery is a bonus, not required (see time correction) | 8,000–15,000 |
| Screen | Any TV/monitor with HDMI. 32"+ recommended for halls | existing / any |
| Power | Keep box + TV on the same switch; app recovers from cuts | — |

Notes:
- Boxes without a clock battery forget the time after a power cut. Salah
  Board handles this (NTP when online, or set the time from your phone) —
  see docs/ARCHITECTURE.md D5. You do NOT need an expensive box.
- A SIM-router/hotspot is optional. The app works fully offline.
- Also runs without Android at all: any device with a browser in kiosk
  mode (Raspberry Pi + Chromium, old laptop, smart TV browser) can open
  the display page — you lose the built-in admin server and auto-boot
  conveniences, and manage config in that browser instead.

## Setup overview (full illustrated guide at M5)

1. Flash/clean the box (remove bloat apps if any), connect WiFi if available.
2. Sideload `salah-board.apk` (USB stick or `adb install`).
3. Press Home → choose Salah Board → "Always". Done — it now owns the screen.
4. Long-press menu/settings on the remote → scan the QR with your phone →
   set masjid name, zone, iqamah times.
5. If the time is wrong (no internet): the screen shows a QR — scan, set time.
6. Test a full day with the preview mode before relying on it.

## Wall mounting & cabling
(TBD at M5 — photos from a real installation.)
