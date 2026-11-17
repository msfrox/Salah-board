"""
Settings-API access tests for deploy/serve.py and deploy/pinauth.py (card SB-4).

Run:  python3 -m unittest discover -s tests -p 'test_*.py'

Starts the real server on a free port with a temporary config folder. The
privileged helpers (hotspot, clock, wifi, reboot), the display switcher and
the git update are replaced by stubs, so these tests check the access gate,
never the machine they run on.
"""
import http.client
import json
import os
import sys
import tempfile
import threading
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
DEPLOY = os.path.join(HERE, "..", "deploy")
TMP = tempfile.mkdtemp(prefix="sb-auth-")
os.environ["SALAHBOARD_CONFIG"] = os.path.join(TMP, "config.json")
sys.path.insert(0, DEPLOY)

import pinauth  # noqa: E402
import serve    # noqa: E402

PIN = "482913"

# Every route that is not one of the display's three: (method, path, body).
PROTECTED = [
    ("GET", "/api/whoami", None),
    ("GET", "/api/hotspot", None),
    ("GET", "/api/wifi/scan", None),
    ("PUT", "/api/config", {"zone": "01"}),
    ("POST", "/api/display/toggle", None),
    ("POST", "/api/time", {"iso": "2026-07-02T12:10:00"}),
    ("POST", "/api/hotspot/start", None),
    ("POST", "/api/hotspot/stop", None),
    ("POST", "/api/hotspot/config", {"ssid": "SalahBoard", "password": "12345678"}),
    ("POST", "/api/preview", {"state": "azan", "seconds": 5}),
    ("POST", "/api/wifi/connect", {"ssid": "Masjid"}),
    ("POST", "/api/update", None),
    ("GET", "/api/version", None),
    ("POST", "/api/version/check", None),
    ("POST", "/api/rollback", None),
    ("POST", "/api/reboot", None),
]
DISPLAY_ROUTES = ["/api/config", "/api/preview", "/api/time"]


class Clock:
    def __init__(self):
        self.now = 1_000_000.0

    def __call__(self):
        return self.now


def _stub_helper(script, *args, timeout=25):
    if script == serve.HOTSPOT_SH and args == ("status",):
        return True, json.dumps({"available": True, "active": False,
                                 "ssid": "SalahBoard", "password": "hotspot-secret"}), ""
    return True, "stubbed", ""


class ServerTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        serve.run_helper = _stub_helper
        serve.Handler._release = lambda self, fn: self._json(200, {"ok": True, "stub": fn.__name__})
        serve.Handler._display = lambda self, mode: self._json(200, {"ok": True, "mode": mode})
        serve.Handler._wifi_scan = lambda self: self._json(200, {"available": True, "networks": []})
        cls.httpd = serve.Server(("127.0.0.1", 0), serve.Handler)
        cls.port = cls.httpd.server_address[1]
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()

    def setUp(self):
        self.clock = Clock()
        serve.AUTH = pinauth.Auth(TMP, clock=self.clock)
        for name in ("pin.json", "reset-pin", "config.json"):
            try:
                os.remove(os.path.join(TMP, name))
            except FileNotFoundError:
                pass
        serve.write_config({"zone": "01", "masjidName": "Test Masjid"})

    # ── helpers ──────────────────────────────────────────────
    def req(self, method, path, body=None, cookie=None, headers=None):
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=10)
        h = dict(headers or {})
        data = None
        if body is not None:
            data = json.dumps(body).encode()
            h["Content-Type"] = "application/json"
        if cookie:
            h["Cookie"] = f"{pinauth.COOKIE}={cookie}"
        conn.request(method, path, body=data, headers=h)
        r = conn.getresponse()
        raw = r.read()
        conn.close()
        try:
            j = json.loads(raw)
        except ValueError:
            j = None
        return r.status, j, r.getheader("Set-Cookie") or "", raw

    def cookie_from(self, set_cookie):
        self.assertIn(pinauth.COOKIE + "=", set_cookie)
        self.assertIn("HttpOnly", set_cookie)
        self.assertIn("SameSite=Strict", set_cookie)
        return set_cookie.split(";")[0].split("=", 1)[1]

    def set_first_pin(self):
        code, _, sc, _ = self.req("POST", "/api/pin", {"pin": PIN})
        self.assertEqual(code, 200)
        return self.cookie_from(sc)

    def login(self, pin=PIN):
        return self.req("POST", "/api/login", {"pin": pin})

    # ── the card's "Done when" ───────────────────────────────
    def test_every_route_needs_a_session_except_the_display_three(self):
        self.set_first_pin()
        for method, path, body in PROTECTED:
            code, j, _, _ = self.req(method, path, body)
            self.assertEqual(code, 401, f"{method} {path} answered {code} without a session")
            self.assertTrue(j["pinSet"])
        for path in DISPLAY_ROUTES:
            code, _, _, _ = self.req("GET", path)
            self.assertNotIn(code, (401, 403), f"GET {path} must stay open for the display")

    def test_every_route_works_with_a_session(self):
        self.set_first_pin()
        code, _, sc, _ = self.login()
        self.assertEqual(code, 200)
        tok = self.cookie_from(sc)
        for method, path, body in PROTECTED:
            code, j, _, _ = self.req(method, path, body, cookie=tok)
            self.assertEqual(code, 200, f"{method} {path} -> {code} {j}")

    def test_display_reads_saved_config_without_a_session_and_no_secrets(self):
        self.set_first_pin()
        code, j, _, raw = self.req("GET", "/api/config")
        self.assertEqual(code, 200)
        self.assertEqual(j["masjidName"], "Test Masjid")
        with open(os.path.join(TMP, "pin.json")) as f:
            rec = json.load(f)
        text = raw.decode()
        for secret in (PIN, rec["hash"], rec["salt"], "hotspot-secret"):
            self.assertNotIn(secret, text)
        self.assertEqual(self.req("GET", "/api/preview")[0], 200)
        self.assertEqual(self.req("GET", "/api/time")[0], 200)
        self.assertEqual(self.req("GET", "/display/index.html")[0], 200)

    def test_hotspot_password_only_with_a_session(self):
        self.set_first_pin()
        code, _, _, raw = self.req("GET", "/api/hotspot")
        self.assertEqual(code, 401)
        self.assertNotIn(b"hotspot-secret", raw)

    def test_five_wrong_pins_produce_a_growing_delay(self):
        self.set_first_pin()
        for i in range(pinauth.FREE_TRIES):
            code, j, _, _ = self.login("000000")
            self.assertEqual((code, j["waitSeconds"]), (401, 0), f"try {i + 1}")
        code, j, _, _ = self.login("000000")          # fifth wrong PIN
        self.assertEqual((code, j["waitSeconds"]), (401, pinauth.FIRST_DELAY))
        code, j, _, _ = self.login(PIN)               # right PIN, but must wait
        self.assertEqual(code, 429)
        self.assertGreater(j["waitSeconds"], 0)
        self.assertEqual(self.req("GET", "/api/auth")[1]["waitSeconds"], pinauth.FIRST_DELAY)
        self.clock.now += pinauth.FIRST_DELAY + 1
        code, j, _, _ = self.login("000000")          # sixth: the delay doubles
        self.assertEqual((code, j["waitSeconds"]), (401, pinauth.FIRST_DELAY * 2))
        self.clock.now += pinauth.FIRST_DELAY * 2 + 1
        code, _, _, _ = self.login(PIN)
        self.assertEqual(code, 200)
        code, j, _, _ = self.login("000000")          # a right PIN resets the count
        self.assertEqual((code, j["waitSeconds"]), (401, 0))

    def test_no_pin_yet_shows_set_a_pin_instead_of_locking_out(self):
        code, j, _, _ = self.req("GET", "/api/auth")
        self.assertEqual((code, j["pinSet"], j["loggedIn"]), (200, False, False))
        code, j, _, _ = self.req("GET", "/api/hotspot")
        self.assertEqual((code, j["pinSet"]), (401, False))
        self.assertEqual(self.login()[0], 409)
        code, j, _, _ = self.req("POST", "/api/pin", {"pin": "123"})
        self.assertEqual(code, 400)
        tok = self.set_first_pin()
        self.assertTrue(self.req("GET", "/api/auth", cookie=tok)[1]["loggedIn"])
        self.assertEqual(self.req("GET", "/api/hotspot", cookie=tok)[0], 200)
        # Once set, nobody can "set the first PIN" again without a session.
        self.assertEqual(self.req("POST", "/api/pin", {"pin": "999999"})[0], 401)

    def test_changing_the_pin_needs_the_current_pin_and_ends_other_sessions(self):
        tok = self.set_first_pin()
        other = self.cookie_from(self.login()[2])
        code, _, _, _ = self.req("POST", "/api/pin", {"pin": "777777", "current": "000000"}, cookie=tok)
        self.assertEqual(code, 401)
        code, _, sc, _ = self.req("POST", "/api/pin", {"pin": "777777", "current": PIN}, cookie=tok)
        self.assertEqual(code, 200)
        new = self.cookie_from(sc)
        self.assertEqual(self.req("GET", "/api/whoami", cookie=other)[0], 401)
        self.assertEqual(self.req("GET", "/api/whoami", cookie=tok)[0], 401)
        self.assertEqual(self.req("GET", "/api/whoami", cookie=new)[0], 200)
        self.assertEqual(self.login(PIN)[0], 401)
        self.assertEqual(self.login("777777")[0], 200)

    def test_reset_file_clears_the_pin_and_every_session(self):
        tok = self.set_first_pin()
        open(os.path.join(TMP, "reset-pin"), "w").close()
        self.assertEqual(self.req("GET", "/api/whoami", cookie=tok)[0], 401)
        self.assertFalse(self.req("GET", "/api/auth")[1]["pinSet"])
        self.assertFalse(os.path.exists(os.path.join(TMP, "reset-pin")))
        self.assertFalse(os.path.exists(os.path.join(TMP, "pin.json")))

    def test_logout_and_idle_expiry(self):
        tok = self.set_first_pin()
        self.clock.now += pinauth.SESSION_IDLE - 5
        self.assertEqual(self.req("GET", "/api/whoami", cookie=tok)[0], 200)  # slides
        self.clock.now += pinauth.SESSION_IDLE + 1
        self.assertEqual(self.req("GET", "/api/whoami", cookie=tok)[0], 401)
        tok = self.cookie_from(self.login()[2])
        code, _, sc, _ = self.req("POST", "/api/logout", cookie=tok)
        self.assertEqual(code, 200)
        self.assertIn("Max-Age=0", sc)
        self.assertEqual(self.req("GET", "/api/whoami", cookie=tok)[0], 401)

    def test_cross_site_requests_are_refused(self):
        tok = self.set_first_pin()
        code, _, _, _ = self.req("POST", "/api/reboot", cookie=tok,
                                 headers={"Origin": "http://evil.example"})
        self.assertEqual(code, 403)
        code, _, _, _ = self.req("POST", "/api/reboot", cookie=tok,
                                 headers={"Origin": f"http://127.0.0.1:{self.port}"})
        self.assertEqual(code, 200)

    def test_only_display_and_admin_are_served_as_files(self):
        for path in ("/.git/config", "/display/%2e%2e/.git/config", "/display/../.git/HEAD",
                     "/deploy/serve.py", "/HANDOFF.md", "/admin/../deploy/pinauth.py"):
            self.assertEqual(self.req("GET", path)[0], 404, path)
        self.assertEqual(self.req("GET", "/admin/index.html")[0], 200)
        code, _, _, _ = self.req("GET", "/")
        self.assertEqual(code, 302)


class LockoutBucketTest(unittest.TestCase):
    def test_network_guessing_never_locks_out_the_board_screen(self):
        d = tempfile.mkdtemp(prefix="sb-auth-b-")
        clock = Clock()
        auth = pinauth.Auth(d, clock=clock)
        self.assertEqual(auth.change_pin(PIN, "", None, "local")[0], "ok")
        for _ in range(10):
            auth.login("000000", "network")
        self.assertEqual(auth.login(PIN, "network")[0], "locked")
        self.assertEqual(auth.login(PIN, "local")[0], "ok")

    def test_delay_schedule(self):
        self.assertEqual([pinauth.lockout_delay(n) for n in range(1, 9)],
                         [0, 0, 0, 0, 30, 60, 120, 240])
        self.assertEqual(pinauth.lockout_delay(50), pinauth.MAX_DELAY)

    def test_pin_rules(self):
        self.assertIsNone(pinauth.valid_pin("123456"))
        for bad in ("12345", "1234567890123", "12a456", "١٢٣٤٥٦", ""):
            self.assertIsNotNone(pinauth.valid_pin(bad), bad)

    def test_pin_file_is_private_and_holds_no_plain_pin(self):
        d = tempfile.mkdtemp(prefix="sb-auth-c-")
        auth = pinauth.Auth(d)
        auth.change_pin(PIN, "", None, "local")
        p = os.path.join(d, "pin.json")
        self.assertEqual(os.stat(p).st_mode & 0o777, 0o600)
        with open(p) as f:
            self.assertNotIn(PIN, f.read())


if __name__ == "__main__":
    unittest.main()
