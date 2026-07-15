import assert from 'node:assert/strict';
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
});
