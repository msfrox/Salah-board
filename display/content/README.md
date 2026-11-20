# Content packs

One JSON per language: `en.json` (reference), `ta.json` (Tamil), `si.json`
(Sinhala). Arabic dua text is embedded inside each pack — duas always render
Arabic + local translation.

Rules:
- Every dua/text object carries a `source` (hadith reference). **Unsourced
  content must not ship.** New content = PR with the reference.
- `meta.reviewed: false` until checked by a scholar/aalim; the app may show
  a small "unreviewed translation" marker in the admin panel (never on the
  main display).
- Shafi'i / ACJU (Sri Lanka) conventions. Wording changes that affect
  meaning need a source discussion in the PR.
- `ta.json` / `si.json` are created in M1 as structure-copies of `en.json`
  (machine translation acceptable initially, flagged unreviewed).

Review: `tools/review-content.sh export` writes one sheet per language to `review/content/`;
`import` applies a returned sheet and flips `meta.reviewed` only with a reviewer name and a
complete sheet (see the header of `tools/review-content.py`). Never hand-edit `reviewed`.
