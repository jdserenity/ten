import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, beforeEach, describe, it } from 'node:test';
import { initDb, getDb } from './db.js';
import { addCard, answerCard, deleteCard, getReviewQueue } from './cards.js';
import { State } from './fsrs.js';

let dbPath;
let sqliteAvailable = true;
try { new Database(':memory:').close(); } catch { sqliteAvailable = false; }

before(() => {
  try {
    dbPath = join(mkdtempSync(join(tmpdir(), 'ten-cards-test-')), 'ten.db');
    initDb(dbPath);
  } catch {
    sqliteAvailable = false;
  }
});

beforeEach(() => {
  if (!sqliteAvailable) return;
  getDb().exec('DELETE FROM cards');
});

after(() => {
  if (dbPath) rmSync(join(dbPath, '..'), { recursive: true, force: true });
});

describe('cards', () => {
  it('adds a card and returns it in the new queue', t => {
    if (!sqliteAvailable) return t.skip('better-sqlite3 bindings unavailable');
    const added = addCard('FR', { front: 'Hello', back: 'Bonjour' });
    assert.equal(added.ok, true);
    assert.ok(added.id > 0);

    const queue = getReviewQueue('FR');
    assert.equal(queue.ok, true);
    assert.equal(queue.totalCount, 1);
    assert.equal(queue.cards.length, 1);
    assert.equal(queue.cards[0].queueKind, 'new');
    assert.equal(queue.cards[0].front, 'Hello');
    assert.equal(queue.cards[0].back, 'Bonjour');
  });

  it('rejects duplicate front/back pairs per language', t => {
    if (!sqliteAvailable) return t.skip('better-sqlite3 bindings unavailable');
    const first = addCard('PT-BR', { front: 'Cat', back: 'Gato' });
    const second = addCard('PT-BR', { front: 'Cat', back: 'Gato' });
    assert.equal(first.ok, true);
    assert.equal(second.ok, false);
    assert.equal(second.reason, 'duplicate');
  });

  it('moves a graded card out of the new queue', t => {
    if (!sqliteAvailable) return t.skip('better-sqlite3 bindings unavailable');
    const added = addCard('FR', { front: 'Dog', back: 'Chien', context: 'animal' });
    const answered = answerCard(added.id, 'good');
    assert.equal(answered.ok, true);

    const queue = getReviewQueue('FR');
    const card = queue.cards.find(entry => entry.id === added.id);
    assert.equal(card, undefined);
  });

  it('deletes a card', t => {
    if (!sqliteAvailable) return t.skip('better-sqlite3 bindings unavailable');
    const added = addCard('FR', { front: 'Fish', back: 'Poisson' });
    const removed = deleteCard(added.id);
    assert.equal(removed.ok, true);
    assert.equal(removed.deleted, true);
    const queue = getReviewQueue('FR');
    assert.equal(queue.cards.some(entry => entry.id === added.id), false);
  });
});

describe('fsrs grading', () => {
  it('updates reps after a good rating', t => {
    if (!sqliteAvailable) return t.skip('better-sqlite3 bindings unavailable');
    const added = addCard('FR', { front: 'Tree', back: 'Arbre' });
    answerCard(added.id, 'good');
    const row = getDb().prepare('SELECT reps, fsrs_state FROM cards WHERE id = ?').get(added.id);
    assert.ok(row.reps >= 1);
    assert.notEqual(row.fsrs_state, State.New);
  });
});
