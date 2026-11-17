# Salah Board

**Free, open-source prayer display for masjids** — built for Sri Lanka
(official **ACJU** timetable, Shafi'i), designed to run as a
Linux kiosk (a small Debian PC or tablet) on any TV or HDMI screen.

Commercial masjid displays charge a large sum upfront — or worse, a
subscription. Salah Board is free forever, has no accounts, no cloud, no
tracking, and works fully offline. Any masjid, anywhere in Sri Lanka, can
set one up for roughly the cost of a small Linux box or old tablet and
any HDMI screen.

> **Status: pre-1.0, running in a masjid.** The web display, the settings panel and the
> Debian kiosk (`deploy/`) are built and live. v1.0 is the Linux kiosk
> ([ADR 0001](decisions/0001-linux-kiosk-is-v1-android-is-parked.md)); the Android shell
> (`android/`) is parked. What is next: [`ROADMAP.md`](ROADMAP.md).

---

## What it does (target feature set)

- Live clock, today's five prayer times + sunrise (ACJU zone timetable)
- Next prayer countdown, then **iqamah countdown** after azan
- Full display state machine: azan dua → dua between azan & iqamah →
  "straighten the rows" → phones-off blackout during salah → adhkar after
- **Jumu'ah mode** (bayan/khutbah timings, etiquette, silence during khutbah)
- **Ramadan mode** (iqamah overrides, imsak/iftar)
- **Luha** wait timer after sunrise (configurable, default 20 min)
- Night dim/blackout between Isha and Fajr
- Rotating notices & announcements (Eid times, events)
- Hijri date with ±1 day adjustment (ACJU follows local moon sighting)
- Multi-language content: Tamil, Sinhala, English, Arabic
- Themes are plain HTML/CSS folders — anyone can contribute one
- Per-board fine-tuning: resize or hide each element of the main screen,
  with a live preview in the admin panel
- Admin from any phone browser — the box serves its own settings panel
  over WiFi, or via its own local hotspot when the masjid has no network
- Survives power cuts on boxes with no clock battery (time-offset model)
- **No azan audio.** The muezzin calls the azan; the screen only displays.

## Architecture in 30 seconds

```
display/   Pure HTML/CSS/JS web app — the actual screen. No framework,
           no build step. Runs in ANY browser (dev, Pi, smart TV) and
           in Chromium --kiosk on the Linux board in production.
deploy/    The Linux kiosk (v1.0): serve.py (static server + settings API),
           systemd, Openbox, hotspot, WiFi, install scripts.
android/   PARKED (ADR 0001). Thin Kotlin shell: HOME-launcher kiosk, boot receiver, WebView,
           keep-screen-on, embedded admin HTTP server, LocalOnlyHotspot,
           NTP time offset, crash watchdog. No display logic lives here.
admin/     (served by serve.py) settings panel web UI, edited from a phone.
docs/      Full spec, architecture, config schema, milestones, hardware guide.
```

Prayer-time data is bundled from [pray.gear.lk](https://pray.gear.lk)
(sister project) — 13 ACJU zones × 12 months of static JSON, transcribed
from official ACJU timetables. Times are solar-based and valid every year,
so the app never *needs* the internet.

## Quick start (development)

```bash
# 1. Refresh the timetable data (optional: it is already bundled)
python3 tools/sync-data.py --check   # or --from ../Prayer-Time-Site/data, or --url https://pray.gear.lk/data/

# 2. Serve the repo (any static server; this one adds no-cache headers)
python3 deploy/serve.py 8080
# board:    http://localhost:8080/display/  — add ?t=2026-07-02T12:10 to fake the clock
# settings: http://localhost:8080/admin/    — or click the gear on the board
```

Serving the repo root (not just `display/`) keeps the on-device settings link
working: the board's gear button opens `/admin/`, which shares its browser
storage, so a Save reaches the display. To run it on a spare PC/tablet as a
real auto-starting kiosk, see [`deploy/`](deploy/README.md).

## Documentation

| Doc | What's in it |
|---|---|
| [`docs/SPEC.md`](docs/SPEC.md) | Feature spec, display state machine, rules |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Design decisions and reasoning |
| [`docs/CONFIG-SCHEMA.md`](docs/CONFIG-SCHEMA.md) | `config.json` — the contract between all parts |
| [`docs/MILESTONES.md`](docs/MILESTONES.md) | Build order M1→M5 with acceptance criteria |
| [`docs/HARDWARE.md`](docs/HARDWARE.md) | What box/TV to buy, masjid setup guide |

## License & data

- **Code:** GPL-3.0 — free forever; derivatives must stay open.
- **Timetable data:** transcribed from official ACJU timetables via
  [pray.gear.lk](https://pray.gear.lk) (CC BY-NC-SA 4.0). We do not
  calculate prayer times; ACJU is the single source of truth.
- **Religious content** (duas, reminders): sourced with references
  (see `display/content/`); verify with your local ulama before release.

Contributions welcome: themes, Tamil/Sinhala translations, testing on
different boxes, and upstream timetable corrections.
