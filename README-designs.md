# Salah Board — display UI/UX designs

High-fidelity mockups for the `display/` screen. **High-contrast theme**,
in **landscape 16:9** (1024×576 reference) and **portrait 9:16** (480×854
reference). Sizes scale with the existing `--sb-scale` / vmin system.
English mockups; the real board stays multilingual (Tamil / Sinhala /
English / Arabic).

> These are **design references**, not the shipped app. The live app is the
> plain HTML/CSS/JS in `display/`. See “Mapping to the app” below for how to
> port them into `themes/` and `ui.js`. To eyeball everything at once open
> **`salah-board-reference.html`** (self-contained; both orientations).

## Design rationale

**The board hangs high, at the front of the hall.** Someone in the back row
must read it at a glance. So the hierarchy is built around *distance
legibility*, not density:

1. **Azan & Iqamah times are the hero** — the two values everyone actually
   looks up. They are the largest text on the board (≈174px landscape).
2. **The live clock is secondary** — it exists so people can check *how the
   current time sits against* the azan/iqamah times, so it’s smaller and
   pushed to a corner (landscape) or above the split (portrait).
3. **The countdown is tertiary** — it saves the mental subtraction (“how long
   left?”), so it’s the small green line by the next-prayer label, not a
   giant number. (It *does* go big on the dedicated BETWEEN / wait screens,
   where the countdown is the whole point.)
4. **The full-day timetable stays prominent** — people need the *whole* day
   (Fajr → Isha + Sunrise), so the six-cell strip runs full width along the
   bottom (landscape) or a 2-column grid (portrait), next prayer highlighted.

**Why high-contrast (not the old LED look):** pure-black ground, bright white
type, a single “go”-green accent. Reads in bright daytime halls and from far
away; calmer and more appropriate to a masjid than the green/amber/red LED
aesthetic. **Red is avoided entirely** — the “straighten the rows” and
khutbah screens use warm gold, which feels instructive rather than alarming.

**Motif:** the background medallion is the masjid’s own 10-fold girih rosette
(`assets/rosette-source.svg`, baked to `assets/rosette.png`), rendered as a
faint, oversized, semi-transparent watermark — present but never competing
with the numbers. A matching crescent-and-star (`assets/crescent-star.svg`)
marks the Jumu’ah screens; small inline SVG icons cover no-phones,
speaker-off, sun (ishrāq/luha) and crescent (night).

## The states

Both orientations cover the same 13 states. Screenshots are numbered in this
order, suffixed `-landscape` / `-portrait`.

| # | State | Machine state | Notes |
|---|-------|---------------|-------|
| 1 | **Normal** | `NORMAL` | clock · next azan/iqamah hero · day strip |
| 2 | **Jumu’ah — today** | `NORMAL` (Fri) | gold banner, Jumu’ah countdown, Friday etiquette |
| 3 | **Ramadan — normal** | `NORMAL` (Ramadan) | Imsak/Iftar row + iftar countdown |
| 4 | **Azan** | `AZAN` | du’ā al-wasīla, no-phones pill |
| 5 | **Between azan & iqamah** | `BETWEEN` | dominant green iqamah countdown + du’ā |
| 6 | **Iqamah** | `IQAMAH` | “straighten the rows” (gold, no red) |
| 7 | **Salah in progress** | `SALAH` | near-black, minimal light spill |
| 8 | **After salah — adhkar** | `AFTER` | astaghfirullāh + 33/33/34 tasbīh |
| 9 | **Sunrise wait** | `SUNRISE_WAIT` | countdown to ishrāq, sun icon |
| 10 | **Luha wait** | `LUHA_WAIT` | countdown until Duha becomes valid |
| 11 | **Luha open** | `LUHA_OPEN` | Duha time has begun |
| 12 | **Jumu’ah — Khutbah** | `KHUTBAH` | remain silent, speaker-off icon |
| 13 | **Night** | `NIGHT` | dimmed clock + tomorrow’s Fajr |

## Colour tokens (proposed high-contrast theme)

| Token | Value | Use |
|-------|-------|-----|
| bg | `#000000` | board ground |
| fg | `#ffffff` | primary numerals/labels |
| fg-dim | `#6f7986` | captions, secondary |
| accent (go) | `#22c55e` | next prayer, countdowns, current-prayer highlight |
| attention (azan) | `#f5b301` | Azan / Sunrise screens |
| gold | `#e6b455` / `#e8c86a` | Iqamah, Jumu’ah, Ramadan, motif |
| clock-seconds | `#4b5563` | de-emphasised `:ss` |
| hairline | `rgba(255,255,255,.10–.14)` | dividers, strip borders |
| night-fg | `#4a5563` on `#000` | dimmed night state |

Type: **Manrope** (UI/numerals) + **Noto Naskh Arabic** (du’ā/adhkar). The
repo already bundles Noto Sans/Tamil/Sinhala/Naskh — add Manrope alongside,
or swap it for the bundled Noto Sans for zero new fonts.

## Assets

- `assets/rosette-source.svg` — the exact masjid rosette (vector, from the
  masjid). Negative-space fills; renders as black-on-transparent.
- `assets/rosette.png` — same rosette baked to **white-on-transparent** so it
  tints via `opacity` over any board colour. 760×760.
- `assets/crescent-star.svg` — derived crescent + 5-point star, white stroke.

## Mapping to the app

The mockups follow the existing state machine (`docs/SPEC.md`,
`display/js/state.js`) one-to-one and reuse the current class hierarchy in
`themes/classic/theme.css`:

- `NORMAL` → `.topbar`/`.masjid-name`/`.dates`, `.hero-row` with `.clock-big`
  + the `.np-*` next block, `.timetable-strip`/`.tt-*`. **Design change:**
  azan/iqamah `.np-time` become the biggest elements; the clock shrinks and
  moves to the corner; countdown is the small `.np-countdown`. Friday and
  Ramadan are `NORMAL` variants (add `.is-jumuah` / `.is-ramadan` modifiers
  with the gold banner / imsak-iftar row).
- `AZAN` → `.screen--azan` (`.arabic` + `.translation` + no-phones pill).
- `BETWEEN` → `.screen--between` (`.icd-countdown` green dominant).
- `IQAMAH` → `.screen--iqamah` — **recolour `--sb-danger` red → gold.**
- `SALAH` → `.screen--salah` (unchanged, near-black).
- `AFTER` → `.screen--after` (adhkar rotation).
- `SUNRISE_WAIT` / `LUHA_WAIT` / `LUHA_OPEN` → `.screen--wait` variants.
- `KHUTBAH` → `.screen--khutbah` — recolour red → gold, speaker-off icon.
- `NIGHT` → `.screen--night`.

**Orientation:** the layouts already differ structurally between landscape
and portrait (hero split becomes vertical, timetable strip becomes a 2-col
grid). Drive with a `@media (orientation: portrait)` block or an
`html[data-orient="portrait"]` attribute — the reference file shows the exact
target for each.

**To adopt:** add `assets/` to a new `themes/highcontrast/`, port the tokens
above into a `theme.css`, set the medallion as a fixed low-opacity background
layer, and apply the per-state class changes above. Structure is largely in
place — this is mostly a re-skin plus the NORMAL hero re-weighting and the
red→gold recolour.

## Not included / possible follow-ups

- Live data wiring (this is static design reference only).
- Multilingual strings (mockups are English; real board rotates languages).
- Any additional overlays your `state.js` has beyond the 13 above.
