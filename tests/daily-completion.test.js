import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const app = readFileSync(new URL('../src/client/app.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../src/client/index.html', import.meta.url), 'utf8');

function session({ realConfetti = false } = {}) {
  const storage = new Map();
  let bursts = 0;
  const context = vm.createContext({
    state: { activeTab: 'daily' }, WORDS_PER_DAY: 5, DAILY_REVIEW_GOAL: 5,
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    getFrequencyLanguageForMode: () => 'FR', dateKey: () => '2026-09-13',
    isDailyReviewComplete: count => count >= 5,
    celebrate: () => { bursts++; return true; },
    setTimeout: () => 1, window: {}
  });
  const code = app.slice(app.indexOf('const DAILY_CONFETTI_STORAGE_PREFIX'), app.indexOf('function buildReviewDots()'));
  vm.runInContext(code, context);
  if (!realConfetti) vm.runInContext('fireCompleteConfetti = celebrate;', context);
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

test('Next advances new words and opens Review from the last one', () => {
  const moves = [];
  const state = { todayWords: Array(5).fill({}), currentWordIndex: 3 };
  const context = vm.createContext({ state, gotoDailyWord: index => moves.push(index), setActiveTab: tab => moves.push(tab) });
  const code = app.slice(app.indexOf('function advanceDailyWord()'), app.indexOf('function gotoDailyWord(index)'));
  vm.runInContext(`${code}\nadvanceDailyWord();`, context);
  assert.deepEqual(moves, [4]);
  state.currentWordIndex = 4;
  vm.runInContext('advanceDailyWord()', context);
  assert.deepEqual(moves, [4, 'review']);
  state.todayWords = [];
  vm.runInContext('advanceDailyWord()', context);
  assert.equal(moves.length, 2);
  assert.match(app, /document.getElementById\('next-btn'\).disabled = false;/);
  assert.match(app, /getElementById\('next-btn'\).addEventListener\('click', \(\) => \{\s*advanceDailyWord\(\);/);
});

test('missing confetti script does not consume the celebration and can retry', () => {
  const s = session({ realConfetti: true });
  s.run('maybeCelebrateDailyComplete(4)');
  for (let i = 0; i < 5; i++) s.run('maybeCelebrateReviewComplete(incrementReviewGradedToday())');
  assert.equal(s.run('hasCelebratedCompleteToday()'), false);
  const calls = [];
  s.context.confetti = options => calls.push(options);
  s.run('maybeCelebrateComplete()');
  assert.equal(calls.length, 2);
  assert.equal(s.run('hasCelebratedCompleteToday()'), true);
  s.run('maybeCelebrateComplete()');
  assert.equal(calls.length, 2);
});

test('bundled confetti renders normally but suppresses all particles with Reduce Motion', () => {
  const vendor = readFileSync(new URL('../src/client/confetti.browser.js', import.meta.url), 'utf8');
  for (const reducedMotion of [false, true]) {
    const s = session({ realConfetti: true });
    const canvases = [];
    Object.assign(s.context, {
      matchMedia: () => ({ matches: reducedMotion }),
      document: {
        documentElement: { clientWidth: 390, clientHeight: 844 },
        createElement: () => ({ style: {}, getContext: () => ({}) }),
        body: { appendChild: canvas => canvases.push(canvas) }
      },
      addEventListener() {}, removeEventListener() {},
      requestAnimationFrame: () => 1, cancelAnimationFrame() {}
    });
    s.context.window = s.context;
    vm.runInContext(vendor, s.context);
    s.run('fireCompleteConfetti()');
    assert.equal(canvases.length, reducedMotion ? 0 : 1);
  }
});

test('the PWA loads confetti before the app module can initialize', () => {
  assert.match(html, /<script src="\/confetti\.browser\.js"><\/script>\s*<script type="module" src="\/app\.js\?v=26"><\/script>/);
  assert.doesNotMatch(html, /confetti\.browser\.js" defer/);
});
