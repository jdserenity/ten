# Generating the word pool

## Background

The original approach scraped the Wiktionary Brazilian Portuguese frequency list and pulled example sentences from Tatoeba. It was abandoned because:

- **~20-40% of words were English**, not Portuguese — the frequency list contains loanwords and the scraper had no way to verify language authenticity
- **Sentences used the wrong sense of a word** — Tatoeba is user-contributed and does substring matching; it can't know which meaning is being taught
- **Sentences modelled incorrect usage** — Tatoeba quality is uneven; some entries use words in grammatically or contextually wrong ways

The user is an intermediate Brazilian Portuguese learner and was catching these errors themselves. The word pool cannot be trusted to self-correct — it needs editorial judgment.

## Current approach

Word pools are generated from language-specific workflows and committed as JSON files in `src/client/`.

- `src/client/words.pt.json` -> Brazilian Portuguese pool
- `src/client/words.fr.json` -> French pool
- `src/client/words.es.json` -> Argentinian Spanish pool (curated; empty until filled)

French generation is frequency-dictionary-based (`scripts/generate-words-fr.js`), while Portuguese generation currently uses the legacy script (`scripts/generate-words.js`). Spanish has no generator yet — edit `words.es.json` directly.

## Quality standards

### Words
- **Brazilian Portuguese pool (`words.pt.json`)**:
  - Must be genuine Brazilian Portuguese (not European Portuguese spelling)
  - **Intermediate level (B1–B2)** — avoid the most basic top-frequency words
- **French pool (`words.fr.json`)**:
  - Natural modern French suitable for Quebec learners
  - **Beginner level (A1-ish)** — start from top/high-frequency dictionary words first
- **Argentinian Spanish pool (`words.es.json`)**:
  - Natural modern Spanish suitable for Argentina learners (voseo, local vocabulary where natural)
  - **Beginner level (A1-ish)** — start from top of `frequency-es-ar.json`
- **Clean stems preferred** — avoid heavily inflected verb forms as the headword; use the infinitive or the base noun/adjective
- **Good variety** — aim for a mix of nouns, verbs, and adjectives across a session

### Translations
- Describe actual Brazilian Portuguese usage, not just a dictionary gloss
- If the word has two meaningfully different common senses, note both — e.g. `"combinar"` should say *"to arrange, to agree on a plan; also to match or go well together"*
- Keep it concise — one line

### Sentences
- **Must demonstrate the primary taught meaning**, not a secondary or idiomatic one unless that is the meaning being taught
- **Natural and colloquial Brazilian Portuguese** — how people actually speak in Brazil, not textbook formal Portuguese
- **Exactly 2 sentences per word**
- **Length: 20–140 characters** per sentence (the app displays them inline; too short feels like a fragment, too long crowds the card)
- The English translation of each sentence should be natural English, not a word-for-word literal translation

## Format

Word files are JSON arrays. Each entry:

```json
{
  "word": "sossego",
  "translation": "peace and quiet, calm",
  "sentences": [
    { "pt": "Preciso de um pouco de sossego para terminar esse trabalho.", "en": "I need a bit of peace and quiet to finish this work." },
    { "pt": "No fim de semana, só quero sossego e nada mais.", "en": "On the weekend, all I want is peace and quiet." }
  ]
}
```

For French entries, use `fr` instead of `pt` in sentence objects. For Spanish, use `es`.

## How to generate

The app shows 10 words per day from a randomly shuffled pool. With a pool of N words, repetition becomes likely after approximately `N / 10` days.

**Recommended pool sizes:**
| Words | Approx. days before heavy repetition |
|-------|---------------------------------------|
| 50    | ~5 days (testing only)               |
| 200   | ~20 days                             |
| 365   | ~1 year                              |
| 730   | ~2 years                             |

### Steps for an agent generating words

1. Pick words for the correct pool:
   - PT-BR: intermediate vocabulary
   - FR: beginner high-frequency vocabulary (starting from the top of the frequency dictionary)
   - ES-AR: beginner high-frequency vocabulary (starting from the top of `frequency-es-ar.json`)
2. **For each word**, write:
   - A concise translation that captures real usage
   - 2 natural sentences in the pool language (20–140 chars each) that clearly demonstrate the primary meaning
   - Accurate, natural English translations of those sentences
3. **Write the full array to the target file** (`src/client/words.pt.json`, `words.fr.json`, or `words.es.json`) — replace the file entirely unless explicitly asked to append.

### Commands

- `npm run generate:pt` -> regenerate Portuguese pool
- `npm run generate:fr` -> regenerate French pool from Wiktionary frequency lists (top-down)

### Checking the pool indicator

After updating a word file, the app footer shows `~N days left in <mode> pool`. It turns amber when ≤ 7 days remain. That is the signal to generate more words.

## What to avoid

- Words that are spelled the same in English and Portuguese (e.g. *animal, hotel, natural*) — they make poor vocabulary cards
- Heavily inflected forms as headwords — use *gostar* not *gostaram*
- Sentences where the word appears as a different part of speech than taught
- Sentences longer than ~140 characters — they overflow the card
- European Portuguese spellings (e.g. *facto* instead of *fato*, *autocarro* instead of *ônibus*)
