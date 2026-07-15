# Project knowledge

Hard-won lessons and traps. Product/system facts live only in `scaffold/ARCH-LLM.md` / `scaffold/ARCH-HUMAN.md` — do not restate them here. Word-pool quality standards and the abandoned scrape story live in `scaffold/generating-words.md`.

## Service worker removed
Ten no longer ships `sw.js`. Static assets are served with `Cache-Control: no-cache`; `app.js` unregisters any leftover worker on load so phones stop intercepting requests after deploy.

## Procedural PWA icons were a dead end
An old script generated icons at runtime. At 192/512px the results looked bad. Icons are now committed static PNGs (`icon-192.png` / `icon-512.png`, aurora design). Replacing the look means replacing those PNGs — do not revive a procedural generator.

## Default port is 3001, not 3000
Older docs said `3000`. The server defaults to `PORT` or **3001**, and scans upward if the port is taken. Use whatever URL the process prints; Tailscale phone bookmarks should match that port.

## Do not hand-edit `words.pt.json`
Portuguese pool content comes from `npm run generate:pt`. Hand edits get overwritten on the next generate. Change the generator (or follow `scaffold/generating-words.md`) and regenerate.

## Confetti is gated in localStorage on purpose
The 10/day completion burst is once per language per calendar day. That gate is client `localStorage`, not SQLite, so a refresh after finishing does not fire confetti again. Daily card *position* is server-side; celebration “already fired” is not. The same pattern applies to the daily **Review** tab (10 cards graded today).

## Review daily progress is client-only
Today's review progress (dots filled toward 10) lives in `localStorage` per language per calendar day, like the confetti gate — not in SQLite. Grading still updates FSRS in the database.

## Anki import is one-shot and needs AnkiConnect live
`npm run import:anki` talks to AnkiConnect on the machine running Anki. Run it before you retire Anki. It copies front/back text only — FSRS scheduling in Ten starts fresh (all imported cards are “new”). Re-running skips duplicates.

## `npm test` needs a working `better-sqlite3` native build
Card/FSRS tests use SQLite via `better-sqlite3`. Use **better-sqlite3 ≥ 12** on Node 24+ (v11 has no prebuilt binary for Node 24). If `npm install` still fails to compile, use Node 20 LTS or install Xcode Command Line Tools.

## Review async actions must re-render in `finally`
If `renderReview()` runs while `reviewSubmitting` is still `true`, grade buttons stay disabled until something else triggers a re-render (e.g. switching tabs). Clear the busy flag and call `renderReview()` in the `finally` block — same pattern as review edit save.

## Do not disable review grade buttons during submit
Again/Hard/Good/Easy should stay tappable except while editing a card. Double-submit is blocked in `submitReviewGrade`; tying `disabled` to `reviewSubmitting` left buttons grey on the next card on some browsers even after the flag cleared.

## ES-AR frequency list source
`frequency-es-ar.json` is built from the ACTIV-ES corpus ([francojc/activ-es](https://github.com/francojc/activ-es)): Argentine film/TV subtitle dialogue, sorted by the `ar_orf` column in `aes1grams.csv`. Regenerate via `npm run frequency:download`. GPL-2.0 corpus — cite Francom et al. if redistributing derivatives beyond this app's bundled JSON.

## When adding a ten-logic import, do not drop existing imports
A missing `nextFrequencyFilter` import in `app.js` crashed startup (`ReferenceError` in `setupFrequencyEvents`) while the generic UI only showed "Failed to initialize app."
