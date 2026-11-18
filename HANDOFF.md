# HANDOFF — Salah Board

_Replace this file at the end of every session; git history keeps the old versions._

## Current state (2026-11-18 — SB-4 and SB-7 done, origin/main merged, Shehan's answers recorded)

- **Shehan's answers of 18 Nov are recorded** (below, and in `SHEHAN-TODO.md`): Android is
  the target and the Linux kiosk the interim board (ADR 0001 **Amendment 1**; README,
  MILESTONES, ARCHITECTURE, RELEASING, `release.yml`, `android/README.md`, ROADMAP, TASKS
  updated); other masjids should be able to use it (new card **SB-10**); the PIN stays
  (wanted against untrained staff). New card **SB-9** (Android box checklist, then the
  shell). `CLAUDE.md` still says "parked": the lines to change are under "Waiting on Shehan".

- **Read `docs/LOCAL-CONTEXT.md` first** (Shehan's file, came in with the merge): local
  Jumu'ah practice, the live board, his preferences. Keep it current in the same commit.
- **origin/main merged** (27 of Shehan's commits up to `f4bea7d`, 17 Nov: Jumu'ah set
  azan → sunnah → bayan → khutbah → fixed 1:00 PM iqamah, background pattern and glow,
  Luha as next prayer, "Reload board" = `POST /api/restart`, running-version rows). Merge
  kept both sides: one `GET /api/version` returns origin's running/installed commit *and*
  the release status; the Network card shows both, with Check / Update to / Go back /
  Reload board / Reboot device. `/api/restart` is behind the PIN. Release messages now say
  "Reload board", not reboot. The two engine tests that pinned the old Jumu'ah sequence are
  re-pinned to the new one (early-azan 6 Nov: bayan 12:15; late-azan 3 Jul: bayan 12:26;
  both khutbah 12:53, iqamah 1:00), matching LOCAL-CONTEXT §2.
- **What runs:** the Linux Debian kiosk (`deploy/serve.py` + systemd + Openbox + Chromium
  `--kiosk`), live in a masjid. **It runs Shehan's `main` from before this work** (probably
  `f4bea7d` or close; Settings → Network → Running version shows it): no PIN, Update pulls
  `main`, and it serves the whole repo, `.git` included, to whoever is on its network. That
  network is only Shehan's phone hotspot or the board's own hotspot (never the masjid WiFi),
  so this is low risk; the update closes it. Nothing from this session is on it.
- **SB-1, SB-2 done** (earlier today). **SB-3:** characterisation tests done; the swap waits
  for Prayer-Time-Site PT-3 on its `main`.
- **SB-4 done (`a3e0c59`)**: caretaker PIN. `deploy/pinauth.py` (PBKDF2 hash in
  `~/.config/salahboard/pin.json`, 0600; sessions in memory, 30 min idle / 12 h; four free
  wrong PINs then 30 s doubling to 1 h, separate counts for the board's own screen and the
  network; reset by dropping `~/.config/salahboard/reset-pin`; CLI `set|reset|status`).
  `serve.py`: only `GET /api/config|preview|time` and the auth routes are open; Origin check;
  files served from `/display/` and `/admin/` only (checked after decoding, so `%2e%2e`
  can't climb out). Admin: lock / "set a PIN" screen with click keypad, Lock button,
  Network → Settings PIN. A refused Save says so instead of quietly writing localStorage.
  `install-kiosk.sh` asks for the PIN when run from a terminal.
- **SB-7 done (`29d1fcd`)**: `deploy/release.py` (update to newest `vX.Y.Z`, refuse a dirty
  tree, run the new version's `sync-data.py --check` and go back if it fails, rollback,
  record in `~/.config/salahboard/release.json`). Routes `GET /api/version`,
  `POST /api/version/check|update|rollback`. Settings card shows running / newest version
  with Update to / Go back to. `firstboot.sh` installs the newest tag. `docs/RELEASING.md`.
- **Tests (all green):** `node --test tests/*.test.mjs` (20) ·
  `python3 -m unittest discover -s tests -p 'test_*.py'` (24: 15 access, 9 release) ·
  `python3 -m unittest discover -s tools -p 'test_*.py'` (6). Both new suites were
  mutation-checked (gate, data check and dirty check each disabled → tests fail).
- **Browser-checked at 1366×768** on a scratch config: set PIN by keypad, save, session ended
  mid-use brings the lock back, five wrong PINs → 30 s wait, display polls config with no
  session; version card in both states. **Not verified on the board.**
- No release tag exists yet (only `debug-latest`). Until one does, Update says "No release
  has been published yet" and firstboot stays on the cloned `main`.

## Resume

**Model: Opus 5.5. Effort: medium.** Ready now: **SB-10** (ready for other masjids) and
**SB-9 part 1** (the Android box checklist into `docs/HARDWARE.md`). Then SB-3's swap once PT-3 is on the site's `main` (vendor with
`python3 tools/sync-data.py --from ../Prayer-Time-Site/data --engine`, reduce `engine.js`,
tests green before and after, `?t=` day walk at 1366×768). SB-5 is blocked (needs PT-1/PT-3
live; its routes go behind the PIN, `release.py` is a model for its swap-and-verify). SB-6
waits for Sakina SK-1; SB-8 needs Shehan at the board (the caretaker guide's new "Settings
PIN" section is a start; the rest of that guide is still Android-era).

```text
Continue Salah-board according to /project-playbook — read ROADMAP.md and HANDOFF.md in ~/Projects/Salah-board, then do
SB-10 (ready for other masjids), then SB-9 part 1 (Android box checklist). Check docs/general/RESEARCH-INDEX.md
before researching (it does not exist yet). Delegate sweeps to Haiku Explore agents.
Model: opus · Effort: medium — set both before sending.

Context you won't get from the files: nothing is pushed to the live board by a build session; no ssh to it.
```

## Updating the live board to this code (Shehan, when ready)

The board's current Update button pulls `main`, so the first update must go through `main`;
after that it follows tags. Set the PIN **before** the board restarts on the new code, so
nobody else can choose it first.

1. On your machine: `git push origin main` (and, if you want boards on the release path
   now, tag a pre-1.0 release after `docs/RELEASING.md`'s checklist, e.g.
   `git tag -a v0.9.0 -m "Salah Board v0.9.0" && git push origin v0.9.0`).
2. SSH to the board as the kiosk user (not root), then:
   ```bash
   cd ~/Salah-board
   git status --short                 # must be empty; if not: git stash
   git pull --ff-only
   python3 deploy/pinauth.py set      # 6–12 digits, typed twice
   python3 tools/sync-data.py --check # must say "data check: ok"
   sudo systemctl restart salahboard-server   # = Reload board; the screen reloads itself
   ```
   (Or, without SSH: settings → Network → Update from GitHub → Reload board, then
   **straight away** open settings on the board's screen and set the PIN.)
3. Check from a phone on the board's network (your hotspot): `http://<board>:8080/admin/` asks for the PIN;
   `http://<board>:8080/.git/config` is "not found"; the display still updates.
4. If you tagged in step 1: settings → Network → Software update should say "Running
   v0.9.0" after `python3 deploy/release.py update` (or the button) and Reload board.
5. If anything is wrong: note the running commit before step 2 (`git rev-parse --short
   HEAD`); `git checkout <that commit> && sudo systemctl restart salahboard-server` returns
   to it (the PIN file is then ignored; `config.json` is untouched either way).

## In flight

Nothing. Local commits on `main` (`a3e0c59`, `29d1fcd` and this HANDOFF), not pushed.

## Shehan's answers (18 Nov 2026)

1. **Android or Linux (Q19, D5):** "android is not parked. the linux is a stop gap till i
   find the right android box. sadly still havent found it yet." → ADR 0001 Amendment 1;
   card SB-9.
2. **One masjid or others (Q20, D6):** "yes right now only one masjidh but make it so i can
   give this to others so they can use in their masjidhs as well." → card SB-10.
3. **Who reviews the duas (Q21):** still open.
4. **PIN (Q22, D7):** yes — "i had issues of the masjidh untrained staff trying to do
   things"; "lets add a pin to the board so no one tries to be clever or a hero". Built (SB-4).
5. **The `.git` exposure:** not urgent — "even though the board is in the masjidh no one
   accesses it. it only ever connects to my phones hotspot or i use its hotspot(so no
   masjidh wifi)… no one ever had access to that device earlier either."

## Decided on default — for Shehan to review (in plain words)

Each of these is already built and can be changed later. Nothing here needs an answer
unless one sounds wrong.

- **Timetable checklist (was item 5).** The board keeps a checklist, with a fingerprint for
  each file, of the prayer-time files it carries, and it lists only the files the screen
  uses: 13 zones × 12 months and the zone list. If it were wider, the board would also carry
  pray.gear.lk's zone map and technical notes. Nothing on screen would change; the board
  would just hold a few files it never opens.
- **Setting the first PIN.** Until a PIN is set, whoever opens settings first chooses it, so
  a new board can be set up from a phone on its hotspot. On your board, the update steps set
  it before anyone else can. If a stranger ever sets it, it can be cleared at the board.
- **Wrong PINs.** After four wrong tries, settings make you wait 30 seconds, then longer each
  time (up to an hour). Wrong tries on a phone never make the board's own screen wait, so
  nobody can lock you out at the board.
- **Forgotten PIN.** Clearing it needs the board itself: a keyboard plugged into it, or SSH.
  A USB stick alone won't do it.
- **Staying unlocked.** Settings stay open until 30 minutes pass unused (12 hours at most).
  **Reload board** and a reboot also lock them: type the PIN again.
- **"Connect a phone" link** (the QR) needs the PIN too.
- **First update.** Your board runs the latest `main` today. The first update through the
  new button moves it to the newest *release*, even if that is slightly older than what it
  runs. After that it only moves forward to newer releases.
- **Go back** returns to the version that ran before, without re-checking its timetable
  files (they already worked on this board).
- **How you update the board changes.** Pushing a fix to `main` no longer reaches the board
  by itself. After pushing, you tag a release (e.g. `v0.9.1`), then on the board: Check for a
  new version → Update → Reload board. This keeps half-finished work off every masjid's
  screen, yours and anyone else's.
- **Android builds** start only from tags named like `android-v1.2.3`, so releasing the
  board never starts an Android build by accident.

## Waiting on Shehan

`SHEHAN-TODO.md`: update the board when convenient (steps above; low urgency, it is only on
your hotspot); change the board's old login password (it is in public git history); tag a
release if you want the Update button to have one; who reviews the duas; hall photos for
SB-8; an Android box that meets SB-9's checklist; merge Prayer-Time-Site `build/pt-0-3` for
the SB-3 swap; tag v1.0.0 when ready.

`CLAUDE.md` updated 2026-11-18 at Shehan's word ("update the claude.md"): Android is the target.
Duas: reviewed in person with the imam on 17 Nov (SHEHAN-TODO). v0.9.0 tagged 18 Nov at his word
("go ahead with the version numbering"); checklist steps 2–4 not run (no spare tablet).

## Gotchas

- The settings page needs the PIN on the board server; off it (plain static server)
  `auth.js` does nothing and settings save to localStorage as before.
- `tests/test_serve.py` stubs the privileged helpers, the display switcher and the release
  actions; never let a test call the real ones (they would `git fetch` or reboot).
- `release.py` leaves the board on a detached HEAD at a tag; `git pull` no longer applies
  there. Use `python3 deploy/release.py update`.
- Privileged features (hotspot, set-clock, reboot, WiFi connect) need the sudoers drop-in
  from `install-kiosk.sh`; a fresh board must run `sudo bash deploy/linux/install-kiosk.sh`.
- Masjid settings, PIN and release record live in `~/.config/salahboard/`, outside the repo.
- Preview is in memory and expires (5 minutes, or a reboot).
- One WiFi radio: joining a network or starting the hotspot drops any SSH carried over WiFi.
- The board has no `curl`; use `python3 -c 'urllib…'` or `wget`.
- Never kill Chromium on the board over SSH by matching its command line; kill by pid.
- `deploy/linux/*.sh` are tracked executable; if a pull complains,
  `git checkout -- deploy/linux/ && git pull`.
- `docs/CARETAKER-GUIDE.md` is still mostly the Android guide (SB-8 rewrites it).
