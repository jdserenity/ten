# Architecture

## Overview

Ten is a static PWA — no backend, no framework, no build pipeline for the app itself. Everything runs in the browser from `public/`.

**This is a personal app. It has exactly one user. Do not design for multi-user scenarios, sharing, accounts, or any form of social feature.**

## Stack

- **App**: Vanilla HTML/CSS/JS in a single file (`public/index.html`)
- **PWA**: Web manifest + service worker (`public/sw.js`) for installability and offline support
- **Word data**: Static JSON (`public/words.json`), pre-generated and committed
- **Hosting**: Netlify, serving `public/` as a static site
- **Tooling**: Node.js script (`scripts/generate-words.js`) for generating `words.json`; `node-html-parser` is the only dependency

## Directory structure

```
public/               # Static site (Netlify publish dir)
  index.html          # Entire app — markup, styles, and JS
  words.json          # Generated word pool (do not edit by hand)
  sw.js               # Service worker (cache-first, offline support)
  manifest.json       # PWA manifest
  icon-192.png
  icon-512.png
scripts/
  generate-words.js   # Word pool generator (run manually as needed)
  generate-icons.js   # Icon generator
```

## How the app works

1. On load, fetches `words.json` (served from cache after first visit)
2. Derives a deterministic daily seed from the current date using a hash
3. Shuffles the word pool with that seed (Fisher-Yates + LCG), takes the first 10
4. Renders word cards with nav, progress dots, and TTS (Web Speech API, pt-BR)

The same 10 words appear all day. A new set appears the next day.

## Word pool generation

`scripts/generate-words.js` does three things:
1. Scrapes the Wiktionary PT frequency list, skips the top 500 (beginner words), filters for clean stems
2. Fetches 2 real example sentences per word from the Tatoeba API (exact word match, length-filtered)
3. Fetches an English definition from the Wiktionary REST API
4. Writes the result to `public/words.json`

The current `TARGET_WORDS` of 100 is a test value — increase it before long-term use (10 words/day means 100 words runs out in 10 days).
