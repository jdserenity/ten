# Ten

A personal PWA for learning Brazilian Portuguese and French.

## Features

- **10/day tab**: Shows 10 deterministic words per day from the active language pool, with translations and real example sentences.
- **Language toggle**: Top-right flag switch between Brazil (PT-BR) and Quebec French mode.
- **Translate tab**: Uses Google Translate for very short inputs (1-5 words, punctuation ignored) and DeepL for 6+ words, then lets you save results instantly as a flashcard.
- **Review tab**: Fully Anki-backed (loads due cards from AnkiConnect and submits grades back to Anki).
- **Frequency dictionary tab**: Full PT-BR and French frequency dictionaries (up to 5000 each), with bright green words already seen in 10/day.
- **Frequency rank hints**: Daily cards and single-word Translate results show frequency rank when available.
- **Anki-first workflow**: Daily/Translate cards are added to the deck configured for the active language mode.
- **Text-to-speech**: Mode-specific speech synthesis (`pt-BR` and `fr-CA`).
- **Word generation**: `npm run generate:pt` (Portuguese), `npm run generate:fr` (French frequency dictionary based).
- **Dictionary refresh**: `npm run frequency:download` refreshes bundled frequency files.