"""Tests for sync-data.py. Run: python3 -m unittest discover -s tools -p 'test_*.py'"""
import hashlib, http.server, importlib.util, json, os, tempfile, threading, unittest

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("sync_data", os.path.join(HERE, "sync-data.py"))
sd = importlib.util.module_from_spec(spec); spec.loader.exec_module(sd)

FILES = {"zone01-01.json": b'{"zone":"01","days":[]}\n', "zone01-02.json": b'{"zone":"01","m":2}\n',
         "zones.json": b'{"zones":[]}\n'}


def make_manifest(files, rev="2026-01-01.1"):
    return {"contract": 1, "revision": rev, "files": [
        {"path": k, "sha256": hashlib.sha256(v).hexdigest(), "bytes": len(v)} for k, v in sorted(files.items())]}


class Server:
    """Serves a dict path->bytes; `partial` paths promise more bytes than they send."""
    def __init__(self, files, partial=()):
        outer = self
        self.files, self.partial = files, set(partial)
        class H(http.server.BaseHTTPRequestHandler):
            def log_message(self, *a): pass
            def do_GET(self):
                rel = self.path.lstrip("/")
                body = outer.files.get(rel)
                if body is None:
                    self.send_response(404); self.end_headers(); return
                self.send_response(200)
                self.send_header("Content-Length", str(len(body) + (50 if rel in outer.partial else 0)))
                self.end_headers(); self.wfile.write(body)
                self.wfile.flush()
                if rel in outer.partial:
                    self.close_connection = True
        self.httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), H)
        self.url = "http://127.0.0.1:%d/" % self.httpd.server_address[1]
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()
    def close(self): self.httpd.shutdown(); self.httpd.server_close()


def snapshot(d):
    return {n: open(os.path.join(d, n), "rb").read() for n in sorted(os.listdir(d))}


class SyncTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); self.dest = os.path.join(self.tmp.name, "data")
        os.makedirs(self.dest)
    def tearDown(self): self.tmp.cleanup()

    def served(self, files=FILES, manifest=None, partial=()):
        pub = dict(files); pub["manifest.json"] = json.dumps(manifest or make_manifest(files)).encode()
        s = Server(pub, partial); self.addCleanup(s.close); return s

    def run_sync(self, url): return sd.main(["--url", url, "--dest", self.dest])

    def test_download_then_no_changes_then_check_ok(self):
        s = self.served()
        self.assertEqual(self.run_sync(s.url), 0)
        for k, v in FILES.items(): self.assertEqual(open(os.path.join(self.dest, k), "rb").read(), v)
        self.assertEqual(sd.check(self.dest), [])
        before = snapshot(self.dest)
        self.assertEqual(self.run_sync(s.url), 0)   # second run: identical
        self.assertEqual(snapshot(self.dest), before)

    def test_checksum_mismatch_replaces_nothing(self):
        self.assertEqual(self.run_sync(self.served().url), 0)
        before = snapshot(self.dest)
        bad = dict(FILES); bad["zone01-02.json"] = b'{"tampered":1}\n'
        new_manifest = make_manifest(FILES, "2026-02-02.1")   # lists the ORIGINAL hash
        new_manifest["files"][0]["bytes"] = 999  # and make another one differ too
        s = self.served(bad, new_manifest)
        self.assertEqual(self.run_sync(s.url), 1)
        self.assertEqual(snapshot(self.dest), before)
        self.assertEqual([n for n in os.listdir(self.dest) if n.startswith(".")], [])

    def test_partial_download_replaces_nothing(self):
        before = snapshot(self.dest)
        s = self.served(partial=["zone01-02.json"])
        self.assertEqual(self.run_sync(s.url), 1)
        self.assertEqual(snapshot(self.dest), before)

    def test_missing_file_replaces_nothing(self):
        s = self.served(FILES, make_manifest(dict(FILES, **{"zone01-03.json": b"x"})))
        self.assertEqual(self.run_sync(s.url), 1)
        self.assertEqual(os.listdir(self.dest), [])

    def test_check_names_corrupt_file(self):
        self.assertEqual(self.run_sync(self.served().url), 0)
        with open(os.path.join(self.dest, "zone01-02.json"), "ab") as f: f.write(b" ")
        self.assertEqual(sd.check(self.dest), ["corrupt: zone01-02.json"])
        self.assertEqual(sd.main(["--check", "--dest", self.dest]), 1)

    def test_from_dir_without_manifest_builds_one(self):
        src = os.path.join(self.tmp.name, "src"); os.makedirs(src)
        for k, v in FILES.items(): open(os.path.join(src, k), "wb").write(v)
        self.assertEqual(sd.main(["--from", src, "--dest", self.dest]), 0)
        self.assertEqual(sd.check(self.dest), [])

if __name__ == "__main__":
    unittest.main()
