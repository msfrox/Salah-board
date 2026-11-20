#!/usr/bin/env python3
"""Review sheets for the content packs (display/content/<lang>.json), SB-6.

    review-content.py export [--lang en|ta|si|all] [--out review/]
    review-content.py import SHEET.csv --reviewer "Name" [--date YYYY-MM-DD] [--dry-run]
    review-content.py status

A sheet is a CSV (opens in Google Sheets or Excel): one row per text in the pack, in the
order the pack holds them. Columns:
  key (locked) | section | english | current | source | reference_checked (yes/no)
  | corrected | comment | status (ok / changed / unsure)

Import rules (ADR: translation review by generated sheets):
  * only rows marked `changed` with a `corrected` value are applied;
  * a correction that drops or adds a {placeholder} is refused;
  * Arabic text and `source` references are never changed by an import: a `changed`
    Arabic row is listed for the imam, not applied;
  * `unsure` rows are listed, never applied;
  * meta.reviewed flips to true (and meta.reviewer / meta.reviewedOn are written) only when
    a reviewer name is given AND every row has a status (ok/changed) AND every sourced
    row says reference_checked=yes. An import of an untouched sheet changes nothing.
Files are edited textually, so the packs' hand layout survives and the diff shows only the
changed strings. Python standard library only. Never invents or corrects content.
"""
import argparse
import csv
import datetime
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTENT = os.path.join(ROOT, "display", "content")
LANGS = ("en", "ta", "si")
COLS = ["key", "section", "english", "current", "source", "reference_checked",
        "corrected", "comment", "status"]
PH = re.compile(r"\{[^{}]*\}")


def load(lang):
    with open(os.path.join(CONTENT, lang + ".json"), encoding="utf-8") as f:
        return json.load(f)


def leaves(node, prefix=""):
    """Yield (key, value, source) for every string; `source` is the sibling source field."""
    if isinstance(node, dict):
        src = node.get("source", "") if isinstance(node.get("source"), str) else ""
        for k, v in node.items():
            if prefix == "" and k == "meta":
                continue
            if k == "source" and isinstance(v, str):
                continue
            yield from _walk(v, prefix + k if not prefix else prefix + "." + k, src)
    else:
        yield from _walk(node, prefix, "")


def _walk(v, key, src):
    if isinstance(v, str):
        yield key, v, src
    elif isinstance(v, dict):
        s = v.get("source", "") if isinstance(v.get("source"), str) else ""
        for k, x in v.items():
            if k == "source" and isinstance(x, str):
                continue
            yield from _walk(x, key + "." + k, s)
    elif isinstance(v, list):
        for i, x in enumerate(v):
            yield from _walk(x, key + "." + str(i), src)


def rows_for(lang):
    en = {k: (v, s) for k, v, s in leaves(load("en"))}
    out = []
    for k, v, s in leaves(load(lang)):
        out.append({"key": k, "section": k.split(".")[0], "english": en.get(k, ("", ""))[0],
                    "current": v, "source": s, "reference_checked": "", "corrected": "",
                    "comment": "", "status": ""})
    return out


def is_arabic(key, value):
    return key.rsplit(".", 1)[-1] == "arabic" or bool(re.search(r"[؀-ۿ]", value) and
                                                         not re.search(r"[A-Za-z]", value))


def cmd_export(a):
    langs = LANGS if a.lang == "all" else (a.lang,)
    os.makedirs(a.out, exist_ok=True)
    for lang in langs:
        path = os.path.join(a.out, "content-%s.csv" % lang)
        with open(path, "w", encoding="utf-8-sig", newline="") as f:
            w = csv.DictWriter(f, COLS)
            w.writeheader()
            w.writerows(rows_for(lang))
        print("wrote", path)


def read_sheet(path):
    with open(path, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def lang_of(path, rows):
    m = re.search(r"content-(en|ta|si)\.csv$", os.path.basename(path))
    if not m:
        sys.exit("cannot tell the language: name the sheet content-<lang>.csv")
    return m.group(1)


def cmd_import(a):
    if not a.reviewer.strip():
        sys.exit("a reviewer name is required")
    rows = read_sheet(a.sheet)
    lang = lang_of(a.sheet, rows)
    fpath = os.path.join(CONTENT, lang + ".json")
    with open(fpath, encoding="utf-8") as f:
        text = f.read()
    pack = {k: v for k, v, _ in leaves(json.loads(text))}
    live = rows_for(lang)
    liveby = {r["key"]: r for r in live}
    applied, refused, unsure, missing = [], [], [], []
    seen = set()
    for r in rows:
        k, st = r["key"], r["status"].strip().lower()
        seen.add(k)
        if k not in pack:
            refused.append((k, "key is not in the pack any more")); continue
        if st == "unsure":
            unsure.append((k, r["comment"])); continue
        if st != "changed":
            continue
        new = r["corrected"]
        if not new.strip() or new == pack[k]:
            refused.append((k, "marked changed but no new text")); continue
        if is_arabic(k, pack[k]):
            refused.append((k, "Arabic text is never changed by an import: for the imam")); continue
        if sorted(PH.findall(new)) != sorted(PH.findall(pack[k])):
            refused.append((k, "placeholders differ: " + ", ".join(PH.findall(pack[k])))); continue
        old_lit = json.dumps(pack[k], ensure_ascii=False)
        if text.count(old_lit) != 1:
            refused.append((k, "the current text is not unique in the file; edit it by hand")); continue
        text = text.replace(old_lit, json.dumps(new, ensure_ascii=False))
        applied.append(k)
    # may the pack be marked reviewed?
    by = {r["key"]: r for r in rows}
    problems = []
    for k in liveby:
        r = by.get(k)
        if r is None:
            missing.append(k); continue
        if r["status"].strip().lower() not in ("ok", "changed"):
            problems.append(k)
        elif liveby[k]["source"] and r["reference_checked"].strip().lower() != "yes":
            problems.append(k + " (reference not checked)")
    can_flip = not problems and not missing and not unsure
    flipped = False
    if can_flip:
        today = a.date or datetime.date.today().isoformat()
        m = re.search(r'"meta"\s*:\s*\{[^}]*\}', text)
        if m and '"reviewed": false' in m.group(0):
            meta = m.group(0).replace('"reviewed": false', '"reviewed": true, "reviewer": %s, '
                                      '"reviewedOn": "%s"' % (json.dumps(a.reviewer, ensure_ascii=False), today))
            text = text[:m.start()] + meta + text[m.end():]
            flipped = True
    json.loads(text)  # never write a broken pack
    print("%s: applied %d, refused %d, unsure %d, rows without a status %d" %
          (lang, len(applied), len(refused), len(unsure), len(problems)))
    for k, why in refused:
        print("  refused", k, "-", why)
    for k, c in unsure:
        print("  unsure ", k, "-", c)
    print("  reviewed flag:", "set to true" if flipped else "unchanged (sheet incomplete or has unsure rows)")
    if a.dry_run:
        print("  dry run: nothing written"); return
    if applied or flipped:
        with open(fpath, "w", encoding="utf-8") as f:
            f.write(text)


def cmd_status(a):
    for lang in LANGS:
        m = load(lang)["meta"]
        print(lang, "reviewed" if m.get("reviewed") else "NOT reviewed", m.get("reviewer", ""), m.get("reviewedOn", ""))


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    s = p.add_subparsers(dest="cmd", required=True)
    e = s.add_parser("export"); e.add_argument("--lang", default="all", choices=("all",) + LANGS)
    e.add_argument("--out", default=os.path.join(ROOT, "review"))
    i = s.add_parser("import"); i.add_argument("sheet"); i.add_argument("--reviewer", required=True)
    i.add_argument("--date"); i.add_argument("--dry-run", action="store_true")
    s.add_parser("status")
    a = p.parse_args()
    {"export": cmd_export, "import": cmd_import, "status": cmd_status}[a.cmd](a)


if __name__ == "__main__":
    main()
