"""Tests for review-content.py. Run: python3 -m unittest discover -s tools -p 'test_*.py'"""
import argparse, contextlib, csv, importlib.util, io, json, os, shutil, tempfile, unittest

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("rc", os.path.join(HERE, "review-content.py"))
rc = importlib.util.module_from_spec(spec); spec.loader.exec_module(rc)
REAL = rc.CONTENT


class T(unittest.TestCase):
    def setUp(self):
        self.d = tempfile.mkdtemp()
        for l in rc.LANGS:
            shutil.copy(os.path.join(REAL, l + ".json"), self.d)
        rc.CONTENT = self.d

    def tearDown(self):
        rc.CONTENT = REAL
        shutil.rmtree(self.d)

    def export(self, lang="ta"):
        rc.cmd_export(argparse.Namespace(lang=lang, out=self.d))
        return os.path.join(self.d, "content-%s.csv" % lang)

    def imp(self, sheet, reviewer="Imam X"):
        with contextlib.redirect_stdout(io.StringIO()) as o:
            rc.cmd_import(argparse.Namespace(sheet=sheet, reviewer=reviewer, date="2026-11-21", dry_run=False))
        return o.getvalue()

    def rewrite(self, path, fn):
        with open(path, encoding="utf-8-sig", newline="") as f:
            rows = list(csv.DictReader(f))
        fn(rows)
        with open(path, "w", encoding="utf-8-sig", newline="") as f:
            w = csv.DictWriter(f, rc.COLS); w.writeheader(); w.writerows(rows)

    def raw(self, l="ta"):
        return open(os.path.join(self.d, l + ".json"), "rb").read()

    def test_untouched_roundtrip_changes_nothing(self):
        before = self.raw()
        self.imp(self.export())
        self.assertEqual(before, self.raw())

    def test_flag_flips_only_when_complete_with_reviewer(self):
        p = self.export()
        def done(rows):
            for r in rows:
                r["status"] = "ok"; r["reference_checked"] = "yes"
        self.rewrite(p, done)
        self.imp(p)
        meta = json.loads(self.raw())["meta"]
        self.assertTrue(meta["reviewed"]); self.assertEqual(meta["reviewer"], "Imam X")

    def test_change_applied_minimal_diff_and_arabic_refused(self):
        p = self.export()
        def edit(rows):
            for r in rows:
                if r["key"] == "labels.fajr":
                    r["status"], r["corrected"] = "changed", "NEW-FAJR"
                if r["key"] == "azanDua.arabic":
                    r["status"], r["corrected"] = "changed", "x"
        self.rewrite(p, edit)
        before = self.raw().decode()
        out = self.imp(p)
        after = self.raw().decode()
        self.assertIn("NEW-FAJR", after)
        self.assertIn("refused azanDua.arabic", out)
        self.assertEqual(len(before.splitlines()), len(after.splitlines()))
        self.assertFalse(json.loads(after)["meta"]["reviewed"])

    def test_placeholder_break_refused_and_unsure_blocks_flip(self):
        p = self.export("en")
        def edit(rows):
            for r in rows:
                r["status"] = "ok"; r["reference_checked"] = "yes"
                if r["key"] == "labels.inMinutes":
                    r["status"], r["corrected"] = "changed", "{name} soon"
                if r["key"] == "labels.today":
                    r["status"] = "unsure"
        self.rewrite(p, edit)
        out = self.imp(p)
        self.assertIn("placeholders differ", out)
        d = json.loads(self.raw("en"))
        self.assertEqual(d["labels"]["inMinutes"], "{name} in {n} min")
        self.assertFalse(d["meta"]["reviewed"])


if __name__ == "__main__":
    unittest.main()
