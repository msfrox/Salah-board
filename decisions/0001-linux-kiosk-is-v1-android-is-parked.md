# 0001 — The Linux kiosk is v1.0; the Android shell is parked

- **Status:** accepted with Amendment 1 (2026-11-18, below): Android is the target, the Linux
  kiosk the interim board. Read the amendment first.
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

## Amendment 1 — 2026-11-18: Android is the target; the Linux kiosk is the interim board

- **Status of this ADR:** points 1–2 superseded by this amendment; points 3–7 accepted.
- **Shehan, 18 Nov 2026 (answer to Q19):** "android is not parked. the linux is a stop gap
  till i find the right android box. sadly still havent found it yet."
- **Shehan, 18 Nov 2026 (Q20):** "yes right now only one masjidh but make it so i can give
  this to others so they can use in their masjidhs as well."
- **Shehan, 18 Nov 2026 (Q22, the PIN):** yes — "i had issues of the masjidh untrained staff
  trying to do things"; "lets add a pin to the board so no one tries to be clever or a hero".

What changes:

1. **Android is the target platform.** The Linux kiosk (`deploy/`) is the **interim board**:
   it is what runs in the masjid until a suitable Android TV box is found, and it keeps
   getting fixes and releases meanwhile. Point 1's "v1.0 is the Linux kiosk" becomes "the
   first releases run on the Linux kiosk"; v1.0 is not tied to either platform.
2. **Android (M3, M4) is not parked; it waits on hardware.** The work is "find a box that
   meets the requirements, then finish and verify the shell" (card SB-9 in `TASKS.md`).
   `android/` stays as it is until then.
3. Points 3–7 stand. Point 4's release tags apply to the kiosk now; APK builds use
   `android-vX.Y.Z` tags (`.github/workflows/release.yml`) until SB-9 decides whether the two
   share version numbers. Point 7 ("written for a stranger") is now a card of its own
   (SB-10): Shehan wants other masjids to be able to set up their own board.
4. Rule for sessions: build features in `display/` and `admin/` (they run on both); keep
   `deploy/` changes to what the interim board needs; don't start Kotlin work before SB-9
   names a box.
