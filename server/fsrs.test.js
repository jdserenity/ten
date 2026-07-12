import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createEmptyCard, State, applyRating } from './fsrs.js';

describe('fsrs wrapper', () => {
  it('schedules a good rating ahead of now', () => {
    const card = createEmptyCard(new Date('2026-01-01T12:00:00Z'));
    const now = new Date('2026-01-01T12:00:00Z');
    const { card: next } = applyRating(card, 'good', now);
    assert.ok(next.due.getTime() >= now.getTime());
    assert.notEqual(next.state, State.New);
    assert.ok(next.reps >= 1);
  });

  it('rejects unknown ratings', () => {
    const card = createEmptyCard();
    assert.throws(() => applyRating(card, 'nope'), /Invalid rating/);
  });
});
