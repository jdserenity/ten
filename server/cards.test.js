import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, beforeEach, describe, it } from 'node:test';
import { initDb, getDb, findOrCreateUser } from './db.js';
import { addCard, answerCard, applyNewCardHoldToExistingCards, deleteCard, getReviewQueue, NEW_CARD_HOLD_MS, updateCard } from './cards.js';
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
  it('keeps a card added today out of the recall queue for 3 days', t => {
    if (!sqliteAvailable) return t.skip('better-sqlite3 bindings unavailable');
    const now = Date.UTC(2026, 10, 7, 15, 0, 0);
    const added = addCard(userId, 'FR', { front: 'Hello', back: 'Bonjour', nowMs: now });
    assert.equal(added.ok, true);
    assert.ok(added.id > 0);

    const row = getDb().prepare('SELECT due, fsrs_state FROM cards WHERE id = ?').get(added.id);
    assert.equal(row.fsrs_state, State.New);
    assert.equal(row.due, now + NEW_CARD_HOLD_MS);

    const today = getReviewQueue(userId, 'FR', now);
    assert.equal(today.ok, true);
    assert.equal(today.totalCount, 1);
    assert.equal(today.cards.length, 0);

    const justBefore = getReviewQueue(userId, 'FR', now + NEW_CARD_HOLD_MS - 1);
    assert.equal(justBefore.cards.length, 0);

    const ready = getReviewQueue(userId, 'FR', now + NEW_CARD_HOLD_MS);
    assert.equal(ready.cards.length, 1);
    assert.equal(ready.cards[0].queueKind, 'new');
    assert.equal(ready.cards[0].front, 'Hello');
    assert.equal(ready.cards[0].back, 'Bonjour');
  });

  it('still shows a new card whose due time has already arrived', t => {
    if (!sqliteAvailable) return t.skip('better-sqlite3 bindings unavailable');
    const now = Date.UTC(2026, 10, 7, 15, 0, 0);
    const added = addCard(userId, 'FR', { front: 'Hello', back: 'Bonjour', nowMs: now });
    getDb().prepare('UPDATE cards SET due = ? WHERE id = ?').run(now - 1000, added.id);
    const queue = getReviewQueue(userId, 'FR', now);
    assert.equal(queue.cards.length, 1);
    assert.equal(queue.cards[0].id, added.id);
    assert.equal(queue.cards[0].queueKind, 'new');
  });

  it('applies the 3-day hold to older new cards that were due immediately', t => {
    if (!sqliteAvailable) return t.skip('better-sqlite3 bindings unavailable');
    const now = Date.UTC(2026, 10, 7, 15, 0, 0);
    const createdSec = Math.floor(now / 1000);
    getDb().prepare(`
      INSERT INTO cards (
        user_id, language, front, back, context, created_at,
        due, stability, difficulty, elapsed_days, scheduled_days,
        learning_steps, reps, lapses, fsrs_state, last_review
      ) VALUES (?, 'FR', 'Today', ?, '', ?, ?, 0, 0, 0, 0, 0, 0, 0, ?, NULL)
    `).run(userId, "Aujourd'hui", createdSec, now, State.New);

    assert.equal(getReviewQueue(userId, 'FR', now).cards.length, 1);
    const result = applyNewCardHoldToExistingCards();
    assert.ok(result.updated >= 1);
    assert.equal(getReviewQueue(userId, 'FR', now).cards.length, 0);

    const row = getDb().prepare("SELECT due FROM cards WHERE front = 'Today' AND user_id = ?").get(userId);
    assert.equal(row.due, createdSec * 1000 + NEW_CARD_HOLD_MS);
    assert.equal(getReviewQueue(userId, 'FR', createdSec * 1000 + NEW_CARD_HOLD_MS).cards.length, 1);

    const olderSec = createdSec - (10 * 24 * 60 * 60);
    getDb().prepare(`
      INSERT INTO cards (
        user_id, language, front, back, context, created_at,
        due, stability, difficulty, elapsed_days, scheduled_days,
        learning_steps, reps, lapses, fsrs_state, last_review
      ) VALUES (?, 'FR', 'Older', 'Plus vieux', '', ?, ?, 0, 0, 0, 0, 0, 0, 0, ?, NULL)
    `).run(userId, olderSec, olderSec * 1000, State.New);
    applyNewCardHoldToExistingCards();
    assert.equal(
      getReviewQueue(userId, 'FR', now).cards.some(card => card.front === 'Older'),
      true
    );
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

  it('returns due cards most-overdue first', t => {
    if (!sqliteAvailable) return t.skip('better-sqlite3 bindings unavailable');
    const later = addCard(userId, 'FR', { front: 'Later', back: 'Plus tard' });
    const sooner = addCard(userId, 'FR', { front: 'Sooner', back: 'Plus tôt' });
    answerCard(userId, later.id, 'good');
    answerCard(userId, sooner.id, 'good');
    const now = Date.now();
    getDb().prepare('UPDATE cards SET due = ? WHERE id = ?').run(now - 1000, later.id);
    getDb().prepare('UPDATE cards SET due = ? WHERE id = ?').run(now - 9000, sooner.id);
    const queue = getReviewQueue(userId, 'FR', now);
    assert.deepEqual(queue.cards.map(card => card.id), [sooner.id, later.id]);
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

describe('grade counts', () => {
  it('starts at zero and counts each rating pressed per card', t => {
    if (!sqliteAvailable) return t.skip('better-sqlite3 bindings unavailable');
    const now = Date.UTC(2026, 10, 7, 15, 0, 0);
    const added = addCard(userId, 'FR', { front: 'Bird', back: 'Oiseau', nowMs: now });
    let queue = getReviewQueue(userId, 'FR', now + NEW_CARD_HOLD_MS);
    assert.deepEqual(queue.cards.find(card => card.id === added.id).gradeCounts, { again: 0, hard: 0, good: 0, easy: 0 });

    answerCard(userId, added.id, 'again');
    getDb().prepare('UPDATE cards SET due = ? WHERE id = ?').run(0, added.id);
    answerCard(userId, added.id, 'again');
    getDb().prepare('UPDATE cards SET due = ? WHERE id = ?').run(0, added.id);
    answerCard(userId, added.id, 'easy');

    getDb().prepare('UPDATE cards SET due = ? WHERE id = ?').run(0, added.id);
    queue = getReviewQueue(userId, 'FR', Date.now());
    assert.deepEqual(queue.cards.find(card => card.id === added.id).gradeCounts, { again: 2, hard: 0, good: 0, easy: 1 });
  });

  it('does not count an invalid rating', t => {
    if (!sqliteAvailable) return t.skip('better-sqlite3 bindings unavailable');
    const now = Date.UTC(2026, 10, 7, 15, 0, 0);
    const added = addCard(userId, 'FR', { front: 'Cat', back: 'Chat', nowMs: now });
    const result = answerCard(userId, added.id, 'nope');
    assert.equal(result.ok, false);
    const queue = getReviewQueue(userId, 'FR', now + NEW_CARD_HOLD_MS);
    assert.deepEqual(queue.cards.find(card => card.id === added.id).gradeCounts, { again: 0, hard: 0, good: 0, easy: 0 });
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
