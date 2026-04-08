/**
 * generate-words.js
 *
 * Fetches intermediate Brazilian Portuguese words from the Wiktionary
 * frequency list (skipping the top 500 most common/beginner words),
 * then pulls 2 real example sentences per word from Tatoeba.
 * Outputs public/words.json.
 */

import { parse } from 'node-html-parser';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_FILE = join(__dirname, '../public/words.json');

const TARGET_WORDS = 100;
const SKIP_TOP_N = 500;       // skip the N most frequent (beginner)
const MIN_SENTENCE_LEN = 20;  // chars — avoid fragments
const MAX_SENTENCE_LEN = 140; // chars — avoid walls of text
const DELAY_MS = 300;         // be polite to Tatoeba between words

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─── 1. Fetch word list from Wiktionary ───────────────────────────────────────

async function fetchWordList() {
  console.log('Fetching Wiktionary frequency list…');
  const url =
    'https://en.wiktionary.org/wiki/Wiktionary:Frequency_lists/BrazilianPortuguese_wordlist';
  const res = await fetch(url);
  const html = await res.text();
  const root = parse(html);

  const items = root.querySelectorAll('ol li');
  const words = items.map(li => {
    const a = li.querySelector('a');
    return (a ? a.text : li.text).trim().toLowerCase();
  }).filter(w => {
    if (!w || !/^[a-záàãâéêíóôõúüç]+$/u.test(w)) return false;
    if (w.length < 4) return false;
    // Skip common inflected verb endings
    if (/(?:aram|erei|aste|este|iram)$/u.test(w)) return false;
    return true;
  });

  console.log(`  Found ${words.length} words in list`);
  return words;
}

// ─── 2. Fetch English translation via Wiktionary API ─────────────────────────

async function fetchTranslation(word) {
  try {
    const url = `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) return null;
    const data = await res.json();

    const sections = data['pt'] || Object.values(data)[0];
    if (!sections?.length) return null;

    for (const section of sections) {
      if (section.definitions?.length) {
        const def = section.definitions[0].definition.replace(/<[^>]+>/g, '').trim();
        if (def) return def;
      }
    }
  } catch {}
  return null;
}

// ─── 3. Fetch example sentences from Tatoeba (paginated) ─────────────────────
// Tatoeba does fuzzy/substring matching and caps results at 10 per page,
// so we page through until we find 2 sentences that contain the exact word.

async function fetchSentences(word) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const wordRegex = new RegExp(`(?<![\\p{L}])${escaped}(?![\\p{L}])`, 'iu');
  const good = [];

  try {
    for (let page = 1; page <= 8 && good.length < 2; page++) {
      const url = `https://tatoeba.org/api_v0/search?from=por&to=eng&query=${encodeURIComponent(word)}&page=${page}`;
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'pt-vocab-app/1.0' }
      });
      if (!res.ok) break;
      const data = await res.json();
      if (!data.results?.length) break;

      for (const result of data.results) {
        const pt = result.text?.trim();
        if (!pt) continue;
        if (pt.length < MIN_SENTENCE_LEN || pt.length > MAX_SENTENCE_LEN) continue;
        if (!wordRegex.test(pt)) continue;

        const trans = result.translations?.[0]?.[0]?.text?.trim() || '';
        good.push({ pt, en: trans });
        if (good.length === 2) break;
      }

      // Stop paging if Tatoeba says there's no next page
      if (!data.paging?.Sentences?.nextPage) break;
      await sleep(150);
    }
  } catch (e) {
    console.error(`  Tatoeba error for "${word}":`, e.message);
  }

  return good;
}

// ─── 4. Main ──────────────────────────────────────────────────────────────────

async function main() {
  const allWords = await fetchWordList();
  const candidates = allWords.slice(SKIP_TOP_N);

  const results = [];
  let checked = 0;

  for (const word of candidates) {
    if (results.length >= TARGET_WORDS) break;
    checked++;

    process.stdout.write(`[${results.length}/${TARGET_WORDS}] "${word}" (candidate #${checked})… `);

    const [sentences, translation] = await Promise.all([
      fetchSentences(word),
      fetchTranslation(word),
    ]);

    if (sentences.length < 2) {
      console.log('skip (sentences)');
      await sleep(DELAY_MS);
      continue;
    }

    if (!translation) {
      console.log('skip (translation)');
      await sleep(DELAY_MS);
      continue;
    }

    console.log('✓');
    results.push({ word, translation, sentences });
    await sleep(DELAY_MS);
  }

  console.log(`\nDone! Collected ${results.length} words. Writing to ${OUT_FILE}…`);
  writeFileSync(OUT_FILE, JSON.stringify(results, null, 2), 'utf-8');
  console.log('words.json written.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
