---
name: kb
description: >-
  Manage the Salah Board knowledge base in docs/kb/ — durable research
  notes, decisions, and findings. Use when the user says "/kb", "save this
  to the kb", "add to the knowledge base", "check the kb", "what does the kb
  say about …", or when you finish researching something worth keeping so it
  is not re-researched later.
---

# kb — Salah Board knowledge base

The knowledge base lives in `docs/kb/` (relative to the repo root). It holds
durable research notes, findings, and decisions that don't belong in the
formal specs. One Markdown file per entry, plus a `README.md` index.

## When to use

- **Save:** the user asks to record a finding, or you've just finished
  research/a decision worth keeping ("save this to the kb", "/kb add …").
- **Look up:** the user asks what's known about a topic ("check the kb for
  hardware", "/kb hardware").
- **List / update:** show the index, or revise/supersede an entry.

Always prefer reading the existing entries before answering a project
question that the kb might already cover — don't re-research what's saved.

## Entry format

Filename: `docs/kb/YYYY-MM-<slug>.md` (e.g. `2026-07-hardware-android-box-sri-lanka.md`).

Each entry starts with a metadata block, then sections:

```markdown
# <Title>

- **Date:** YYYY-MM-DD
- **Tags:** comma, separated, tags
- **Status:** researched | decided | superseded | draft
- **Related:** links to specs/other kb entries

## Question
What was being asked / decided.

## Conclusion
The short answer, stated plainly and first.

## Reasoning
Why — the analysis, trade-offs, options considered.

## Sources
- Title — URL   (one per line; always cite web research)
```

Keep prose terse and wrapped to ~72 columns to match the rest of `docs/`.

## Saving a new entry

1. Pick a slug and create `docs/kb/YYYY-MM-<slug>.md` using the format above.
2. Write Conclusion first (the answer), then Reasoning, then Sources. Never
   invent sources — cite the real URLs used. If a claim is unsourced, say so.
3. Add a row to the top of the "Entries" table in `docs/kb/README.md`
   (newest first): date, `[Title](file.md)`, tags.
4. If the finding also changes actionable project docs (e.g.
   `docs/HARDWARE.md`), update those in the same change and cross-link.
5. Commit with a clear message; push to the session's working branch.

## Looking something up

1. Read `docs/kb/README.md` to scan the index by title/tag.
2. Open the relevant entry file(s) and answer from them, citing the entry
   path. If nothing matches, say the kb has no entry yet and offer to
   research + save one.

## Superseding

Don't delete outdated entries — set their `Status: superseded`, add a note
pointing to the replacement, and link back from the new entry. History is
the point of a kb.
