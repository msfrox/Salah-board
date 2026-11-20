# HANDOFF — Salah Board

_Replace this file at the end of every session; git history keeps the old versions._

## Current state (2026-11-21 — backend pass done; looks frozen)

- **Read `docs/LOCAL-CONTEXT.md` first.**
- **Pushed and tagged:** v0.10.0 (20 Nov). **Local only, not pushed:** the random-hotspot-password
  commit, the transition mocks, SB-6 and a docs pass. No push or tag from build sessions; the live
  board is untouched.
- **SB-6 built** (`tools/review-content.py`, wrapper `review-content.sh`, tests in
  `tools/test_review_content.py`): `export` writes `review/content/content-{en,ta,si}.csv`;
  `import SHEET --reviewer NAME` applies only `changed` rows, refuses broken `{placeholders}`, never
  touches Arabic or `source`, lists `unsure` rows, edits the pack textually (small diffs) and flips
  `meta.reviewed` only for a complete sheet with a reviewer. Built self-contained here because
  Sakina's SK-1 tool does not exist yet (Sakina untouched). The packs stay `reviewed: false` until a
  reviewer's sheet comes back; Shehan said the duas were reviewed with the imam on 17 Nov, so that
  sheet (or his word, recorded) is what flips it.
- **Docs fixed:** ROADMAP and TASKS now carry Status lines for SB-6 and SB-8 and record v0.10.0, the
  hotspot password and the mocks. SB-1 to SB-5, SB-7, SB-9 part 1 and SB-10 already had them.
- **No more backend cards.** SB-8 is parked (hall photos), SB-9 part 2 needs a box. Look and feature
  work waits for Shehan's transition pick: `review/transitions/` (serve the repo with
  `python3 -m http.server 8765`, open `/review/transitions/`). Don't wire the mocks.
- **Tests:** `node --test tests/*.test.mjs` (21) · `python3 -m unittest discover -s tests -p 'test_*.py'`
  (47) · `python3 -m unittest discover -s tools -p 'test_*.py'` (10). All green.

## Resume

- **Next, in order:** (1) wire a switchable `transitions` option (`config.json`, update
  `docs/CONFIG-SCHEMA.md`) built from `screens.html`, off by default, with a cheap-mode (muted cross-fade
  everywhere) so he can test performance on the board; (2) he tests on the board; (3) finalise.
- **Old note, when Shehan picks a transition:** implement it in `display/js/ui.js` / the theme CSS, respect
  `prefers-reduced-motion`, check 1366×768 in all themes and states, keep it cheap (modest kiosk box;
  avoid `filter: blur`; bloom is the heaviest).
- Follow-ups worth a card: a bayan *before* the azan; "This Hijri month began on" (LOCAL-CONTEXT §7);
  folding the review tool into Sakina's SK-1 if that is built.

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

`SHEHAN-TODO.md`. Open: pick a transition mock; send the imam's review sheet back through `tools/review-content.py import` when you have one. Also open: update the live
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
