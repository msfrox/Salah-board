# HANDOFF — Salah Board

_Replace this file at the end of every session; git history keeps the old versions._

## Current state (2026-11-18 — SB-4 and SB-7 done, origin/main merged; local commits only, nothing pushed)

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
  `main`, and it serves the whole repo, `.git` included, to the masjid WiFi. Nothing from
  this session is on it. Steps for Shehan are below.
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

**Model: Opus 5.5. Effort: medium.** Ready cards: none that need nothing from Shehan.
SB-3's swap once PT-3 is on the site's `main` (vendor with
`python3 tools/sync-data.py --from ../Prayer-Time-Site/data --engine`, reduce `engine.js`,
tests green before and after, `?t=` day walk at 1366×768). SB-5 is blocked (needs PT-1/PT-3
live; its routes go behind the PIN, `release.py` is a model for its swap-and-verify). SB-6
waits for Sakina SK-1; SB-8 needs Shehan at the board (the caretaker guide's new "Settings
PIN" section is a start; the rest of that guide is still Android-era).

```text
Continue Salah-board according to /project-playbook — read ROADMAP.md and HANDOFF.md in ~/Projects/Salah-board, then do
SB-3's swap if Prayer-Time-Site PT-3 is on its main, else SB-8 with Shehan's photos. Check docs/general/RESEARCH-INDEX.md
before researching (it does not exist yet). Delegate sweeps to Haiku Explore agents.
Model: opus · Effort: medium — set both before sending.

Context you won't get from the files: nothing is pushed to the live board by a build session; no ssh to it.
```

## Updating the live board to this code (Shehan, when ready)

The board's current Update button pulls `main`, so the first update must go through `main`;
after that it follows tags. Set the PIN **before** the board restarts on the new code, so
there is no window where anyone on the WiFi can set it first.

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
3. Check from a phone on the masjid WiFi: `http://<board>:8080/admin/` asks for the PIN;
   `http://<board>:8080/.git/config` is "not found"; the display still updates.
4. If you tagged in step 1: settings → Network → Software update should say "Running
   v0.9.0" after `python3 deploy/release.py update` (or the button) and Reload board.
5. If anything is wrong: note the running commit before step 2 (`git rev-parse --short
   HEAD`); `git checkout <that commit> && sudo systemctl restart salahboard-server` returns
   to it (the PIN file is then ignored; `config.json` is untouched either way).

## In flight

Nothing. Local commits on `main` (`a3e0c59`, `29d1fcd` and this HANDOFF), not pushed.

## Decided on default — for Shehan to review

(Shehan, 18 Nov: "use the recommended option and continue".) Items 1–5 are from earlier
today and are also in `SHEHAN-TODO.md`.

1. **Linux kiosk as v1.0, Android parked (Q19)?** Picked: Linux first (ADR 0001). Reverse:
   ADR 0001 points 1 and 2 swap.
2. **One masjid or offered to others (Q20)?** Picked: one now, written for a stranger.
3. **Who signs off the duas (Q21)?** Not picked: needs a name. Only matters for SB-6.
4. **Caretaker PIN (Q22)?** Yes — built in SB-4.
5. **SB-2 manifest scope:** display files only. Reverse: widen `WANTED` in `sync-data.py`.
6. **Who may set the first PIN?** Options: anyone while none is set / only the board's own
   screen / only at install. Picked: **anyone while none is set**, plus the installer asks
   when run from a terminal. Why: the card requires a hotspot-only masjid to reach settings
   from a phone, and the "set a PIN" screen instead of a lock-out. Risk: someone on the WiFi
   sets it first; the fix is the reset file. Reverse: in `pinauth.change_pin`, refuse the
   first PIN unless `bucket == "local"`.
7. **Wrong-PIN counting:** Options: one global count / per client IP / board screen and
   network apart. Picked: **apart**. Why: a global count lets a phone lock out the caretaker
   at the board; per-IP is beaten by changing IP. Reverse: `_bucket()` in `serve.py`.
8. **PIN reset:** a file over SSH or the board's console only; no USB-stick detection (the
   kiosk does not auto-mount). Reverse: add a check of `/media/*/*/salahboard-reset-pin` in
   `pinauth._check_reset`.
9. **Sessions:** in memory, 30 min idle, 12 h max; a reboot logs everyone out. Reverse:
   `SESSION_IDLE` / `SESSION_MAX` in `pinauth.py`.
10. **`GET /api/whoami` behind the PIN** (the card's "all but three"). It only gives the
    board's LAN address. Reverse: add it to `OPEN_GET` in `serve.py`.
11. **A board on an untagged commit** (like the live one) updates to the newest tag even if
    that tag is older code. Why: releases are the point; main may hold half-done work.
    Reverse: in `release.status`, make `updateAvailable` false when the tag is an ancestor of
    HEAD.
12. **Go back is not gated by the data check** (the version already ran here). Reverse:
    `verify=True` in `release.rollback`.
13. **Android release workflow** now triggers on `android-v*` tags, not `v*`, so a board
    release doesn't start the parked APK build (which needs keystore secrets). Reverse: one
    line in `.github/workflows/release.yml`.

14. **LOCAL-CONTEXT vs SB-7 (from the merge).** `docs/LOCAL-CONTEXT.md` §1 described updating
    the board with "Update from GitHub" (pull `main`) and §6 says Shehan pushes straight to
    `main`; SB-7 (ADR 0001 point 4) makes boards follow release tags only. Options: tags
    only / keep pulling `main` / a per-board "channel" setting. Picked: **tags only**, and
    LOCAL-CONTEXT §1 and §6 updated to say so. Why: it is the card's purpose and a second
    masjid must never get half-done work; for Shehan the change is one extra step (tag a
    patch release after pushing a fix). Reverse: in `release.update`, fall back to
    `git pull --ff-only` when the board is on a branch, or add a `channel` key to config.
15. **Reload board ends PIN sessions** (sessions live in server memory; Reload restarts the
    server). The card says so and the lock screen returns. Reverse: persist sessions to a
    file in `~/.config/salahboard/` (`pinauth.Auth._sessions`).

## Waiting on Shehan

`SHEHAN-TODO.md`. New today: **the live board serves its `.git` folder to the masjid WiFi**
(old code), so the old board password in git history is readable by anyone there until it
is updated: changing that password is now urgent. Then update the board (steps above) and,
if wanted, tag a pre-1.0 release. Still: who reviews the duas; hall photos for SB-8; merge
Prayer-Time-Site `build/pt-0-3` to its `main` for the SB-3 swap; tag v1.0.0 when ready.

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
