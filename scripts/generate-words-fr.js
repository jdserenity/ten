/**
 * generate-words-fr.js (FR only)
 *
 * Fetches French words from a Wiktionary frequency list (highest frequency first),
 * then pulls 2 example sentences per word from Tatoeba.
 * Outputs src/client/words.fr.json.
 */

import { parse } from 'node-html-parser';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_FILE = join(__dirname, '../src/client/words.fr.json');

const TARGET_WORDS = Number(process.env.FR_TARGET_WORDS || 100);
const SKIP_TOP_N = Number(process.env.FR_SKIP_TOP_N || 0); // beginner mode: start at top
const MIN_SENTENCE_LEN = 20;
const MAX_SENTENCE_LEN = 140;
const DELAY_MS = 300;

const sleep = ms => new Promise(r => setTimeout(r, ms));

function extractWordsFromHtml(html) {
  const root = parse(html);
  const seen = new Set();
  const words = [];

  const pushWord = raw => {
    const word = String(raw || '')
      .trim()
      .toLowerCase()
      .replace(/^\d+[.)\s-]*/, '')
      .replace(/\s+/g, ' ')
      .replace(/\s+\(.+\)$/, '');
    if (!word) return;
    if (!/^[a-zàâæçéèêëîïôœùûüÿ'-]+$/u.test(word)) return;
    if (word.length < 2) return;
    if (seen.has(word)) return;
    seen.add(word);
    words.push(word);
  };

  root.querySelectorAll('ol li').forEach(li => {
    const a = li.querySelector('a');
    pushWord(a ? a.text : li.text);
  });

  root.querySelectorAll('table tr').forEach(tr => {
    const cells = tr.querySelectorAll('td');
    if (!cells.length) return;
    const candidate = cells[1] || cells[0];
    const a = candidate.querySelector('a');
    pushWord(a ? a.text : candidate.text);
  });

  return words;
}

async function fetchWordList() {
  console.log('Fetching French frequency list from Wiktionary...');
  const urls = [
    'https://en.wiktionary.org/wiki/Wiktionary:Frequency_lists/French_wordlist_opensubtitles_5000',
    'https://en.wiktionary.org/wiki/Wiktionary:Frequency_lists/French'
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const html = await res.text();
      const words = extractWordsFromHtml(html);
      if (words.length) {
        console.log(`  Found ${words.length} words from ${url}`);
        return words;
      }
    } catch (error) {
      console.log(`  Failed to fetch ${url}: ${error.message}`);
    }
  }

  throw new Error('Could not fetch a usable French frequency list from Wiktionary.');
}

async function fetchTranslation(word) {
  try {
    const url = `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const data = await res.json();
    const sections = data.fr || Object.values(data)[0];
    if (!sections?.length) return null;

    for (const section of sections) {
      if (!section.definitions?.length) continue;
      const def = String(section.definitions[0].definition || '').replace(/<[^>]+>/g, '').trim();
      if (def) return def;
    }
  } catch {}
  return null;
}

async function fetchSentences(word) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const wordRegex = new RegExp(`(?<![\\p{L}])${escaped}(?![\\p{L}])`, 'iu');
  const good = [];

  try {
    for (let page = 1; page <= 8 && good.length < 2; page++) {
      const url = `https://tatoeba.org/api_v0/search?from=fra&to=eng&query=${encodeURIComponent(word)}&page=${page}`;
      const res = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'fr-vocab-app/1.0' }
      });
      if (!res.ok) break;
      const data = await res.json();
      if (!data.results?.length) break;

      for (const result of data.results) {
        const fr = String(result.text || '').trim();
        if (!fr) continue;
        if (fr.length < MIN_SENTENCE_LEN || fr.length > MAX_SENTENCE_LEN) continue;
        if (!wordRegex.test(fr)) continue;

        const en = String(result.translations?.[0]?.[0]?.text || '').trim();
        good.push({ fr, en });
        if (good.length === 2) break;
      }

      if (!data.paging?.Sentences?.nextPage) break;
      await sleep(150);
    }
  } catch (error) {
    console.error(`  Tatoeba error for "${word}":`, error.message);
  }

  return good;
}

async function main() {
  const allWords = await fetchWordList();
  const candidates = allWords.slice(SKIP_TOP_N);

  const results = [];
  let checked = 0;

  for (const word of candidates) {
    if (results.length >= TARGET_WORDS) break;
    checked++;

    process.stdout.write(`[${results.length}/${TARGET_WORDS}] "${word}" (candidate #${checked})... `);

    const [sentences, translation] = await Promise.all([fetchSentences(word), fetchTranslation(word)]);

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

    console.log('ok');
    results.push({ word, translation, sentences });
    await sleep(DELAY_MS);
  }

  console.log(`\nDone! Collected ${results.length} French words. Writing to ${OUT_FILE}...`);
  writeFileSync(OUT_FILE, JSON.stringify(results, null, 2), 'utf-8');
  console.log('words.fr.json written.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
