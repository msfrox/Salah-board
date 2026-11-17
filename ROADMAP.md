# Roadmap — Salah-board

One line per item. Full cards are in `TASKS.md`. The original milestone specs (M1–M5) are in
`docs/MILESTONES.md`; `PLAN.md` is the finished history of the Linux kiosk overhaul.

| To do this | Read |
|---|---|
| Anything | `CLAUDE.md` (golden rules), `HANDOFF.md` |
| Understand what v1.0 is | `decisions/0001-linux-kiosk-is-v1-android-is-parked.md` |
| Touch the timetable data or the engine | `decisions/0002-…`, `docs/ARCHITECTURE.md` D6 |
| Display behaviour | `docs/SPEC.md`, `docs/CONFIG-SCHEMA.md` |
| Themes and look | `README-designs.md` |
| Install or update a board | `deploy/README.md`, `deploy/linux/INSTALL-DEBIAN.md` |
| What waits on Shehan | `SHEHAN-TODO.md` |

## Shipped

- M1 web display and state machine · M1.5 display refinements · M2 settings panel.
- Linux Debian kiosk (sessions 1–4): `serve.py`, hotspot, WiFi join, clock, update and
  reboot buttons, board preview, HDMI hot-plug. Live in a masjid.

## Phase: v1.0 — the Linux kiosk release (ADR 0001, ADR 0002)

| ID | What | Model | Status |
|---|---|---|---|
| SB-1 | Docs match the project; board password out of HANDOFF | Sonnet | done 2026-11-18 |
| SB-2 | `tools/sync-data.py`, manifest and checksums | Sonnet | done 2026-11-18 |
| SB-3 | Vendor `pt-core.js`; engine as an extension; engine tests | Sonnet | tests done 2026-11-18 (`node --test tests/*.test.mjs`); swap pending |
| SB-4 | Caretaker PIN on the settings API | Opus | done 2026-11-18 (not verified on the board) |
| SB-5 | On-board timetable refresh and rollback | Opus | after PT-1 is live, SB-2, SB-4 |
| SB-6 | Content review sheets (en, ta, si; duas) | Sonnet | after Sakina SK-1 |
| SB-7 | Release by tag; update to newest tag; RELEASING.md | Opus | done 2026-11-18 (not verified on the board) |
| SB-8 | Theme sizing in the hall; caretaker guide | Opus | needs Shehan at the board |

`PT-1`, `PT-3` are Prayer-Time-Site cards; `SK-1` is a Sakina card.

## Parked

M3 Android shell · M4 Android time correction and hotspot (ADR 0001).

## Later

See `docs/MILESTONES.md` "Later".
