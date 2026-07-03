# Hardware guide

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

## Setup overview

Full step-by-step is in `docs/CARETAKER-GUIDE.md` (printable, one page).
Short version: sideload the APK, press Home → "Always", long-press the
remote to open settings, configure via the QR-linked admin page (or the
D-pad if there's no phone/WiFi at all).

## Wall mounting & cabling

General guidance until photos from a real installation are added here:

- Mount the screen where it's readable from the back rows without glare
  from doorways/windows — test at the time of day the hall is brightest.
- Keep the box itself accessible (behind/below the screen, not sealed
  into a wall cavity) — the power cable and, if used, a USB stick for
  APK updates both need reaching without a ladder each time.
- Route HDMI and power along the same path and secure with cable clips;
  avoid running either across a walkway.
- Put the box and screen on the same switched outlet/breaker so a power
  cut and restore always bring both back together — the app is designed
  to recover from that unattended (D3/D5), but only if the screen itself
  also powers back on.
- A cheap surge protector is worth it for a device left permanently on.

**Photos from a real installation are still needed** — this section will
get them once a first physical deployment exists; text guidance above is
deliberately generic until then rather than inventing specifics.
