#!/usr/bin/env python3
"""Sync the bundled ACJU timetable (display/data/) from pray.gear.lk's published contract.

Replaces tools/sync-data.ps1 (ADR 0002). Python standard library only.

    sync-data.py --from ../Prayer-Time-Site/data     copy from a local checkout
    sync-data.py --url https://pray.gear.lk/data/    download
    sync-data.py --check                             verify the bundle against its manifest
    --engine                                         also refresh display/js/pt-core.js

The source's manifest.json lists every file with its SHA-256. Every file is verified
against it BEFORE anything in display/data/ is touched; a mismatch or a short download
aborts with nothing replaced. Files are copied byte for byte (never re-encoded).

Only the files the display reads are bundled: zoneNN-MM.json and zones.json. The manifest
written to display/data/manifest.json is the source's, filtered to those files. If the
source has no manifest.json (older publication) one is built locally from the files and
the output says so.
"""
import argparse
import hashlib
import http.client
import json
import os
import re
import shutil
import sys
import tempfile
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEST = os.path.join(ROOT, "display", "data")
ENGINE_DEST = os.path.join(ROOT, "display", "js", "pt-core.js")
WANTED = re.compile(r"^(zone\d\d-\d\d\.json|zones\.json)$")


class SyncError(Exception):
    pass


def sha256(data):
    return hashlib.sha256(data).hexdigest()


# ---- sources: each returns bytes for a relative path, or None if absent -------------
class DirSource:
    def __init__(self, path):
        self.path = path
        if not os.path.isdir(path):
            raise SyncError("not a directory: %s" % path)

    def read(self, rel):
        p = os.path.join(self.path, rel)
        if not os.path.isfile(p):
            return None
        with open(p, "rb") as f:
            return f.read()

    def listing(self):
        return sorted(n for n in os.listdir(self.path) if WANTED.match(n))

    def engine(self):
        p = os.path.join(self.path, "..", "assets", "js", "pt-core.js")
        if not os.path.isfile(p):
            raise SyncError("no assets/js/pt-core.js next to %s" % self.path)
        with open(p, "rb") as f:
            return f.read()


# pray.gear.lk's edge refuses Python's default "Python-urllib/x.y" agent with a
# 403 (found 18 Nov 2026); a named agent is let through. Shared by the board's
# on-board refresh (deploy/datarefresh.py), which reuses this class.
USER_AGENT = "SalahBoard-sync/1 (open-source masjid prayer display)"


class UrlSource:
    def __init__(self, base):
        self.base = base if base.endswith("/") else base + "/"

    def _get(self, url):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=30) as r:
                body = r.read()
                want = r.headers.get("Content-Length")
                if want is not None and int(want) != len(body):
                    raise SyncError("partial download of %s (%d of %s bytes)" % (url, len(body), want))
                return body
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            raise SyncError("%s: HTTP %d" % (url, e.code))
        except (urllib.error.URLError, OSError, http.client.HTTPException) as e:
            raise SyncError("%s: %s" % (url, e))

    def read(self, rel):
        return self._get(self.base + rel)

    def listing(self):
        return [("zone%02d-%02d.json" % (z, m)) for z in range(1, 14) for m in range(1, 13)] + ["zones.json"]

    def engine(self):
        body = self._get(urllib.request.urljoin(self.base, "../assets/js/pt-core.js"))
        if body is None:
            raise SyncError("pt-core.js not found beside %s" % self.base)
        return body


# ---- core ---------------------------------------------------------------------------
def build_plan(src):
    """Return (manifest dict, {path: bytes}), fully verified. Raises SyncError."""
    raw = src.read("manifest.json")
    if raw is not None:
        try:
            manifest = json.loads(raw)
            entries = [e for e in manifest["files"] if WANTED.match(e["path"])]
        except (ValueError, KeyError, TypeError) as e:
            raise SyncError("manifest.json is unreadable: %s" % e)
        if not entries:
            raise SyncError("manifest.json lists no timetable files")
        files = {}
        for e in entries:
            body = src.read(e["path"])
            if body is None:
                raise SyncError("missing file listed in manifest: %s" % e["path"])
            if len(body) != e["bytes"] or sha256(body) != e["sha256"]:
                raise SyncError("checksum mismatch: %s (nothing was replaced)" % e["path"])
            files[e["path"]] = body
        manifest["files"] = sorted(entries, key=lambda e: e["path"])
        return manifest, files

    # No manifest at the source: build one locally from the files.
    print("note: source has no manifest.json; building one locally from the files "
          "(checksums here only detect later corruption, not a bad source)")
    files = {}
    for name in src.listing():
        body = src.read(name)
        if body is None:
            raise SyncError("missing file: %s" % name)
        files[name] = body
    if not files:
        raise SyncError("no timetable files found at the source")
    manifest = {
        "contract": 1,
        "revision": "local-" + sha256(b"".join(files[k] for k in sorted(files)))[:12],
        "source": {"name": "built locally (source had no manifest)"},
        "files": [{"path": k, "sha256": sha256(files[k]), "bytes": len(files[k])} for k in sorted(files)],
    }
    return manifest, files


def manifest_bytes(manifest):
    return (json.dumps(manifest, indent=2, ensure_ascii=False) + "\n").encode("utf-8")


def apply_plan(manifest, files, dest=DEST):
    """Write only what differs. Stage in a temp dir inside dest, then rename each file."""
    os.makedirs(dest, exist_ok=True)
    changed = []
    for name, body in sorted(files.items()):
        p = os.path.join(dest, name)
        if os.path.isfile(p):
            with open(p, "rb") as f:
                if f.read() == body:
                    continue
        changed.append(name)
    mbytes = manifest_bytes(manifest)
    mpath = os.path.join(dest, "manifest.json")
    m_changed = not (os.path.isfile(mpath) and open(mpath, "rb").read() == mbytes)
    if not changed and not m_changed:
        return []
    if not changed:
        print("manifest.json written (data files already identical)")
    stage = tempfile.mkdtemp(prefix=".sync-", dir=dest)
    try:
        for name in changed:
            with open(os.path.join(stage, name), "wb") as f:
                f.write(files[name])
        with open(os.path.join(stage, "manifest.json"), "wb") as f:
            f.write(mbytes)
        for name in changed:
            os.replace(os.path.join(stage, name), os.path.join(dest, name))
        os.replace(os.path.join(stage, "manifest.json"), mpath)
    finally:
        shutil.rmtree(stage, ignore_errors=True)
    return changed


def check(dest=DEST):
    """Verify dest against its manifest. Return a list of problems (empty = ok)."""
    mpath = os.path.join(dest, "manifest.json")
    if not os.path.isfile(mpath):
        return ["manifest.json is missing (run sync-data.py)"]
    try:
        with open(mpath, "rb") as f:
            entries = json.load(f)["files"]
    except (ValueError, KeyError) as e:
        return ["manifest.json is unreadable: %s" % e]
    problems = []
    listed = set()
    for e in entries:
        listed.add(e["path"])
        p = os.path.join(dest, e["path"])
        if not os.path.isfile(p):
            problems.append("missing: %s" % e["path"])
            continue
        with open(p, "rb") as f:
            body = f.read()
        if len(body) != e["bytes"] or sha256(body) != e["sha256"]:
            problems.append("corrupt: %s" % e["path"])
    for n in sorted(os.listdir(dest)):
        if WANTED.match(n) and n not in listed:
            problems.append("not in manifest: %s" % n)
    return problems


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    g = ap.add_mutually_exclusive_group()
    g.add_argument("--from", dest="from_dir", metavar="DIR", help="local Prayer-Time-Site data/ folder")
    g.add_argument("--url", metavar="BASE", help="published data base, e.g. https://pray.gear.lk/data/")
    ap.add_argument("--engine", action="store_true", help="also refresh display/js/pt-core.js")
    ap.add_argument("--check", action="store_true", help="verify display/data against its manifest; exit 0/1")
    ap.add_argument("--dest", default=DEST, help=argparse.SUPPRESS)
    a = ap.parse_args(argv)

    if a.check:
        problems = check(a.dest)
        for p in problems:
            print(p)
        print("data check: %s" % ("FAILED (%d problem(s))" % len(problems) if problems else "ok"))
        return 1 if problems else 0

    if not (a.from_dir or a.url):
        ap.error("give --from DIR, --url BASE, or --check")
    try:
        src = DirSource(a.from_dir) if a.from_dir else UrlSource(a.url)
        manifest, files = build_plan(src)
        changed = apply_plan(manifest, files, a.dest)
        engine_changed = False
        if a.engine:
            body = src.engine()
            old = open(ENGINE_DEST, "rb").read() if os.path.isfile(ENGINE_DEST) else None
            if old != body:
                with open(ENGINE_DEST, "wb") as f:
                    f.write(body)
                engine_changed = True
    except SyncError as e:
        print("error: %s" % e, file=sys.stderr)
        return 1
    rev = manifest.get("revision", "?")
    if not changed and not engine_changed:
        print("no changes (revision %s, %d files)" % (rev, len(files)))
    else:
        print("revision %s: %d file(s) updated" % (rev, len(changed)))
        for n in changed:
            print("  " + n)
        if engine_changed:
            print("  display/js/pt-core.js")
    return 0


if __name__ == "__main__":
    sys.exit(main())
