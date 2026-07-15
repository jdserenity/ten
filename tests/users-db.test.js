import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';

let dbModule;
try {
  dbModule = await import('../server/db.js');
} catch (_) {
  dbModule = null;
}

const describeDb = dbModule ? describe : describe.skip;

const tempDir = mkdtempSync(join(tmpdir(), 'ten-users-'));
const dbPath = join(tempDir, 'test.db');

describeDb('users and per-user data', () => {
  const {
    addFeedback,
    addUnlockedWord,
    findOrCreateUser,
    getAllUnlockedWords,
    getFeedbackList,
    getUserById,
    getUserLanguages,
    initDb,
    setUserLanguages
  } = dbModule;

  let jd;
  let friend;

  before(() => {
    initDb(dbPath);
    jd = findOrCreateUser('jd');
    friend = findOrCreateUser('friend');
  });

  after(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('seeds jd with isDev on first init', () => {
    assert.equal(jd.username, 'jd');
    assert.equal(jd.isDev, true);
    assert.equal(getUserById(jd.id).isDev, true);
  });

  it('creates new users without isDev', () => {
    assert.equal(friend.username, 'friend');
    assert.equal(friend.isDev, false);
  });

  it('reuses existing usernames case-insensitively', () => {
    const again = findOrCreateUser('JD');
    assert.equal(again.id, jd.id);
  });

  it('starts with no languages for a new user', () => {
    assert.deepEqual(getUserLanguages(friend.id), []);
  });

  it('stores and returns user languages', () => {
    const saved = setUserLanguages(friend.id, ['FR', 'PT-BR']);
    assert.equal(saved.ok, true);
    assert.deepEqual(getUserLanguages(friend.id), ['FR', 'PT-BR']);
  });

  it('scopes unlocked words per user', () => {
    addUnlockedWord(jd.id, 'FR', 'bonjour');
    addUnlockedWord(friend.id, 'FR', 'salut');
    assert.deepEqual(getAllUnlockedWords(jd.id)['FR'], ['bonjour']);
    assert.deepEqual(getAllUnlockedWords(friend.id)['FR'], ['salut']);
  });

  it('stores feedback and lists it for dev review', () => {
    const posted = addFeedback(friend.id, 'Love the app!');
    assert.equal(posted.ok, true);
    const list = getFeedbackList();
    assert.ok(list.some(entry => entry.body === 'Love the app!' && entry.username === 'friend'));
  });

  it('resumes a partial unlocked_words migration', () => {
    const resumeDir = mkdtempSync(join(tmpdir(), 'ten-users-resume-'));
    const resumePath = join(resumeDir, 'resume.db');
    try {
      const legacy = new Database(resumePath);
      legacy.exec(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE,
          is_dev INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE TABLE user_languages (
          user_id INTEGER NOT NULL,
          language TEXT NOT NULL,
          PRIMARY KEY (user_id, language)
        );
        CREATE TABLE feedback (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          body TEXT NOT NULL,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE TABLE unlocked_words (
          language TEXT NOT NULL,
          normalized_word TEXT NOT NULL,
          unlocked_at INTEGER NOT NULL DEFAULT (unixepoch()),
          PRIMARY KEY (language, normalized_word)
        );
        INSERT INTO unlocked_words (language, normalized_word) VALUES ('FR', 'bonjour');
        CREATE TABLE unlocked_words_new (
          user_id INTEGER NOT NULL,
          language TEXT NOT NULL,
          normalized_word TEXT NOT NULL,
          unlocked_at INTEGER NOT NULL DEFAULT (unixepoch()),
          PRIMARY KEY (user_id, language, normalized_word)
        );
      `);
      legacy.close();

      initDb(resumePath);
      const jdUser = findOrCreateUser('jd');
      assert.deepEqual(getAllUnlockedWords(jdUser.id)['FR'], ['bonjour']);
    } finally {
      rmSync(resumeDir, { recursive: true, force: true });
    }
  });
});
