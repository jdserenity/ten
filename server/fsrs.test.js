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

  it('schedules every rating at least a day out so daily reviewers are not re-shown the same card tomorrow by default short-term steps', () => {
    const now = new Date('2026-01-01T12:00:00Z');
    for (const rating of ['again', 'hard', 'good', 'easy']) {
      const { card: next } = applyRating(createEmptyCard(now), rating, now);
      assert.equal(next.state, State.Review, `${rating} should graduate the card out of learning`);
      assert.ok(next.scheduled_days >= 1, `${rating} should schedule at least 1 day, got ${next.scheduled_days}`);
      assert.ok(next.due.getTime() >= now.getTime() + 24 * 60 * 60 * 1000, `${rating} due should be at least tomorrow`);
    }
  });

  it('spaces repeated hard ratings further apart instead of trapping the card in learning', () => {
    let card = createEmptyCard(new Date('2026-01-01T12:00:00Z'));
    const intervals = [];
    for (let day = 0; day < 3; day++) {
      const reviewAt = new Date(Math.max(card.due.getTime(), new Date('2026-01-01T12:00:00Z').getTime() + day * 86400000));
      card = applyRating(card, 'hard', reviewAt).card;
      intervals.push(card.scheduled_days);
    }
    assert.ok(intervals[1] > intervals[0], `hard intervals should grow, got ${intervals}`);
    assert.ok(intervals[2] > intervals[1], `hard intervals should grow, got ${intervals}`);
  });
});
