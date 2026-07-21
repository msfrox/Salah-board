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
- Also runs without Android at all: any spare x86 PC, laptop or Windows
  tablet works as a stop-gap. `deploy/` has a copy-and-run kiosk kit
  (tiny Python static server + fullscreen Chromium/Edge + auto-boot) for
  minimal Linux (recommended) or Windows — see `deploy/README.md`. You
  manage config in that browser instead of the built-in admin server.

## Which device? (Android box vs Pi vs mini-PC vs Arduino)

Short answer: **a cheap Android TV box**, and it's not a coincidence — the
whole product is a web display wrapped in a thin Android shell (see
ARCHITECTURE.md D2–D8). The APK *is* the product, so the box that runs it
best is an Android box. Everything else is a fallback that drops features.

- **Arduino — no.** It's a microcontroller with kilobytes of RAM; it can't
  run a browser/WebView at all. Wrong category. (A real green/yellow/red
  LED matrix board is a *different product*; Salah Board renders a full
  1080p HTML screen.)
- **Raspberry Pi — works, but the worst fit for a masjid specifically.**
  ~70% of Pi signage failures are SD-card corruption, and it's triggered
  by *unclean power cuts* — i.e. daily masjid reality here. Heat (75–80 °C
  in a hot hall) shortens life, and kiosk mode / auto-recovery / remote
  admin all have to be hand-configured. The Android shell gives all of
  that for free. Fine for a hobbyist with active cooling + a quality PSU +
  read-only/eMMC storage; not something to hand a caretaker. Note it *can*
  still run the browser fallback well if flashed to Armbian (see below).
- **Mini-PC / Intel NUC — most reliable, but overkill.** No SD card, x86,
  runs the `deploy/` Chromium kiosk kit. But it's dearer (LKR 40k–80k+),
  draws more power 24/7, and you lose the Android shell's niceties. Only
  worth it for a large central masjid that already has a spare PC.
- **Android TV box — the answer for ~95% of installs.** Purpose-built to
  sit behind a TV all day, and crucially uses **eMMC flash, not an SD
  card**, so it survives power cuts far better than a Pi.

## Buying in Sri Lanka — the fake-box problem

The local market is flooded with counterfeit boxes advertising fake specs,
and — this is the important part — **the fake models and the malware models
are the same models.** The names you'll see everywhere (**T95, T95Max, H96,
X88 Pro, X12 Plus**) are the exact ones security researchers found shipping
with **BadBox / Triada malware baked into the firmware**: they join an
ad-fraud botnet on first boot, act as a residential proxy for someone
else's traffic, and several shipped with **ADB open over WiFi**. On a
*community* network for an *open-source religious* project, that's a trust
problem, not just a reliability one.

**So don't hunt for an "honest fake" — that isn't really a thing. Buy for
the chip, then flash it clean.** Clean firmware overwrites the malware
partition, which is exactly why a cheap box becomes usable.

**Buying rule — verify the silicon, ignore the label:**

1. Only buy a box on a **genuine Amlogic** SoC — `S905W2`, `S905X4`, or
   `S905X2/X3`. Genuine Amlogic units are consistently the reliable ones;
   the disasters are **Rockchip RK3229 clones** hiding inside boxes
   labelled "AllWinner H313" or "S905X4" (the H96 MAX X4 is an S905X3
   wearing an S905X4 sticker; fake X96Q boxes are RK3229 with 1 GB RAM
   sold as 2 GB).
2. **Verify before you trust it** — install **CPU-Z**, **AIDA64**, or
   **DevCheck** and read the *real* SoC / RAM / storage. If it claims 4 GB
   and reports 1 GB, return it. Do this in the shop if you can.
3. **Match the flash to the exact SoC + PCB revision** (identify via ADB or
   physical board inspection, not the sticker). Vendor-matched firmware
   only — "universal all-S905" ROMs are the #1 cause of bricking.

**Two flashing paths:**

- **Path A — flash clean Android**, keep the APK and the full shell
  (kiosk, watchdog, hotspot admin, time-offset). Use the official Amlogic
  **USB Burning Tool** (v2.1.7+, Windows only) with a vendor-matched clean
  Android build.
- **Path B — flash Armbian / CoreELEC (Linux) and run the `deploy/` browser
  kiosk kit.** This wipes Android entirely, so there's *no Android attack
  surface at all* — the cleanest option for a trust-critical install. It's
  a first-class supported mode of this project (ARCHITECTURE.md D2); you
  manage config in the browser instead of the built-in admin server.
  CoreELEC can even boot from SD card without touching internal flash.

**If you can't/won't flash:** buy a real vendor instead — a **Xiaomi Mi TV
Stick / Mi Box** or **Nokia Streaming Box**. They cost a bit more, are
Play-certified, and carry no BadBox. Worth it for a hands-off install.

The full research trail (models, sources, the malware reports) is kept in
`docs/HARDWARE-RESEARCH.md`.

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
