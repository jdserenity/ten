import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  WORDS_PER_DAY,
  computePoolDaysLeft,
  countUnseenPoolWords,
  formatPoolDaysLabel,
  hashDate,
  normalizePoolWord,
  pickDailyWords,
  resolveDailyWordsFromAssignment,
  seededShuffle
} from '../src/client/daily-pool.js';

const pool = Array.from({ length: 30 }, (_, i) => ({
  word: `word${i + 1}`,
  translation: `meaning ${i + 1}`
}));

describe('normalizePoolWord', () => {
  it('lowercases and trims', () => {
    assert.equal(normalizePoolWord('  Bonjour '), 'bonjour');
  });
});

describe('pickDailyWords', () => {
  it('never returns words already in the seen set', () => {
    const seen = new Set(['word1', 'word2', 'word3']);
    const dayKey = '2026-6-12';
    const picked = pickDailyWords(pool, seen, dayKey);
    assert.equal(picked.length, WORDS_PER_DAY);
    for (const entry of picked) {
      assert.equal(seen.has(normalizePoolWord(entry.word)), false);
    }
  });

  it('is deterministic for the same day key', () => {
    const seen = new Set(['word1']);
    const dayKey = '2026-6-12';
    const first = pickDailyWords(pool, seen, dayKey).map(entry => entry.word);
    const second = pickDailyWords(pool, seen, dayKey).map(entry => entry.word);
    assert.deepEqual(first, second);
  });

  it('changes when the day key changes', () => {
    const seen = new Set();
    const dayA = pickDailyWords(pool, seen, '2026-6-12').map(entry => entry.word);
    const dayB = pickDailyWords(pool, seen, '2026-6-13').map(entry => entry.word);
    assert.notDeepEqual(dayA, dayB);
  });

  it('returns fewer than 10 when the unseen pool is smaller', () => {
    const tinyPool = pool.slice(0, 5);
    const picked = pickDailyWords(tinyPool, new Set(), '2026-6-12');
    assert.equal(picked.length, 5);
  });
});

describe('resolveDailyWordsFromAssignment', () => {
  it('maps saved headwords back to pool entries in order', () => {
    const assigned = ['word3', 'word1', 'word9'];
    const resolved = resolveDailyWordsFromAssignment(pool, assigned);
    assert.deepEqual(resolved.map(entry => entry.word), assigned);
  });

  it('drops headwords missing from the pool', () => {
    const resolved = resolveDailyWordsFromAssignment(pool, ['word1', 'missing', 'word2']);
    assert.deepEqual(resolved.map(entry => entry.word), ['word1', 'word2']);
  });
});

describe('computePoolDaysLeft', () => {
  it('counts down as words are surfaced', () => {
    assert.equal(computePoolDaysLeft(300, 0), 30);
    assert.equal(computePoolDaysLeft(300, 10), 29);
    assert.equal(computePoolDaysLeft(300, 36), 26.4);
    assert.equal(computePoolDaysLeft(300, 300), 0);
  });

  it('never goes below zero', () => {
    assert.equal(computePoolDaysLeft(30, 50), 0);
  });
});

describe('countUnseenPoolWords', () => {
  it('counts only words not yet surfaced', () => {
    const seen = new Set(['word1', 'word2']);
    assert.equal(countUnseenPoolWords(pool, seen), 28);
  });
});

describe('formatPoolDaysLabel', () => {
  it('uses singular day for exactly 1', () => {
    assert.equal(formatPoolDaysLabel(1, 'Quebec'), '~1 day left in Quebec pool');
  });

  it('shows one decimal for fractional days', () => {
    assert.equal(formatPoolDaysLabel(26.4, 'Brazil'), '~26.4 days left in Brazil pool');
  });
});

describe('seededShuffle', () => {
  it('is stable for a fixed seed', () => {
    const input = [1, 2, 3, 4, 5];
    const seed = hashDate('2026-6-12');
    assert.deepEqual(seededShuffle(input, seed), seededShuffle(input, seed));
  });
});
