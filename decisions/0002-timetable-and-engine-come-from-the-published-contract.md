# 0002 — The timetable and the engine come from pray.gear.lk's published contract

- **Status:** proposed — pending Shehan's answers (fable-sprint `S15-PLAN.md`, Q10, Q11)
- **Date:** 2026-11-16
- **Follows:** Prayer-Time-Site `decisions/0001-one-prayer-times-source-is-the-published-data-contract.md`

## Context

`display/data/` holds a byte-identical copy of Prayer-Time-Site's 156 ACJU files, put there
by `tools/sync-data.ps1`, a PowerShell script that looks for `E:\GitHub\Prayer Time Site`.
Development moved to Linux; the script no longer runs where the work happens.
`display/js/engine.js` is a hand-adapted copy of the site's `pt-core.js` with iqamah logic
mixed in, so a fix in one does not reach the other.

A board in a masjid cannot tell whether its timetable is current, and there is no way to
update the timetable without updating the whole program. Architecture decision D6 planned an
online refresh "comparing a version/hash from pray.gear.lk"; the site had no such thing to
compare against. The family ADR above adds it (`data/manifest.json`).

## Decision

1. **Bundled, always.** All 156 files and `zones.json` stay in the repo and in every
   release. The board never needs the internet (golden rule 2 is unchanged).
2. **Synced by manifest.** `tools/sync-data.py` (Python standard library, runs on Linux and
   Windows) replaces the PowerShell script. It reads `https://pray.gear.lk/data/manifest.json`
   (or a local Prayer-Time-Site checkout given with `--from`), downloads what differs,
   verifies every SHA-256, and writes `display/data/manifest.json` alongside the files.
3. **The board can refresh itself, but only when asked.** The settings page shows the
   timetable revision and, when the board is online, whether a newer one exists. A caretaker
   presses "Update timetable". `serve.py` downloads to a temporary folder, verifies every
   checksum against the manifest, runs the same sanity checks as the site's validation suite
   on the new set, swaps it in one step, and keeps the previous set for "go back". A failed
   or partial download changes nothing. There is no silent automatic update: the people
   responsible for a masjid's prayer times should know when they change.
4. **Refreshed data lives outside the repo**, in `~/.config/salahboard/data/`, next to the
   config. The display reads from there if a complete, verified set exists, otherwise from the
   bundled set. A program update (`git` to a new tag) therefore never fights a data update.
5. **The engine is vendored, not adapted.** `display/js/pt-core.js` is an unmodified copy of
   the site's file (its version is in the file). Iqamah, Jumu'ah and Ramadan logic move to
   `display/js/engine.js`, which *uses* `PT` and adds to it. `sync-data.py --engine` refreshes
   the vendored copy.
6. **Prayer keys are unchanged**: `fajr, sunrise, luhr, asr, magrib, isha`.

## Consequences

- Depends on Prayer-Time-Site cards PT-1 (manifest) and PT-3 (configurable `DATA_BASE`,
  version constant) being merged and live. The sync tool can be built against a local
  checkout before that; the on-board refresh cannot be finished until the manifest is live.
- The display gains one indirection (which data folder), which must be covered by the
  state-machine tests: a wrong path here is a blank board.
- Licence position is unchanged: code GPL-3.0, timetable data CC BY-NC-SA 4.0 from
  pray.gear.lk, as the README already states.
