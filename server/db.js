import Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DEFAULT_DB_PATH = join(ROOT, 'data', 'ten.db');
const VALID_LANGUAGES = new Set(['PT-BR', 'FR', 'FR-FR', 'ES-AR']);
const VALID_APP_LANGS = new Set(['en', 'pt-BR']);
const SEED_DEV_USERNAME = 'jd';

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
  if (code === 'FR' || code === 'FR-CA') return 'FR';
  if (code === 'FR-FR') return 'FR-FR';
  if (code === 'ES' || code === 'ES-AR' || code === 'ES-419') return 'ES-AR';
  return VALID_LANGUAGES.has(code) ? code : '';
}

export function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase();
}

function mapUserRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    isDev: Boolean(row.is_dev),
    createdAt: row.created_at,
    appLang: normalizeAppLang(row.app_lang) || null
  };
}

export function normalizeAppLang(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const lower = raw.toLowerCase();
  if (lower === 'en' || lower.startsWith('en-')) return 'en';
  if (lower === 'pt' || lower === 'pt-br' || lower === 'pt_br') return 'pt-BR';
  return VALID_APP_LANGS.has(raw) ? raw : '';
}

function hashSourceText(text) {
  return createHash('sha256')
    .update(String(text || '').trim().normalize('NFC').toLocaleLowerCase())
    .digest('hex');
}

function migrateAppLangColumn() {
  if (!tableHasColumn('users', 'app_lang')) {
    getDb().exec('ALTER TABLE users ADD COLUMN app_lang TEXT');
  }
}

function migrateTranslationCacheTable() {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS translation_cache (
      source_lang TEXT NOT NULL,
      target_lang TEXT NOT NULL,
      source_hash TEXT NOT NULL,
      source_text TEXT NOT NULL,
      translated_text TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (source_lang, target_lang, source_hash)
    )
  `);
}

function tableHasColumn(tableName, columnName) {
  const cols = getDb().prepare(`PRAGMA table_info(${tableName})`).all();
  return cols.some(col => col.name === columnName);
}

function ensureSeedDevUser() {
  const existing = getDb()
    .prepare('SELECT id, username, is_dev, created_at, app_lang FROM users WHERE username = ? COLLATE NOCASE')
    .get(SEED_DEV_USERNAME);
  let user;
  if (existing) {
    if (!existing.is_dev) {
      getDb().prepare('UPDATE users SET is_dev = 1 WHERE id = ?').run(existing.id);
      existing.is_dev = 1;
    }
    user = mapUserRow(existing);
  } else {
    const result = getDb()
      .prepare('INSERT INTO users (username, is_dev) VALUES (?, 1)')
      .run(SEED_DEV_USERNAME);
    user = getUserById(Number(result.lastInsertRowid));
  }
  if (!getUserLanguages(user.id).length) setUserLanguages(user.id, ['PT-BR', 'FR']);
  return user;
}

function tableExists(tableName) {
  const row = getDb()
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName);
  return Boolean(row);
}

function dropTableIfExists(tableName) {
  if (tableExists(tableName)) getDb().exec(`DROP TABLE ${tableName}`);
}

function migrateTableAddUserId(tableName, userId, { createNewSql, copySql, indexSqls = [] }) {
  if (tableHasColumn(tableName, 'user_id')) {
    dropTableIfExists(`${tableName}_new`);
    return;
  }

  const newName = `${tableName}_new`;
  if (!tableExists(newName)) getDb().exec(createNewSql);

  const newCount = getDb().prepare(`SELECT COUNT(*) AS count FROM ${newName}`).get().count;
  if (newCount === 0 && tableExists(tableName)) getDb().prepare(copySql).run(userId);

  dropTableIfExists(tableName);
  if (tableExists(newName)) getDb().exec(`ALTER TABLE ${newName} RENAME TO ${tableName}`);
  indexSqls.forEach(sql => getDb().exec(sql));
}

function migrateLegacyRowsToUser(userId) {
  const assignUserId = (tableName, extraSql = '') => {
    if (!tableHasColumn(tableName, 'user_id')) return;
    getDb().prepare(`UPDATE ${tableName} SET user_id = ? WHERE user_id IS NULL ${extraSql}`).run(userId);
  };
  assignUserId('unlocked_words');
  assignUserId('daily_card_index');
  assignUserId('daily_word_assignment');
  assignUserId('cards');
}

function migrateUnlockedWordsTable(userId) {
  migrateTableAddUserId('unlocked_words', userId, {
    createNewSql: `
      CREATE TABLE unlocked_words_new (
        user_id INTEGER NOT NULL,
        language TEXT NOT NULL,
        normalized_word TEXT NOT NULL,
        unlocked_at INTEGER NOT NULL DEFAULT (unixepoch()),
        PRIMARY KEY (user_id, language, normalized_word)
      )`,
    copySql: `
      INSERT INTO unlocked_words_new (user_id, language, normalized_word, unlocked_at)
      SELECT ?, language, normalized_word, unlocked_at FROM unlocked_words`,
    indexSqls: [
      `CREATE INDEX IF NOT EXISTS idx_unlocked_words_user_language
        ON unlocked_words (user_id, language)`
    ]
  });
  migrateLegacyRowsToUser(userId);
}

function migrateDailyCardIndexTable(userId) {
  migrateTableAddUserId('daily_card_index', userId, {
    createNewSql: `
      CREATE TABLE daily_card_index_new (
        user_id INTEGER NOT NULL,
        language TEXT NOT NULL,
        date_key TEXT NOT NULL,
        card_index INTEGER NOT NULL,
        updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
        PRIMARY KEY (user_id, language, date_key)
      )`,
    copySql: `
      INSERT INTO daily_card_index_new (user_id, language, date_key, card_index, updated_at)
      SELECT ?, language, date_key, card_index, updated_at FROM daily_card_index`
  });
  migrateLegacyRowsToUser(userId);
}

function migrateDailyWordAssignmentTable(userId) {
  migrateTableAddUserId('daily_word_assignment', userId, {
    createNewSql: `
      CREATE TABLE daily_word_assignment_new (
        user_id INTEGER NOT NULL,
        language TEXT NOT NULL,
        date_key TEXT NOT NULL,
        words_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
        PRIMARY KEY (user_id, language, date_key)
      )`,
    copySql: `
      INSERT INTO daily_word_assignment_new (user_id, language, date_key, words_json, updated_at)
      SELECT ?, language, date_key, words_json, updated_at FROM daily_word_assignment`
  });
  migrateLegacyRowsToUser(userId);
}

function migrateCardsTable(userId) {
  migrateTableAddUserId('cards', userId, {
    createNewSql: `
      CREATE TABLE cards_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
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
        UNIQUE (user_id, language, front, back)
      )`,
    copySql: `
      INSERT INTO cards_new (
        id, user_id, language, front, back, context, created_at,
        due, stability, difficulty, elapsed_days, scheduled_days,
        learning_steps, reps, lapses, fsrs_state, last_review
      )
      SELECT
        id, ?, language, front, back, context, created_at,
        due, stability, difficulty, elapsed_days, scheduled_days,
        learning_steps, reps, lapses, fsrs_state, last_review
      FROM cards`,
    indexSqls: [
      'CREATE INDEX IF NOT EXISTS idx_cards_user_language_due ON cards (user_id, language, due)',
      'CREATE INDEX IF NOT EXISTS idx_cards_user_language_state ON cards (user_id, language, fsrs_state)'
    ]
  });
  migrateLegacyRowsToUser(userId);
}

function runMultiUserMigrations() {
  const seedUser = ensureSeedDevUser();
  migrateUnlockedWordsTable(seedUser.id);
  migrateDailyCardIndexTable(seedUser.id);
  migrateDailyWordAssignmentTable(seedUser.id);
  migrateCardsTable(seedUser.id);
}

export function initDb(dbPath = process.env.TEN_DB_PATH || DEFAULT_DB_PATH) {
  mkdirSync(dirname(dbPath), { recursive: true });
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      is_dev INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS user_languages (
      user_id INTEGER NOT NULL,
      language TEXT NOT NULL,
      PRIMARY KEY (user_id, language),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      body TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
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
  migrateAppLangColumn();
  migrateTranslationCacheTable();
  runMultiUserMigrations();
  return db;
}

export { normalizeLanguage };

export function getDb() {
  if (!db) initDb();
  return db;
}

export function getUserById(id) {
  const userId = Number(id);
  if (!Number.isInteger(userId) || userId <= 0) return null;
  const row = getDb()
    .prepare('SELECT id, username, is_dev, created_at, app_lang FROM users WHERE id = ?')
    .get(userId);
  return mapUserRow(row);
}

export function findOrCreateUser(username) {
  const normalized = normalizeUsername(username);
  if (!normalized || normalized.length > 40 || !/^[a-z0-9_-]+$/.test(normalized)) {
    return { ok: false, reason: 'invalid' };
  }
  const existing = getDb()
    .prepare('SELECT id, username, is_dev, created_at, app_lang FROM users WHERE username = ? COLLATE NOCASE')
    .get(normalized);
  if (existing) return { ok: true, ...mapUserRow(existing) };
  const result = getDb()
    .prepare('INSERT INTO users (username, is_dev) VALUES (?, 0)')
    .run(normalized);
  return { ok: true, ...getUserById(Number(result.lastInsertRowid)) };
}

export function getUserLanguages(userId) {
  const user = getUserById(userId);
  if (!user) return [];
  const rows = getDb()
    .prepare('SELECT language FROM user_languages WHERE user_id = ? ORDER BY language')
    .all(user.id);
  return rows.map(row => row.language).filter(lang => VALID_LANGUAGES.has(lang));
}

function normalizeLanguageList(languages) {
  if (!Array.isArray(languages)) return [];
  const seen = new Set();
  const normalized = [];
  for (const language of languages) {
    const lang = normalizeLanguage(language);
    if (!lang || seen.has(lang)) continue;
    seen.add(lang);
    normalized.push(lang);
  }
  return normalized;
}

export function setUserLanguages(userId, languages) {
  const user = getUserById(userId);
  if (!user) return { ok: false, reason: 'invalid_user' };
  const normalized = normalizeLanguageList(languages);
  const replace = getDb().transaction((uid, langs) => {
    getDb().prepare('DELETE FROM user_languages WHERE user_id = ?').run(uid);
    const insert = getDb().prepare('INSERT INTO user_languages (user_id, language) VALUES (?, ?)');
    langs.forEach(lang => insert.run(uid, lang));
  });
  replace(user.id, normalized);
  return { ok: true, languages: getUserLanguages(user.id) };
}

export function addUserLanguages(userId, languages) {
  const user = getUserById(userId);
  if (!user) return { ok: false, reason: 'invalid_user' };
  const normalized = normalizeLanguageList(languages);
  if (!normalized.length) return { ok: false, reason: 'invalid' };
  const insert = getDb().prepare('INSERT OR IGNORE INTO user_languages (user_id, language) VALUES (?, ?)');
  normalized.forEach(lang => insert.run(user.id, lang));
  return { ok: true, languages: getUserLanguages(user.id) };
}

export function setUserAppLang(userId, appLang) {
  const user = getUserById(userId);
  const normalized = normalizeAppLang(appLang);
  if (!user || !normalized) return { ok: false, reason: 'invalid' };
  getDb().prepare('UPDATE users SET app_lang = ? WHERE id = ?').run(normalized, user.id);
  return { ok: true, appLang: normalized };
}

export function getCachedTranslation(sourceLang, targetLang, sourceText) {
  const source = String(sourceLang || '').trim().toUpperCase();
  const target = String(targetLang || '').trim().toUpperCase();
  const text = String(sourceText || '').trim();
  if (!source || !target || !text) return null;
  const row = getDb()
    .prepare(`
      SELECT translated_text FROM translation_cache
      WHERE source_lang = ? AND target_lang = ? AND source_hash = ?
    `)
    .get(source, target, hashSourceText(text));
  const translated = String(row?.translated_text || '').trim();
  return translated || null;
}

export function setCachedTranslation(sourceLang, targetLang, sourceText, translatedText) {
  const source = String(sourceLang || '').trim().toUpperCase();
  const target = String(targetLang || '').trim().toUpperCase();
  const text = String(sourceText || '').trim();
  const translated = String(translatedText || '').trim();
  if (!source || !target || !text || !translated) return { ok: false, reason: 'invalid' };
  getDb()
    .prepare(`
      INSERT INTO translation_cache (source_lang, target_lang, source_hash, source_text, translated_text, created_at)
      VALUES (?, ?, ?, ?, ?, unixepoch())
      ON CONFLICT (source_lang, target_lang, source_hash) DO UPDATE SET
        translated_text = excluded.translated_text,
        created_at = excluded.created_at
    `)
    .run(source, target, hashSourceText(text), text, translated);
  return { ok: true };
}

export function addFeedback(userId, body) {
  const user = getUserById(userId);
  const text = String(body || '').trim();
  if (!user || !text) return { ok: false, reason: 'invalid' };
  const result = getDb()
    .prepare('INSERT INTO feedback (user_id, body) VALUES (?, ?)')
    .run(user.id, text);
  return { ok: true, id: Number(result.lastInsertRowid) };
}

export function getUsersWithLanguagesForOps() {
  const rows = getDb()
    .prepare('SELECT id, username FROM users ORDER BY username COLLATE NOCASE')
    .all();
  return rows.map(row => ({
    id: row.id,
    username: row.username,
    languages: getUserLanguages(row.id),
    unlockedWords: getAllUnlockedWords(row.id)
  }));
}

export function getFeedbackList(limit = 100) {
  const rows = getDb()
    .prepare(`
      SELECT feedback.id, feedback.body, feedback.created_at, users.username
      FROM feedback
      JOIN users ON users.id = feedback.user_id
      ORDER BY feedback.created_at DESC, feedback.id DESC
      LIMIT ?
    `)
    .all(limit);
  return rows.map(row => ({
    id: row.id,
    body: row.body,
    createdAt: row.created_at,
    username: row.username
  }));
}

export function getAllUnlockedWords(userId) {
  const user = getUserById(userId);
  if (!user) return { 'PT-BR': [], FR: [], 'FR-FR': [], 'ES-AR': [] };
  const rows = getDb()
    .prepare('SELECT language, normalized_word FROM unlocked_words WHERE user_id = ? ORDER BY language, normalized_word')
    .all(user.id);
  const wordsByLanguage = { 'PT-BR': [], FR: [], 'FR-FR': [], 'ES-AR': [] };
  for (const row of rows) {
    if (!wordsByLanguage[row.language]) wordsByLanguage[row.language] = [];
    wordsByLanguage[row.language].push(row.normalized_word);
  }
  return wordsByLanguage;
}

export function addUnlockedWord(userId, language, word) {
  const user = getUserById(userId);
  const lang = normalizeLanguage(language);
  const normalized = normalizeWord(word);
  if (!user || !lang || !normalized) return { ok: false, reason: 'invalid' };
  const result = getDb()
    .prepare('INSERT OR IGNORE INTO unlocked_words (user_id, language, normalized_word) VALUES (?, ?, ?)')
    .run(user.id, lang, normalized);
  return { ok: true, added: result.changes > 0, language: lang, word: normalized };
}

export function importUnlockedWords(userId, wordsByLanguage) {
  const user = getUserById(userId);
  if (!user || !wordsByLanguage || typeof wordsByLanguage !== 'object') return { imported: 0 };
  const insert = getDb().prepare(
    'INSERT OR IGNORE INTO unlocked_words (user_id, language, normalized_word) VALUES (?, ?, ?)'
  );
  let imported = 0;
  const importMany = getDb().transaction((uid, payload) => {
    for (const [language, words] of Object.entries(payload)) {
      const lang = normalizeLanguage(language);
      if (!lang || !Array.isArray(words)) continue;
      for (const word of words) {
        const normalized = normalizeWord(word);
        if (!normalized) continue;
        const result = insert.run(uid, lang, normalized);
        if (result.changes > 0) imported++;
      }
    }
  });
  importMany(user.id, wordsByLanguage);
  return { imported };
}

export function getDailyCardIndex(userId, language, dateKey) {
  const user = getUserById(userId);
  const lang = normalizeLanguage(language);
  const key = String(dateKey || '').trim();
  if (!user || !lang || !key) return null;
  const row = getDb()
    .prepare('SELECT card_index FROM daily_card_index WHERE user_id = ? AND language = ? AND date_key = ?')
    .get(user.id, lang, key);
  if (!row) return null;
  const index = Number(row.card_index);
  return Number.isInteger(index) && index >= 0 ? index : null;
}

export function setDailyCardIndex(userId, language, dateKey, cardIndex) {
  const user = getUserById(userId);
  const lang = normalizeLanguage(language);
  const key = String(dateKey || '').trim();
  const index = Number(cardIndex);
  if (!user || !lang || !key || !Number.isInteger(index) || index < 0) {
    return { ok: false, reason: 'invalid' };
  }
  getDb()
    .prepare(`
      INSERT INTO daily_card_index (user_id, language, date_key, card_index, updated_at)
      VALUES (?, ?, ?, ?, unixepoch())
      ON CONFLICT (user_id, language, date_key) DO UPDATE SET
        card_index = excluded.card_index,
        updated_at = excluded.updated_at
    `)
    .run(user.id, lang, key, index);
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

export function getDailyWordAssignment(userId, language, dateKey) {
  const user = getUserById(userId);
  const lang = normalizeLanguage(language);
  const key = String(dateKey || '').trim();
  if (!user || !lang || !key) return null;
  const row = getDb()
    .prepare('SELECT words_json FROM daily_word_assignment WHERE user_id = ? AND language = ? AND date_key = ?')
    .get(user.id, lang, key);
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.words_json);
    if (!Array.isArray(parsed) || !parsed.length) return null;
    return parsed.map(word => String(word || '').trim()).filter(Boolean);
  } catch (_) {
    return null;
  }
}

export function setDailyWordAssignment(userId, language, dateKey, words) {
  const user = getUserById(userId);
  const lang = normalizeLanguage(language);
  const key = String(dateKey || '').trim();
  const normalized = parseDailyWordList(words);
  if (!user || !lang || !key || !normalized) return { ok: false, reason: 'invalid' };
  getDb()
    .prepare(`
      INSERT INTO daily_word_assignment (user_id, language, date_key, words_json, updated_at)
      VALUES (?, ?, ?, ?, unixepoch())
      ON CONFLICT (user_id, language, date_key) DO UPDATE SET
        words_json = excluded.words_json,
        updated_at = excluded.updated_at
    `)
    .run(user.id, lang, key, JSON.stringify(normalized));
  return { ok: true, language: lang, dateKey: key, words: normalized };
}
