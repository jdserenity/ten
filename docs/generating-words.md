# Generating the word pool

## Background

The original approach scraped the Wiktionary Brazilian Portuguese frequency list and pulled example sentences from Tatoeba. It was abandoned because:

- **~20-40% of words were English**, not Portuguese — the frequency list contains loanwords and the scraper had no way to verify language authenticity
- **Sentences used the wrong sense of a word** — Tatoeba is user-contributed and does substring matching; it can't know which meaning is being taught
- **Sentences modelled incorrect usage** — Tatoeba quality is uneven; some entries use words in grammatically or contextually wrong ways

The user is an intermediate Brazilian Portuguese learner and was catching these errors themselves. The word pool cannot be trusted to self-correct — it needs editorial judgment.

## Current approach

Words are written directly by a language-capable agent (Claude) and committed as `public/words.json`. No scraping, no external APIs at generation time. The output is reviewed by the user before deployment.

## Quality standards

### Words
- **Must be genuine Brazilian Portuguese** — not English loanwords, not European Portuguese variants spelled differently
- **Intermediate level (B1–B2)** — useful in everyday conversation but not among the most basic 500 words (those would be things like *e, não, ser, ter, com, para, que, mais*)
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

`public/words.json` is a JSON array. Each entry:

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

1. **Pick intermediate Brazilian Portuguese words** — nouns, verbs, adjectives in a natural mix. Avoid the very common ones listed above.
2. **For each word**, write:
   - A concise translation that captures real usage
   - 2 natural sentences in Brazilian Portuguese (20–140 chars each) that clearly demonstrate the primary meaning
   - Accurate, natural English translations of those sentences
3. **Write the full array to `public/words.json`** — replace the file entirely; do not append (unless explicitly asked to extend an existing pool)
4. **Bump the service worker cache version** in `public/sw.js` — change `ten-vN` to the next number. This is mandatory; without it, deployed browsers will keep serving the old cached `words.json` indefinitely.

### Checking the pool indicator

After updating `words.json`, the app's footer shows `~N days left in pool`. It turns amber when ≤ 7 days remain. That is the signal to generate more words.

## What to avoid

- Words that are spelled the same in English and Portuguese (e.g. *animal, hotel, natural*) — they make poor vocabulary cards
- Heavily inflected forms as headwords — use *gostar* not *gostaram*
- Sentences where the word appears as a different part of speech than taught
- Sentences longer than ~140 characters — they overflow the card
- European Portuguese spellings (e.g. *facto* instead of *fato*, *autocarro* instead of *ônibus*)
