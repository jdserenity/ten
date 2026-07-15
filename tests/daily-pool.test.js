import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  WORDS_PER_DAY,
  computePoolDaysLeft,
  countUnseenPoolWords,
  formatPoolDaysLabel,
  hashDate,
  normalizePoolWord,
  pickAdditionalDailyWords,
  pickDailyWords,
  reconcileDailyWords,
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

  it('treats unlocked words as no longer available in the pool', () => {
    const seen = new Set(['word1', 'word2', 'word3', 'word4', 'word5']);
    assert.equal(countUnseenPoolWords(pool, seen), 25);
    assert.equal(computePoolDaysLeft(pool.length, seen.size), 2.5);
  });
});

describe('pickAdditionalDailyWords', () => {
  it('never returns blocked or already-seen words', () => {
    const blocked = new Set(['word1', 'word2', 'word3']);
    const extra = pickAdditionalDailyWords(pool, blocked, '2026-6-12', 3);
    assert.equal(extra.length, 3);
    for (const entry of extra) {
      assert.equal(blocked.has(normalizePoolWord(entry.word)), false);
    }
  });
});

describe('reconcileDailyWords', () => {
  it('drops unlocked words from a saved assignment and refills to 10', () => {
    const dayKey = '2026-6-12';
    const seen = new Set(['word1', 'word2']);
    const assigned = pickDailyWords(pool, new Set(), dayKey).map(entry => entry.word);
    seen.add('word1');
    seen.add('word2');
    const reconciled = reconcileDailyWords(pool, assigned, seen, dayKey);
    assert.equal(reconciled.length, WORDS_PER_DAY);
    for (const entry of reconciled) {
      assert.equal(seen.has(normalizePoolWord(entry.word)), false);
    }
    const assignedNorm = new Set(assigned.map(normalizePoolWord));
    assert.equal(reconciled.some(entry => assignedNorm.has(normalizePoolWord(entry.word)) && seen.has(normalizePoolWord(entry.word))), false);
  });

  it('matches a fresh pick when nothing was unlocked after assignment', () => {
    const dayKey = '2026-6-12';
    const seen = new Set();
    const fresh = pickDailyWords(pool, seen, dayKey);
    const assigned = fresh.map(entry => entry.word);
    const reconciled = reconcileDailyWords(pool, assigned, seen, dayKey);
    assert.deepEqual(reconciled.map(entry => entry.word), assigned);
  });

  it('picks from scratch when there is no saved assignment', () => {
    const dayKey = '2026-6-12';
    const seen = new Set(['word1']);
    const reconciled = reconcileDailyWords(pool, null, seen, dayKey);
    const fresh = pickDailyWords(pool, seen, dayKey);
    assert.deepEqual(reconciled.map(entry => entry.word), fresh.map(entry => entry.word));
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
