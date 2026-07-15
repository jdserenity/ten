# Project knowledge

Hard-won lessons and traps. Product/system facts live only in `scaffold/ARCH-LLM.md` / `scaffold/ARCH-HUMAN.md` — do not restate them here. Word-pool quality standards live in `scaffold/skills/seed-daily-words/SKILL.md`.

## TTS must assign a voice, not only lang
Setting `SpeechSynthesisUtterance.lang` alone (e.g. `es-AR`) is not enough. Many browsers keep the default English voice and mangle Spanish/Portuguese/French. Always pick a matching voice via `speechSynthesis.getVoices()` and set `utt.voice`. Exact `es-AR` voices are rare — prefer Latin American Spanish (`es-MX`, `es-US`, `es-419`, …) before Spain (`es-ES`). Chrome may return an empty voice list until the `voiceschanged` event.

## Service worker removed
Ten no longer ships `sw.js`. Static assets are served with `Cache-Control: no-cache`; `app.js` unregisters any leftover worker on load so phones stop intercepting requests after deploy.

## Procedural PWA icons were a dead end
An old script generated icons at runtime. At 192/512px the results looked bad. Icons are now committed static PNGs (`icon-192.png` / `icon-512.png`, aurora design). Replacing the look means replacing those PNGs — do not revive a procedural generator.

## Default port is 3001, not 3000
Older docs said `3000`. The server defaults to `PORT` or **3001**, and scans upward if the port is taken. Use whatever URL the process prints; Tailscale phone bookmarks should match that port.

## Shared French pool was wrong
Quebec (`fr`) and France (`fr-fr`) must not share one `words.fr.json`. Separate files (`words.fr-ca.json`, `words.fr-fr.json`) keep progress and regional sentences honest. Same idea for Spanish: use `words.es-ar.json`, not a generic `words.es.json`.

## Tatoeba / scrape generators are retired
Auto-fetched example sentences (Tatoeba, naive Wiktionary scrapes) produced wrong senses, weak usage, and English contamination. Pools are agent/LLM curated via `scaffold/skills/seed-daily-words/SKILL.md` and gated by `npm run words:check`.

## Accents are non-negotiable
A previous French pool shipped with **zero diacritics** (`tres`, `ecole`, `francais`). The checker fails entries with no accents in languages that use them. Always write real orthography.

## Sense and POS traps
LLMs sometimes use the wrong reading of a word (e.g. Portuguese *linda* as the name “Linda” instead of “beautiful”). Sentences must match the taught sense and part of speech. Prefer showcasing real multi-sense lemmas on purpose — never accidental name/POS mixups.

## One lemma per card
Do not add separate 10/day cards for conjugations/inflections of a lemma already in the pool. Show real forms inside the three example sentences instead.

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

## reconcileDailyWords must keep today's assigned words after they are surfaced in 10/day
`reconcileDailyWords` uses the surfaced/unlocked set to block **new** picks and refills, not to drop headwords already in today's saved assignment. Viewing a word on the 10/day tab adds it to the unlocked set immediately; if reconcile also removed assigned headwords present in that set, a refresh would swap today's list and reset progress dots. Words unlocked outside 10/day while still on today's list are removed live via `reconcileTodayWordsAfterUnlock`, which persists the updated assignment before the next load.

## Boot should not block on every tab's data
Startup used to run the full 10/day + frequency pipeline before opening the tab the user actually needs (e.g. Review after finishing 10/day). `planBootDataLoads` in `client-load.js` picks priority vs background loads; unlocks, word pool JSON, frequency JSON, and daily assignment/index prefetch in parallel. Daily glosses should use `Promise.all` — four sequential translate calls made card flips feel stuck.
