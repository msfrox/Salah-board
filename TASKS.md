# Tasks — Salah-board

Cards run in this order. Each is tagged with the model that builds it; effort is `medium`
unless the card says otherwise. Decisions are in `decisions/`. Planned 2026-11-16
(fable-sprint S15).

House rules for every card: `CLAUDE.md`'s golden rules; the display is plain HTML/CSS/JS with
no build step; test at 1366×768; prayer keys are never renamed; no AI attribution in commits.
**The live board is in a masjid: nothing is pushed to it by a build session.** Shehan updates
the board. "Verified" means tested in a browser or a script on the build machine; anything
only the real board can show is written "not verified on the board".

---

### SB-1 — Make the docs describe the project that exists   [Sonnet] · effort medium · ~1 h
**Status 2026-11-18:** Done (`4ac89e2`). Taken from the commits, 2026-11-19 docs pass; the card's own Done-when was not re-run.
Why: README, CLAUDE.md and MILESTONES describe an Android product; a Linux kiosk is what
runs (ADR 0001). The next session would otherwise start in the wrong place.
Context to read: `decisions/0001-…`, `README.md`, `CLAUDE.md`, `docs/MILESTONES.md`,
`deploy/README.md`, `deploy/linux/INSTALL-DEBIAN.md`, `PLAN.md`.
Do: apply ADR 0001 point 3. (Point 6 is already done: the planning session took the board's
address and password out of `HANDOFF.md` on 2026-11-16, and `PLAN.md` and `MILESTONES.md`
already carry a pointer to `ROADMAP.md`.) Check no other file names the board's address or
login.
Done when: a search of the tree for the board's LAN address and for `pw ` finds no
credentials outside `.git`; README's status line and
"runs on" text match ADR 0001; `CLAUDE.md` "How to work" points to `ROADMAP.md` and
`TASKS.md`; M3 and M4 are marked parked with the ADR number.
Don't: delete `android/` or any doc. Don't rewrite git history to remove the old password;
`SHEHAN-TODO.md` already asks Shehan to change it on the board.

### SB-2 — `tools/sync-data.py`                            [Sonnet] · effort medium · ~1.5 h
**Status 2026-11-18:** Done (`0bd72e9`). Taken from the commits, 2026-11-19 docs pass; the card's own Done-when was not re-run.
Why: the sync tool is PowerShell with a Windows path and no integrity check (ADR 0002).
Context to read: `decisions/0002-…`, `tools/sync-data.ps1`, Prayer-Time-Site
`decisions/0001-…` and `data/SCHEMA.md` (once PT-1 exists).
Do: ADR 0002 point 2. Flags: `--from <dir>`, `--url <base>`, `--engine`, `--check` (verify
the bundled set against its manifest, exit 0/1). If the source has no `manifest.json` yet
(PT-1 not live), build one locally from the files and say so in the output. Remove the
PowerShell script and update every doc that names it.
Done when: `--from ../Prayer-Time-Site/data` on a clean tree reports "no changes" (the copies
are identical today); corrupting one bundled file makes `--check` exit 1 and name it; a
unit test with a temporary HTTP server covers download, checksum mismatch (nothing is
replaced) and a partial download; runs under plain `python3` with no installs.
Don't: reformat the JSON files; checksums must match the source byte for byte.

### SB-3 — Vendor `pt-core.js`; engine becomes an extension   [Sonnet] · effort medium · ~3 h
**Status 2026-11-18:** Done (`1878137`, `f2ab45d`, `a4d1bf9`). Taken from the commits, 2026-11-19 docs pass; the card's own Done-when was not re-run.
Why: the engine is a drifting hand copy of the site's (ADR 0002 point 5).
Context to read: `decisions/0002-…`, `display/js/engine.js`, `display/js/state.js`,
Prayer-Time-Site `assets/js/pt-core.js` and `assets/js/PT-CORE.md`.
Do: first write characterisation tests for the current `engine.js` (a dev-only test runner,
`node --test`, no dependency, no change to how the display is served): next prayer, after-Isha
rollover including month and year end, iqamah for each prayer, Ramadan overrides, Jumu'ah.
Then vendor `pt-core.js` unmodified, reduce `engine.js` to iqamah/Jumu'ah/Ramadan logic on
top of `PT`, and add the script tag.
Done when: the characterisation tests pass unchanged before and after the swap; `diff` of
the vendored file against the site's is empty; a full `?t=` day walk in a browser at
1366×768 shows the same states as before (list the times walked in the commit body).
Don't: start before PT-3 is merged (the site's file needs `PT.configure`); if it is not,
stop after the characterisation tests and commit those. Don't edit the vendored file.

### SB-4 — Caretaker PIN on the settings API               [Opus] · effort medium · ~2.5 h
**Status 2026-11-18:** Done (`a3e0c59`). Taken from the commits, 2026-11-19 docs pass; the card's own Done-when was not re-run.
Why: every `/api/*` route on the board is open to the whole network (ADR 0001 point 5).
Context to read: `decisions/0001-…`, `deploy/serve.py` (all routes), `admin/` (how it calls
the API), `deploy/linux/install-kiosk.sh`, `docs/CONFIG-SCHEMA.md`.
Do: a PIN (6 digits or more) set at install and changeable from the settings page, stored as
a salted hash in `~/.config/salahboard/`, outside `config.json` so an exported config never
carries it. `POST /api/login` returns a session cookie; every route that changes anything or
reveals the WiFi or hotspot password requires it; the routes the display itself polls
(`GET /api/config`, `GET /api/preview`, `GET /api/time`) stay open but `GET /api/config`
must not include secrets. Lock out for a growing delay after wrong PINs. A documented reset:
a file the installer can drop on the board over SSH or USB. The gear button on the board's
own screen still opens settings, and still asks for the PIN.
Done when: a script hits every route without a session and gets 401 on all but the three
display routes; with a session all work; five wrong PINs produce a delay; the display loads
and updates from a saved config with no session; an existing board with no PIN set shows a
"set a PIN" screen instead of being locked out; `CONFIG-SCHEMA.md` and `admin/api.md` updated.
Don't: put the PIN in `config.json`, in the repo, or in a URL. Don't break the hotspot
first-run flow (a masjid with no network must still reach settings). Not verified on the
board until Shehan updates it.

### SB-5 — On-board timetable refresh                       [Opus] · effort medium · ~3 h
**Status 2026-11-18:** Done (`a5abbae`, `ce76f2d`). Taken from the commits, 2026-11-19 docs pass; the card's own Done-when was not re-run.
**Needs Prayer-Time-Site PT-1 live at `https://pray.gear.lk/data/manifest.json`.**
Why: a board must be able to take an ACJU revision without a program update (ADR 0002).
Context to read: `decisions/0002-…` points 3 and 4, `deploy/serve.py`, `display/js/engine.js`
(data path), `admin/` Network tab, SB-2's code (reuse it), SB-4 (the routes need the PIN).
Do: `GET /api/data` (bundled and active revision, whether a newer one is available, when
last checked) and `POST /api/data/refresh` and `/api/data/rollback`, per ADR 0002 point 3;
the data folder indirection of point 4; a card on the settings page.
Done when: tests with a local HTTP server cover: newer manifest → verified swap; one bad
checksum → nothing changes; power-cut simulation (kill mid-download) → old set intact;
rollback restores the previous set; offline → the card says so and nothing breaks; the
display reads the active set; the bundled set is never modified (`git status` clean after a
refresh).
Don't: refresh automatically. Don't write inside the repo folder.

### SB-6 — Content review sheets                            [Sonnet] · effort medium · ~1.5 h
Why: all three language packs are `reviewed: false`, and they hold duas (golden rule 7).
Context to read: `display/content/README.md`, `display/content/*.json`, Sakina
`decisions/0002-translation-review-by-generated-sheets.md` and `tools/i18n-review/README.md`.
Do: add a JSON-pack adapter to Sakina's review tool **in the Sakina repo** (coordinate: it is
a change there, on its own branch) and a thin `tools/review-content.sh` here that calls it.
The sheet for religious text gets two extra columns: the source reference already in the
pack, and "reference checked (yes/no)". English is reviewed too. Export the three sheets.
Done when: export → import with no edits changes nothing; `reviewed` flips to true only
through an import that carries a reviewer name; sheets committed under `review/`.
Don't: correct, add or "improve" any dua or translation. Unsourced text is listed for the
reviewer, never fixed.

### SB-7 — Release by tag; update to the newest tag         [Opus] · effort medium · ~2.5 h
**Status 2026-11-18:** Done (`29d1fcd`). Taken from the commits, 2026-11-19 docs pass; the card's own Done-when was not re-run.
Why: the Update button pulls `main`, so work in progress can reach a masjid (ADR 0001 point 4).
Context to read: `decisions/0001-…`, `deploy/serve.py` (`_update`), `deploy/linux/firstboot.sh`,
`deploy/linux/install-kiosk.sh`, `deploy/linux/INSTALL-DEBIAN.md`.
Do: `_update` fetches tags and checks out the newest `vX.Y.Z`, records the previous one, and
the settings page shows current version, available version and "go back". `--check` the
bundled data (SB-2) after an update and refuse to stay on a release whose data fails.
`firstboot.sh` installs the newest tag. Write `docs/RELEASING.md` (checklist: tests, day
walk at 1366×768 in every theme, airplane test from M4's acceptance list re-run on the Linux
kiosk, tag, release notes).
Done when: in a scratch clone with two fake tags, update moves to the newer and rollback
returns; an update with a dirty tree fails cleanly with a message the caretaker can read;
`RELEASING.md` exists.
Don't: tag v1.0.0. That is Shehan's, after SB-8 and the reviews. Not verified on the board.

### SB-8 — Theme sizing in the hall; caretaker guide        [Opus] · effort medium · ~2 h
**Needs Shehan at the board (or photos from the hall).**
Why: HANDOFF's one deferred item; and the printed guide is the v1.0 acceptance test.
Context to read: previous `HANDOFF.md` "Deferred" (in git history after SB-1), `PLAN.md`
"Theme scale", `docs/CARETAKER-GUIDE.md`, `docs/HARDWARE.md`.
Do: with Shehan's photos, set each of `classic`, `led`, `mono` to a coefficient that reads
from the back row, one theme at a time with a screenshot check at 1366×768; finish the
caretaker guide for the Linux kiosk (PIN, hotspot, update, timetable refresh, what to do
after a power cut) and export its text for Tamil and Sinhala review with SB-6's sheets.
Done when: Shehan says each theme reads from the back of the hall; the guide covers every
settings tab.
Don't: apply the default theme's 2.05× to the others (their layouts were not designed for it).

### SB-9 — Android: find the box, then finish the shell     [Opus] · effort medium · ~1 h now, more later
**Status 2026-11-18:** Part 1 done (the Android box shop checklist); the rest of the card has no commit (`2ac6eee`). Taken from the commits, 2026-11-19 docs pass; the card's own Done-when was not re-run.
**Needs Shehan to find a box.** Shehan, 18 Nov 2026: "android is not parked. the linux is a
stop gap till i find the right android box. sadly still havent found it yet." (ADR 0001,
Amendment 1.)
Why: Android is the target; the Linux kiosk is the interim board.
Context to read: ADR 0001 Amendment 1, `docs/HARDWARE.md`, `android/README.md` ("What's
unverified"), `docs/MILESTONES.md` M3 and M4, `docs/LOCAL-CONTEXT.md` §1 and §7.
**The box must** (a checklist Shehan can take to a shop; part 1 of this card writes it into
`docs/HARDWARE.md`):
- Android 8.0 or newer (the shell's `minSdk 26`, the floor for the no-WiFi hotspot), 2 GB RAM
  or more, HDMI out at 1366×768 or 1920×1080, WiFi that can run a hotspot.
- Let you install an APK from a USB stick or a download (sideloading not locked), and let
  you pick a different **Home app** and keep it ("Always"). Some TV boxes lock their
  launcher; those can't be used.
- Have an Android System WebView (or Chrome) that can be updated, recent enough to run the
  display: test by opening the board's display page in the box's browser before buying.
- **Turn itself on when power returns** after a full cut (LOCAL-CONTEXT §7: the tablet
  doesn't, and that is the main weakness of the interim board).
- Nice to have: a clock battery, Ethernet, a remote with a Menu key.
Do (once a box is in hand): run `android/README.md`'s "What's unverified" list and M3/M4's
acceptance on it; port SB-4 (PIN) and SB-7 (release by tag) to the shell's server so both
platforms share `admin/api.md` exactly; decide whether APK versions share the `vX.Y.Z`
numbers (today APKs use `android-vX.Y.Z`); a migration note for moving a masjid from the
Linux board (export config, PIN set again).
Done when (part 1, can be done now): the checklist above is in `docs/HARDWARE.md` and
`docs/CARETAKER-GUIDE.md` says which board each section is for. (Part 2: M3/M4 acceptance
ticked on the chosen box.)
Don't: start Kotlin work before a box is chosen. Don't move display logic into Kotlin.

### SB-10 — Ready for other masjids                         [Opus] · effort medium · ~3 h
**Status 2026-11-18:** Done (first-run setup and SETUP-GUIDE.md) (`3e2c037`, `3a4cec4`). Taken from the commits, 2026-11-19 docs pass; the card's own Done-when was not re-run.
Shehan, 18 Nov 2026: "yes right now only one masjidh but make it so i can give this to
others so they can use in their masjidhs as well."
Why: today some of this masjid's choices are built in as defaults, and the setup guides
assume Shehan.
Context to read: `docs/LOCAL-CONTEXT.md`, `display/js/config.js` (defaults),
`deploy/linux/preseed.cfg`, `deploy/linux/install-kiosk.sh`, `docs/CARETAKER-GUIDE.md`,
`docs/HARDWARE.md`.
Masjid-specific spots known on 18 Nov 2026:
- **Jumu'ah defaults are this masjid's practice** (`config.js`): bayan 12:15 PM, iqamah fixed
  1:00 PM, khutbah 7 min, sunnah 5 min, and the order azan → sunnah → bayan → khutbah. Other
  masjids put the bayan before the azan, or derive the iqamah from the azan.
- **Iqamah defaults** (Fajr +30, Luhr/Asr +20 rounded to 5, Magrib +10, Isha fixed 7:15 PM),
  Luha 20 min after sunrise, Ramadan Magrib +20: this masjid's, presented as everyone's.
- **Zone 01 and English** as defaults; the masjid name is blank (good).
- **The default theme's sizes were tuned in this hall** ("field-tuned landscape sizes the
  defaults") and its background is **this masjid's rosette** (`display/themes/default/assets/`).
- **The automated installer** (`preseed.cfg`) sets a **fixed login password for every board**
  (user `board`), clones from `msfrox/Salah-board`, and assumes `/home/board/Salah-board`.
- Hijri offset is set by hand every month (LOCAL-CONTEXT §3, §7 open idea).
- `docs/CARETAKER-GUIDE.md` is Android-era and assumes a helper who knows the project.
Do: a **first-run setup** on the settings page (masjid name, zone, language, then Jumu'ah
and iqamah practice with the current values offered as one example, not silently assumed);
the installer asks for the login password (or forces a change at first login); a
`docs/SETUP-GUIDE.md` a stranger can follow from "buy a box" to "board on the wall",
including the PIN; LOCAL-CONTEXT stays as *this* masjid's record and the defaults point to
it as an example.
Done when: a fresh install with no config walks through first-run setup before showing
times; no default silently encodes this masjid's Jumu'ah practice; the preseed has no fixed
password; someone who has never met Shehan can follow the guide (have a Sonnet agent with
only the repo walk it and list where it got stuck).
Don't: change this masjid's live behaviour: its saved config keeps its values.

---

## Waiting on hardware (ADR 0001 Amendment 1)

- **M3 — Android shell APK** and **M4 — time correction and hotspot on Android**: specs
  stay in `docs/MILESTONES.md`; picked up through SB-9 once a box is found.

## Later

Companion mobile app · other madhabs or countries · fleet dashboard · audio to overflow
halls (all from MILESTONES "Later").
