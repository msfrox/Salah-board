# 0001 — The Linux kiosk is v1.0; the Android shell is parked

- **Status:** proposed — pending Shehan's answers (fable-sprint `S15-PLAN.md`, Q19, Q20, Q22)
- **Date:** 2026-11-16

## Context

`docs/MILESTONES.md` plans the project as a web display (M1, M2, done) wrapped by an Android
kiosk app (M3, M4, not started), then a polish release (M5). `README.md` still says
"Status: foundation" and "any cheap Android TV box".

What was actually built from session 1 onward is different, and better proven: a **Debian
kiosk** (`deploy/serve.py` under systemd, Openbox, Chromium `--kiosk`) that runs on a tablet
and an HDMI screen in a masjid today. It already has most of what M3 and M4 asked of
Android: boot to the board, a settings page served to a phone, a WiFi hotspot for a masjid
with no network, clock correction, update and reboot buttons, HDMI hot-plug handling.

So the documents describe a product that does not exist and omit the one that does. A
session that follows `CLAUDE.md` ("find the first milestone not marked done") would start
writing Kotlin.

## Decision

1. **v1.0 is the Linux kiosk.** The next phase finishes and releases it. The remaining M5
   items are re-read for Linux: data refresh, the translation and content review, the
   caretaker guide, a tagged release.
2. **Android (M3, M4) is parked, not cancelled.** It is taken up when a masjid has a use for
   an Android TV box that a Linux box cannot serve. `android/` stays in the tree untouched.
3. **The docs are corrected to say this**: README status and "what it runs on",
   `CLAUDE.md`'s working instructions, `MILESTONES.md` (M3/M4 marked parked with this ADR's
   number, a new "v1.0 Linux" section), and `HANDOFF.md`.
4. **A release is a git tag.** The board's "Update" button moves to the newest release tag,
   not to whatever is on `main`, so a half-finished commit can never reach a masjid screen.
   The previous tag is remembered and the settings page can go back to it.
5. **The settings page gets a caretaker PIN.** Today every `/api/*` route on the board,
   including change-the-times, reboot, update and join-a-WiFi, is open to anyone on the
   masjid's network. A PIN set at install, checked by `serve.py`, closes that. The display
   itself stays open (it must load with nobody present).
6. **Nothing board-specific lives in the repo.** The board's address and password come out of
   `HANDOFF.md` and go to Shehan's password manager; the repo documents a fresh install only.
7. **Written for a stranger.** Even with one masjid today, the release, the install guide and
   the caretaker guide assume someone who has never met Shehan.

## Consequences

- The golden rules in `CLAUDE.md` are unchanged except rule 3 ("the shell stays thin"), which
  now reads for `serve.py` and the shell scripts as well as for Kotlin.
- The offline guarantee (SPEC "Offline guarantee") must hold on Linux: the airplane test in
  M4's acceptance list is re-run against the kiosk as part of the release card.
- The PIN is a small barrier for a small threat (a curious person on the WiFi). It is not
  hardening against an attacker with the device in hand, and the docs say so.
- If Shehan answers Q19 with "Android first", points 1 and 2 swap, and points 3 to 7 stand.
