import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'node-html-parser';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLIENT_DIR = join(__dirname, '../src/client');

const SOURCES = [
  {
    language: 'PT-BR',
    url: 'https://en.wiktionary.org/wiki/Wiktionary:Frequency_lists/BrazilianPortuguese_wordlist',
    outFile: join(CLIENT_DIR, 'frequency-pt-br.json'),
    format: 'wiktionary-html'
  },
  {
    language: 'FR',
    url: 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/fr/fr_50k.txt',
    outFile: join(CLIENT_DIR, 'frequency-fr.json'),
    format: 'counted-lines'
  },
  {
    language: 'ES-AR',
    url: 'https://raw.githubusercontent.com/francojc/activ-es/master/activ-es-v.02/wordlists/plain/aes1grams.csv',
    outFile: join(CLIENT_DIR, 'frequency-es-ar.json'),
    format: 'activ-es-csv'
  }
];

const LIMIT = 5000;
const WORD_RE = /^[\p{L}\p{M}]+(?:['’\-][\p{L}\p{M}]+)*$/u;
const JUNK_RE = /(.)\1{3,}/u;

export function isActivEsWordCandidate(word) {
  if (!word || word.length < 2) return false;
  if (!WORD_RE.test(word)) return false;
  if (JUNK_RE.test(word)) return false;
  return true;
}

export function parseActivEsArgentinaCsv(text, limit = LIMIT) {
  const lines = String(text || '').split('\n');
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const match = line.match(/^"?\d+"?,"([^"]+)",([0-9.]+),/);
    if (!match) continue;
    const word = match[1].trim().toLocaleLowerCase();
    const arOrf = Number(match[2]);
    if (!Number.isFinite(arOrf) || arOrf <= 0) continue;
    if (!isActivEsWordCandidate(word)) continue;
    rows.push({ word, arOrf });
  }

  rows.sort((a, b) => b.arOrf - a.arOrf);

  const words = [];
  const seen = new Set();
  for (const row of rows) {
    if (words.length >= limit) break;
    if (seen.has(row.word)) continue;
    seen.add(row.word);
    words.push(row.word);
  }

  return words;
}

function parseWords(html) {
  const root = parse(html);
  const listItems = root.querySelectorAll('ol li');
  const words = [];
  const seen = new Set();

  for (const item of listItems) {
    if (words.length >= LIMIT) break;
    const raw = (item.querySelector('a')?.text || item.text || '').trim().toLocaleLowerCase();
    if (!raw) continue;
    if (!WORD_RE.test(raw)) continue;
    if (seen.has(raw)) continue;
    seen.add(raw);
    words.push(raw);
  }

  return words;
}

function parseCountedLines(text) {
  const words = [];
  const seen = new Set();
  const lines = String(text || '').split('\n');

  for (const line of lines) {
    if (words.length >= LIMIT) break;
    const [raw] = line.trim().split(/\s+/);
    if (!raw) continue;
    if (!WORD_RE.test(raw)) continue;
    const word = raw.toLocaleLowerCase();
    if (seen.has(word)) continue;
    seen.add(word);
    words.push(word);
  }

  return words;
}

async function downloadOne(source) {
  console.log(`Downloading ${source.language} frequency list...`);
  const response = await fetch(source.url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${source.language} list (${response.status})`);
  }

  const payload = await response.text();
  const words = source.format === 'counted-lines'
    ? parseCountedLines(payload)
    : source.format === 'activ-es-csv'
      ? parseActivEsArgentinaCsv(payload)
      : parseWords(payload);
  if (!words.length) {
    throw new Error(`No words parsed for ${source.language}`);
  }

  writeFileSync(source.outFile, JSON.stringify(words, null, 2) + '\n', 'utf8');
  console.log(`Saved ${words.length} words to ${source.outFile}`);
}

async function main() {
  for (const source of SOURCES) {
    await downloadOne(source);
  }
  console.log('Done.');
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  main().catch(error => {
    console.error(error.message || error);
    process.exit(1);
  });
}
