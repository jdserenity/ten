# Ten

A personal PWA for learning Brazilian Portuguese and French.

## Features

- **10/day tab**: Shows 10 deterministic words per day from the active language pool, with translations and real example sentences. Remembers which card you were on after refresh.
- **Language toggle**: Top-right flag switch between Brazil (PT-BR) and Quebec French mode.
- **Translate tab**: Uses Google Translate for very short inputs (1-5 words, punctuation ignored) and DeepL for 6+ words, then lets you save results instantly as a flashcard. TTS on the result.
- **Review tab**: Fully Anki-backed (loads new + due cards from AnkiConnect, new first, and submits grades back to Anki).
- **Frequency dictionary tab**: Full PT-BR and French frequency dictionaries (up to 5000 each), with bright green unlocked words (stored in SQLite on the server). Tap a word for an instant inline translation.
- **Frequency rank hints**: Daily cards and single-word Translate results show frequency rank when available.
- **Anki-first workflow**: Daily/Translate cards go to the active mode’s deck (`Brazilian Portuguese` / `French`) and note type (`Basic-BR` / `Basic-FR`).
- **Text-to-speech**: Mode-specific speech synthesis (`pt-BR` and `fr-CA`).
- **Daily completion**: Confetti when you reach the 10th card (once per day per language).
- **Word generation**: `npm run generate:pt` (Portuguese), `npm run generate:fr` (French frequency dictionary based).
- **Dictionary refresh**: `npm run frequency:download` refreshes bundled frequency files.