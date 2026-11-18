# Hardware guide

> **Which board is which.** The board in use **today** is the Linux kiosk
> (a spare PC or tablet running `deploy/`), an interim stop-gap. The
> **target** is an Android TV box, still waiting for a suitable box
> (ADR 0001, Amendment 1; card SB-9). Each section below is marked:
> **[Android target]**, **[Linux board, today]** or **[Both]**.

## What to buy  **[Android target, with a Linux stop-gap note]**

The table and first two notes are about the Android box. The last note
(a spare PC as a stop-gap) is the **Linux board, today**. For a full
shop checklist see "Choosing an Android box" below.

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
- Also runs without Android at all: any spare x86 PC, laptop or Windows
  tablet works as a stop-gap. `deploy/` has a copy-and-run kiosk kit
  (tiny Python static server + fullscreen Chromium/Edge + auto-boot) for
  minimal Linux (recommended) or Windows — see `deploy/README.md`. You
  manage config in that browser instead of the built-in admin server.

## Setup overview  **[Android target]**

*(For the Linux board, see `deploy/README.md` and the caretaker guide.)*

Full step-by-step is in `docs/CARETAKER-GUIDE.md` (printable, one page).
Short version: sideload the APK, press Home → "Always", long-press the
remote to open settings, configure via the QR-linked admin page (or the
D-pad if there's no phone/WiFi at all).

## Wall mounting & cabling  **[Both]**

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

## Choosing an Android box (the target board)  **[Android target]**

Take this page to the shop. No technical knowledge needed. We do not
recommend any brand or model; any box that passes the checks will do.
Settings menus differ from box to box, so the paths below are a guide,
not exact.

### Must have (all of these, or don't buy)

| # | The box must... | Why |
|---|---|---|
| 1 | Run **Android 8.0 or newer** | The app needs Android 8.0 (software level 26). It is also the oldest version that can switch on the no-WiFi hotspot. |
| 2 | Have **2 GB RAM or more** | Less makes the screen slow or freeze. |
| 3 | Have **HDMI out** that works at **1366x768 or 1920x1080** | Those are the sizes masjid TVs use. |
| 4 | Have **WiFi that can run a hotspot** | Lets you set up from a phone where the masjid has no WiFi. |
| 5 | **Allow installing an APK** from a USB stick or a download (not locked) | The app is installed from a file, not from a store. |
| 6 | Let you **choose a different Home app and keep it ("Always")** | The board must start by itself. Some TV boxes lock their launcher; those can't be used. |
| 7 | Have an **updatable Android System WebView (or Chrome)**, recent enough to show the display | The display is a web page. An old, stuck WebView shows a broken screen. |
| 8 | **Turn itself on when power returns** after a full cut | After a power cut nobody should need to press a button. This is the main weakness of today's interim board. |

### Nice to have

- A **clock battery**, so the time survives a power cut (the app can fix
  the time without one, so this is only a bonus).
- An **Ethernet** socket, for a steadier connection than WiFi.
- A remote with a **Menu key**, which opens the board's settings.

### How to test in the shop

Ask the seller to let you try these on the box before you pay. Menu names
vary by box; look around if yours differ.

1. **Android version.** Settings -> About (or "About device") -> Android
   version. Must say 8.0 or higher. Also check RAM there if shown.
2. **Home app.** Settings -> Apps -> Default apps -> Home app (some boxes
   call it "Launcher" or "Home screen"). Can you pick a different one?
   If the setting is missing or greyed out, the box is locked: don't buy.
3. **Unknown sources.** Settings -> Security (or Apps -> Special access)
   -> Install unknown apps / Unknown sources. You must be able to switch
   it on for the file manager or browser.
4. **Install a file.** Plug in a USB stick with any harmless APK and
   check the box offers to install it.
5. **Open the display page.** Open the box's browser (or Chrome), go to
   the board's display page (the project's GitHub page has the address).
   The prayer times must show, fit the screen and not look broken.
6. **WebView/Chrome version.** Settings -> Apps -> Android System
   WebView (or Chrome). It should show a version number and an Update
   option (via the Play Store, if the box has one).
7. **Power test.** With the box running, pull the power plug out for a
   few seconds and plug it back in. It must start up **by itself**,
   with no button press. If it stays off, don't buy it.
8. **Hotspot.** Settings -> Network (or WiFi) -> Hotspot / Portable
   hotspot. Check it can be switched on.

Write the box's exact model down and tell the project (open an issue on
GitHub), so the checks can be recorded once a box is chosen.
