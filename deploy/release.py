#!/usr/bin/env python3
"""
Salah Board — update the board to the newest release tag (card SB-7, ADR 0001).

Why this exists: the Update button used to `git pull` main, so work in progress
could reach a masjid. A release is now a git tag `vX.Y.Z`; the board only ever
runs a tag (or the commit it was installed from, until its first update).

    update    fetch tags, check out the newest vX.Y.Z, run the bundled data
              check (tools/sync-data.py --check) and go back if it fails.
    rollback  return to the version that ran before the last update.
    status    what runs now, what was found at the last check, what "go back"
              would return to. No network.
    check     fetch tags, then status.

The board's history (previous, current, newest found) is kept outside the repo
in <config dir>/release.json, so it survives the checkout it describes.

Command line (firstboot.sh uses `update`; run as the kiosk user, never root):
    python3 deploy/release.py status|check|update|rollback [--root DIR] [--dir DIR]
"""
import json
import os
import re
import subprocess
import sys
import time

TAG_RE = re.compile(r"^v(\d+)\.(\d+)\.(\d+)$")
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
DATA_CHECK = [sys.executable, "tools/sync-data.py", "--check"]

MSG_DIRTY = ("This board's program files have been changed by hand, so it cannot "
             "update safely. Nothing was changed. Ask whoever installed the board "
             "to look (in the board's folder: git status).")
MSG_OFFLINE = ("Could not reach GitHub to look for a new version. Check the "
               "board's internet connection and try again. Nothing was changed.")
MSG_NO_RELEASE = "No release has been published yet. Nothing was changed."


def default_dir():
    cfg = os.environ.get("SALAHBOARD_CONFIG")
    if cfg:
        return os.path.dirname(os.path.abspath(cfg))
    return os.path.join(os.path.expanduser("~"), ".config", "salahboard")


class ReleaseError(Exception):
    """A failure the caretaker can read; nothing was left half-done."""


def _git(root, *args, timeout=60):
    r = subprocess.run(["git", "-C", root, *args], capture_output=True, text=True,
                       timeout=timeout)
    return r.returncode, r.stdout.strip(), r.stderr.strip()


def _key(tag):
    m = TAG_RE.match(tag)
    return tuple(int(x) for x in m.groups()) if m else None


def release_tags(root):
    """All vX.Y.Z tags, oldest first (numeric order: v0.10.0 after v0.9.0)."""
    _, out, _ = _git(root, "tag", "--list", "v*")
    return sorted((t for t in out.splitlines() if _key(t)), key=_key)


def current(root):
    """(label, commit): label is the vX.Y.Z tag at HEAD, else 'build <sha>'."""
    _, sha, _ = _git(root, "rev-parse", "HEAD")
    _, out, _ = _git(root, "tag", "--points-at", "HEAD")
    tags = sorted((t for t in out.splitlines() if _key(t)), key=_key)
    return (tags[-1] if tags else f"build {sha[:7]}"), sha


def _state_path(state_dir):
    return os.path.join(state_dir or default_dir(), "release.json")


def _load(state_dir):
    try:
        with open(_state_path(state_dir), encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def _save(state_dir, state):
    path = _state_path(state_dir)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2)
    os.replace(tmp, path)


def _dirty(root):
    """Tracked files changed by hand (untracked files don't block a checkout)."""
    _, out, _ = _git(root, "status", "--porcelain", "--untracked-files=no")
    return bool(out)


def _fetch(root):
    code, _, err = _git(root, "fetch", "--quiet", "--tags", "--force", "origin", timeout=120)
    if code != 0:
        raise ReleaseError(MSG_OFFLINE + (f" ({err.splitlines()[-1]})" if err else ""))


def _data_ok(root):
    """Run the bundled-data check of the checked-out tree. (ok, detail)."""
    if not os.path.exists(os.path.join(root, DATA_CHECK[1])):
        return False, "this version has no data check (tools/sync-data.py)"
    try:
        r = subprocess.run(DATA_CHECK, cwd=root, capture_output=True, text=True, timeout=120)
    except (OSError, subprocess.SubprocessError) as e:
        return False, str(e)
    return r.returncode == 0, (r.stdout + r.stderr).strip()


def _checkout(root, commit):
    code, _, err = _git(root, "checkout", "--quiet", "--detach", commit)
    if code != 0:
        raise ReleaseError(f"Could not switch versions: {err or 'git checkout failed'}. "
                           "Nothing was changed.")


def status(root=ROOT, state_dir=None):
    label, sha = current(root)
    tags = release_tags(root)
    st = _load(state_dir)
    latest = tags[-1] if tags else None
    newer = bool(latest) and (_key(label) is None or _key(latest) > _key(label))
    prev = st.get("previous")
    return {
        "current": label, "commit": sha[:7],
        "latest": latest, "updateAvailable": newer and latest != label,
        "previous": prev["label"] if prev and prev.get("commit") != sha else None,
        "checkedAt": st.get("checkedAt"), "updatedAt": st.get("updatedAt"),
    }


def check(root=ROOT, state_dir=None):
    _fetch(root)
    st = _load(state_dir)
    st["checkedAt"] = time.strftime("%Y-%m-%dT%H:%M:%S")
    _save(state_dir, st)
    return status(root, state_dir)


def _switch(root, state_dir, target_label, target_commit, verify):
    """Move to target; on a failed data check go back. Records previous."""
    before_label, before_sha = current(root)
    _checkout(root, target_commit)
    ok, detail = _data_ok(root)
    if verify and not ok:
        _checkout(root, before_sha)
        raise ReleaseError(f"{target_label} failed its prayer-time data check, so the "
                           f"board stayed on {before_label}. ({detail.splitlines()[-1] if detail else 'no detail'})")
    st = _load(state_dir)
    st["previous"] = {"label": before_label, "commit": before_sha}
    st["updatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%S")
    _save(state_dir, st)
    return before_label


def update(root=ROOT, state_dir=None, fetch=True):
    """Move to the newest release tag. Returns a dict for the API."""
    if _dirty(root):
        raise ReleaseError(MSG_DIRTY)
    if fetch:
        check(root, state_dir)
    s = status(root, state_dir)
    if not s["latest"]:
        raise ReleaseError(MSG_NO_RELEASE)
    if not s["updateAvailable"]:
        return {"changed": False, "message": f"Already on the newest version ({s['current']}).",
                **status(root, state_dir)}
    _, sha, _ = _git(root, "rev-list", "-n", "1", s["latest"])
    was = _switch(root, state_dir, s["latest"], sha, verify=True)
    return {"changed": True, "message": f"Updated from {was} to {s['latest']}. "
            "Press Reload board to start the new version.", **status(root, state_dir)}


def rollback(root=ROOT, state_dir=None):
    """Return to the version that ran before the last update."""
    if _dirty(root):
        raise ReleaseError(MSG_DIRTY)
    prev = _load(state_dir).get("previous")
    if not prev or prev.get("commit") == current(root)[1]:
        raise ReleaseError("There is no earlier version to go back to. Nothing was changed.")
    # Going back to a version that already ran: its data check is not a gate.
    was = _switch(root, state_dir, prev["label"], prev["commit"], verify=False)
    return {"changed": True, "message": f"Went back from {was} to {prev['label']}. "
            "Press Reload board to start it.", **status(root, state_dir)}


def _main(argv):
    import argparse
    p = argparse.ArgumentParser(description="Salah Board releases")
    p.add_argument("action", choices=["status", "check", "update", "rollback"])
    p.add_argument("--root", default=ROOT, help="the board's repo folder")
    p.add_argument("--dir", default=None, help="config folder (default ~/.config/salahboard)")
    a = p.parse_args(argv)
    fn = {"status": status, "check": check, "update": update, "rollback": rollback}[a.action]
    try:
        out = fn(a.root, a.dir)
    except ReleaseError as e:
        print(e)
        return 1
    print(out.get("message") or json.dumps(out, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(_main(sys.argv[1:]))
