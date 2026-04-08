# Ten

A personal PWA for learning Brazilian Portuguese. Shows 10 words a day from a pre-generated pool, with English translations and real example sentences from Tatoeba. Text-to-speech for pronunciation. Works offline.

## Setup

```bash
npm install
```

## Regenerating the word pool

The word pool (`public/words.json`) is generated offline and committed. To refresh it:

```bash
npm run generate
```

This scrapes the Wiktionary Brazilian Portuguese frequency list (skipping the top 500 most common words), then fetches 2 real example sentences per word from Tatoeba. It targets 100 words by default — adjust `TARGET_WORDS` in `scripts/generate-words.js` for a larger pool.

## Deployment

Deploys to Netlify automatically. `public/` is the publish directory. No build step for the app itself.
