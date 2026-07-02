# Salah Board

**Free, open-source prayer display for masjids** — built for Sri Lanka
(official **ACJU** timetable, Shafi'i), designed to run on any cheap
Android TV box and any TV.

Commercial masjid displays charge a large sum upfront — or worse, a
subscription. Salah Board is free forever, has no accounts, no cloud, no
tracking, and works fully offline. Any masjid, anywhere in Sri Lanka, can
set one up for roughly the cost of a budget Android box (~LKR 10,000) and
any HDMI screen.

> **Status: foundation.** Architecture and specs are complete; implementation
> follows the milestones in [`docs/MILESTONES.md`](docs/MILESTONES.md).

---

## What it does (target feature set)

- Live clock, today's five prayer times + sunrise (ACJU zone timetable)
- Next prayer countdown, then **iqamah countdown** after azan
- Full display state machine: azan dua → dua between azan & iqamah →
  "straighten the rows" → phones-off blackout during salah → adhkar after
- **Jumu'ah mode** (bayan/khutbah timings, etiquette, silence during khutbah)
- **Ramadan mode** (iqamah overrides, imsak/iftar)
- Sunrise (ishraq) countdown and **Luha** wait timer (configurable, default 20 min)
- Night dim/blackout between Isha and Fajr
- Rotating notices & announcements (Eid times, events)
- Hijri date with ±1 day adjustment (ACJU follows local moon sighting)
- Multi-language content: Tamil, Sinhala, English, Arabic
- Themes are plain HTML/CSS folders — anyone can contribute one
- Admin from any phone browser — the box serves its own settings panel
  over WiFi, or via its own local hotspot when the masjid has no network
- Survives power cuts on boxes with no clock battery (time-offset model)
- **No azan audio.** The muezzin calls the azan; the screen only displays.

## Architecture in 30 seconds

```
display/   Pure HTML/CSS/JS web app — the actual screen. No framework,
           no build step. Runs in ANY browser (dev, Pi, smart TV) and
           inside the Android shell's WebView in production.
android/   Thin Kotlin shell: HOME-launcher kiosk, boot receiver, WebView,
           keep-screen-on, embedded admin HTTP server, LocalOnlyHotspot,
           NTP time offset, crash watchdog. No display logic lives here.
admin/     (served by the shell) settings panel web UI, edited from a phone.
docs/      Full spec, architecture, config schema, milestones, hardware guide.
```

Prayer-time data is bundled from [pray.gear.lk](https://pray.gear.lk)
(sister project) — 13 ACJU zones × 12 months of static JSON, transcribed
from official ACJU timetables. Times are solar-based and valid every year,
so the app never *needs* the internet.

## Quick start (development)

```bash
# 1. Get the timetable data (copies from sibling repo or downloads)
powershell tools/sync-data.ps1

# 2. Serve the display folder (any static server)
cd display && python -m http.server 8000
# open http://localhost:8000  — add ?t=2026-07-02T12:10 to fake the clock
```

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
