import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const app = readFileSync(new URL('../src/client/app.js', import.meta.url), 'utf8');

function session() {
  const storage = new Map();
  let bursts = 0;
  const context = vm.createContext({
    state: { activeTab: 'daily' }, WORDS_PER_DAY: 5, DAILY_REVIEW_GOAL: 5,
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    getFrequencyLanguageForMode: () => 'FR', dateKey: () => '2026-09-13',
    isDailyReviewComplete: count => count >= 5,
    celebrate: () => { bursts++; }
  });
  const code = app.slice(app.indexOf('const DAILY_CONFETTI_STORAGE_PREFIX'), app.indexOf('function buildReviewDots()'));
  vm.runInContext(`${code}\nfireCompleteConfetti = celebrate;`, context);
  return { context, run: code => vm.runInContext(code, context), bursts: () => bursts };
}

test('new words first celebrates only after the fifth graded review, once', () => {
  const s = session();
  for (let i = 0; i < 5; i++) s.run(`maybeCelebrateDailyComplete(${i})`);
  assert.equal(s.bursts(), 0);
  assert.equal(s.run('hasCompletedDailyWordsToday()'), true);
  for (let i = 0; i < 4; i++) s.run('maybeCelebrateReviewComplete(incrementReviewGradedToday())');
  assert.equal(s.bursts(), 0);
  s.run('maybeCelebrateReviewComplete(incrementReviewGradedToday())');
  assert.equal(s.bursts(), 1);
  s.run('maybeCelebrateDailyComplete(4); maybeCelebrateReviewComplete(incrementReviewGradedToday())');
  assert.equal(s.bursts(), 1);
});

test('review first celebrates only on reaching the fifth new word', () => {
  const s = session();
  for (let i = 0; i < 5; i++) s.run('maybeCelebrateReviewComplete(incrementReviewGradedToday())');
  assert.equal(s.bursts(), 0);
  for (let i = 0; i < 4; i++) s.run(`maybeCelebrateDailyComplete(${i})`);
  assert.equal(s.bursts(), 0);
  s.run('maybeCelebrateDailyComplete(4)');
  assert.equal(s.bursts(), 1);
});

test('background daily rendering cannot mark new words complete or celebrate', () => {
  const s = session();
  s.context.state.activeTab = 'review';
  for (let i = 0; i < 5; i++) s.run('maybeCelebrateReviewComplete(incrementReviewGradedToday())');
  s.run('maybeCelebrateDailyComplete(4)');
  assert.equal(s.run('hasCompletedDailyWordsToday()'), false);
  assert.equal(s.bursts(), 0);
});

test('celebration gates persist and are scoped to the language and day', () => {
  const s = session();
  s.run('maybeCelebrateDailyComplete(4)');
  for (let i = 0; i < 5; i++) s.run('maybeCelebrateReviewComplete(incrementReviewGradedToday())');
  s.run('maybeCelebrateComplete()');
  assert.equal(s.bursts(), 1);
  s.context.dateKey = () => '2026-09-14';
  assert.equal(s.run('hasCompletedDailyWordsToday()'), false);
  assert.equal(s.run('hasCompletedDailyReviewToday()'), false);
  s.run('maybeCelebrateComplete()');
  s.context.dateKey = () => '2026-09-13';
  s.context.getFrequencyLanguageForMode = () => 'ES-VE';
  s.run('maybeCelebrateComplete()');
  assert.equal(s.bursts(), 1);
});
