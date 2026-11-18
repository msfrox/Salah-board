# Waiting on Shehan — Salah-board

# 🟡 ANSWER HERE

The full question sheet is `fable-sprint/S15-PLAN.md` (Q19–Q22). A blank answer means the
default stands.

1. **Linux kiosk as v1.0, Android parked (Q19)?** Default: yes. ADR 0001.
   → **Answered 18 Nov:** "android is not parked. the linux is a stop gap till i find the
   right android box. sadly still havent found it yet." (ADR 0001 Amendment 1; card SB-9.)
2. **One masjid, or offered to others (Q20)?** Default: one now, written for a stranger.
   → **Answered 18 Nov:** "yes right now only one masjidh but make it so i can give this to
   others so they can use in their masjidhs as well." (Card SB-10.)
3. **Who signs off the duas and reminders (Q21)?** Default: the masjid's imam, or an ‘alim
   you name. Name:
   → 
4. **A caretaker PIN on the settings page (Q22)?** Default: yes.
   → **Answered 18 Nov:** yes — "i had issues of the masjidh untrained staff trying to do
   things"; "lets add a pin to the board so no one tries to be clever or a hero". (Built, SB-4.)

## Steps only you can do

- [ ] **Update the live board** to the SB-4/SB-7 code when convenient: the exact steps are
  in `HANDOFF.md` → "Updating the live board" (they set the PIN before the board restarts).
  Only you can do it: the board is reachable only on your hotspot. This also gives the
  board the PIN you asked for.
- [ ] **Change the board's login password** some time and keep it in your password manager.
  Not urgent (18 Nov: "no one accesses it. it only ever connects to my phones hotspot or i
  use its hotspot(so no masjidh wifi)"), but the old one is in the repo's public git
  history, and the board's old server shows its `.git` folder to whoever is on its network
  until the update.
- [ ] **When you find an Android box**: check it against card SB-9's list in `TASKS.md`
  (Home app can be changed, turns on after a power cut, Android 8+, 2 GB RAM, hotspot).
- [ ] **Change four lines in `CLAUDE.md`** that still say Android is parked (exact text in
  `HANDOFF.md` → "Waiting on Shehan"), or ask a session to do it.
- [ ] **Optional: tag a pre-1.0 release** (e.g. `v0.9.0`) after `docs/RELEASING.md`'s
  checklist, so the board's Update button has a release to move to. Until a `vX.Y.Z` tag
  exists, Update says "no release yet".
- [ ] **Skim "Decided on default" in `HANDOFF.md`**, now in plain words (what each means for
  you or a caretaker at the board). The one that changes your routine: pushing to `main` no
  longer updates the board; you tag a release, then Check → Update → Reload board.
- [ ] **Photos from the back row of the hall** of each theme (`classic`, `led`, `mono`,
  `default`) for card SB-8.
- [ ] **Give the review sheets** (after SB-6) to the imam and the Tamil and Sinhala readers.
- [ ] **Tag v1.0.0** when the reviews are in and `docs/RELEASING.md`'s checklist passes.
