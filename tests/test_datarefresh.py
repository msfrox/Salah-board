"""
On-board timetable refresh tests for deploy/datarefresh.py and its routes in deploy/serve.py (card SB-5).

Run:  python3 -m unittest discover -s tests -p 'test_*.py'

A local http.server on a temp dir plays pray.gear.lk (a fake manifest + 157 fake
files). The data folder is always a temp dir; nothing here touches the real
internet, the real ~/.config, or display/data/.
"""
import hashlib
import http.client
import http.server
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import unittest
from unittest import mock

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(REPO, "deploy"))
_TMP_CFG = tempfile.mkdtemp(prefix="sb-dr-cfg-")
os.environ.setdefault("SALAHBOARD_CONFIG", os.path.join(_TMP_CFG, "config.json"))

import datarefresh as dr  # noqa: E402
import pinauth            # noqa: E402
import serve              # noqa: E402

PIN = "482913"


def make_day(n, tag):
    return {"date": "%d-Jan" % n, "fajr": "5:%02d AM" % (n % 60), "sunrise": "6:22 AM",
            "luhr": "12:15 PM", "asr": "3:37 PM", "magrib": "6:07 PM", "isha": tag}


def make_set(rev):
    """{path: bytes}: zones.json, 13 x 12 valid zone files, and an extra SCHEMA.md."""
    files = {"zones.json": json.dumps({"zones": [{"id": "01"}]}).encode(),
             "SCHEMA.md": b"# schema (not a timetable file)\n"}
    for z in range(1, 14):
        for m in range(1, 13):
            days = [make_day(d + 1, "rev " + rev) for d in range(dr.DAYS_IN_MONTH[m][0])]
            files["zone%02d-%02d.json" % (z, m)] = json.dumps(
                {"zone": "%02d" % z, "monthNum": m, "days": days}).encode()
    return files


def make_manifest(files, rev):
    return json.dumps({"contract": 1, "revision": rev, "revised": "2026-12-01", "files": [
        {"path": k, "sha256": hashlib.sha256(v).hexdigest(), "bytes": len(v)}
        for k, v in sorted(files.items())]}).encode()


class Pray:
    """A stand-in for pray.gear.lk. `drop` paths promise more bytes than they send."""
    def __init__(self):
        self.files = {}
        self.drop = set()
        outer = self

        class H(http.server.BaseHTTPRequestHandler):
            def log_message(self, *a):
                pass

            def do_GET(self):
                rel = self.path.lstrip("/")
                body = outer.files.get(rel)
                if body is None:
                    self.send_response(404)
                    self.send_header("Content-Length", "0")
                    self.end_headers()
                    return
                self.send_response(200)
                self.send_header("Content-Length", str(len(body) + (500 if rel in outer.drop else 0)))
                self.end_headers()
                self.wfile.write(body[: len(body) // 2] if rel in outer.drop else body)
                self.wfile.flush()
                self.close_connection = True

        self.httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), H)
        self.url = "http://127.0.0.1:%d/" % self.httpd.server_address[1]
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()

    def publish(self, rev, mutate=None):
        files = make_set(rev)
        manifest = make_manifest(files, rev)       # honest manifest first ...
        if mutate:
            mutate(files)                          # ... then the files go bad
        self.files = dict(files)
        self.files["manifest.json"] = manifest

    def close(self):
        self.httpd.shutdown()
        self.httpd.server_close()


def tree(d):
    out = {}
    for base, _, names in os.walk(d):
        for n in names:
            p = os.path.join(base, n)
            with open(p, "rb") as f:
                out[os.path.relpath(p, d)] = f.read()
    return out


def closed_port_url():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return "http://127.0.0.1:%d/" % port


def git_status_data():
    r = subprocess.run(["git", "-C", REPO, "status", "--porcelain", "--", "display/data"],
                       capture_output=True, text=True)
    return r.stdout


class BundledFixture(unittest.TestCase):
    """A fake bundled set (rev 2026-01-01.1) in a temp dir, a fake pray.gear.lk, a Store."""
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="sb-dr-")
        self.bundled = os.path.join(self.tmp, "bundled")
        os.makedirs(self.bundled)
        files = make_set("2026-01-01.1")
        for k, v in files.items():
            if k != "SCHEMA.md":
                with open(os.path.join(self.bundled, k), "wb") as f:
                    f.write(v)
        with open(os.path.join(self.bundled, "manifest.json"), "wb") as f:
            f.write(make_manifest({k: v for k, v in files.items() if k != "SCHEMA.md"}, "2026-01-01.1"))
        self.pray = Pray()
        self.pray.publish("2026-12-01.1")
        self.datadir = os.path.join(self.tmp, "cfg", "data")
        self.store = dr.Store(self.datadir, bundled=self.bundled, base_url=self.pray.url)

    def tearDown(self):
        self.pray.close()
        shutil.rmtree(self.tmp, ignore_errors=True)

    def served_luhr_tag(self, store=None):
        d = (store or self.store).active_dir or self.bundled
        with open(os.path.join(d, "zone01-01.json")) as f:
            return json.load(f)["days"][0]["isha"]


class RefreshTest(BundledFixture):
    def test_fresh_board_uses_the_bundled_set(self):
        s = self.store.status()
        self.assertEqual(s["bundled"]["revision"], "2026-01-01.1")
        self.assertEqual(s["active"], {"revision": "2026-01-01.1", "source": "bundled"})
        self.assertIsNone(s["previous"])
        self.assertIsNone(s["latest"])
        self.assertFalse(os.path.exists(self.datadir))      # nothing is created until asked

    def test_check_finds_a_newer_revision_without_downloading_files(self):
        s = self.store.check()
        self.assertEqual(s["latest"], {"revision": "2026-12-01.1"})
        self.assertTrue(s["updateAvailable"])
        self.assertTrue(s["online"])
        self.assertIsNotNone(s["lastChecked"])
        self.assertIsNone(self.store.active_dir)

    def test_newer_manifest_gives_a_verified_swap(self):
        out = self.store.refresh()
        self.assertTrue(out["changed"])
        self.assertEqual(out["active"], {"revision": "2026-12-01.1", "source": "refreshed"})
        self.assertEqual(out["previous"], {"revision": "2026-01-01.1"})   # = the bundled set
        self.assertEqual(self.served_luhr_tag(), "rev 2026-12-01.1")
        self.assertEqual(self.store.active_dir, os.path.join(self.datadir, "active"))
        manifest, problem = dr.verify_set(self.store.active_dir)
        self.assertIsNone(problem)
        self.assertEqual(len(manifest["files"]), 157)        # SCHEMA.md was not kept
        self.assertFalse(os.path.exists(os.path.join(self.store.active_dir, "SCHEMA.md")))
        self.assertEqual([n for n in os.listdir(self.datadir) if n.startswith(".")], [])
        self.assertFalse(out["updateAvailable"])

    def test_same_revision_is_already_up_to_date(self):
        self.store.refresh()
        before = tree(self.datadir)
        out = self.store.refresh()
        self.assertFalse(out["changed"])
        self.assertIn("already up to date", out["message"])
        self.assertEqual(tree(self.datadir).keys(), before.keys())
        self.assertEqual(self.store.status()["previous"], {"revision": "2026-01-01.1"})

    def test_second_refresh_keeps_the_first_as_previous(self):
        self.store.refresh()
        self.pray.publish("2027-01-05.1")
        out = self.store.refresh()
        self.assertEqual(out["active"]["revision"], "2027-01-05.1")
        self.assertEqual(out["previous"], {"revision": "2026-12-01.1"})
        self.assertEqual(os.listdir(self.datadir).count("previous"), 1)

    def test_one_bad_checksum_changes_nothing(self):
        self.store.refresh()
        before = tree(self.datadir)

        def corrupt(files):
            files["zone07-05.json"] = files["zone07-05.json"].replace(b"rev ", b"REV ")   # same length
        self.pray.publish("2027-01-05.1", corrupt)
        with self.assertRaises(dr.DataError) as cm:
            self.store.refresh()
        self.assertIn("Nothing was changed", str(cm.exception))
        after = tree(self.datadir)
        before.pop("state.json"), after.pop("state.json")
        self.assertEqual(after, before)
        self.assertEqual(self.store.status()["active"]["revision"], "2026-12-01.1")
        self.assertEqual([n for n in os.listdir(self.datadir) if n.startswith(".")], [])

    def test_a_file_that_checks_out_but_is_not_a_timetable_is_refused(self):
        bad = json.dumps({"zone": "01", "monthNum": 3, "days": [{"date": "1-Mar", "fajr": "5:00 AM"}] * 31}).encode()
        files = make_set("2027-02-01.1")
        files["zone01-03.json"] = bad
        self.pray.files = dict(files)
        self.pray.files["manifest.json"] = make_manifest(files, "2027-02-01.1")   # honest checksum
        with self.assertRaises(dr.DataError) as cm:
            self.store.refresh()
        self.assertIn("failed a check", str(cm.exception))
        self.assertIsNone(self.store.active_dir)
        self.assertFalse(os.path.isdir(os.path.join(self.datadir, "active")))

    def test_wrong_day_count_is_refused(self):
        doc = json.loads(make_set("x")["zone02-04.json"])
        doc["days"] = doc["days"][:20]
        files = make_set("2027-02-01.1")
        files["zone02-04.json"] = json.dumps(doc).encode()
        self.pray.files = dict(files, **{"manifest.json": make_manifest(files, "2027-02-01.1")})
        with self.assertRaises(dr.DataError):
            self.store.refresh()
        self.assertIsNone(self.store.active_dir)

    def test_a_missing_file_is_refused(self):
        files = make_set("2027-02-01.1")
        del files["zone13-12.json"]
        self.pray.files = dict(files, **{"manifest.json": make_manifest(files, "2027-02-01.1")})
        with self.assertRaises(dr.DataError):
            self.store.refresh()
        self.assertIsNone(self.store.active_dir)

    def test_download_killed_midway_leaves_the_old_set_and_no_temp_folder(self):
        self.store.refresh()
        before = tree(self.datadir)
        self.pray.publish("2027-01-05.1")
        self.pray.drop = {"zone09-03.json"}          # the server hangs up half way through this file
        with self.assertRaises(dr.DataError):
            self.store.refresh()
        after = tree(self.datadir)
        before.pop("state.json"), after.pop("state.json")
        self.assertEqual(after, before)
        self.assertEqual([n for n in os.listdir(self.datadir) if n.startswith(".")], [])
        self.assertEqual(self.served_luhr_tag(), "rev 2026-12-01.1")

    def test_power_cut_while_writing_leaves_the_old_set_intact(self):
        self.store.refresh()
        before = tree(self.datadir)
        self.pray.publish("2027-01-05.1")
        calls = []

        def die_on_fifth(fd):
            calls.append(fd)
            if len(calls) == 5:
                raise OSError("power cut")
        with mock.patch.object(dr.os, "fsync", die_on_fifth):
            with self.assertRaises(OSError):
                self.store.refresh()
        after = tree(self.datadir)
        before.pop("state.json"), after.pop("state.json")
        self.assertEqual(after, before)
        self.assertEqual([n for n in os.listdir(self.datadir) if n.startswith(".")], [])

    def test_a_half_written_folder_from_a_real_power_cut_is_never_used(self):
        # The process itself died, so nothing cleaned up: a .tmp folder and an
        # "active" folder whose manifest is missing / whose files are short.
        os.makedirs(os.path.join(self.datadir, ".tmp-dead"))
        with open(os.path.join(self.datadir, ".tmp-dead", "zone01-01.json"), "wb") as f:
            f.write(b'{"zone": "01", "da')
        active = os.path.join(self.datadir, "active")
        os.makedirs(active)
        for k, v in list(make_set("2027-01-05.1").items())[:40]:
            with open(os.path.join(active, k), "wb") as f:
                f.write(v)
        store = dr.Store(self.datadir, bundled=self.bundled, base_url=self.pray.url)
        self.assertIsNone(store.active_dir)
        self.assertEqual(store.status()["active"]["source"], "bundled")
        self.assertFalse(os.path.exists(os.path.join(self.datadir, ".tmp-dead")))
        # even with a manifest, one short file makes the set unusable
        with open(os.path.join(active, "manifest.json"), "wb") as f:
            f.write(make_manifest(make_set("2027-01-05.1"), "2027-01-05.1"))
        self.assertIsNone(dr.Store(self.datadir, bundled=self.bundled).active_dir)

    def test_a_corrupted_active_set_falls_back_to_the_bundled_one(self):
        self.store.refresh()
        with open(os.path.join(self.datadir, "active", "zone01-01.json"), "ab") as f:
            f.write(b" ")
        store = dr.Store(self.datadir, bundled=self.bundled)
        self.assertIsNone(store.active_dir)
        self.assertEqual(store.status()["active"]["source"], "bundled")

    def test_rollback_restores_the_previous_set_and_can_swap_back(self):
        self.store.refresh()
        self.pray.publish("2027-01-05.1")
        self.store.refresh()
        out = self.store.rollback()
        self.assertEqual(out["active"], {"revision": "2026-12-01.1", "source": "refreshed"})
        self.assertEqual(out["previous"], {"revision": "2027-01-05.1"})
        self.assertEqual(self.served_luhr_tag(), "rev 2026-12-01.1")
        out = self.store.rollback()                  # previous <-> active
        self.assertEqual(out["active"]["revision"], "2027-01-05.1")

    def test_rollback_from_the_first_refresh_returns_to_the_bundled_set(self):
        self.store.refresh()
        out = self.store.rollback()
        self.assertEqual(out["active"], {"revision": "2026-01-01.1", "source": "bundled"})
        self.assertIsNone(self.store.active_dir)
        self.assertEqual(out["previous"], {"revision": "2026-12-01.1"})
        self.assertEqual(self.store.rollback()["active"]["revision"], "2026-12-01.1")

    def test_rollback_with_nothing_to_go_back_to(self):
        with self.assertRaises(dr.DataError):
            self.store.rollback()

    def test_offline_says_so_and_changes_nothing(self):
        store = dr.Store(self.datadir, bundled=self.bundled, base_url=closed_port_url())
        for action in (store.check, store.refresh):
            with self.assertRaises(dr.Offline) as cm:
                action()
            self.assertIn("Not connected to the internet", str(cm.exception))
        s = store.status()
        self.assertFalse(s["online"])
        self.assertIn("keeps using its timetable", s["error"])
        self.assertEqual(s["active"]["source"], "bundled")
        self.assertEqual(self.served_luhr_tag(store), "rev 2026-01-01.1")

    def test_bundled_set_is_never_modified_and_git_stays_clean(self):
        # the real bundle, via the default Store, refreshed from the fake server
        real = dr.Store(os.path.join(self.tmp, "real-data"), base_url=self.pray.url)
        self.assertEqual(real.bundled, os.path.join(REPO, "display", "data"))
        snap = tree(real.bundled)
        clean_before = git_status_data()
        real.refresh()
        real.rollback()
        real.refresh()
        self.assertEqual(tree(real.bundled), snap)
        self.assertEqual(git_status_data(), clean_before)
        self.assertEqual(clean_before, "")

    def test_default_data_dir_follows_the_config_dir_or_env(self):
        with mock.patch.dict(os.environ, {"SALAHBOARD_CONFIG": "/x/cfg/config.json"}, clear=False):
            os.environ.pop("SALAHBOARD_DATA", None)
            self.assertEqual(dr.default_dir(), "/x/cfg/data")
            os.environ["SALAHBOARD_DATA"] = "/y/data"
            self.assertEqual(dr.default_dir(), "/y/data")


class RoutesTest(BundledFixture):
    """The four /api/data routes and the display file route, on the real server."""
    @classmethod
    def setUpClass(cls):
        cls.httpd = serve.Server(("127.0.0.1", 0), serve.Handler)
        cls.port = cls.httpd.server_address[1]
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()

    def setUp(self):
        super().setUp()
        self._old = (serve.DATA, serve.AUTH)
        serve.DATA = self.store
        serve.AUTH = pinauth.Auth(os.path.join(self.tmp, "cfg"))
        self.cookie = None
        code, _, sc, _ = self.req("POST", "/api/pin", {"pin": PIN})
        self.assertEqual(code, 200)
        self.cookie = sc.split(";")[0].split("=", 1)[1]

    def tearDown(self):
        serve.DATA, serve.AUTH = self._old
        super().tearDown()

    def req(self, method, path, body=None, cookie=True):
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=15)
        h = {}
        data = None
        if body is not None:
            data = json.dumps(body).encode()
            h["Content-Type"] = "application/json"
        if cookie and self.cookie:
            h["Cookie"] = "%s=%s" % (pinauth.COOKIE, self.cookie)
        conn.request(method, path, body=data, headers=h)
        r = conn.getresponse()
        raw = r.read()
        conn.close()
        try:
            j = json.loads(raw)
        except ValueError:
            j = None
        return r.status, j, r.getheader("Set-Cookie") or "", raw

    def test_routes_need_a_session(self):
        for method, path in (("GET", "/api/data"), ("POST", "/api/data/check"),
                             ("POST", "/api/data/refresh"), ("POST", "/api/data/rollback")):
            self.assertEqual(self.req(method, path, cookie=False)[0], 401, path)
        self.assertEqual(self.store.status()["active"]["source"], "bundled")

    def test_check_refresh_display_and_rollback_over_http(self):
        code, j, _, _ = self.req("GET", "/api/data")
        self.assertEqual(code, 200)
        self.assertEqual(j["active"], {"revision": "2026-01-01.1", "source": "bundled"})
        self.assertIsNone(j["latest"])
        self.assertEqual(self.req("GET", "/display/data/zone01-01.json")[1]["days"][0]["isha"], "7:21 PM")   # the real bundled file

        code, j, _, _ = self.req("POST", "/api/data/check")
        self.assertEqual((code, j["ok"], j["latest"]), (200, True, {"revision": "2026-12-01.1"}))

        id_before = self.req("GET", "/api/preview")[1]["instance"]
        code, j, _, _ = self.req("POST", "/api/data/refresh")
        self.assertEqual((code, j["ok"], j["changed"]), (200, True, True))
        # the display's own fetch now gets the refreshed file, with no session
        code, doc, _, _ = self.req("GET", "/display/data/zone01-01.json", cookie=False)
        self.assertEqual((code, doc["days"][0]["isha"]), (200, "rev 2026-12-01.1"))
        self.assertEqual(self.req("GET", "/display/data/zones.json", cookie=False)[0], 200)
        self.assertEqual(self.req("GET", "/display/data/manifest.json", cookie=False)[1]["revision"], "2026-12-01.1")
        self.assertNotEqual(self.req("GET", "/api/preview")[1]["instance"], id_before)   # board reloads itself
        # other display files still come from the repo
        self.assertEqual(self.req("GET", "/display/index.html", cookie=False)[0], 200)
        # no path trickery out of the data folder
        self.assertEqual(self.req("GET", "/display/data/..%2fstate.json", cookie=False)[0], 404)
        self.assertEqual(self.req("GET", "/display/data/state.json", cookie=False)[0], 404)

        code, j, _, _ = self.req("POST", "/api/data/rollback")
        self.assertEqual((code, j["ok"], j["active"]["source"]), (200, True, "bundled"))
        self.assertEqual(self.req("GET", "/display/data/zone01-01.json", cookie=False)[1]["days"][0]["isha"],
                         "7:21 PM")

    def test_offline_over_http(self):
        self.store.base_url = closed_port_url()
        code, j, _, _ = self.req("POST", "/api/data/refresh")
        self.assertEqual((code, j["ok"], j["offline"]), (200, False, True))
        self.assertIn("Not connected to the internet", j["error"])
        code, j, _, _ = self.req("GET", "/api/data")
        self.assertEqual((code, j["online"]), (200, False))
        self.assertEqual(self.req("GET", "/display/data/zone01-01.json", cookie=False)[0], 200)

    def test_a_refused_refresh_is_a_readable_409_and_changes_nothing(self):
        self.pray.publish("2027-01-05.1", lambda f: f.__setitem__("zones.json", b"{}"))
        code, j, _, _ = self.req("POST", "/api/data/refresh")
        self.assertEqual((code, j["ok"]), (409, False))
        self.assertIn("Nothing was changed", j["error"])
        self.assertEqual(j["active"]["source"], "bundled")
        self.assertEqual(self.req("POST", "/api/data/rollback")[0], 409)


if __name__ == "__main__":
    unittest.main()
