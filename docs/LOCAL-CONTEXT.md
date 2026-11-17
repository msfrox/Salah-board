# Local context — how things are done here

**Read this at the start of every session.** It records local practice,
community conventions and the project owner's preferences, learned from real
use of the board, so they never have to be explained twice.

> **Keep it current.** Whenever a session learns something new about local
> practice, the community, the board in use, or how the owner likes things
> done, add or correct it here **in the same commit** as the related change.
> If something here turns out to be wrong, fix it here and say so. Keep it to
> practice and preferences: no passwords, IP addresses, emails or personal
> details (this repository is public).

Last updated: November 2026.

---

## 1. The pilot board

- First live board: a masjid shown as **"AJM"** on the display, **ACJU zone 01**
  (Colombo / Gampaha / Kalutara), Sri Lanka.
- Hardware: a small x86 tablet/PC running the **Debian kiosk** (`deploy/`),
  driving an ordinary LED TV over HDMI at **1366×768**. Viewed from across the
  hall, mounted high.
- Updating the board: Settings → Network → **Update from GitHub**, then
  **Reload board** (restarts the board program; the screen reloads itself).
  **Reboot device** only when something is stuck. The version line on that
  card shows which commit is running.
- The owner tests changes live using **Preview → Run the board from this
  time** (board is the default target; "Open here" opens a tab instead).

## 2. Jumu'ah (Friday) — local practice

- **Order:** azan → sunnah prayer → **bayan** → **khutbah** → iqamah.
  The bayan is *after* the azan here (not before it, as in some masjids).
- **Iqamah is a fixed time (currently 1:00 PM) and does not move through the
  year.** Reason: office workers get a one-hour lunch break (12–1 or 12:30–
  1:30) and plan around a predictable Jumu'ah. Never derive the iqamah from
  the azan.
- **Khutbah is short — about 7 minutes** — and ends at the iqamah, so the
  khutbah start = iqamah − khutbah length.
- **Bayan usually starts at 12:15 PM.** The Zuhr azan moves through the year
  (zone 01: 11:56–12:26), so in the late-azan months (roughly late
  December–April and June–early September) **the bayan starts later**, after
  the azan and the sunnah prayer; the iqamah stays the same. The board does
  this automatically (bayan = its usual time, or azan screen + minimum sunnah
  time, whichever is later).
- Bayan speaker/topic change every week; they belong to one Friday only and
  clear themselves after that Jumu'ah.
- **During the bayan and khutbah the screen must be calm** — it must never
  draw eyes away from the speaker: no rotating cards, minutes not seconds,
  no ticking seconds on the clock. During the khutbah show **only** the
  "remain silent" notice, the phones notice and the time.
- The sunnah, bayan and khutbah screens are **one designed set** (same
  layout) and all carry a **"switch off your mobile phones · please remain
  silent"** footer with the no-phone icon (khutbah: phones only — "Remain
  silent" is already its main message).

## 3. Prayer names and religious text

- ACJU timetable, **Shafi'i** conventions (see `CLAUDE.md`).
- Say **"Luha"** only — not "Luha (Duha)" or "Duha" (also லுஹா / ලුහා).
- After Fajr, the main screen treats **Luha** as the next prayer:
  Sunrise | Luha (Luha = sunrise + 20 min).
- **ﷺ after every mention of the Prophet** in display text, in every language,
  kept on the same line as the name. Add it to translations only — never
  alter the Arabic text.
- Never invent religious wording (e.g. a rak'ah count for the Jumu'ah sunnah).
  Use sourced text already in `display/content/`, or wording the imam gives.
  All three language packs are still `"reviewed": false` — they need a
  scholar's review before wider rollout.
- **Hijri date follows ACJU moon sighting**, so it can differ from the
  calculated calendar by a day; the offset is set by hand in settings and
  needs checking every month (the pilot board is back on offset 0 as of
  late Nov 2026).

## 4. Display design preferences (owner-approved)

- **Prayer times (azan / iqamah) are always the largest text.** If space is
  tight, the clock, name and countdown step back first.
- Main screen, landscape: "NEXT PRAYER" as a small two-line caption **beside**
  a big prayer name, on one row with the clock. Short names fill the name box;
  long ones (Maghrib, Jumu'ah) shrink to fit it — the size doesn't have to
  match the clock.
- No captions on the clock or the countdown (they're self-explanatory).
- Main clock: small, dimmed AM/PM after the seconds. Corner clock (other
  screens): AM/PM at full clock size.
- Clock + countdown must add up exactly to the target time (countdowns round
  up).
- Everything sizes itself to the real screen (the hero measures its space);
  always check at **1366×768**, all states, with banners on.
- Long text never wraps a banner onto two lines (it shrinks, then "…").
- **Landscape is the main design** (boards are mounted landscape); portrait
  only needs a tidy fallback.
- **Background pattern** (the masjid's rosette): the same motif on every
  screen but **composed differently per screen** to suit its meaning (not one
  layout copied everywhere); must be visible on a real TV; tinted (default
  gold). Calm/near-dark screens (sunnah, bayan, khutbah, salah, night) keep it
  subtle. Colour, and visibility + size per screen, are in Advanced.

## 5. Settings / admin preferences

- Settings belong where a caretaker would look: Luha under **Prayers**;
  Jumu'ah and Ramadan together.
- Show the result of derived times live next to the inputs (e.g. "Khutbah
  starts 12:53 PM").

## 6. How the owner likes to work

- Not a coder: explain **why** in plain language, give **one clear
  recommendation** (not a menu of options), use tables and short steps.
- **Work directly on `main`**: commit and push there; no feature branches.
- Test properly before saying it's done (screenshots at 1366×768, all
  languages, banners on); don't trade quality for speed.
- Markdown for documents; ask before creating a new document.
- Photos of the live board are the main feedback channel — look closely at
  them for problems beyond the one asked about.

## 7. Open ideas (not built yet)

- **"This Hijri month began on [date]"** setting, entered from ACJU's
  announcement, instead of a manual day offset — recommended next.
- Scholar review of all duas/translations (a checklist could be prepared).
- Power-cut recovery: the tablet doesn't power itself on after a full outage;
  a mini-PC with "power on after AC loss" fixes it.
- On normal days there's ~50 px of space above the timetable (the prayer
  times are already at their maximum width); could let the timetable use it.
