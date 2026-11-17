"""
Release-tag update tests for deploy/release.py (card SB-7).

Run:  python3 -m unittest discover -s tests -p 'test_*.py'

Each test builds a throwaway "GitHub" repo with fake vX.Y.Z tags and clones it
as "the board". The data check is a stand-in tools/sync-data.py that passes
when display/data/ok.txt says "ok", so a release with bad data can be faked.
Your git config is not used (no signing, no hooks).
"""
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "deploy"))

import release  # noqa: E402

FAKE_CHECK = """import sys
ok = open("display/data/ok.txt").read().strip() == "ok"
print("all files match the manifest" if ok else "zone01-01.json: checksum mismatch")
sys.exit(0 if ok else 1)
"""


class ReleaseTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="sb-release-")
        gitcfg = os.path.join(self.tmp, "gitconfig")
        open(gitcfg, "w").close()
        self._env = {k: os.environ.get(k) for k in (
            "GIT_CONFIG_GLOBAL", "GIT_CONFIG_NOSYSTEM", "GIT_AUTHOR_NAME",
            "GIT_AUTHOR_EMAIL", "GIT_COMMITTER_NAME", "GIT_COMMITTER_EMAIL")}
        os.environ.update(GIT_CONFIG_GLOBAL=gitcfg, GIT_CONFIG_NOSYSTEM="1",
                          GIT_AUTHOR_NAME="t", GIT_AUTHOR_EMAIL="t@example.invalid",
                          GIT_COMMITTER_NAME="t", GIT_COMMITTER_EMAIL="t@example.invalid")
        self.origin = os.path.join(self.tmp, "origin")
        self.board = os.path.join(self.tmp, "board")
        self.state = os.path.join(self.tmp, "config")
        os.makedirs(os.path.join(self.origin, "tools"))
        os.makedirs(os.path.join(self.origin, "display", "data"))
        self.git(self.origin, "init", "-q", "-b", "main")
        with open(os.path.join(self.origin, "tools", "sync-data.py"), "w") as f:
            f.write(FAKE_CHECK)
        self.release_("v0.1.0", "one")
        self.git(self.tmp, "clone", "-q", self.origin, self.board)
        self.git(self.board, "checkout", "-q", "--detach", "v0.1.0")

    def tearDown(self):
        for k, v in self._env.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v
        shutil.rmtree(self.tmp, ignore_errors=True)

    # ── helpers ──────────────────────────────────────────────
    def git(self, cwd, *args):
        subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True)

    def release_(self, tag, content, data="ok"):
        """Commit a new version in the fake GitHub repo and tag it."""
        with open(os.path.join(self.origin, "version.txt"), "w") as f:
            f.write(content)
        with open(os.path.join(self.origin, "display", "data", "ok.txt"), "w") as f:
            f.write(data)
        self.git(self.origin, "add", "-A")
        self.git(self.origin, "commit", "-q", "-m", tag or content)
        if tag:
            self.git(self.origin, "tag", tag)

    def running(self):
        with open(os.path.join(self.board, "version.txt")) as f:
            return f.read()

    # ── the card's "Done when" ───────────────────────────────
    def test_update_moves_to_the_newer_tag_and_rollback_returns(self):
        self.release_("v0.2.0", "two")
        s = release.check(self.board, self.state)
        self.assertEqual((s["current"], s["latest"], s["updateAvailable"]), ("v0.1.0", "v0.2.0", True))
        self.assertIsNone(s["previous"])
        out = release.update(self.board, self.state)
        self.assertTrue(out["changed"])
        self.assertEqual((out["current"], out["previous"]), ("v0.2.0", "v0.1.0"))
        self.assertEqual(self.running(), "two")
        out = release.rollback(self.board, self.state)
        self.assertEqual((out["current"], self.running()), ("v0.1.0", "one"))
        self.assertTrue(out["updateAvailable"])
        # and forward again: "go back" now points at v0.2.0
        self.assertEqual(out["previous"], "v0.2.0")

    def test_dirty_tree_fails_cleanly_with_a_readable_message(self):
        self.release_("v0.2.0", "two")
        with open(os.path.join(self.board, "version.txt"), "w") as f:
            f.write("edited on the board")
        with self.assertRaises(release.ReleaseError) as cm:
            release.update(self.board, self.state)
        self.assertEqual(str(cm.exception), release.MSG_DIRTY)
        self.assertEqual(self.running(), "edited on the board")
        self.assertEqual(release.current(self.board)[0], "v0.1.0")
        with self.assertRaises(release.ReleaseError):
            release.rollback(self.board, self.state)

    def test_untracked_files_do_not_block_an_update(self):
        self.release_("v0.2.0", "two")
        open(os.path.join(self.board, "notes.txt"), "w").close()
        self.assertTrue(release.update(self.board, self.state)["changed"])

    def test_release_with_bad_data_is_refused_and_the_board_stays(self):
        self.release_("v0.2.0", "two")
        release.update(self.board, self.state)
        self.release_("v0.3.0", "three", data="corrupt")
        with self.assertRaises(release.ReleaseError) as cm:
            release.update(self.board, self.state)
        self.assertIn("v0.3.0 failed its prayer-time data check", str(cm.exception))
        self.assertIn("stayed on v0.2.0", str(cm.exception))
        self.assertEqual((release.current(self.board)[0], self.running()), ("v0.2.0", "two"))
        # the refused release did not replace "go back"
        self.assertEqual(release.status(self.board, self.state)["previous"], "v0.1.0")

    def test_offline_changes_nothing(self):
        self.release_("v0.2.0", "two")
        shutil.rmtree(self.origin)
        with self.assertRaises(release.ReleaseError) as cm:
            release.update(self.board, self.state)
        self.assertTrue(str(cm.exception).startswith(release.MSG_OFFLINE))
        self.assertEqual(self.running(), "one")

    def test_already_newest(self):
        out = release.update(self.board, self.state)
        self.assertFalse(out["changed"])
        self.assertIn("Already on the newest version (v0.1.0)", out["message"])
        with self.assertRaises(release.ReleaseError):
            release.rollback(self.board, self.state)

    def test_only_vXYZ_tags_count_and_they_sort_as_numbers(self):
        for tag in ("v0.9.0", "v0.10.0"):
            self.release_(tag, tag)
        self.release_("", "work in progress")      # untagged commit on main
        self.git(self.origin, "tag", "debug-latest")
        self.git(self.origin, "tag", "v1.0")
        self.git(self.origin, "tag", "v2.0.0-rc1")
        release.update(self.board, self.state)
        self.assertEqual((release.current(self.board)[0], self.running()), ("v0.10.0", "v0.10.0"))

    def test_a_board_on_a_plain_commit_moves_to_the_newest_tag(self):
        self.release_("", "main, untagged")
        self.git(self.board, "fetch", "-q", "origin")
        self.git(self.board, "checkout", "-q", "origin/main")
        label = release.current(self.board)[0]
        self.assertTrue(label.startswith("build "))
        self.release_("v0.2.0", "two")
        out = release.update(self.board, self.state)
        self.assertEqual((out["current"], out["previous"]), ("v0.2.0", label))

    def test_no_release_published(self):
        self.git(self.board, "tag", "-d", "v0.1.0")
        self.git(self.origin, "tag", "-d", "v0.1.0")
        self.git(self.board, "fetch", "-q", "--prune", "--prune-tags", "origin")
        with self.assertRaises(release.ReleaseError) as cm:
            release.update(self.board, self.state)
        self.assertEqual(str(cm.exception), release.MSG_NO_RELEASE)


if __name__ == "__main__":
    unittest.main()
