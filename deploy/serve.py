#!/usr/bin/env python3
"""
Salah Board — dependency-free static server for the PC/tablet Linux kiosk.

Why this exists: the display uses fetch() to load its JSON data, content
packs and config, and browsers block fetch() over file://. So the display
folder must be served over HTTP. This is the smallest possible way to do
that with zero installs beyond Python 3 (already present on Linux; a single
download on Windows).

Usage:   python3 serve.py [PORT]
Default port 8080. Binds all interfaces, so a phone on the same WiFi can
also open http://<this-device-ip>:PORT/ to glance at the board or, via
/admin/, configure it.

This is the PC/Linux equivalent of the Android shell's embedded HTTP server
(docs/ARCHITECTURE.md D4/D8). It implements the shared config contract plus
the LAN-only device endpoints the admin panel uses:

  GET  /api/config          -> the board's stored config.json (single contract)
  PUT  /api/config          -> replace it (a Save from the board OR a phone)
  GET  /api/whoami          -> the phone URL to reach this admin page (+ QR)
  POST /api/display/<mode>  -> switch screen: external | tablet | both | toggle
  GET  /api/time            -> the board's current wall clock (for offset sync)
  POST /api/time            -> set the board's system clock (needs sudoers helper)
  GET  /api/hotspot         -> WiFi hotspot status + ssid/password
  POST /api/hotspot/start   -> turn the hotspot on
  POST /api/hotspot/stop    -> turn the hotspot off
  POST /api/hotspot/config  -> set {ssid, password} (and turn it on)

Config is stored OUTSIDE the repo (default ~/.config/salahboard/config.json,
override with $SALAHBOARD_CONFIG) so a `git pull` update never touches the
masjid's settings. The hotspot/time helpers are called through `sudo -n` and
do nothing unless install-kiosk.sh has added the sudoers drop-in.
"""
import http.server
import json
import os
import socket
import socketserver
import subprocess
import sys
import time

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080

# Serve the whole repo root (not just display/) so /admin/ is reachable on
# the device too. The board itself lives at /display/ . Works regardless of
# where the repo folder was copied.
ROOT = os.path.abspath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
)
DISPLAY_TOGGLE = os.path.join(ROOT, "deploy", "linux", "display-toggle.sh")
HOTSPOT_SH = os.path.join(ROOT, "deploy", "linux", "hotspot.sh")
SETTIME_SH = os.path.join(ROOT, "deploy", "linux", "settime.sh")
REBOOT_SH = os.path.join(ROOT, "deploy", "linux", "reboot.sh")
VALID_MODES = ("external", "tablet", "both", "toggle")

CONFIG_PATH = os.environ.get("SALAHBOARD_CONFIG") or os.path.join(
    os.path.expanduser("~"), ".config", "salahboard", "config.json"
)
MAX_CONFIG_BYTES = 512 * 1024  # generous; config is a couple of KB in practice


def lan_ip():
    """Best-effort LAN IP of this device (no traffic actually sent)."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


def read_config():
    """Stored config, or None if never saved yet (display then uses defaults)."""
    try:
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def write_config(obj):
    """Atomically persist config.json; raises OSError on a real write failure."""
    os.makedirs(os.path.dirname(CONFIG_PATH), exist_ok=True)
    tmp = CONFIG_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
    os.replace(tmp, CONFIG_PATH)


def run_helper(script, *args, timeout=25):
    """Call a privileged helper through `sudo -n` (no password prompt). Returns
    (ok, stdout, stderr). If the sudoers drop-in isn't installed, sudo -n fails
    fast and the endpoint reports that cleanly instead of hanging."""
    if not os.path.exists(script):
        return False, "", f"{os.path.basename(script)} not found"
    try:
        r = subprocess.run(
            ["sudo", "-n", script, *args],
            capture_output=True, text=True, timeout=timeout,
        )
        return r.returncode == 0, r.stdout.strip(), r.stderr.strip()
    except (OSError, subprocess.SubprocessError) as e:
        return False, "", str(e)


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        # Never cache: a data refresh or config edit shows up on reload.
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *args):
        pass  # keep the console quiet on the kiosk

    def _json(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_body(self):
        """Read and JSON-parse the request body, capped at MAX_CONFIG_BYTES."""
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > MAX_CONFIG_BYTES:
            return None
        raw = self.rfile.read(length)
        try:
            return json.loads(raw.decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            return None

    # ── GET ──────────────────────────────────────────────────
    def do_GET(self):
        path = self.path.split("?")[0]

        if path == "/api/whoami":
            ip = lan_ip()
            return self._json(200, {
                "ip": ip,
                "port": PORT,
                "adminUrl": f"http://{ip}:{PORT}/admin/",
                "boardUrl": f"http://{ip}:{PORT}/display/",
            })

        if path == "/api/config":
            cfg = read_config()
            if cfg is None:
                # Never saved on this board yet — let the display fall back to
                # its built-in defaults / any existing localStorage.
                return self._json(404, {"error": "no config saved yet"})
            return self._json(200, cfg)

        if path == "/api/time":
            return self._json(200, {
                "nowMs": int(time.time() * 1000),
                "iso": time.strftime("%Y-%m-%dT%H:%M:%S"),
                "tz": time.strftime("%Z"),
            })

        if path == "/api/hotspot":
            ok, out, err = run_helper(HOTSPOT_SH, "status")
            if ok and out:
                try:
                    return self._json(200, json.loads(out))
                except ValueError:
                    pass
            return self._json(200, {"available": False, "active": False,
                                    "error": err or out or "hotspot helper unavailable"})

        return super().do_GET()

    # ── PUT ──────────────────────────────────────────────────
    def do_PUT(self):
        if self.path.split("?")[0] == "/api/config":
            obj = self._read_body()
            if not isinstance(obj, dict):
                return self._json(400, {"ok": False, "error": "body must be a JSON config object"})
            try:
                write_config(obj)
                return self._json(200, {"ok": True})
            except OSError as e:
                return self._json(500, {"ok": False, "error": str(e)})
        return self._json(404, {"ok": False, "error": "not found"})

    # ── POST ─────────────────────────────────────────────────
    def do_POST(self):
        parts = self.path.split("?")[0].strip("/").split("/")

        # /api/display/<mode>
        if len(parts) == 3 and parts[0] == "api" and parts[1] == "display":
            return self._display(parts[2])

        # /api/time  { "iso": "YYYY-MM-DDTHH:MM:SS" }  -> set the system clock
        if parts == ["api", "time"]:
            return self._set_time()

        # /api/hotspot/<action>
        if len(parts) == 3 and parts[0] == "api" and parts[1] == "hotspot":
            return self._hotspot(parts[2])

        # /api/update  -> git pull the repo to the latest code
        if parts == ["api", "update"]:
            return self._update()

        # /api/reboot  -> reboot the board (applies updated code)
        if parts == ["api", "reboot"]:
            ok, out, err = run_helper(REBOOT_SH, timeout=10)
            return self._json(200 if ok else 500, {"ok": ok, "output": out,
                              "error": None if ok else (err or "reboot helper unavailable")})

        return self._json(404, {"ok": False, "error": "not found"})

    def _update(self):
        """`git pull` the repo (owned by this unprivileged user) to latest."""
        try:
            before = subprocess.run(["git", "-C", ROOT, "rev-parse", "HEAD"],
                                    capture_output=True, text=True, timeout=15).stdout.strip()
            r = subprocess.run(["git", "-C", ROOT, "pull", "--ff-only"],
                               capture_output=True, text=True, timeout=120)
            after = subprocess.run(["git", "-C", ROOT, "rev-parse", "HEAD"],
                                   capture_output=True, text=True, timeout=15).stdout.strip()
            out = (r.stdout + r.stderr).strip()
            if r.returncode != 0:
                return self._json(500, {"ok": False, "output": out,
                                        "error": "git pull failed (local changes, or no internet?)"})
            return self._json(200, {"ok": True, "changed": before != after, "output": out})
        except (OSError, subprocess.SubprocessError) as e:
            return self._json(500, {"ok": False, "error": str(e)})

    def _display(self, mode):
        if mode not in VALID_MODES:
            return self._json(400, {"ok": False, "error": f"bad mode: {mode}"})
        if not os.path.exists(DISPLAY_TOGGLE):
            return self._json(500, {"ok": False, "error": "display-toggle.sh not found"})
        env = dict(os.environ)
        env.setdefault("DISPLAY", ":0")
        env.setdefault("XAUTHORITY", os.path.expanduser("~/.Xauthority"))
        try:
            r = subprocess.run(
                ["bash", DISPLAY_TOGGLE, mode],
                env=env, capture_output=True, text=True, timeout=15,
            )
            ok = r.returncode == 0
            return self._json(200 if ok else 500, {
                "ok": ok, "mode": mode,
                "output": (r.stdout + r.stderr).strip(),
            })
        except (OSError, subprocess.SubprocessError) as e:
            return self._json(500, {"ok": False, "error": str(e)})

    def _set_time(self):
        obj = self._read_body() or {}
        iso = obj.get("iso")
        if not iso:
            return self._json(400, {"ok": False, "error": "missing iso"})
        ok, out, err = run_helper(SETTIME_SH, iso)
        return self._json(200 if ok else 500, {
            "ok": ok, "output": out, "error": None if ok else (err or "could not set time (sudoers helper installed?)"),
        })

    def _hotspot(self, action):
        if action in ("start", "stop"):
            ok, out, err = run_helper(HOTSPOT_SH, action)
            return self._json(200 if ok else 500, {"ok": ok, "output": out, "error": None if ok else (err or out)})
        if action == "config":
            obj = self._read_body() or {}
            ssid = str(obj.get("ssid") or "").strip()
            password = str(obj.get("password") or "")
            if not ssid:
                return self._json(400, {"ok": False, "error": "ssid is required"})
            if len(password) < 8:
                return self._json(400, {"ok": False, "error": "password must be at least 8 characters"})
            ok, out, err = run_helper(HOTSPOT_SH, "config", ssid, password)
            return self._json(200 if ok else 500, {"ok": ok, "output": out, "error": None if ok else (err or out)})
        return self._json(400, {"ok": False, "error": f"bad hotspot action: {action}"})


# Correct MIME for the assets the display fetches. Some minimal setups serve
# .woff2 as octet-stream, which stricter browsers refuse — pin the real types
# so the bundled fonts (and thus Arabic/Tamil/Sinhala glyphs) always load.
Handler.extensions_map[".json"] = "application/json"
Handler.extensions_map[".woff2"] = "font/woff2"
Handler.extensions_map[".woff"] = "font/woff"
Handler.extensions_map[".svg"] = "image/svg+xml"


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == "__main__":
    if not os.path.isdir(ROOT):
        sys.exit(f"display/ not found at {ROOT} — run this from inside deploy/")
    with Server(("0.0.0.0", PORT), Handler) as httpd:
        print(f"Salah Board: serving {ROOT}")
        print(f"  config:   {CONFIG_PATH}")
        print(f"  board:    http://localhost:{PORT}/display/")
        print(f"  settings: http://localhost:{PORT}/admin/")
        print(f"  network:  http://{lan_ip()}:{PORT}/display/")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
