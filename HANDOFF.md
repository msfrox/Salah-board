# HANDOFF — Salah Board

_Replace this file at the end of every session; git history keeps the old versions._

## Current state (2026-11-18, evening — SB-3, SB-5, SB-9 part 1, SB-10 done)

- **Read `docs/LOCAL-CONTEXT.md` first** (local practice, the live board, Shehan's
  preferences). Keep it current in the same commit.
- **What runs:** the Linux Debian kiosk, live in a masjid, on Shehan's code from before this
  week's cards (v0.9.0 is tagged and pushed; whether the board has moved to it is Shehan's
  to say). **Nothing from today is pushed**; all commits below are local on `main`.
- **Today's cards (local commits):**
  - **SB-9 part 1** `2ac6eee`: Android box shop checklist in `docs/HARDWARE.md`; each
    section of HARDWARE and CARETAKER-GUIDE says which board it is for.
  - **SB-3 swap** `f2ab45d` (merge `a4d1bf9`): `display/js/pt-core.js` vendored unmodified
    (PT 1.0.0, Prayer-Time-Site `67cb755`; `diff` empty). `engine.js` uses `PT` for parsing,
    month loading, rows, keys, Hijri month names. It keeps its own timeline/rollover and
    `hijriInfo`, because PT's status functions read `new Date()` and would ignore `?t=`.
    Characterisation tests unchanged and green. **Day walk at 1366×768**, 23 moments
    (Thu 2 Jul every state, Fri 3 Jul Jumu'ah set, 31 Jul and 31 Dec rollover, Hijri flip at
    Maghrib): identical text and state before and after the swap.
  - **SB-10** `3e2c037`, `3a4cec4`: first-run setup. A board with no saved config shows
    "This board is not set up yet"; the settings page walks General → Prayers → Jumu'ah →
    Finish, each confirmed with a tick, and saves `setupDone: true`. Jumu'ah iqamah can now
    be "N minutes after the azan" (`jumuah.iqamahMode: "afterAzan"`, new engine test).
    `preseed.cfg` no longer sets a password (Debian's installer asks; checked in the
    user-setup source: `db_input critical passwd/user-password`). `docs/SETUP-GUIDE.md`,
    walked by a Sonnet agent with only the repo; its blockers were fixed.
    Browser-checked at 1366×768: setup screen, the four steps, a Save part-way, an old
    config skipping setup.
  - **SB-5** `a5abbae` (merge `ce76f2d`): on-board timetable refresh. `deploy/datarefresh.py`
    keeps refreshed sets in `~/.config/salahboard/data/{active,previous}`; `serve.py` serves
    `/display/data/*` from `active/` when it is complete and verified, else the bundled set.
    `GET /api/data`, `POST /api/data/check|refresh|rollback`, all behind the PIN. A
    "Prayer timetable" card on the Network tab. 23 new tests (swap, bad checksum, cut-off
    download, rollback, offline, `git status` clean).
  - **Download fix** `018c767`: pray.gear.lk answers Python's default user agent with
    **403** (curl gets 200). `tools/sync-data.py` now sends a named agent; this is shared by
    the board's refresh. The live check then says "already up to date (2026-11-16.1)".
    A real swap against the live site can only be seen when the site publishes a new
    revision.
- **Tests (all green):** `node --test tests/*.test.mjs` (21) ·
  `python3 -m unittest discover -s tests -p 'test_*.py'` (47) ·
  `python3 -m unittest discover -s tools -p 'test_*.py'` (6).
- **Not verified on the board:** SB-4, SB-5, SB-7, SB-10 (no spare board; the live one is
  never touched by a build session).

## Resume

Nothing in the queue can be built without Shehan:
- **SB-6** waits for Sakina SK-1 (the duas were reviewed in person with the imam on 17 Nov;
  SB-6 now only records that review).
- **SB-8** needs Shehan at the board / hall photos.
- **SB-9 part 2** needs a box.
- **Follow-ups worth a card** (not built): a bayan *before* the azan (some masjids do
  this; the engine clamps the bayan to after the azan today); a per-board random hotspot
  password instead of `salahboard` (see Decided on default); "This Hijri month began on"
  (LOCAL-CONTEXT §7).

```text
Continue Salah-board according to /project-playbook — read ROADMAP.md and HANDOFF.md in ~/Projects/Salah-board, then do
the follow-up card Shehan picks from HANDOFF "Resume" (bayan before the azan, or the per-board hotspot password).
Check docs/general/RESEARCH-INDEX.md before researching (it does not exist yet). Delegate implementation from task
cards to Sonnet agents and sweeps to Haiku Explore agents.
Model: opus · Effort: medium — set both before sending.

Context you won't get from the files: nothing is pushed to the live board by a build session; pray.gear.lk 403s
Python's default user agent (fixed in sync-data.py; keep a User-Agent on any new download code).
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
- **The board's hotspot still starts with the password `salahboard`** on every new board.
  The setup guide tells people to change it after setting the PIN. Settings still need the
  PIN, so a stranger on the hotspot sees the screen, not the settings. Making it random per
  board is a small follow-up.

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

`SHEHAN-TODO.md`. New today: **push and tag** so boards can get this work. When you're ready:

```bash
cd ~/Projects/Salah-board
git push origin main
git tag -a v0.10.0 -m "Salah Board v0.10.0: first-run setup, timetable refresh, pt-core engine"
git push origin v0.10.0
```

(Run `docs/RELEASING.md`'s checklist first if you want the full release check; the version
number is your call.) Then on the board: Settings → Network → Check for a new version →
Update to v0.10.0 → Reload board. Your board keeps its settings and won't show the setup.

Also open: update the live board when convenient; change its old login password; hall
photos (SB-8); an Android box (SB-9 checklist in `docs/HARDWARE.md`); tag v1.0.0 when ready.

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
