# Architecture

## Overview

Ten is now a self-hosted web app with a lightweight Node server and a vanilla browser client. It is still intentionally simple and single-user.

**This is a personal app. It has exactly one user. Do not design for multi-user scenarios, sharing, accounts, or any form of social feature.**

## Stack

- **Server**: Node.js HTTP server (`server/index.js`) for static serving + proxy endpoints
- **Client**: Vanilla HTML/CSS/JS (`src/client/index.html`, `src/client/styles.css`, `src/client/app.js`)
- **PWA**: Web manifest + service worker (`src/client/manifest.json`, `src/client/sw.js`)
- **Word data**: Generated JSON (`src/client/words.json`)
- **Translation path**: Client -> `/api/translate` -> configurable LibreTranslate endpoint
- **Anki path**: Client -> `/api/anki` -> configurable AnkiConnect endpoint
- **Review model**: Anki is the sole SRS source of truth (no local scheduler)
- **Client persistence**: localStorage only for UI/settings persistence
- **Tooling**: Node scripts for words and icons in `scripts/`

## Directory structure

```
server/
  index.js              # Node server + API proxy
src/
  client/
    index.html          # App markup shell
    styles.css          # App styles
    app.js              # App logic
    words.json          # Generated word pool (do not edit by hand)
    sw.js               # Service worker
    manifest.json       # PWA manifest
    icon-192.png
    icon-512.png
scripts/
  generate-words.js
  generate-icons.js
```

## Runtime model

1. `npm run start` starts the Node server on `PORT` (default `3000`)
2. Server serves client assets from `src/client`
3. Client calls:
   - `POST /api/translate` to proxy translation requests
   - `POST /api/anki` to proxy AnkiConnect actions
4. Daily words are fetched from `/words.json` and shown in deterministic 10/day order
5. Review tab fetches due cards from Anki (`findCards` + `cardsInfo`) and submits grades via `answerCards`

## Word pool generation

`scripts/generate-words.js` writes to `src/client/words.json`.

The current `TARGET_WORDS` of 100 is a test value — increase it before long-term use (10 words/day means 100 words runs out in 10 days).
