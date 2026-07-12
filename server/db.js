import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DEFAULT_DB_PATH = join(ROOT, 'data', 'ten.db');
const VALID_LANGUAGES = new Set(['PT-BR', 'FR']);

let db;

function normalizeWord(value) {
  return String(value || '')
    .trim()
    .toLocaleLowerCase()
    .normalize('NFC');
}

function normalizeLanguage(value) {
  const code = String(value || '').trim().toUpperCase();
  if (code === 'PB' || code === 'PT' || code === 'PT-BR' || code === 'PT-PT') return 'PT-BR';
  if (code === 'FR' || code === 'FR-FR' || code === 'FR-CA') return 'FR';
  return VALID_LANGUAGES.has(code) ? code : '';
}

export function initDb(dbPath = process.env.TEN_DB_PATH || DEFAULT_DB_PATH) {
  mkdirSync(dirname(dbPath), { recursive: true });
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS unlocked_words (
      language TEXT NOT NULL,
      normalized_word TEXT NOT NULL,
      unlocked_at INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (language, normalized_word)
    );
    CREATE INDEX IF NOT EXISTS idx_unlocked_words_language
      ON unlocked_words (language);
    CREATE TABLE IF NOT EXISTS daily_card_index (
      language TEXT NOT NULL,
      date_key TEXT NOT NULL,
      card_index INTEGER NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (language, date_key)
    );
    CREATE TABLE IF NOT EXISTS cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      language TEXT NOT NULL,
      front TEXT NOT NULL,
      back TEXT NOT NULL,
      context TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      due INTEGER NOT NULL,
      stability REAL NOT NULL DEFAULT 0,
      difficulty REAL NOT NULL DEFAULT 0,
      elapsed_days REAL NOT NULL DEFAULT 0,
      scheduled_days INTEGER NOT NULL DEFAULT 0,
      learning_steps INTEGER NOT NULL DEFAULT 0,
      reps INTEGER NOT NULL DEFAULT 0,
      lapses INTEGER NOT NULL DEFAULT 0,
      fsrs_state INTEGER NOT NULL DEFAULT 0,
      last_review INTEGER,
      UNIQUE (language, front, back)
    );
    CREATE INDEX IF NOT EXISTS idx_cards_language_due ON cards (language, due);
    CREATE INDEX IF NOT EXISTS idx_cards_language_state ON cards (language, fsrs_state);
    CREATE TABLE IF NOT EXISTS daily_word_assignment (
      language TEXT NOT NULL,
      date_key TEXT NOT NULL,
      words_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (language, date_key)
    );
  `);
  return db;
}

export { normalizeLanguage };

export function getDb() {
  if (!db) initDb();
  return db;
}

export function getAllUnlockedWords() {
  const rows = getDb()
    .prepare('SELECT language, normalized_word FROM unlocked_words ORDER BY language, normalized_word')
    .all();
  const wordsByLanguage = { 'PT-BR': [], FR: [] };
  for (const row of rows) {
    if (!wordsByLanguage[row.language]) wordsByLanguage[row.language] = [];
    wordsByLanguage[row.language].push(row.normalized_word);
  }
  return wordsByLanguage;
}

export function addUnlockedWord(language, word) {
  const lang = normalizeLanguage(language);
  const normalized = normalizeWord(word);
  if (!lang || !normalized) return { ok: false, reason: 'invalid' };
  const result = getDb()
    .prepare('INSERT OR IGNORE INTO unlocked_words (language, normalized_word) VALUES (?, ?)')
    .run(lang, normalized);
  return { ok: true, added: result.changes > 0, language: lang, word: normalized };
}

export function importUnlockedWords(wordsByLanguage) {
  if (!wordsByLanguage || typeof wordsByLanguage !== 'object') return { imported: 0 };
  const insert = getDb().prepare(
    'INSERT OR IGNORE INTO unlocked_words (language, normalized_word) VALUES (?, ?)'
  );
  let imported = 0;
  const importMany = getDb().transaction(payload => {
    for (const [language, words] of Object.entries(payload)) {
      const lang = normalizeLanguage(language);
      if (!lang || !Array.isArray(words)) continue;
      for (const word of words) {
        const normalized = normalizeWord(word);
        if (!normalized) continue;
        const result = insert.run(lang, normalized);
        if (result.changes > 0) imported++;
      }
    }
  });
  importMany(wordsByLanguage);
  return { imported };
}

export function getDailyCardIndex(language, dateKey) {
  const lang = normalizeLanguage(language);
  const key = String(dateKey || '').trim();
  if (!lang || !key) return null;
  const row = getDb()
    .prepare('SELECT card_index FROM daily_card_index WHERE language = ? AND date_key = ?')
    .get(lang, key);
  if (!row) return null;
  const index = Number(row.card_index);
  return Number.isInteger(index) && index >= 0 ? index : null;
}

export function setDailyCardIndex(language, dateKey, cardIndex) {
  const lang = normalizeLanguage(language);
  const key = String(dateKey || '').trim();
  const index = Number(cardIndex);
  if (!lang || !key || !Number.isInteger(index) || index < 0) {
    return { ok: false, reason: 'invalid' };
  }
  getDb()
    .prepare(`
      INSERT INTO daily_card_index (language, date_key, card_index, updated_at)
      VALUES (?, ?, ?, unixepoch())
      ON CONFLICT (language, date_key) DO UPDATE SET
        card_index = excluded.card_index,
        updated_at = excluded.updated_at
    `)
    .run(lang, key, index);
  return { ok: true, language: lang, dateKey: key, cardIndex: index };
}

function parseDailyWordList(words) {
  if (!Array.isArray(words)) return null;
  const normalized = [];
  for (const word of words) {
    const value = normalizeWord(word);
    if (!value) return null;
    normalized.push(value);
  }
  if (!normalized.length || normalized.length > 10) return null;
  return normalized;
}

export function getDailyWordAssignment(language, dateKey) {
  const lang = normalizeLanguage(language);
  const key = String(dateKey || '').trim();
  if (!lang || !key) return null;
  const row = getDb()
    .prepare('SELECT words_json FROM daily_word_assignment WHERE language = ? AND date_key = ?')
    .get(lang, key);
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.words_json);
    if (!Array.isArray(parsed) || !parsed.length) return null;
    return parsed.map(word => String(word || '').trim()).filter(Boolean);
  } catch (_) {
    return null;
  }
}

export function setDailyWordAssignment(language, dateKey, words) {
  const lang = normalizeLanguage(language);
  const key = String(dateKey || '').trim();
  const normalized = parseDailyWordList(words);
  if (!lang || !key || !normalized) return { ok: false, reason: 'invalid' };
  getDb()
    .prepare(`
      INSERT INTO daily_word_assignment (language, date_key, words_json, updated_at)
      VALUES (?, ?, ?, unixepoch())
      ON CONFLICT (language, date_key) DO UPDATE SET
        words_json = excluded.words_json,
        updated_at = excluded.updated_at
    `)
    .run(lang, key, JSON.stringify(normalized));
  return { ok: true, language: lang, dateKey: key, words: normalized };
}
