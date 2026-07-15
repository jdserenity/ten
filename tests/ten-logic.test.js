import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildNotLearnedFrozenPool,
  canonicalizeTranslateLanguage,
  DAILY_REVIEW_GOAL,
  defaultTranslateDirection,
  extractPrimaryWordToken,
  extractSingleLearningWord,
  formatTranslateFrequencyRank,
  frequencyEntryMatchesFilter,
  frequencyListTotal,
  getFrequencyTierLabel,
  getReviewEmptyState,
  isDailyReviewComplete,
  learningLangFromModeId,
  modeIdFromLearningLang,
  nextFrequencyFilter,
  resolveStartupTab,
  shouldShowHeaderAddLanguageButton,
  shouldShowPoolDaysFooter,
  shouldShowSettingsAddLanguageButton
} from '../src/client/ten-logic.js';

test('resolveStartupTab opens 10/day, then review, then translate', () => {
  assert.equal(resolveStartupTab({ dailyCompleteToday: false, reviewCompleteToday: false }), 'daily');
  assert.equal(resolveStartupTab({ dailyCompleteToday: false, reviewCompleteToday: true }), 'daily');
  assert.equal(resolveStartupTab({ dailyCompleteToday: true, reviewCompleteToday: false }), 'review');
  assert.equal(resolveStartupTab({ dailyCompleteToday: true, reviewCompleteToday: true }), 'translate');
});

test('isDailyReviewComplete requires ten graded cards', () => {
  assert.equal(isDailyReviewComplete(9), false);
  assert.equal(isDailyReviewComplete(10), true);
  assert.equal(isDailyReviewComplete(10, DAILY_REVIEW_GOAL), true);
  assert.equal(isDailyReviewComplete(11), true);
});

test('getReviewEmptyState nudges new users and celebrates an empty queue', () => {
  assert.deepEqual(getReviewEmptyState(0), {
    label: 'Need cards',
    message: 'Add flashcards from 10/day (use the ＋ buttons), then come back here to review.'
  });
  assert.deepEqual(getReviewEmptyState(12), {
    label: 'All clear',
    message: 'No new or due cards for this language. Add cards from Translate or 10/day.'
  });
});

test('nextFrequencyFilter toggles off when the same filter is clicked again', () => {
  assert.equal(nextFrequencyFilter('all', 'unlocked'), 'unlocked');
  assert.equal(nextFrequencyFilter('unlocked', 'unlocked'), 'all');
  assert.equal(nextFrequencyFilter('not-learned', 'not-learned'), 'all');
});

test('nextFrequencyFilter switches between unlocked and not-learned', () => {
  assert.equal(nextFrequencyFilter('unlocked', 'not-learned'), 'not-learned');
  assert.equal(nextFrequencyFilter('not-learned', 'unlocked'), 'unlocked');
});

test('frequencyEntryMatchesFilter respects unlocked and not-learned views', () => {
  assert.equal(frequencyEntryMatchesFilter(true, 'all'), true);
  assert.equal(frequencyEntryMatchesFilter(false, 'all'), true);
  assert.equal(frequencyEntryMatchesFilter(true, 'unlocked'), true);
  assert.equal(frequencyEntryMatchesFilter(false, 'unlocked'), false);
  assert.equal(frequencyEntryMatchesFilter(true, 'not-learned'), false);
  assert.equal(frequencyEntryMatchesFilter(false, 'not-learned'), true);
});

test('defaultTranslateDirection targets English from the active learning language', () => {
  assert.deepEqual(defaultTranslateDirection('FR'), { source: 'FR', target: 'EN' });
  assert.deepEqual(defaultTranslateDirection('PT-BR'), { source: 'PT-BR', target: 'EN' });
  assert.deepEqual(defaultTranslateDirection('ES-AR'), { source: 'ES-AR', target: 'EN' });
});

test('buildNotLearnedFrozenPool snapshots only unseen normalized words', () => {
  const entries = [
    { normalizedWord: 'bonjour' },
    { normalizedWord: 'merci' },
    { normalizedWord: 'oui' }
  ];
  const seenSet = new Set(['merci']);
  const frozen = buildNotLearnedFrozenPool(entries, seenSet);
  assert.equal(frozen.size, 2);
  assert.equal(frozen.has('bonjour'), true);
  assert.equal(frozen.has('oui'), true);
  assert.equal(frozen.has('merci'), false);
});

test('frequencyEntryMatchesFilter keeps frozen not-learned words visible after unlock', () => {
  const frozen = new Set(['bonjour', 'merci']);
  assert.equal(frequencyEntryMatchesFilter(true, 'not-learned', frozen, 'bonjour'), true);
  assert.equal(frequencyEntryMatchesFilter(false, 'not-learned', frozen, 'merci'), true);
  assert.equal(frequencyEntryMatchesFilter(false, 'not-learned', frozen, 'oui'), false);
});

test('frequencyListTotal counts the active filter pool', () => {
  assert.equal(frequencyListTotal(5000, 120, 'all'), 5000);
  assert.equal(frequencyListTotal(5000, 120, 'unlocked'), 120);
  assert.equal(frequencyListTotal(5000, 120, 'not-learned'), 4880);
});

test('getFrequencyTierLabel maps rank bands to plain-language labels', () => {
  assert.equal(getFrequencyTierLabel(42), 'very common');
  assert.equal(getFrequencyTierLabel(500), 'very common');
  assert.equal(getFrequencyTierLabel(501), 'common');
  assert.equal(getFrequencyTierLabel(2500), 'mid-frequency');
  assert.equal(getFrequencyTierLabel(2501), 'less common');
});

test('extractPrimaryWordToken strips trailing punctuation for single-word input', () => {
  assert.equal(extractPrimaryWordToken('bonjour!'), 'bonjour');
  assert.equal(extractPrimaryWordToken('  être '), 'être');
  assert.equal(extractPrimaryWordToken('two words'), null);
});

test('extractSingleLearningWord picks the learning-language side of a single-word translate', () => {
  assert.equal(
    extractSingleLearningWord('bonjour!', 'hello', 'FR', 'EN', 'FR'),
    'bonjour'
  );
  assert.equal(
    extractSingleLearningWord('hello', 'Bonjour.', 'EN', 'FR', 'FR'),
    'Bonjour'
  );
  assert.equal(
    extractSingleLearningWord('good morning', 'bonjour mon ami', 'EN', 'FR', 'FR'),
    null
  );
});

test('shouldShowPoolDaysFooter is only true for dev users', () => {
  assert.equal(shouldShowPoolDaysFooter(true), true);
  assert.equal(shouldShowPoolDaysFooter(false), false);
});

test('language add button placement follows onboarding vs settings', () => {
  assert.equal(shouldShowHeaderAddLanguageButton([]), true);
  assert.equal(shouldShowHeaderAddLanguageButton(['FR']), false);
  assert.equal(shouldShowSettingsAddLanguageButton([]), false);
  assert.equal(shouldShowSettingsAddLanguageButton(['FR']), true);
});

test('mode and learning language ids round-trip', () => {
  assert.equal(learningLangFromModeId('fr'), 'FR');
  assert.equal(learningLangFromModeId('es-ar'), 'ES-AR');
  assert.equal(modeIdFromLearningLang('PT-BR'), 'pt-br');
  assert.equal(modeIdFromLearningLang('ES-AR'), 'es-ar');
});

test('canonicalizeTranslateLanguage maps Spanish variants to ES-AR', () => {
  assert.equal(canonicalizeTranslateLanguage('es-ar'), 'ES-AR');
  assert.equal(canonicalizeTranslateLanguage('ES'), 'ES-AR');
  assert.equal(canonicalizeTranslateLanguage('ES-419'), 'ES-AR');
});

test('formatTranslateFrequencyRank includes rank and tier when known', () => {
  assert.equal(
    formatTranslateFrequencyRank('Input', 12),
    'Input frequency rank #12 (very common)'
  );
  assert.equal(
    formatTranslateFrequencyRank('Result', null),
    'Result frequency rank unavailable'
  );
});
