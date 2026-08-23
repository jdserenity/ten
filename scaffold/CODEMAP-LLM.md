# Code map (agent reference)

Confirmed product/system facts. File/flow/state map → `scaffold/CODEMAP-HUMAN.md`. Word-pool editorial rules → `scaffold/skills/seed-daily-words/SKILL.md`. Run → root `README.md`.

## Product
- **Ten** — personal PWA. Tracks: **PT-BR** (intermediate / B1–B2), **FR** (Quebec beginner), **FR-FR** (France beginner; own pool + progress, shared `frequency-fr.json` with FR), **ES-AR** (Argentina beginner). Users pick any via header `+`; add/remove later in Settings (owned start selected; deselect + Save removes).
- Username-only accounts. New username creates; existing signs in. Seed **`jd`** has `is_dev = 1`; everyone else `0`. Until ≥1 learning language: tabs show **Add a language!** (i18n), no fetch errors; Translate disabled; white chalk hint near header `+` (hidden while picker open; gone after any language added). Default open mode: last visited among the user's languages (`localStorage`; one-time migrate from `sessionStorage`).
- Tabs L→R: **5/new** (up to 5 unseen pool words/day), **5/review** (5 flashcards/day then unlimited), **Progress** (bundled frequency lists + unlock highlighting), **Translate** (last). **Settings** is a header cog, not a tab. UI strings: `en` / `pt-BR` (Brazilian, not European) in `i18n.js`. Pre-login: `navigator.languages`. Signed-in override: `users.app_lang` (`NULL` = keep detecting). `<html lang>` follows app language. Translate / Progress inline translate use app language as the non-learning pole (fallback `EN` when it equals the learning language). Tab labels pt-BR: `5/novas`, `5/revisar`, `Progresso`.
- Daily: `WORDS_PER_DAY = 5` (`daily-pool.js`), `DAILY_REVIEW_GOAL = 5` (`ten-logic.js`). Confetti once per language per calendar day on finishing the 5th new word and the 5th graded review (`localStorage` gates). After 5 reviews, **∞** — keep going. `resolveStartupTab`: 5/new unless that day's confetti gate is set → 5/review unless today's 5 grades are done → Translate.
- **FSRS** (`ts-fsrs`) is the only SRS. Cards unique on `(user_id, language, front, back)`. Learning language on Back; app language on Front for new cards from 5/new / Translate.
- Dev (`is_dev`): wrench → `/ops.html` (pool runway per language/user + feedback inbox); `~N days left in <mode> pool` on 5/new footer (one decimal when fractional; amber ≤7). Prod users do not see those. Header feedback expands; POST to SQLite; read on Ops, not Settings.

## Constraints
- Vanilla HTML/CSS/JS only. No React/Vue/Svelte/Vite/Webpack/Tailwind.
- Runtime deps: `better-sqlite3`, `ts-fsrs`, `canvas-confetti` (vendored `confetti.browser.js`), `dotenv`, `node-html-parser` (scripts). No new deps without a strong reason.
- Self-hosted `npm run start`. No service worker. Static `Cache-Control: no-cache`. `app.js` unregisters leftover workers. PWA icons are committed aurora PNGs (`icon-192.png` / `icon-512.png`) — do not revive a procedural generator.
- Default **PORT 3001**, scan upward if taken. `better-sqlite3` ≥ 12 on Node 24+.

## Modes (`MODE_CONFIGS` in `app.js`)
| id | pool | sentence key | learning lang | speech |
| --- | --- | --- | --- | --- |
| `pt-br` | `/words.pt-br.json` | `pt` | `PT-BR` | `pt-BR` |
| `fr` | `/words.fr-ca.json` | `fr` | `FR` | `fr-CA` |
| `fr-fr` | `/words.fr-fr.json` | `fr` | `FR-FR` | `fr-FR` |
| `es-ar` | `/words.es-ar.json` | `es` | `ES-AR` | `es-AR` |

Quebec and France must not share a word-pool file. Spanish pool is `words.es-ar.json`, not `words.es.json`. FR-CA vs FR-FR frequency list is shared (`frequency-fr.json`); unlocks/progress are not.

## APIs (`server/index.js`)
Auth header **`X-User-Id`** (numeric) on data routes except login + translate + health.

| Method | Path | |
| --- | --- | --- |
| POST | `/api/auth/login` | `{ username }` → `{ id, username, isDev, languages, appLang }` |
| GET | `/api/me` | current user |
| PUT | `/api/app-language` | `{ appLang: 'en' \| 'pt-BR' }` |
| PUT | `/api/user-languages` | `{ languages, replace? }` — `PT-BR` / `FR` / `FR-FR` / `ES-AR` |
| POST/GET | `/api/feedback` | POST any user; GET dev-only |
| GET | `/api/dev/ops` | dev-only: tightest pool runway + feedback |
| POST | `/api/translate` | 1–5 words (punctuation ignored) Google; 6+ DeepL. SQLite `translation_cache`; hits return `provider: 'cache'`. No user header. |
| GET | `/api/cards/queue?language=` | new + due, new first |
| POST | `/api/cards` | `{ language, front, back, context? }` |
| PATCH | `/api/cards/:id` | `{ front, back, context? }`; FSRS unchanged |
| POST | `/api/cards/:id/answer` | `{ rating: again\|hard\|good\|easy }` |
| DELETE | `/api/cards/:id` | |
| GET/POST | `/api/unlocked-words` | Progress/5/new unlocks |
| POST | `/api/unlocked-words/import` | one-time localStorage → SQLite |
| GET/POST | `/api/daily-progress` | 5/new card index 0–4, language + calendar day |
| GET/POST | `/api/daily-words` | today's headwords JSON; writes reject empty or `> WORDS_PER_DAY` |
| POST | `/api/daily-glosses/ensure` | persist all today's 5/new glosses for the app-language pole; provider only on cache miss |
| GET | `/api/health` | `{ ok: true }` |

## Client behavior
- **5/new:** Pick up to 5 pool words not yet surfaced (viewed on a daily card or unlocked via single-word translate / Progress inline translate). Unlocked words never appear even if still in the pool. Saved assignment persisted (`/api/daily-words`); refresh keeps the same list. Unviewed words from today are not marked surfaced and return to the pool. Assigned headwords already in today's list stay after they are surfaced in 5/new — the seen set blocks **new** picks/refills only. Words unlocked *outside* 5/new while still on today's list are dropped live (`reconcileTodayWordsAfterUnlock`) and refilled. Assignment longer than 5 is truncated to the first 5 on load. Card index via `/api/daily-progress`. Glosses: one `/api/daily-glosses/ensure` on boot (any tab) into `daily_word_glosses`; English JSON fields when app language is `en` (no paid call). Example sentences sit in a nested dropdown labeled **new word used in context**, collapsed by default; each open reveals one more sentence (up to 3). Nested **another** labels hide after open and cannot be collapsed. Chevron is a right-facing triangle that rotates down on open. Newly revealed sentences fade and slide in on every open, including reopen after close. Footer pool-days: unseen pool words / 5, dev only.
- **5/review:** Dots toward 5; confetti on 5th grade; then ∞. Queue from `/api/cards/queue`. Grade buttons stay enabled except while editing a card (do not `disabled` on `reviewSubmitting`). After async grade/delete/edit, clear busy flag and `renderReview()` in `finally`. Daily grade count is client `localStorage`, not SQLite.
- **Progress:** Unlocked = seen in 5/new or single-word translate. Summary **Unlocked** / **Not learned** toggle filters; tap again → all. Default on refresh: full list. Tap word → inline translate. **Not learned** freezes the visible pool until the tab is left or the filter is toggled off/on — inline unlock does not remove a row from that frozen list.
- **Translate:** Swap direction or switch learning mode clears draft. Re-entering the tab resets direction to learning → app language (or `EN` if those match). Single learning-language word unlocks Progress + shows rank/tier when in the dictionary. Same rank meta on 5/new cards.
- **TTS:** `speakText` must set `utt.voice` from `speechSynthesis.getVoices()` (`pickSpeechVoice`). `lang` alone keeps English on many browsers. `es-AR`: prefer Latin American tags before `es-ES`. Empty voice list until `voiceschanged`. If no matching non-English voice, do not `speak()` — never lang-only fallback.
- **i18n wiring:** `index.html` English is first-paint fallback. After boot, `applyAppLanguage()` overwrites `[data-i18n]`, placeholders, titles, aria-labels from `i18n.js`. `app.js?v=` query on the script tag is a cache buster.

## Persistence
`TEN_DB_PATH` or `data/ten.db`. WAL. Live schema after migrations (all per-user tables include `user_id`; legacy rows assigned to `jd`):
- `users(id, username UNIQUE NOCASE, is_dev, app_lang, created_at)` — `app_lang` nullable `en` | `pt-BR`
- `user_languages(user_id, language)` PK `(user_id, language)`
- `feedback(id, user_id, body, created_at)`
- `unlocked_words` PK `(user_id, language, normalized_word)`
- `daily_card_index` PK `(user_id, language, date_key)`
- `daily_word_assignment` PK `(user_id, language, date_key)`
- `daily_word_glosses` PK `(user_id, language, date_key, target_lang)`
- `translation_cache` PK `(source_lang, target_lang, source_hash)`
- `cards` unique `(user_id, language, front, back)` + FSRS columns
Languages stored: `PT-BR`, `FR`, `FR-FR`, `ES-AR`.

## Data
- Pools agent-curated; `npm run words:check`. One lemma/card; exactly 3 sentences (legacy PT-BR may still have 2); content words only; regional flavour mandatory. Each card has `level` (`A1` \| `A2` \| `B1` \| `B2`); the checker requires it. 5/new does not filter by `level`. No Tatoeba/scrape generators. PT-BR 5/new pool is currently empty (maintainer is not studying Portuguese).
- Frequency: `npm run frequency:download` (PT-BR Wiktionary, FR FrequencyWords, ES-AR ACTIV-ES `ar_orf` from `aes1grams.csv`, GPL-2.0 — cite Francom et al. if redistributing). ~5000 each.
- `npm run import:anki`: AnkiConnect live; copies note text from decks `Brazilian Portuguese` and `French`; FSRS starts fresh (all imported = new); re-run skips duplicates.

## Traps
- `reconcileDailyWords` must not drop today's assigned headwords just because 5/new already unlocked them; that swapped the day's list and reset dots.
- `planBootDataLoads` exists because blocking on every tab's data made Review-after-5/new slow; do not fetch 5/new glosses per card from the client.
- Adding a `ten-logic.js` import in `app.js` must not drop existing named imports (`nextFrequencyFilter` missing crashed boot as "Failed to initialize app").
- FR-CA and FR-FR sharing one `words.fr.json` mixed progress and regional sentences — keep separate files.
- ASCII-only French/Spanish in a pool is a hard fail (`words:check`).
- Do not disable review grade buttons during submit; tying `disabled` to `reviewSubmitting` left them grey on the next card on some browsers after the flag cleared.
