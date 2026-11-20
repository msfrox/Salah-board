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
- [x] **`CLAUDE.md` says Android is the target** — done 18 Nov at your word.
- [x] **v0.9.0 tagged** 18 Nov at your word.
- [x] **v0.10.0 pushed and tagged** — Shehan, 2026-11-20: "yes push and tag". On the board: Settings → Network → Check → Update to v0.10.0 → Reload board.
- [ ] **Open the transition mocks and pick one** (or say what to change): `python3 -m http.server 8765` in the repo, then http://localhost:8765/review/transitions/
- [x] ~~Push the 18 Nov build commits and tag the next release~~ (SB-3, SB-5, SB-9, SB-10 and
  a download fix; all local on `main`). Until they are pushed, new installs still get the
  old preseed (with its shared password) and boards can't get the timetable refresh. The
  commands are in `HANDOFF.md` → "Waiting on Shehan".
- [ ] **Skim the new "Decided on default" items** in `HANDOFF.md` (setup for other masjids,
  timetable refresh). Nothing changes on your board unless you update it.
- [ ] **Skim "Decided on default" in `HANDOFF.md`**, now in plain words (what each means for
  you or a caretaker at the board). The one that changes your routine: pushing to `main` no
  longer updates the board; you tag a release, then Check → Update → Reload board.
- [ ] **Photos from the back row of the hall** of each theme (`classic`, `led`, `mono`,
  `default`) for card SB-8. Shehan, 2026-11-20: "later. for now its working fine." Parked.
- [x] **Duas reviewed with the imam** — Shehan, 2026-11-18: *"duas are reviewed already. i sat with the imaam
      yesterday for them."* (17 Nov, in person). SB-6's sheets now only record that review (reviewer: the imam).
- [ ] **Tag v1.0.0** when the reviews are in and `docs/RELEASING.md`'s checklist passes.
