import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, beforeEach, describe, it } from 'node:test';
import { initDb, getDb, findOrCreateUser } from './db.js';
import { addCard, answerCard, deleteCard, getReviewQueue, updateCard } from './cards.js';
import { State } from './fsrs.js';

let dbPath;
let userId;
let sqliteAvailable = true;
try { new Database(':memory:').close(); } catch { sqliteAvailable = false; }

before(() => {
  try {
    dbPath = join(mkdtempSync(join(tmpdir(), 'ten-cards-test-')), 'ten.db');
    initDb(dbPath);
    userId = findOrCreateUser('tester').id;
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
    const added = addCard(userId, 'FR', { front: 'Hello', back: 'Bonjour' });
    assert.equal(added.ok, true);
    assert.ok(added.id > 0);

    const queue = getReviewQueue(userId, 'FR');
    assert.equal(queue.ok, true);
    assert.equal(queue.totalCount, 1);
    assert.equal(queue.cards.length, 1);
    assert.equal(queue.cards[0].queueKind, 'new');
    assert.equal(queue.cards[0].front, 'Hello');
    assert.equal(queue.cards[0].back, 'Bonjour');
  });

  it('rejects duplicate front/back pairs per language', t => {
    if (!sqliteAvailable) return t.skip('better-sqlite3 bindings unavailable');
    const first = addCard(userId, 'PT-BR', { front: 'Cat', back: 'Gato' });
    const second = addCard(userId, 'PT-BR', { front: 'Cat', back: 'Gato' });
    assert.equal(first.ok, true);
    assert.equal(second.ok, false);
    assert.equal(second.reason, 'duplicate');
  });

  it('moves a graded card out of the new queue', t => {
    if (!sqliteAvailable) return t.skip('better-sqlite3 bindings unavailable');
    const added = addCard(userId, 'FR', { front: 'Dog', back: 'Chien', context: 'animal' });
    const answered = answerCard(userId, added.id, 'good');
    assert.equal(answered.ok, true);

    const queue = getReviewQueue(userId, 'FR');
    const card = queue.cards.find(entry => entry.id === added.id);
    assert.equal(card, undefined);
  });

  it('deletes a card', t => {
    if (!sqliteAvailable) return t.skip('better-sqlite3 bindings unavailable');
    const added = addCard(userId, 'FR', { front: 'Fish', back: 'Poisson' });
    const removed = deleteCard(userId, added.id);
    assert.equal(removed.ok, true);
    assert.equal(removed.deleted, true);
    const queue = getReviewQueue(userId, 'FR');
    assert.equal(queue.cards.some(entry => entry.id === added.id), false);
  });

  it('updates front and back without resetting scheduling', t => {
    if (!sqliteAvailable) return t.skip('better-sqlite3 bindings unavailable');
    const added = addCard(userId, 'FR', { front: 'Cat', back: 'Chat', context: 'animal' });
    answerCard(userId, added.id, 'good');
    const before = getDb().prepare('SELECT reps, fsrs_state, front, back FROM cards WHERE id = ?').get(added.id);

    const updated = updateCard(userId, added.id, { front: 'Kitten', back: 'Chaton' });
    assert.equal(updated.ok, true);

    const after = getDb().prepare('SELECT reps, fsrs_state, front, back, context FROM cards WHERE id = ?').get(added.id);
    assert.equal(after.front, 'Kitten');
    assert.equal(after.back, 'Chaton');
    assert.equal(after.context, 'animal');
    assert.equal(after.reps, before.reps);
    assert.equal(after.fsrs_state, before.fsrs_state);
  });

  it('rejects duplicate front/back pairs when updating', t => {
    if (!sqliteAvailable) return t.skip('better-sqlite3 bindings unavailable');
    addCard(userId, 'FR', { front: 'One', back: 'Un' });
    const second = addCard(userId, 'FR', { front: 'Two', back: 'Deux' });
    const updated = updateCard(userId, second.id, { front: 'One', back: 'Un' });
    assert.equal(updated.ok, false);
    assert.equal(updated.reason, 'duplicate');
  });
});

describe('fsrs grading', () => {
  it('updates reps after a good rating', t => {
    if (!sqliteAvailable) return t.skip('better-sqlite3 bindings unavailable');
    const added = addCard(userId, 'FR', { front: 'Tree', back: 'Arbre' });
    answerCard(userId, added.id, 'good');
    const row = getDb().prepare('SELECT reps, fsrs_state FROM cards WHERE id = ?').get(added.id);
    assert.ok(row.reps >= 1);
    assert.notEqual(row.fsrs_state, State.New);
  });
});
