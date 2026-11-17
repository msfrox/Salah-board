# Releasing Salah Board

A release is a git tag `vX.Y.Z` on `main`. Boards only ever run a release: the
settings page's *Update* moves a board to the newest tag, and a fresh install
(`firstboot.sh`) starts on it (card SB-7, `deploy/release.py`). Pushing to
`main` reaches no masjid; **pushing a tag reaches every board whose caretaker
presses Update.** So the checklist below is the gate.

Version numbers: `vMAJOR.MINOR.PATCH`. PATCH for fixes, MINOR for a feature or
a timetable revision, MAJOR for anything that needs the installer re-run
(new sudoers rule, new package). `v1.0.0` is Shehan's call, after SB-8 and the
content reviews (`SHEHAN-TODO.md`). Only `vX.Y.Z` counts: `v1.0`, `v1.0.0-rc1`
and `debug-latest` are ignored by boards. Android tags are `android-vX.Y.Z`
(the parked APK workflow; ADR 0001).

## Checklist

Do these on the exact commit you will tag. Write the results in the release
notes.

### 1. Tests (build machine)

```bash
node --test tests/*.test.mjs                              # engine (20)
python3 -m unittest discover -s tests -p 'test_*.py'      # settings API, PIN, releases
python3 -m unittest discover -s tools -p 'test_*.py'      # data sync
python3 tools/sync-data.py --check                        # bundled timetable vs manifest
```

All must pass. A failing `--check` also makes boards refuse the release.

### 2. Day walk at 1366×768, every theme

Serve with `python3 deploy/serve.py 8080` (or any static server) and open
`http://localhost:8080/display/` at a **1366×768** window. For each theme
(`default`, `classic`, `led`, `mono`; switch in settings → Display), step a
weekday and a Friday with `?t=`:

| `?t=` | Expect |
|---|---|
| `2026-07-02T03:30` | night, next is Fajr |
| `2026-07-02T04:40` | Fajr azan → between → iqamah |
| `2026-07-02T06:30` | after sunrise, Luha wait / open |
| `2026-07-02T12:10` | before Luhr |
| `2026-07-02T15:40` | Asr sequence |
| `2026-07-02T18:30` | Magrib (Hijri date flips) |
| `2026-07-02T21:00` | after Isha: tomorrow's Fajr |
| `2026-07-31T21:00` | after Isha on the last of the month: 1 August's Fajr |
| `2026-12-31T21:00` | after Isha on 31 December: 1 January's Fajr |
| `2026-07-03T12:20` | Friday: Jumu'ah flow, khutbah screen |

Then `?state=` for each of `normal, azan, between, iqamah, salah, after,
luha-wait, luha-open, night, jumuah, khutbah` with a notice banner on, and one
pass with Ramadan on. Nothing clipped, overlapping or unreadable.

### 3. Airplane test on the Linux kiosk

M4's acceptance list (`docs/MILESTONES.md`), re-run on the kiosk (a spare
tablet, never the live board):

- [ ] WiFi off and Ethernet out, clock set wrong (`sudo date -s '2025-01-01 03:00'`),
      reboot: the board comes up showing the timetable for the date it believes.
- [ ] With only the board's mouse: open settings, enter the PIN, set the clock
      on the Time tab: the times are right; still right after a reboot.
- [ ] Start the hotspot from the Network tab; a phone joins it and reaches the
      settings page (asks for the PIN).
- [ ] A board with no PIN set shows "Set a settings PIN", not a lock-out.
- [ ] Note anything the Android spec promised that the kiosk lacks (e.g. a
      "clock looks wrong" screen) in the release notes. Don't block on it
      unless it shows a wrong prayer time.

### 4. Update path

On the spare tablet, running the previous release: Network → *Check* → *Update
to vX.Y.Z* → reboot. Then *Go back* → reboot, and forward again. Settings and
PIN survive both ways.

### 5. Tag and notes

```bash
git switch main && git pull
git tag -a vX.Y.Z -m "Salah Board vX.Y.Z"
git push origin vX.Y.Z
```

Release notes (GitHub release on the tag, plain words for a caretaker):
what changed on screen, whether the installer must be re-run (a MAJOR), the
timetable revision (`display/data/manifest.json` → `revision`), known gaps
from step 3.

### 6. The live board

Shehan updates the masjid's board himself, from its settings page, after the
spare tablet has run the release for a day. Build sessions never push to it.
