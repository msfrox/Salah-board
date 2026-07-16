# Salah Board — work plan (display/admin/deploy overhaul)

Running target: **Linux Debian kiosk** (`deploy/serve.py` served by systemd as the
kiosk user, Chromium `--kiosk`). The Acer tablet runs this same Linux kiosk. The
Android shell (`android/`) is a separate future path — not touched here.

## Decisions (the why)

- **Theme scale is resolution-independent already** via `html{font-size:calc(1vmin*--sb-scale)}`.
  The high-contrast fonts looked tiny because the port undersized every rem vs the
  1024×576 design (hero should be ≈30vmin, was ~13rem) AND a `max-height:800px`
  media query shrank the hero further on 720p. Fix = bump the base vmin coefficient
  (preserves the design's proven proportions) + drop the counter-productive shrink.
  `--sb-scale` stays as the fine user adjustment. No per-resolution hacks.
- **Config sync from a phone was broken** because `serve.py` had no `/api/config`
  route — the phone's PUT fell back to the *phone's* localStorage, never reaching
  the board. Fix = real `/api/config` GET/PUT in serve.py persisting to
  `~/.config/salahboard/config.json` (outside the repo, survives `git pull`), plus
  the display polls `/api/config` so a phone save shows on the board within seconds.
- **Time**: display renders `now() + config.time.offsetMs` (privilege-free, always
  works). Admin Time tab nudges the offset and can match the admin device's clock
  (needs `/api/time` GET for the board's current clock). Optional system-clock set
  via a sudoers helper.
- **Hotspot** (Linux/NetworkManager): serve.py → `deploy/linux/hotspot.sh` (nmcli)
  via `sudo -n` (sudoers drop-in installed by install-kiosk.sh). Admin Network tab
  toggles it and edits SSID/password.
- **Admin tabs**: wrap the existing cards into tab panels (hidden panels stay in the
  DOM, so populate/collect are untouched). New tabs: Time, Network, Preview.
- **Dev/Preview**: reuses the existing `?state=`/`?t=` debug params — buttons open
  the live display forced into each of the 13 states. No display changes needed.

## Phases

- [x] P0 — explore, plan
- [x] P1 — scale range 0.2–5× (config clamp, admin slider, validation, schema doc)
- [x] P2 — display: apply `time.offsetMs`; poll `/api/config` for phone-sync
- [x] P3 — serve.py: `/api/config`, `/api/time`, `/api/hotspot`
- [x] P4 — Linux helpers: hotspot.sh, settime.sh, sudoers, install-kiosk.sh, NM pkg
- [x] P5 — admin: tabbed layout + Time + Network + Preview tabs + CSS + JS wiring
- [x] P6 — high-contrast theme resize (screenshot-verified — hero now ≈30vmin)
- [x] P7 — docs: config schema + tablet update instructions
- [x] P8 — verify (screenshots), commit, push

## Prayer keys (never rename): fajr, sunrise, luhr, asr, magrib, isha
