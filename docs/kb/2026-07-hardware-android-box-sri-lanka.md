# Hardware: best player device (Android box vs Pi vs mini-PC vs Arduino)

- **Date:** 2026-07-21
- **Tags:** hardware, android-tv-box, raspberry-pi, sri-lanka, malware, flashing
- **Status:** researched
- **Related:** `docs/HARDWARE.md`, `docs/ARCHITECTURE.md` (D2–D8)

## Question

What is the best hardware to run Salah Board on — Android TV box,
Raspberry Pi, Arduino, mini-PC/NUC, or something else? And in Sri Lanka,
where the market is full of counterfeit Android boxes with faked specs,
which specific device is reliable (flashing a custom ROM is acceptable)?

## Conclusion

**A cheap Android TV box on a *genuine Amlogic* SoC, verified with CPU-Z,
then flashed clean.** The product is a web display in a thin Android shell
(ARCHITECTURE.md D2), so an Android box is the intended target and keeps
every feature. Pi/mini-PC are browser-fallback options; Arduino is out.

## Reasoning by device

- **Arduino — eliminated.** Microcontroller, KB of RAM, no browser/WebView.
  Wrong category. A real LED-matrix board is a different product.
- **Raspberry Pi — works, worst fit for a masjid.** ~70% of Pi signage
  failures are SD-card corruption, triggered by unclean power cuts (daily
  masjid reality). Heat 75–80 °C; kiosk/auto-recovery/remote-admin all
  hand-configured. OK for a hobbyist (active cooling, quality PSU,
  read-only/eMMC). Can run the browser fallback if flashed to Armbian.
- **Mini-PC / Intel NUC — most reliable, overkill.** No SD card, x86, runs
  the `deploy/` Chromium kiosk kit. Dearer (LKR 40k–80k+), more power,
  loses the Android shell. Only for a large central masjid with a spare PC.
- **Android TV box — answer for ~95% of installs.** Built to sit behind a
  TV 24/7; uses **eMMC flash, not SD card**, so it survives power cuts far
  better than a Pi. Matches the existing HARDWARE.md recommendation.

## The Sri Lanka fake-box problem (key finding)

The counterfeit models and the *malware* models are the **same models**.
**T95, T95Max, H96, X88 Pro, X12 Plus** are the exact boxes found shipping
with **BadBox / Triada** malware in firmware: ad-fraud botnet on first
boot, residential-proxy abuse, several with **ADB open over WiFi**. On a
community masjid network for an open-source religious project this is a
trust problem, not only a reliability one.

Spec-faking examples:
- H96 MAX X4 — advertised S905X4/Android 10, actually S905X3/Android 9.
- Fake X96Q — advertised AllWinner H313 2 GB/16 GB, actually Rockchip
  RK3229 with 1 GB RAM / 8 GB flash.
- "X96 Air" — 8+ different internal versions in the same case.

## Buying strategy: buy the chip, then flash clean

Flashing clean firmware overwrites the malware partition — that's what
makes a cheap box usable. Rule:

1. Genuine **Amlogic** SoC only — `S905W2`, `S905X4`, or `S905X2/X3`.
   Avoid Rockchip RK3229 clones.
2. **Verify** real SoC/RAM/storage with **CPU-Z / AIDA64 / DevCheck**
   before trusting the box (do it in the shop).
3. Match the flash to the exact SoC + PCB revision (ADB / board
   inspection, not the sticker). Vendor-matched firmware only —
   "universal all-S905" ROMs are the top cause of bricking.

Two flashing paths:
- **Path A — clean Android**, keep the APK + full shell. Official Amlogic
  **USB Burning Tool** (v2.1.7+, Windows only) + vendor-matched clean ROM.
- **Path B — Armbian / CoreELEC (Linux)** + the `deploy/` browser kiosk
  kit. Wipes Android entirely → no Android attack surface. First-class
  supported mode (D2); config managed in-browser. CoreELEC can boot from
  SD without touching internal flash.

No-flash alternative: buy a real vendor — **Xiaomi Mi TV Stick / Mi Box**
or **Nokia Streaming Box**. Play-certified, no BadBox, costs a little more.

## Sources

- H96 MAX X4 fake S905X4 — https://androidpctv.com/h96-max-x4-fake-s905x4/
- T95 hides malware (Security Affairs) — https://securityaffairs.com/140866/security/t95-android-tv-box-malware.html
- BadBox pre-installed (BleepingComputer) — https://www.bleepingcomputer.com/news/security/android-tv-box-on-amazon-came-pre-installed-with-malware/
- Pre-loaded malware (EFF) — https://www.eff.org/deeplinks/2023/05/android-tv-boxes-sold-amazon-come-pre-loaded-malware
- Repurposing dodgy boxes as Linux (Hackaday) — https://hackaday.com/2025/11/03/repurposing-dodgy-android-tv-boxes-as-linux-boxes/
- Custom firmware for Amlogic S905 (Alibaba guide) — https://electronics.alibaba.com/buyingguides/custom-firmware-for-amlogic-s905-tv-boxes-a-practical-guide
- X96 model guide — https://electronics.alibaba.com/buyingguides/x96-android-tv-box-guide-what-to-choose-in-2025
- Raspberry Pi 24/7 signage optimization (piSignage) — https://blog.pisignage.com/how-to-optimize-raspberry-pi-for-24-7-digital-signage-complete-guide/
- Pi vs Amazon Signage Stick (Brix) — https://brixsignage.com/blog/raspberry-pi-vs-amazon-signage-stick/
- Signage media players comparison (MediaSignage) — https://digitalsignage.com/digital_signage/docs/hardware/media-players/
