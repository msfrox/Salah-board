# HANDOFF — Salah Board

_Replace this file at the end of every session; git history keeps the old versions._

## Current state (2026-11-16 — v1.0 planned, nothing built)

- **What runs:** the Linux Debian kiosk (`deploy/serve.py` + systemd + Openbox + Chromium
  `--kiosk`), live on a board in a masjid, on external HDMI. Sessions 1–4 are done and were
  verified on the board (preview on the board screen, in-panel WiFi join, HDMI hot-plug
  switch). Last code on the board: `b7d445a`; `main` has moved on since (theme and Jumu'ah
  work merged 2026-11-08), so **check what the board is running before assuming**.
- A planning session (fable-sprint S15) wrote the v1.0 plan into `ROADMAP.md`, `TASKS.md` and
  two ADRs in `decisions/`, on branch `away/2026-11/s15-plan`. **Both ADRs are "proposed":**
  written on defaults while Shehan was away. No code was changed.
- The plan's main call: **v1.0 is the Linux kiosk; Android (M3, M4) is parked** (ADR 0001).
  README, `CLAUDE.md` and `docs/MILESTONES.md` still describe the Android plan until card
  SB-1 corrects them. Until then, do **not** follow `CLAUDE.md`'s "find the first milestone
  not marked done": it leads to Android.

## Resume

**Model: Sonnet 5.5. Effort: medium.**
First card: **SB-1** (docs), then SB-2, then SB-3's characterisation tests (`TASKS.md`).

**SB-4, SB-5, SB-7 and SB-8 are `[Opus]` cards** (a security boundary on a device in a
public place; atomic data swap; the update path of a live board; work at the board). Run
them in a separate Opus session at medium effort, SB-4 first.

Continue prompt (Sonnet session):

```text
Continue Salah-board according to /project-playbook — read ROADMAP.md and HANDOFF.md in ~/Projects/Salah-board, then do
cards SB-1, SB-2 and the characterisation tests of SB-3 from TASKS.md. Check SHEHAN-TODO.md first for answers.
Delegate implementation from task cards to Sonnet agents and sweeps to Haiku Explore agents.
Model: sonnet · Effort: medium — set both before sending.

Context you won't get from the files: CLAUDE.md and MILESTONES.md still point at Android until SB-1 fixes them; nothing is pushed to the live board by a build session.
```

## In flight

Nothing.

## Waiting on Shehan

`SHEHAN-TODO.md`: confirm Linux-first, the PIN, who reviews the duas, change the board's
password, photos from the hall for theme sizing.

## Deferred from earlier sessions

- Other themes (`classic`, `led`, `mono`) sizing: a judgement call in the real hall, one
  theme at a time with screenshot checks. Do not blanket-apply the default theme's 2.05×.
  Now card SB-8.
- Optional: reboot the board once to confirm `hdmi-watch.sh` starts from the Openbox
  autostart (proven by hand, not yet across a boot).

## Gotchas

- Privileged features (hotspot, set-clock, reboot, WiFi connect) need the sudoers drop-in
  from `install-kiosk.sh`; without it they report "unavailable" cleanly. A fresh board must
  run `sudo bash deploy/linux/install-kiosk.sh`.
- Two edits were made directly on the live board in session 4 (Openbox autostart launches
  `hdmi-watch.sh`; sudoers includes `wifi.sh *`). A fresh install gets both from
  `install-kiosk.sh`.
- Masjid settings live in `~/.config/salahboard/config.json`, outside the repo.
- Preview is in memory and expires (5 minutes, or a reboot).
- One WiFi radio: joining a network or starting the hotspot drops any SSH carried over WiFi.
  Scanning is safe.
- The board has no `curl`; use `python3 -c 'urllib…'` or `wget`.
- Never kill Chromium on the board by matching its command line over SSH: the pattern also
  matches your own SSH command. Kill by process id.
- `deploy/linux/*.sh` are tracked as executable; if a pull complains of local changes it is
  mode noise: `git checkout -- deploy/linux/ && git pull`.
- The settings API has no login yet (card SB-4). Anyone on the masjid network can change it.
- The board's address and login are no longer written here; they are in Shehan's password
  manager (see `SHEHAN-TODO.md`). They remain in this file's git history.
