# Architecture (agent reference)

Dense system map for agents. Confirmed facts only. Lessons → `scaffold/PROJECT-KNOWLEDGE.md`. Word-pool editorial rules → `scaffold/skills/seed-daily-words/SKILL.md`.

## Product
- **Name:** Ten — personal PWA for learning Brazilian Portuguese, French (Quebec-oriented), French (France-oriented), and Argentinian Spanish.
- **Users:** Username-only accounts (no email/password). New username → create account; existing → sign in. Remembered on device via `localStorage`. Seeded owner account **`jd`** has `is_dev = 1` (dev mode); all other signups are prod (`is_dev = 0`). Each user owns their own cards, unlocks, daily progress, and language list. Until the user adds at least one learning language, tabs show **Add a language!** (i18n) with no fetch errors; Translate controls are disabled. Fresh users (no languages yet) see a white chalk-style hint arrow near the header `+`; it hides while the header language picker is open and disappears once any language is added.
- Four offered learning tracks: **PT-BR** (intermediate / B1–B2 oriented), **FR** (beginner, Quebec-oriented; top-frequency vocabulary first), **FR-FR** (beginner, France-oriented; reuses the French word pool and frequency list with separate progress), and **ES-AR** (beginner, Argentina-oriented; word pool TBD). Users pick any on first open (header `+`) and can add or remove languages later in **Settings** (picker lists every track; owned ones start selected so deselecting + Save removes them). Default mode on open: last visited language among the user's languages.
- Tabs: **10/day** (up to 10 unseen words/day from the active pool), **Review** (10 flashcards/day after 10/day, then unlimited), **Frequency** (bundled dictionaries with unlock highlighting), **Translate** (free-form translation; last tab). **Settings** opens from a cog icon in the header tools row (with feedback + flags; not a tab).
- **FSRS** (`ts-fsrs`) on the Node server is the sole SRS source of truth. Flashcards live in SQLite per user + language; duplicate `(user_id, language, front, back)` rejected on add.
- **Dev vs prod:** Dev users (`is_dev`) see owner-only UI: wrench link to **`/ops.html`** (all four pool runways by language/user + feedback inbox), and `~N days left in <mode> pool` on the 10/day footer. Prod users do not.
- **Feedback:** Header compact field expands to a writing panel; submits to SQLite. Dev users read entries on **Ops** (`/ops.html`), not in Settings.
- **App language (UI / native):** Supported `en` and `pt-BR`. The `pt-BR` catalog is **Brazilian Portuguese** (not European). Before sign-in, UI uses `navigator.languages` detection. Signed-in users can override in **Settings**; stored on the account as `users.app_lang` (`NULL` = keep using browser detection). `<html lang>` tracks app language. Translate / Frequency inline translate use app language as the non-learning pole (falls back to `EN` when app language equals the active learning language). Strings live in `src/client/i18n.js`.
- Mobile PWA first. Do not suggest desktop-only UX (e.g. Esc shortcuts) unless asked.
- Lean root `README.md` — features only; architecture/deploy live here and in `ARCH-HUMAN.md`.

## Constraints
- **No frameworks.** Vanilla HTML/CSS/JS only. Do not introduce React, Vue, Svelte, Vite, Webpack, Tailwind, or equivalents.
- **Minimal deps.** Runtime: `better-sqlite3`, `ts-fsrs`, `canvas-confetti` (vendored as `src/client/confetti.browser.js`), `dotenv`, `node-html-parser` (generator + import scripts). Avoid new deps without a strong reason.
- Minimal Node server — no heavy backend frameworks or infrastructure unless explicitly requested.
- Self-hosted via `npm run start` (VPS or always-on machine). No external CI/CD requirement.

## Stack
- Node HTTP server: `server/index.js` (static + APIs), `server/db.js` (SQLite), `server/cards.js` + `server/fsrs.js` (card CRUD + scheduling).
- Client: `src/client/index.html`, `styles.css`, `app.js`.
- PWA: `src/client/manifest.json`, `icon-192.png` / `icon-512.png` (static aurora PNGs). No service worker — static assets are served with `Cache-Control: no-cache`.
- Word pools: `src/client/words.pt-br.json`, `words.fr-ca.json`, `words.fr-fr.json`, `words.es-ar.json` (agent-curated; one file per flavour).
- Frequency dictionaries: `src/client/frequency-pt-br.json`, `frequency-fr.json`, `frequency-es-ar.json` (up to ~5000 each). ES-AR list from ACTIV-ES Argentina subtitle corpus (`ar_orf` column).
- TTS: Web Speech API; `speakText` picks the best installed voice for mode speech langs `pt-BR` / `fr-CA` / `fr-FR` / `es-AR` (`es-AR` falls back to Latin American Spanish, then Spain). Translate: Google uses `es-AR` for short Spanish and `fr-FR` for France French; DeepL uses generic `ES` and `FR` (no regional codes).

## Layout
| Path | Role |
| --- | --- |
| `server/index.js` | HTTP server, static files, `/api/*` |
| `server/db.js` | SQLite schema + unlock/daily-progress helpers |
| `server/cards.js` | Flashcard CRUD + review queue + grade |
| `server/fsrs.js` | `ts-fsrs` wrapper |
| `data/ten.db` | Runtime DB (gitignored); override with `TEN_DB_PATH` |
| `src/client/app.js` | All UI logic; `MODE_CONFIGS` for per-mode settings |
| `src/client/i18n.js` | App-language catalogs (`en`, `pt-BR`), detection, `t()` |
| `src/client/ten-logic.js` | Pure helpers for startup tab + frequency filters (unit-tested) |
| `src/client/client-load.js` | Boot load priority plan (`planBootDataLoads`; unit-tested) |
| `src/client/daily-pool.js` | 10/day word selection and pool-days-left math (shared with tests) |
| `src/client/ops.html` | Dev-only ops dashboard (pool runway + feedback) |
| `src/client/ops.js` | Ops page client logic |
| `server/daily-glosses.js` | Resolve/persist 10/day glosses via `translation_cache` |
| `server/pool-health.js` | Pool runway report for `/api/dev/ops` |
| `src/client/confetti.browser.js` | Vendored confetti for 10/day completion |
| `scripts/import-anki-cards.js` | One-shot AnkiConnect → SQLite import |
| `scripts/check-words.js` | Quality gate for all dialect word pools (`npm run words:check`) |
| `scaffold/skills/seed-daily-words/SKILL.md` | How agents curate/refill 10/day pools |

## Modes (`MODE_CONFIGS` in `app.js`)
| Mode id | Words | Sentence key | Learning lang |
| --- | --- | --- | --- |
| `pt-br` | `/words.pt-br.json` | `pt` | `PT-BR` |
| `fr` | `/words.fr-ca.json` | `fr` | `FR` |
| `fr-fr` | `/words.fr-fr.json` | `fr` | `FR-FR` |
| `es-ar` | `/words.es-ar.json` | `es` | `ES-AR` |

Active language mode is stored in `localStorage` (last visited; defaults to `fr` when unset). One-time migration reads legacy `sessionStorage` value.

Active language mode is stored in `localStorage` (last visited among the user's languages). Legacy single-user rows migrate to `jd` on first multi-user schema upgrade.

## APIs
| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/auth/login` | `{ username }` → create or find user `{ id, username, isDev, languages, appLang }`. No auth header. |
| GET | `/api/me` | Current user (requires `X-User-Id`). Includes `appLang`. |
| PUT | `/api/app-language` | `{ appLang: 'en' \| 'pt-BR' }` — persist UI language on user account. Requires `X-User-Id`. |
| PUT | `/api/user-languages` | `{ languages, replace? }` — add or replace user's `PT-BR` / `FR` / `FR-FR` / `ES-AR` list. |
| POST | `/api/feedback` | `{ body }` — save feedback for current user. |
| GET | `/api/feedback` | Dev users only — list recent feedback with username + time. |
| GET | `/api/dev/ops` | Dev users only — tightest pool runway per language + feedback list. |
| POST | `/api/translate` | Provider split by word count (punctuation ignored): **1–5 words → Google** (`GOOGLE_TRANSLATE_API_KEY`); **6+ → DeepL** (`DEEPL_AUTH_KEY`). Responses are cached in SQLite (`translation_cache`); cache hits return `provider: 'cache'`. No user header required. |
| GET | `/api/cards/queue?language=` | New + due cards for Review (new first). Requires `X-User-Id`. |
| POST | `/api/cards` | Add card `{ language, front, back, context? }`. |
| PATCH | `/api/cards/:id` | Update card `{ front, back, context? }`; FSRS state unchanged. |
| POST | `/api/cards/:id/answer` | Grade `{ rating: again\|hard\|good\|easy }`. |
| DELETE | `/api/cards/:id` | Delete card. |
| GET/POST | `/api/unlocked-words` | Frequency unlock state. POST adds one word. |
| POST | `/api/unlocked-words/import` | One-time localStorage → SQLite migration. |
| GET/POST | `/api/daily-progress` | Open 10/day card index (0–9) keyed by language + calendar day. |
| GET/POST | `/api/daily-words` | Today's fixed 10-word assignment (headwords JSON) per language + calendar day. |
| POST | `/api/daily-glosses/ensure` | Resolve and persist all 10/day glosses for today's cards + target language; uses `translation_cache` and only calls Google/DeepL on cache miss. Requires `X-User-Id`. |
| GET | `/api/health` | `{ ok: true }` |

Authenticated data routes require header **`X-User-Id`** (numeric user id from login).

## Client behavior
- **10/day:** Picks up to 10 words per day from the active pool that have not been surfaced yet (viewed on a daily card or unlocked via single-word translate / Frequency inline translate). Unlocked words are excluded even when still in the pool; saved assignments are reconciled on load and when a word is newly unlocked outside 10/day (drop + deterministic refill). Words already in today's saved assignment stay after refresh even once surfaced in 10/day; the surfaced set only blocks new picks and refills. Today's assignment is persisted in SQLite (`/api/daily-words`) so refresh keeps the same list; unviewed words from today are not marked surfaced and return to the pool. Card index restored via `/api/daily-progress`. Reaching card 10 fires a one-time `canvas-confetti` burst per language + calendar day (`localStorage` gate so it does not re-fire on later loads that day). Footer shows `~N days left in <mode> pool` for **dev users only** (one decimal when fractional; amber at ≤7; counts only pool words not yet unlocked/surfaced). On page refresh, default tab is **10/day** unless that day's 10 are already complete (confetti gate), then **Review** unless today's 10 review cards are done, then **Translate**. Tab order in the UI: 10/day → Review → Frequency → Translate. `+` buttons save word/sentences as flashcards. Glosses for all cards in today's assignment are resolved once on boot via `/api/daily-glosses/ensure` (any tab) and stored in SQLite (`daily_word_glosses`); English JSON fields are used when app language is `en` without calling translate APIs. Paid Google/DeepL calls happen only on `translation_cache` miss.
- **Review:** Daily goal of **10 flashcards** (progress dots; confetti once per language per calendar day when the tenth card is graded). After 10, an **∞** after the dots signals you can keep reviewing without limit. Loads queue from `/api/cards/queue` (new first); grades via `/api/cards/:id/answer` (FSRS). **Edit card** opens front/back fields and saves via `PATCH /api/cards/:id` (scheduling unchanged). Learning language on Back; app language on Front for new cards from 10/day / Translate. Daily progress count is client `localStorage`, not SQLite.
- **Translate:** Result can be saved as a card; TTS on result. Single learning-language word unlocks that word in the frequency dictionary. Daily cards and single-word translate results show frequency rank + tier when the word is in the dictionary. Swapping translate direction or switching learning mode clears the translate draft. Returning to the Translate tab resets direction to learning language → app language (or `EN` when those match).
- **Frequency:** Bundled list; unlocked words highlighted (seen in 10/day or unlocked via single-word translate). Summary cards: **Unlocked** (left) and **Not learned** (right); tap either to filter that pool, tap again to show all. Default list on refresh is the full pool. Tap word → live translate (learning language → app language) inline. While **Not learned** is active, the visible pool is frozen until the Frequency tab is left and re-entered or the filter is toggled off and on again — unlocking a word via inline translate does not remove it from the frozen list until then.

## Persistence (SQLite)
Path: `TEN_DB_PATH` or `data/ten.db`.
- `users(id, username UNIQUE, is_dev, app_lang, created_at)` — seed `jd` with `is_dev = 1` and both languages if empty; `app_lang` nullable (`en` | `pt-BR`)
- `user_languages(user_id, language)` PK `(user_id, language)`
- `feedback(id, user_id, body, created_at)`
- `unlocked_words(user_id, language, normalized_word, unlocked_at)` PK `(user_id, language, normalized_word)`
- `daily_card_index(user_id, language, date_key, card_index, updated_at)` PK `(user_id, language, date_key)`
- `daily_word_assignment(user_id, language, date_key, words_json, updated_at)` PK `(user_id, language, date_key)`
- `daily_word_glosses(user_id, language, date_key, target_lang, glosses_json, updated_at)` PK `(user_id, language, date_key, target_lang)` — resolved 10/day glosses per app-language pole
- `translation_cache(source_lang, target_lang, source_hash, source_text, translated_text, created_at)` PK `(source_lang, target_lang, source_hash)`
- `cards` — per-user flashcard content + FSRS state; unique `(user_id, language, front, back)`
Languages: `PT-BR`, `FR`, `FR-FR`, `ES-AR`.

## Word / frequency data
- Word pools are **agent-curated** (one JSON file per flavour). Editorial rules: `scaffold/skills/seed-daily-words/SKILL.md`. Validate with `npm run words:check`.
- New cards: one lemma, exactly **3** example sentences, content words only (glue skip-list), regional flavour mandatory.
- Frequency refresh: `npm run frequency:download` (PT-BR Wiktionary, FR FrequencyWords, ES-AR ACTIV-ES).

## Run / deploy
```bash
cp .env.example .env   # GOOGLE_TRANSLATE_API_KEY, DEEPL_AUTH_KEY; optional PORT, TEN_DB_PATH
npm install
npm run start          # default PORT 3001; scans upward if busy
npm test
npm run deepl:check
npm run google:check
```
**One-time Anki migration:** with Anki Desktop + AnkiConnect still running locally, `npm run import:anki` (optional `ANKI_CONNECT_ENDPOINT`). Imports note text from decks `Brazilian Portuguese` and `French`; FSRS scheduling starts fresh. Back up `data/ten.db`. Human-oriented setup → `scaffold/ARCH-HUMAN.md`.
