#!/usr/bin/env python3
"""
Salah Board — dependency-free static server for the PC kiosk stop-gap.

Why this exists: the display uses fetch() to load its JSON data, content
packs and config, and browsers block fetch() over file://. So the display
folder must be served over HTTP. This is the smallest possible way to do
that with zero installs beyond Python 3 (already present on Linux; a single
download on Windows).

Usage:   python3 serve.py [PORT]
Default port 8080. Binds all interfaces, so a phone on the same WiFi can
also open http://<this-device-ip>:PORT/ to glance at the board.

This is the PC equivalent of the Android shell's embedded HTTP server
(docs/ARCHITECTURE.md D4/D8) — minus the /api/config route, so the display
falls back to localStorage config, exactly as config.js already handles.
It adds two small device endpoints the admin panel uses (LAN-only):
  GET  /api/whoami          -> the phone URL to reach this admin page (+ QR)
  POST /api/display/<mode>  -> switch screen: external | tablet | both | toggle
"""
import http.server
import json
import os
import socket
import socketserver
import subprocess
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080

# Serve the whole repo root (not just display/) so /admin/ is reachable on
# the device too — the display and admin share the same localStorage origin,
# so the on-device settings page can configure the board. The board itself
# lives at /display/ . Works regardless of where the repo folder was copied.
ROOT = os.path.abspath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
)
DISPLAY_TOGGLE = os.path.join(ROOT, "deploy", "linux", "display-toggle.sh")
VALID_MODES = ("external", "tablet", "both", "toggle")


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

    def do_GET(self):
        if self.path.split("?")[0] == "/api/whoami":
            ip = lan_ip()
            return self._json(200, {
                "ip": ip,
                "port": PORT,
                "adminUrl": f"http://{ip}:{PORT}/admin/",
                "boardUrl": f"http://{ip}:{PORT}/display/",
            })
        return super().do_GET()

    def do_POST(self):
        parts = self.path.split("?")[0].strip("/").split("/")
        # /api/display/<mode>
        if len(parts) == 3 and parts[0] == "api" and parts[1] == "display":
            mode = parts[2]
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
        self._json(404, {"ok": False, "error": "not found"})


# Correct MIME for the zone/content JSON the engine fetches.
Handler.extensions_map[".json"] = "application/json"


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == "__main__":
    if not os.path.isdir(ROOT):
        sys.exit(f"display/ not found at {ROOT} — run this from inside deploy/")
    with Server(("0.0.0.0", PORT), Handler) as httpd:
        print(f"Salah Board: serving {ROOT}")
        print(f"  board:    http://localhost:{PORT}/display/")
        print(f"  settings: http://localhost:{PORT}/admin/")
        print(f"  network:  http://{lan_ip()}:{PORT}/display/")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
