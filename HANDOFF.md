# HANDOFF — Salah Board

_Replace this file at the end of every session; git history keeps the old versions._

## Current state (2026-11-20 — v0.10.0 pushed; transition mocks ready)

- **Read `docs/LOCAL-CONTEXT.md` first.**
- **Pushed and tagged:** `main` and **v0.10.0** (SB-3/5/9/10) went to GitHub on 20 Nov at
  Shehan's word ("yes push and tag"). Tests re-run first: 21 / 47 / 6, all green. The live
  board is untouched; Shehan updates it himself (Settings → Network → Check → Update →
  Reload board). Not pushed since: the two local commits below.
- **Backend change (local commit):** the board's hotspot now starts with a **random
  10-character password per board** instead of the shared `salahboard`
  (`deploy/linux/hotspot.sh`; `docs/SETUP-GUIDE.md` updated). Existing hotspot profiles keep
  their password. The password shows in settings → Network → WiFi hotspot.
- **Transition mocks:** `review/transitions/index.html`: four transitions (fade, slide,
  cross-fade with zoom, "bloom" circle reveal) played between real board screens (live
  display in frames, 1366×768), with a screen-pair picker and speed control. Not wired
  into the app. To open: `python3 -m http.server 8765` in the repo root, then
  http://localhost:8765/review/transitions/ (a plain file:// open can't load the data).
- **Shehan, 2026-11-20 (A1):** "later. for now its working fine. let the looks and features
  be as is for now. do the backend changes. only thing i would like to test is small
  animations between the screens ... if possible make some design mocks and show the
  animations". So: hall photos (SB-8) parked; no look/feature changes until he picks a
  transition.
- **Tests:** `node --test tests/*.test.mjs` (21) · `python3 -m unittest discover -s tests -p 'test_*.py'`
  (47) · `python3 -m unittest discover -s tools -p 'test_*.py'` (6).

## Resume

- **When Shehan picks a transition:** implement it in `display/js/ui.js` / the theme CSS
  (state changes already re-render in one place; the mock animates two layers), respect
  `prefers-reduced-motion`, check at 1366×768 all themes and states, and keep the cost low
  (the kiosk box is modest; avoid `filter: blur` if frames drop; the bloom option is the
  heaviest).
- No other backend card is ready. SB-6 waits for Sakina SK-1; SB-8 for hall photos;
  SB-9 part 2 for a box. Follow-ups worth a card: a bayan *before* the azan; "This Hijri
  month began on" (LOCAL-CONTEXT §7).

```text
Continue Salah-board according to /project-playbook — read ROADMAP.md and HANDOFF.md in ~/Projects/Salah-board, then
implement the screen transition Shehan picked from review/transitions/ (ask which if he has not said).
Check docs/general/RESEARCH-INDEX.md before researching (it does not exist yet).
Delegate implementation from task cards to Sonnet agents and sweeps to Haiku Explore agents.
Model: opus · Effort: medium — set both before sending.

Context you won't get from the files: nothing is pushed to the live board by a build session; pray.gear.lk 403s
Python's default user agent (keep a User-Agent on any new download code).
```

## Decided on default — for Shehan to review (in plain words)

Already built; each can be changed. Nothing needs an answer unless it sounds wrong.
(Earlier items, from SB-4 and SB-7, are in this file's git history at `0ab4220`.)

**Ready for other masjids (SB-10)**
- **Your board is never sent through setup.** Only a board that has *never* saved settings
  shows "not set up yet". Your saved settings count as set up.
- **This masjid's times stay as the example.** A new board's settings are pre-filled with
  your iqamah and Jumu'ah practice, labelled "an example from the first masjid", and the
  caretaker has to tick "this matches our masjid" on each page. A board must show
  *something*, and your practice is a real, sensible one.
- **Jumu'ah iqamah can follow the azan** (new choice), for masjids that don't fix it. Yours
  stays a fixed 1:00 PM.
- **A bayan before the azan is not supported yet.** The settings and the guide say so; it is
  a follow-up card if a masjid needs it.
- **The background rosette stays on every board** (it is a general pattern, and it can be
  turned down per screen).
- **The automatic installer asks for the login password** instead of giving every board
  `salahboard`. It stops once for it. Boards always install from `msfrox/Salah-board`.
- **The board's hotspot starts with a random password**, different on every board (20 Nov).
  The caretaker reads it in settings → Network → WiFi hotspot and can change it.

**Timetable refresh (SB-5)**
- **Only when someone presses it.** The board never updates its timetable by itself.
- **After an update or a go-back the screen reloads itself** within about 2 seconds, so the
  new times show without Reload board.
- **"Go back" after the first update returns to the timetable that came with the board.**
  Pressing it again goes forward again. The board keeps only two timetables.
- **Any different revision on pray.gear.lk is offered as an update** (no "is it newer"
  guessing), and an update must contain the full set of 157 files or it is refused.
- **"Online" means "the last Check worked".** Opening the page doesn't go online by itself.
- **If a refreshed timetable ever looks wrong at the board:** press Go back; or delete
  `~/.config/salahboard/data/active` over SSH and Reload board (the bundled one returns).

## Waiting on Shehan

`SHEHAN-TODO.md`. New: open the transition mocks and pick one. Also open: update the live
board to v0.10.0 when convenient; change its old login password; hall photos (SB-8, parked);
an Android box (SB-9 checklist in `docs/HARDWARE.md`); tag v1.0.0 when ready.

## Gotchas

- `display/js/pt-core.js` is vendored: never edit it; refresh it with
  `python3 tools/sync-data.py --from ../Prayer-Time-Site/data --engine`. Load order is
  config, pt-core, engine, state, ui, main.
- The display's first-run screen is skipped whenever `?t=`, `?state=` or `?zone=` is in the
  URL, or a preview is running; `?setup=1` forces it. A dev browser with empty localStorage
  shows it on a plain `/display/` URL.
- Download code must send a User-Agent (pray.gear.lk 403s `Python-urllib`).
- `SALAHBOARD_CONFIG` and `SALAHBOARD_DATA` point the server at scratch folders for local
  testing; never test against the real `~/.config/salahboard/`.
- The settings page needs the PIN on the board server; off it (plain static server)
  `auth.js` does nothing and settings save to localStorage.
- `tests/test_serve.py` stubs the privileged helpers and release actions; never let a test
  call the real ones.
- `release.py` leaves the board on a detached HEAD at a tag; use
  `python3 deploy/release.py update`, not `git pull`.
- Masjid settings, PIN, release record and refreshed timetables live in
  `~/.config/salahboard/`, outside the repo.
- One WiFi radio: joining a network or starting the hotspot drops any SSH carried over WiFi.
- The board has no `curl`; use `python3 -c 'urllib…'` or `wget`.
- Never kill Chromium on the board over SSH by matching its command line; kill by pid.
- `docs/CARETAKER-GUIDE.md` is still mostly the Android guide (SB-8 rewrites it);
  `docs/SETUP-GUIDE.md` is the Linux path for a new masjid.
