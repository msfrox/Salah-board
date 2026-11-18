#!/usr/bin/env python3
"""
Salah Board — on-board timetable refresh and go-back (card SB-5, ADR 0002 points 3 and 4).

Why this exists: a masjid board must be able to take a new ACJU revision from
pray.gear.lk without a program update, and must never be left with a broken or
half-written timetable. Python standard library only.

Data lives OUTSIDE the repo, next to the config (default ~/.config/salahboard/data/):

    active/      a complete, verified set (zones.json + 156 zone files + manifest.json)
    previous/    the set that was active before the last refresh ("go back")
    state.json   last check: when, newest revision seen, online or not, last error
    .tmp-*/      a download in progress; never used, deleted on the next start/refresh

The bundled set in display/data/ is never written. When there is no `active/`
(or it fails verification) the board serves the bundled set. A missing side in
the active/previous pair means "the bundled set", so going back from the first
refresh returns to the bundled timetable.

Nothing here runs by itself: the caretaker presses a button (check / refresh / go back).

Command line (for testing on the board):
    python3 deploy/datarefresh.py status|check|refresh|rollback
"""
import importlib.util
import json
import os
import re
import shutil
import sys
import tempfile
import time

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
BUNDLED = os.path.join(ROOT, "display", "data")
DEFAULT_URL = "https://pray.gear.lk/data/"
PRAYERS = ("fajr", "sunrise", "luhr", "asr", "magrib", "isha")
ZONES, MONTHS = 13, 12
# Files the display may be served from the active set (the data files + their manifest).
SERVED = re.compile(r"^(zone\d\d-\d\d\.json|zones\.json|manifest\.json)$")
DAYS_IN_MONTH = {1: (31,), 2: (28, 29), 3: (31,), 4: (30,), 5: (31,), 6: (30,),
                 7: (31,), 8: (31,), 9: (30,), 10: (31,), 11: (30,), 12: (31,)}

MSG_OFFLINE = ("Not connected to the internet — the board keeps using its timetable.")


def _load_sync():
    """Reuse tools/sync-data.py (manifest download, SHA-256 verify). Its name has a hyphen."""
    spec = importlib.util.spec_from_file_location("sync_data", os.path.join(ROOT, "tools", "sync-data.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


sd = _load_sync()


class DataError(Exception):
    """A failure the caretaker can read; nothing was left half-done."""


class Offline(DataError):
    pass


def default_dir():
    d = os.environ.get("SALAHBOARD_DATA")
    if d:
        return os.path.abspath(d)
    cfg = os.environ.get("SALAHBOARD_CONFIG")
    base = os.path.dirname(os.path.abspath(cfg)) if cfg else os.path.join(
        os.path.expanduser("~"), ".config", "salahboard")
    return os.path.join(base, "data")


def default_url():
    return os.environ.get("SALAHBOARD_DATA_URL") or DEFAULT_URL


def _expected_names():
    return {"zones.json"} | {"zone%02d-%02d.json" % (z, m)
                             for z in range(1, ZONES + 1) for m in range(1, MONTHS + 1)}


def _read_json(path):
    with open(path, "rb") as f:
        return json.loads(f.read().decode("utf-8"))


def check_zone_file(name, body):
    """Sanity-check one file's bytes. Returns a problem string or None."""
    try:
        doc = json.loads(body.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        return "%s is not valid JSON" % name
    if name == "zones.json":
        return None if isinstance(doc, dict) and doc.get("zones") else "zones.json lists no zones"
    m = re.match(r"^zone(\d\d)-(\d\d)\.json$", name)
    month = int(m.group(2))
    days = doc.get("days") if isinstance(doc, dict) else None
    if not isinstance(days, list) or len(days) not in DAYS_IN_MONTH[month]:
        return "%s has the wrong number of days" % name
    for row in days:
        if not isinstance(row, dict) or any(not isinstance(row.get(k), str) or not row.get(k)
                                            for k in ("date",) + PRAYERS):
            return "%s has a day without all six prayer times" % name
    return None


def verify_set(path):
    """A set is usable only if its manifest lists all 157 files and every file on
    disk matches its size and SHA-256 and passes the sanity checks.
    Returns (manifest or None, problem or None)."""
    mpath = os.path.join(path, "manifest.json")
    try:
        manifest = _read_json(mpath)
        entries = {e["path"]: e for e in manifest["files"] if SERVED.match(e["path"])}
        revision = manifest["revision"]
        if not isinstance(revision, str) or not revision:
            raise ValueError("no revision")
    except (OSError, ValueError, KeyError, TypeError):
        return None, "no complete manifest"
    missing = _expected_names() - set(entries)
    if missing:
        return None, "manifest is missing %d file(s)" % len(missing)
    for name in sorted(_expected_names()):
        e = entries[name]
        try:
            with open(os.path.join(path, name), "rb") as f:
                body = f.read()
        except OSError:
            return None, "missing file: %s" % name
        if len(body) != e["bytes"] or sd.sha256(body) != e["sha256"]:
            return None, "corrupt file: %s" % name
        problem = check_zone_file(name, body)
        if problem:
            return None, problem
    return manifest, None


def _rev_of(path):
    try:
        return _read_json(os.path.join(path, "manifest.json")).get("revision")
    except (OSError, ValueError, AttributeError):
        return None


class _Prefetched:
    """Wraps a UrlSource so the manifest we already downloaded is not fetched twice."""
    def __init__(self, src, manifest_bytes):
        self.src, self.mb = src, manifest_bytes

    def read(self, rel):
        return self.mb if rel == "manifest.json" else self.src.read(rel)


class Store:
    def __init__(self, data_dir=None, bundled=BUNDLED, base_url=None, clock=time.time):
        self.dir = data_dir or default_dir()
        self.bundled = bundled
        self.base_url = base_url or default_url()
        self.clock = clock
        self.active_dir = None      # path served to the display, or None = bundled
        self.reload()

    # ── paths and state ──────────────────────────────────────
    @property
    def active(self):
        return os.path.join(self.dir, "active")

    @property
    def previous(self):
        return os.path.join(self.dir, "previous")

    def _state(self):
        try:
            return _read_json(os.path.join(self.dir, "state.json"))
        except (OSError, ValueError):
            return {}

    def _save_state(self, **kw):
        st = self._state()
        st.update(kw)
        os.makedirs(self.dir, exist_ok=True)
        tmp = os.path.join(self.dir, "state.json.tmp")
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(st, f, indent=2)
        os.replace(tmp, os.path.join(self.dir, "state.json"))

    def reload(self):
        """Decide once which folder the display is served from, and clear leftovers
        of an interrupted download. Called at startup and after every change."""
        self._clean_leftovers()
        manifest, _ = verify_set(self.active) if os.path.isdir(self.active) else (None, None)
        self.active_dir = self.active if manifest else None
        return self.active_dir

    def _clean_leftovers(self):
        try:
            names = os.listdir(self.dir)
        except OSError:
            return
        for n in names:
            if n.startswith((".tmp-", ".swap-", ".discard-")):
                shutil.rmtree(os.path.join(self.dir, n), ignore_errors=True)

    # ── what the board is using ──────────────────────────────
    def _bundled_rev(self):
        return _rev_of(self.bundled) or "unknown"

    def status(self):
        """No network. active/previous revisions, and what the last check found."""
        st = self._state()
        bundled = self._bundled_rev()
        if self.active_dir:
            active = {"revision": _rev_of(self.active_dir), "source": "refreshed"}
        else:
            active = {"revision": bundled, "source": "bundled"}
        prev_manifest = None
        if os.path.isdir(self.previous):
            prev_manifest, _ = verify_set(self.previous)
        if prev_manifest:
            previous = {"revision": prev_manifest["revision"]}
        elif self.active_dir:
            previous = {"revision": bundled}   # going back from the first refresh = bundled
        else:
            previous = None
        latest = st.get("latest")
        out = {
            "bundled": {"revision": bundled},
            "active": active,
            "previous": previous,
            "latest": {"revision": latest} if latest else None,
            "updateAvailable": bool(latest) and latest != active["revision"],
            "lastChecked": st.get("lastChecked"),
            "online": bool(st.get("online")),
        }
        if st.get("error"):
            out["error"] = st["error"]
        return out

    # ── network ──────────────────────────────────────────────
    def _stamp(self):
        return time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(self.clock()))

    def _fetch_manifest(self):
        """(manifest dict, raw bytes). Raises Offline / DataError. Records the outcome."""
        src = sd.UrlSource(self.base_url)
        try:
            raw = src.read("manifest.json")
        except sd.SyncError as e:
            self._save_state(lastChecked=self._stamp(), online=False, error=MSG_OFFLINE)
            raise Offline(MSG_OFFLINE) from e
        try:
            if raw is None:
                raise ValueError("no manifest")
            manifest = json.loads(raw.decode("utf-8"))
            rev = manifest["revision"]
            if not isinstance(rev, str) or not rev or not manifest["files"]:
                raise ValueError("bad manifest")
        except (ValueError, KeyError, TypeError, UnicodeDecodeError):
            msg = "The timetable server answered, but its list of files could not be read. Nothing was changed."
            self._save_state(lastChecked=self._stamp(), online=True, error=msg)
            raise DataError(msg)
        return manifest, raw, src

    def check(self):
        manifest, _, _ = self._fetch_manifest()
        self._save_state(lastChecked=self._stamp(), online=True, error=None,
                         latest=manifest["revision"])
        return self.status()

    def refresh(self):
        manifest, raw, src = self._fetch_manifest()
        rev = manifest["revision"]
        self._save_state(lastChecked=self._stamp(), online=True, error=None, latest=rev)
        current = self.status()["active"]["revision"]
        if rev == current:
            return {"changed": False, "message": "The timetable is already up to date (%s)." % rev,
                    **self.status()}
        os.makedirs(self.dir, exist_ok=True)
        self._clean_leftovers()
        tmp = tempfile.mkdtemp(prefix=".tmp-", dir=self.dir)
        try:
            try:
                new_manifest, files = sd.build_plan(_Prefetched(src, raw))
            except sd.SyncError as e:
                raise DataError("The new timetable could not be downloaded or did not check out (%s). "
                                "Nothing was changed." % e)
            names = set(files)
            if names != _expected_names():
                raise DataError("The new timetable is incomplete. Nothing was changed.")
            for name, body in sorted(files.items()):
                problem = check_zone_file(name, body)
                if problem:
                    raise DataError("The new timetable failed a check (%s). Nothing was changed." % problem)
            for name, body in sorted(files.items()):
                with open(os.path.join(tmp, name), "wb") as f:
                    f.write(body)
                    f.flush()
                    os.fsync(f.fileno())
            with open(os.path.join(tmp, "manifest.json"), "wb") as f:   # last: marks the set complete
                f.write(sd.manifest_bytes(new_manifest))
                f.flush()
                os.fsync(f.fileno())
            ok, problem = verify_set(tmp)
            if not ok:
                raise DataError("The new timetable failed its final check (%s). Nothing was changed." % problem)
            self._swap_in(tmp)
        except BaseException:
            shutil.rmtree(tmp, ignore_errors=True)
            raise
        self.reload()
        return {"changed": True, "message": "Timetable updated to %s. The board screen reloads by itself." % rev,
                **self.status()}

    def _swap_in(self, tmp):
        """active -> previous, tmp -> active, by renames. A crash between the two
        renames leaves no active set (the bundled one is served) and a good previous."""
        discard = None
        if os.path.isdir(self.previous):
            discard = os.path.join(self.dir, ".discard-previous")
            shutil.rmtree(discard, ignore_errors=True)
            os.rename(self.previous, discard)
        if os.path.isdir(self.active):
            os.rename(self.active, self.previous)
        os.rename(tmp, self.active)
        if discard:
            shutil.rmtree(discard, ignore_errors=True)

    def rollback(self):
        """previous <-> active. A missing side means the bundled timetable."""
        st = self.status()
        if not st["previous"]:
            raise DataError("There is no earlier timetable to go back to. Nothing was changed.")
        was = st["active"]["revision"]
        has_prev = os.path.isdir(self.previous)
        if has_prev:
            manifest, problem = verify_set(self.previous)
            if not manifest:
                raise DataError("The earlier timetable is damaged (%s), so the board stayed as it is." % problem)
        swap = os.path.join(self.dir, ".swap-active")
        shutil.rmtree(swap, ignore_errors=True)
        has_active = os.path.isdir(self.active)
        if has_active:
            os.rename(self.active, swap)
        if has_prev:
            os.rename(self.previous, self.active)
        if has_active:
            os.rename(swap, self.previous)
        self.reload()
        now = self.status()["active"]["revision"]
        return {"changed": True, "message": "Went back from timetable %s to %s. The board screen reloads by itself."
                % (was, now), **self.status()}


def _main(argv):
    if not argv or argv[0] not in ("status", "check", "refresh", "rollback"):
        print(__doc__.split("Command line")[1].strip())
        return 2
    store = Store()
    try:
        out = getattr(store, argv[0])()
    except DataError as e:
        print(e)
        return 1
    print(out.get("message") or json.dumps(out, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(_main(sys.argv[1:]))
