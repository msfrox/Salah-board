# HANDOFF — Salah Board

_Replace this file at the end of every session; git history keeps the old versions._

## Current state (2026-11-18 — SB-1, SB-2 and SB-3's tests done; local commits only)

- **What runs:** the Linux Debian kiosk (`deploy/serve.py` + systemd + Openbox + Chromium
  `--kiosk`), live in a masjid. Nothing was pushed to it. **Check what the board runs before
  assuming** (last known code on it: `b7d445a`).
- **SB-1 done:** README, `CLAUDE.md`, `docs/MILESTONES.md` (M3/M4 marked PARKED, ADR 0001),
  `docs/ARCHITECTURE.md` now describe the Linux kiosk. No board address or password is in the
  tree (checked; they remain in git history, `SHEHAN-TODO.md` asks Shehan to change them).
  `android/` untouched (its `DataRefresh.kt` comment still names the old `.ps1`).
- **SB-2 done:** `tools/sync-data.py` (`--from`, `--url`, `--engine`, `--check`; stdlib only);
  `tools/sync-data.ps1` removed. `display/data/manifest.json` added (source revision
  `2026-11-16.1`, 157 files = 156 zone files + `zones.json`, filtered from the site's
  manifest). Tests: `python3 -m unittest discover -s tools -p 'test_*.py'` (6, local HTTP
  server: download, checksum mismatch, partial download, missing file, `--check`).
  `--from ../Prayer-Time-Site/data` reports "no changes"; a corrupted file makes `--check`
  exit 1 and name it.
- **SB-3 half done:** `tests/engine.test.mjs`, 20 characterisation tests (`node --test
  tests/*.test.mjs`, no install, TZ pinned to Asia/Colombo). Mutation-checked once. **The
  swap is NOT done**: PT-3 (`b1ff42c`, versioned `pt-core.js` with `PT.configure`) exists
  only on Prayer-Time-Site branch `build/pt-0-3`, not on its `main`.
- Pinned oddities (not bugs fixed here): the default Isha iqamah (fixed 7:15 PM) is before
  Isha azan most of the year, so it falls back to azan+10; the default Jumu'ah bayan
  (12:30 PM) is after the Luhr azan (~12:16), so no bayan card is built. Worth a look in a
  later display session; the tests will need updating if either changes.
- Both ADRs are still "proposed" (Shehan has not answered `SHEHAN-TODO.md`).

## Resume

**Model: Opus 5.5. Effort: medium.** Next: **SB-4** (caretaker PIN, `TASKS.md`). Then SB-7.
SB-3's swap can follow once PT-3 is on the site's `main`: vendor with
`python3 tools/sync-data.py --from ../Prayer-Time-Site/data --engine`, reduce `engine.js`,
keep `tests/` green before and after, do the `?t=` day walk at 1366×768. SB-5 needs the live
manifest at `https://pray.gear.lk/data/manifest.json` (not checked). SB-6 waits for Sakina
SK-1; SB-8 needs Shehan at the board.

```text
Continue Salah-board according to /project-playbook — read ROADMAP.md and HANDOFF.md in ~/Projects/Salah-board, then do
card SB-4 (caretaker PIN) from TASKS.md. Delegate sweeps to Haiku Explore agents.
Model: opus · Effort: medium — set both before sending.

Context you won't get from the files: nothing is pushed to the live board by a build session; no ssh to it.
```

## In flight

Nothing. Local commits on `main`, not pushed.

## Decided on default — for Shehan to review

(Shehan, 18 Nov: "use the recommended option and continue".) Each question below is in
`SHEHAN-TODO.md`, unanswered.

1. **Linux kiosk as v1.0, Android parked (Q19)?** Options: Linux first / Android first.
   Picked: **Linux first** (ADR 0001 default). Why: it is what runs today. Reverse: ADR 0001
   says points 1 and 2 swap; re-point README/CLAUDE.md "How to work" at `docs/MILESTONES.md`
   M3 and un-park it (one commit, `git revert` of the SB-1 docs commit does most of it).
2. **One masjid or offered to others (Q20)?** Picked: **one now, written for a stranger.**
   Reverse: nothing built depends on it.
3. **Who signs off the duas (Q21)?** Not picked: needs a name. Only matters for SB-6.
4. **Caretaker PIN (Q22)?** Picked: **yes** (SB-4 will build it). Reverse: drop SB-4.
5. **SB-2 manifest scope:** the bundled manifest lists only what the display reads (zone
   files + `zones.json`), not the site's `SCHEMA.md`, schemas or `zones.geojson`. Why: keeps
   the bundle minimal. Reverse: widen `WANTED` in `tools/sync-data.py`.

## Waiting on Shehan

`SHEHAN-TODO.md`: change the board's password and save it in the password manager (the old
one is in git history); name who reviews the duas; photos from the hall for SB-8; update the
live board himself when a release is ready; merge Prayer-Time-Site `build/pt-0-3` (PT-3) to
its `main` if he agrees (needed for the SB-3 swap).

## Gotchas

- Privileged features (hotspot, set-clock, reboot, WiFi connect) need the sudoers drop-in
  from `install-kiosk.sh`; a fresh board must run `sudo bash deploy/linux/install-kiosk.sh`.
- Masjid settings live in `~/.config/salahboard/config.json`, outside the repo.
- Preview is in memory and expires (5 minutes, or a reboot).
- One WiFi radio: joining a network or starting the hotspot drops any SSH carried over WiFi.
- The board has no `curl`; use `python3 -c 'urllib…'` or `wget`.
- Never kill Chromium on the board over SSH by matching its command line; kill by pid.
- `deploy/linux/*.sh` are tracked executable; if a pull complains, `git checkout -- deploy/linux/ && git pull`.
- The settings API has no login yet (SB-4): anyone on the masjid network can change it.
- Engine tests run the display's own scripts in a `vm` sandbox with `fetch` reading
  `display/data`; keep them runnable with plain `node --test`.
