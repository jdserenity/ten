# Architecture (agent reference)

Dense system map for agents. Confirmed facts only. Lessons → `scaffold/PROJECT-KNOWLEDGE.md`. Word-pool editorial rules → `scaffold/generating-words.md`.

## Product
- **Name:** Ten — personal PWA for learning Brazilian Portuguese and French (Quebec-oriented).
- Exactly one user. No multi-user, accounts, sharing, or social features — do not propose them.
- Two learning tracks: **PT-BR** (intermediate / B1–B2 oriented) and **FR** (beginner, top-frequency vocabulary first). Default mode on open: French.
- Tabs: **10/day** (10 deterministic words/day from the active pool), **Translate**, **Review** (Anki-backed), **Frequency** (bundled dictionaries with unlock highlighting).
- Anki is the sole SRS source of truth (no local scheduler). Separate decks and note types per track so duplicate detection does not cross languages.
- Mobile PWA first. Do not suggest desktop-only UX (e.g. Esc shortcuts) unless asked.
- Lean root `README.md` — features only; architecture/deploy live here and in `ARCH-HUMAN.md`.

## Constraints
- **No frameworks.** Vanilla HTML/CSS/JS only. Do not introduce React, Vue, Svelte, Vite, Webpack, Tailwind, or equivalents.
- **Minimal deps.** Runtime: `better-sqlite3`, `canvas-confetti` (vendored as `src/client/confetti.browser.js`), `dotenv`, `node-html-parser` (generator scripts). Avoid new deps without a strong reason.
- Minimal Node server — no heavy backend frameworks or infrastructure unless explicitly requested.
- Self-hosted via `npm run start`. No external CI/CD requirement.

## Stack
- Node HTTP server: `server/index.js` (static + API proxies), `server/db.js` (SQLite).
- Client: `src/client/index.html`, `styles.css`, `app.js`.
- PWA: `src/client/manifest.json`, `sw.js` (cache name `ten-vN`), `icon-192.png` / `icon-512.png` (static aurora PNGs).
- Word pools: `src/client/words.pt.json`, `words.fr.json`.
- Frequency dictionaries: `src/client/frequency-pt-br.json`, `frequency-fr.json` (up to ~5000 each).
- TTS: mode speech langs `pt-BR` / `fr-CA`.

## Layout
| Path | Role |
| --- | --- |
| `server/index.js` | HTTP server, static files, `/api/*` proxies |
| `server/db.js` | SQLite schema + unlock/daily-progress helpers |
| `data/ten.db` | Runtime DB (gitignored); override with `TEN_DB_PATH` |
| `src/client/app.js` | All UI logic; `MODE_CONFIGS` for per-mode settings |
| `src/client/ten-logic.js` | Pure helpers for startup tab + frequency filters (unit-tested) |
| `src/client/confetti.browser.js` | Vendored confetti for 10/day completion |
| `scripts/generate-words.js` | PT-BR pool generator → `words.pt.json` |
| `scripts/generate-words-fr.js` | FR pool from frequency lists → `words.fr.json` |
| `scripts/download-frequency-dictionaries.js` | Refresh bundled frequency JSON |
| `scripts/check-deepl.js` / `check-google.js` | API key smoke checks |
| `scaffold/generating-words.md` | How to curate/regenerate word pools |

## Modes (`MODE_CONFIGS` in `app.js`)
| Mode id | Deck | Note type | Words | Sentence key | Learning lang |
| --- | --- | --- | --- | --- | --- |
| `pt-br` | `Brazilian Portuguese` | `Basic-BR` | `/words.pt.json` | `pt` | `PT-BR` |
| `fr` | `French` | `Basic-FR` | `/words.fr.json` | `fr` | `FR` |

Active language mode is stored in `sessionStorage` (defaults to `fr` when unset).

## APIs
| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/translate` | Provider split by word count (punctuation ignored): **1–5 words → Google** (`GOOGLE_TRANSLATE_API_KEY`); **6+ → DeepL** (`DEEPL_AUTH_KEY`). Same split for both language modes. |
| POST | `/api/anki` | Proxies AnkiConnect (`ANKI_CONNECT_ENDPOINT`, default `http://127.0.0.1:8765`). |
| GET/POST | `/api/unlocked-words` | Frequency unlock state. POST adds one word. |
| POST | `/api/unlocked-words/import` | One-time localStorage → SQLite migration. |
| GET/POST | `/api/daily-progress` | Open 10/day card index (0–9) keyed by language + calendar day. |
| GET | `/api/health` | `{ ok: true }` |

## Client behavior
- **10/day:** Deterministic 10-word slice from active pool; card index restored via `/api/daily-progress`. Reaching card 10 fires a one-time `canvas-confetti` burst per language + calendar day (`localStorage` gate so it does not re-fire on later loads that day). Footer shows `~N days left in <mode> pool` (amber at ≤7). On page refresh, default tab is **10/day** unless that day’s 10 are already complete (confetti gate), then **Translate**. Tab choice persists in memory during the same page session (no refresh).
- **Translate:** Result can be saved to Anki; TTS on result. Single learning-language word unlocks that word in the frequency dictionary. Daily cards and single-word translate results show frequency rank + tier when the word is in the dictionary.
- **Frequency:** Bundled list; unlocked words highlighted (seen in 10/day or unlocked via single-word translate). Summary cards: **Unlocked** (left) and **Not learned** (right); tap either to filter that pool, tap again to show all. Default list on refresh is the full pool. Tap word → live translate (learning language → English) inline.
- **Review:** `findCards` with `is:new` then `is:due`, `cardsInfo`; grades via `answerCards`.
- **Anki add:** Learning language on Back; `addNote` with `allowDuplicate: false` (rejects duplicate first fields within the same note type).

## Persistence (SQLite)
Path: `TEN_DB_PATH` or `data/ten.db`.
- `unlocked_words(language, normalized_word, unlocked_at)` PK `(language, normalized_word)`
- `daily_card_index(language, date_key, card_index, updated_at)` PK `(language, date_key)`
Languages: `PT-BR`, `FR`.

## Word / frequency data
- `words.pt.json` is **generated** (`npm run generate:pt`) — do not hand-edit; change the generator and re-run. Editorial standards: `scaffold/generating-words.md`.
- French pool: `npm run generate:fr` (frequency-dictionary-based).
- Frequency refresh: `npm run frequency:download`, then bump SW cache.
- After any change to SW-cached client assets (word files, frequency JSON, icons, CSS/JS shell), bump `ten-vN` in `src/client/sw.js`.

## Run / deploy
```bash
cp .env.example .env   # GOOGLE_TRANSLATE_API_KEY, DEEPL_AUTH_KEY; optional PORT, ANKI_*, TEN_DB_PATH
npm install
npm run start          # default PORT 3001; scans upward if busy
npm run deepl:check
npm run google:check
```
Production: always-on backup MacBook with Anki Desktop + AnkiConnect + Ten server + Tailscale for phone access. Anki note types must exist exactly as `Basic-BR` and `Basic-FR` (clone from Basic). Back up `data/ten.db`. Human-oriented setup (launchd, Tailscale) → `scaffold/ARCH-HUMAN.md`.
