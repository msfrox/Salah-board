# Waiting on Shehan — Salah-board

# 🟡 ANSWER HERE

The full question sheet is `fable-sprint/S15-PLAN.md` (Q19–Q22). A blank answer means the
default stands.

1. **Linux kiosk as v1.0, Android parked (Q19)?** Default: yes. ADR 0001.
   → 
2. **One masjid, or offered to others (Q20)?** Default: one now, written for a stranger.
   → 
3. **Who signs off the duas and reminders (Q21)?** Default: the masjid's imam, or an ‘alim
   you name. Name:
   → 
4. **A caretaker PIN on the settings page (Q22)?** Default: yes.
   → 

## Steps only you can do

- [ ] **Change the board's login password and save it in your password manager — now
  urgent.** The old one (and the board's address) is in git history, and the live board's
  old server hands its whole `.git` folder to anyone on the masjid WiFi
  (`http://<board>:8080/.git/…`). The update below closes that, but the old password stays
  in the public history.
- [ ] **Update the live board** to the SB-4/SB-7 code: push `main`, then the exact steps in
  `HANDOFF.md` → "Updating the live board" (set the PIN before the reboot). Build sessions
  never push to it.
- [ ] **Optional: tag a pre-1.0 release** (e.g. `v0.9.0`) after `docs/RELEASING.md`'s
  checklist, so the board's Update button has a release to move to. Until a `vX.Y.Z` tag
  exists, Update says "no release yet".
- [ ] **Review the 15 "Decided on default" items** in `HANDOFF.md` (6–15 are new: first
  PIN, lockout counting, reset, sessions, release rules; 14 is where SB-7 changes how you
  update the board, per your LOCAL-CONTEXT).
- [ ] **Photos from the back row of the hall** of each theme (`classic`, `led`, `mono`,
  `default`) for card SB-8.
- [ ] **Give the review sheets** (after SB-6) to the imam and the Tamil and Sinhala readers.
- [ ] **Tag v1.0.0** when the reviews are in and `docs/RELEASING.md`'s checklist passes.
