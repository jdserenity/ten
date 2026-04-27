# Ten

A personal PWA for learning Brazilian Portuguese.

## Features

- **10/day tab**: Shows 10 deterministic words per day from a pre-generated pool, with translations and real example sentences.
- **Translate tab**: Translates text via a LibreTranslate-compatible endpoint, then lets you save it instantly as a flashcard.
- **Review tab**: Fully Anki-backed (loads due cards from AnkiConnect and submits grades back to Anki).
- **Anki-first workflow**: Daily/Translate cards are added directly to your Anki deck.
- **Text-to-speech**: PT-BR speech synthesis for words/sentences.

## Setup

```bash
npm install
```

## Run locally

```bash
npm run start
```

App runs at `http://localhost:3000` by default.

## Regenerating the word pool

The word pool (`src/client/words.json`) is generated offline and committed. To refresh it:

```bash
npm run generate
```

This scrapes the Wiktionary Brazilian Portuguese frequency list (skipping the top 500 most common words), then fetches 2 real example sentences per word from Tatoeba. It targets 100 words by default — adjust `TARGET_WORDS` in `scripts/generate-words.js` for a larger pool.

## App structure

- `server/index.js`: lightweight Node server + API proxy
- `src/client/index.html`: markup shell
- `src/client/styles.css`: styles
- `src/client/app.js`: browser logic

## Deployment

Self-host the Node server (for example on your always-on MacBook):

```bash
npm install
npm run start
```

Use a process manager (pm2/launchd/systemd) if you want automatic restart.

## Translate + Anki settings

Configure these inside the app (Translate tab -> **Connection settings**):

- LibreTranslate endpoint (required for translation; proxied via `/api/translate`)
- LibreTranslate API key (optional)
- AnkiConnect endpoint, deck, and note type (optional; proxied via `/api/anki`)
