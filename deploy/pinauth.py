#!/usr/bin/env python3
"""
Salah Board — caretaker PIN for the settings API (card SB-4).

Why this exists: serve.py answers on the whole masjid network, so without a
PIN anyone on the WiFi could change the board, read the hotspot password or
reboot it. The display itself needs no PIN: the three routes it polls
(GET /api/config, /api/preview, /api/time) stay open and carry no secrets.

What is stored, and where:
  <config dir>/pin.json   {"algo": "pbkdf2_sha256", "iterations", "salt", "hash"}
                          mode 0600, next to config.json but never inside it,
                          so an exported config never carries the PIN.
  <config dir>/reset-pin  drop this file (any content) to clear the PIN. The
                          next request sees it, deletes both files and ends
                          every session; the settings page then asks for a new
                          PIN. Put it there over SSH, or from a keyboard at the
                          board (Ctrl+Alt+F2, log in):
                              touch ~/.config/salahboard/reset-pin

Sessions live in memory only (a reboot logs everyone out). Wrong PINs are
counted in two buckets: the board's own screen (loopback) and the network.
Someone on the WiFi guessing PINs can lock out other phones, but never the
caretaker standing at the board.

Command line (used by install-kiosk.sh; run as the kiosk user):
    python3 deploy/pinauth.py set   [--dir DIR]   # prompts twice
    python3 deploy/pinauth.py reset [--dir DIR]
    python3 deploy/pinauth.py status [--dir DIR]
"""
import hashlib
import hmac
import json
import os
import secrets
import threading
import time

PIN_MIN, PIN_MAX = 6, 12
ITERATIONS = 100_000          # ~0.1 s on a small Atom tablet; fine per login
SESSION_IDLE = 30 * 60        # a session ends after 30 minutes with no request
SESSION_MAX = 12 * 60 * 60    # and after 12 hours whatever happens
MAX_SESSIONS = 20
FREE_TRIES = 4                # wrong PINs before the first delay
FIRST_DELAY = 30              # seconds; doubles with every further wrong PIN
MAX_DELAY = 60 * 60
COOKIE = "sb_session"


def default_dir():
    cfg = os.environ.get("SALAHBOARD_CONFIG")
    if cfg:
        return os.path.dirname(os.path.abspath(cfg))
    return os.path.join(os.path.expanduser("~"), ".config", "salahboard")


def valid_pin(pin):
    """A PIN is 6–12 digits. Returns an error message, or None if fine."""
    if not isinstance(pin, str) or not pin.isascii() or not pin.isdigit():
        return "The PIN must be digits only."
    if not PIN_MIN <= len(pin) <= PIN_MAX:
        return f"The PIN must be {PIN_MIN} to {PIN_MAX} digits."
    return None


def _hash(pin, salt, iterations):
    return hashlib.pbkdf2_hmac("sha256", pin.encode(), salt, iterations).hex()


def lockout_delay(fails):
    """Seconds to wait after `fails` consecutive wrong PINs (0 = no wait)."""
    if fails <= FREE_TRIES:
        return 0
    return min(MAX_DELAY, FIRST_DELAY * 2 ** (fails - FREE_TRIES - 1))


class Auth:
    def __init__(self, config_dir=None, clock=time.time):
        self.dir = config_dir or default_dir()
        self.pin_file = os.path.join(self.dir, "pin.json")
        self.reset_file = os.path.join(self.dir, "reset-pin")
        self.clock = clock
        self._lock = threading.Lock()
        self._sessions = {}   # token -> {"created", "seen"}
        self._buckets = {}    # "local" | "network" -> {"fails", "until"}

    # ── stored PIN ───────────────────────────────────────────
    def _check_reset(self):
        """Honour a dropped reset file. Caller holds the lock."""
        if os.path.exists(self.reset_file):
            for p in (self.pin_file, self.reset_file):
                try:
                    os.remove(p)
                except FileNotFoundError:
                    pass
            self._sessions.clear()
            self._buckets.clear()
            print("Salah Board: PIN reset by reset-pin file", flush=True)

    def _load(self):
        try:
            with open(self.pin_file, "r", encoding="utf-8") as f:
                rec = json.load(f)
            if rec.get("algo") == "pbkdf2_sha256" and rec.get("hash"):
                return rec
        except (OSError, ValueError):
            pass
        return None

    def pin_set(self):
        with self._lock:
            self._check_reset()
            return self._load() is not None

    def _write_pin(self, pin):
        os.makedirs(self.dir, exist_ok=True)
        salt = secrets.token_bytes(16)
        rec = {"algo": "pbkdf2_sha256", "iterations": ITERATIONS,
               "salt": salt.hex(), "hash": _hash(pin, salt, ITERATIONS)}
        tmp = self.pin_file + ".tmp"
        fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(rec, f)
        os.replace(tmp, self.pin_file)

    def _matches(self, pin):
        rec = self._load()
        if rec is None or not isinstance(pin, str):
            return False
        try:
            want = _hash(pin, bytes.fromhex(rec["salt"]), int(rec["iterations"]))
        except (KeyError, ValueError, TypeError):
            return False
        return hmac.compare_digest(want, rec["hash"])

    # ── wrong-PIN delay ──────────────────────────────────────
    def wait_for(self, bucket):
        """Seconds this bucket must still wait before another try."""
        with self._lock:
            b = self._buckets.get(bucket)
            return max(0, int(b["until"] - self.clock() + 0.999)) if b else 0

    def _try_pin(self, pin, bucket):
        """Check a PIN against the lockout. Caller holds the lock.
        Returns ("ok"|"wrong"|"locked", retry_after_seconds)."""
        now = self.clock()
        b = self._buckets.setdefault(bucket, {"fails": 0, "until": 0.0})
        if b["until"] > now:
            return "locked", int(b["until"] - now + 0.999)
        if self._matches(pin):
            b.update(fails=0, until=0.0)
            return "ok", 0
        b["fails"] += 1
        delay = lockout_delay(b["fails"])
        b["until"] = now + delay
        return "wrong", delay

    # ── sessions ─────────────────────────────────────────────
    def _new_session(self):
        now = self.clock()
        if len(self._sessions) >= MAX_SESSIONS:
            oldest = min(self._sessions, key=lambda t: self._sessions[t]["seen"])
            del self._sessions[oldest]
        token = secrets.token_urlsafe(32)
        self._sessions[token] = {"created": now, "seen": now}
        return token

    def session_ok(self, token):
        with self._lock:
            self._check_reset()
            if not token or self._load() is None:
                return False
            s = self._sessions.get(token)
            now = self.clock()
            if not s or now - s["seen"] > SESSION_IDLE or now - s["created"] > SESSION_MAX:
                self._sessions.pop(token, None)
                return False
            s["seen"] = now
            return True

    def logout(self, token):
        with self._lock:
            self._sessions.pop(token, None)

    # ── the three actions the API exposes ────────────────────
    def login(self, pin, bucket):
        """Returns (status, token, retry_after); status is ok|wrong|locked|nopin."""
        with self._lock:
            self._check_reset()
            if self._load() is None:
                return "nopin", None, 0
            status, retry = self._try_pin(pin, bucket)
            return status, (self._new_session() if status == "ok" else None), retry

    def change_pin(self, new_pin, current, token, bucket):
        """Set the first PIN (no session needed), or change it (session and the
        current PIN needed). Every other session ends. Returns
        (status, token, retry_after, error); status ok|bad|denied|wrong|locked."""
        err = valid_pin(new_pin)
        with self._lock:
            self._check_reset()
            if self._load() is not None:
                s = self._sessions.get(token or "")
                if not s:
                    return "denied", None, 0, "Unlock the settings first."
                status, retry = self._try_pin(current, bucket)
                if status != "ok":
                    return status, None, retry, "The current PIN is wrong."
            if err:
                return "bad", None, 0, err
            self._write_pin(new_pin)
            self._sessions.clear()
            return "ok", self._new_session(), 0, None


# ── command line ─────────────────────────────────────────────
def _main(argv):
    import argparse
    import getpass
    p = argparse.ArgumentParser(description="Salah Board settings PIN")
    p.add_argument("action", choices=["set", "reset", "status"])
    p.add_argument("--dir", default=None, help="config folder (default ~/.config/salahboard)")
    a = p.parse_args(argv)
    auth = Auth(a.dir)
    if a.action == "status":
        print("PIN is set." if auth.pin_set() else "No PIN set: the settings page will ask for one.")
        return 0
    if a.action == "reset":
        os.makedirs(auth.dir, exist_ok=True)
        open(auth.reset_file, "w").close()
        auth.pin_set()  # applies it now; the running server also sees it
        print("PIN cleared. The settings page will ask for a new one.")
        return 0
    pin = getpass.getpass(f"New settings PIN ({PIN_MIN}-{PIN_MAX} digits): ")
    err = valid_pin(pin)
    if err:
        print(err)
        return 1
    if getpass.getpass("Type it again: ") != pin:
        print("The two PINs differ; nothing changed.")
        return 1
    auth._write_pin(pin)
    print(f"PIN saved in {auth.pin_file}. Restart the server to end open sessions.")
    return 0


if __name__ == "__main__":
    import sys
    sys.exit(_main(sys.argv[1:]))
