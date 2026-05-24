# Architecture

## Overview

Ten is now a self-hosted web app with a lightweight Node server and a vanilla browser client. It is still intentionally simple and single-user.

**This is a personal app. It has exactly one user. Do not design for multi-user scenarios, sharing, accounts, or any form of social feature.**

## Stack

- **Server**: Node.js HTTP server (`server/index.js`) for static serving + proxy endpoints
- **Client**: Vanilla HTML/CSS/JS (`src/client/index.html`, `src/client/styles.css`, `src/client/app.js`)
- **PWA**: Web manifest + service worker (`src/client/manifest.json`, `src/client/sw.js`)
- **Word data**: Generated JSON pools (`src/client/words.pt.json` for PT-BR, `src/client/words.fr.json` for French)
- **Frequency data**: Bundled JSON dictionaries (`src/client/frequency-pt-br.json`, `src/client/frequency-fr.json`)
- **Translation path**: Client -> `/api/translate` -> provider split by word count (1-5 words uses Google Translate, 6+ words uses DeepL; punctuation ignored)
- **Anki path**: Client -> `/api/anki` -> configurable AnkiConnect endpoint; each mode uses its own deck and note type (`Basic-BR` for PT-BR, `Basic-FR` for French—cloned from Basic in Anki); learning language is always on Back; `addNote` uses `allowDuplicate: false` so Anki rejects duplicate first fields within the same note type
- **Review model**: Anki is the sole SRS source of truth (no local scheduler)
- **Persistence**: SQLite (`data/ten.db`, override with `TEN_DB_PATH`) for unlocked frequency words and daily 10-card stack position (per language + calendar day); active language mode in `sessionStorage`
- **Tooling**: Node scripts for words and icons in `scripts/`

## Directory structure

```
server/
  index.js              # Node server + API proxy
  db.js                 # SQLite (unlocked frequency words)
data/
  ten.db                # SQLite database (created at runtime, gitignored)
src/
  client/
    index.html          # App markup shell
    styles.css          # App styles
    app.js              # App logic
    words.pt.json       # Brazilian Portuguese word pool
    words.fr.json       # French word pool
    frequency-pt-br.json # PT-BR frequency dictionary
    frequency-fr.json   # French frequency dictionary
    sw.js               # Service worker
    manifest.json       # PWA manifest
    icon-192.png
    icon-512.png
scripts/
  generate-words.js
  download-frequency-dictionaries.js
  generate-icons.js
```

## Runtime model

1. `npm run start` starts the Node server on `PORT` (default `3000`)
2. Server serves client assets from `src/client`
3. Client calls:
   - `POST /api/translate` to proxy translation requests with provider routing (`GOOGLE_TRANSLATE_API_KEY` for 1-5 words, `DEEPL_AUTH_KEY` for 6+ words)
   - `POST /api/anki` to proxy AnkiConnect actions
   - `GET /api/unlocked-words` and `POST /api/unlocked-words` for frequency unlock state (`POST /api/unlocked-words/import` for one-time localStorage migration)
   - `GET /api/daily-progress` and `POST /api/daily-progress` for which card (0–9) is open in today’s 10/day stack
4. Daily words are fetched from the active mode pool (`/words.pt.json` or `/words.fr.json`) and shown in deterministic 10/day order; the open card index is restored after refresh. Reaching card 10 triggers a one-time `canvas-confetti` burst (per language + day, tracked in `sessionStorage`)
5. Frequency tab reads bundled dictionaries and highlights words seen in 10/day or via a single-word translate (persisted in SQLite via `/api/unlocked-words`)
6. Review tab fetches new and due cards from Anki (`findCards` with `is:new` then `is:due`, `cardsInfo`) and submits grades via `answerCards`

## Word pool generation

`scripts/generate-words.js` is PT-BR-only and writes to `src/client/words.pt.json`.

French pool content is curated separately in `src/client/words.fr.json` and starts from beginner/high-frequency vocabulary.
