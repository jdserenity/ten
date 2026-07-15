import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildNotLearnedFrozenPool,
  DAILY_REVIEW_GOAL,
  defaultTranslateDirection,
  extractPrimaryWordToken,
  extractSingleLearningWord,
  formatTranslateFrequencyRank,
  frequencyEntryMatchesFilter,
  frequencyListTotal,
  getFrequencyTierKey,
  getReviewEmptyState,
  isDailyReviewComplete,
  learningLangFromModeId,
  modeIdFromLearningLang,
  nextFrequencyFilter,
  normalizeTranslateDirection,
  resolveStartupTab,
  resolveTranslateNativeLang,
  shouldShowHeaderAddLanguageButton,
  shouldShowPoolDaysFooter,
  shouldShowSettingsAddLanguageButton,
  swapTranslateDirection
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

test('getReviewEmptyState returns i18n keys for empty and clear queues', () => {
  assert.deepEqual(getReviewEmptyState(0), {
    labelKey: 'review.empty.needCardsLabel',
    messageKey: 'review.empty.needCardsMessage'
  });
  assert.deepEqual(getReviewEmptyState(12), {
    labelKey: 'review.empty.allClearLabel',
    messageKey: 'review.empty.allClearMessage'
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

test('defaultTranslateDirection targets the native language from the active learning language', () => {
  assert.deepEqual(defaultTranslateDirection('FR', 'EN'), { source: 'FR', target: 'EN' });
  assert.deepEqual(defaultTranslateDirection('PT-BR', 'PT-BR'), { source: 'PT-BR', target: 'EN' });
  assert.deepEqual(defaultTranslateDirection('FR', 'PT-BR'), { source: 'FR', target: 'PT-BR' });
});

test('resolveTranslateNativeLang falls back to English when native matches learning', () => {
  assert.equal(resolveTranslateNativeLang('PT-BR', 'PT-BR'), 'EN');
  assert.equal(resolveTranslateNativeLang('FR', 'EN'), 'EN');
});

test('normalizeTranslateDirection clamps to learning language and native pole', () => {
  assert.deepEqual(
    normalizeTranslateDirection('FR', 'PT-BR', 'FR', 'PT-BR'),
    { source: 'FR', target: 'PT-BR' }
  );
  assert.deepEqual(
    normalizeTranslateDirection('DE', 'FR', 'PT-BR', 'EN'),
    { source: 'PT-BR', target: 'EN' }
  );
});

test('swapTranslateDirection toggles between learning language and native pole', () => {
  assert.deepEqual(
    swapTranslateDirection('FR', 'EN', 'FR', 'EN'),
    { source: 'EN', target: 'FR' }
  );
  assert.deepEqual(
    swapTranslateDirection('PT-BR', 'EN', 'PT-BR', 'PT-BR'),
    { source: 'EN', target: 'PT-BR' }
  );
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

test('getFrequencyTierKey maps rank bands to i18n keys', () => {
  assert.equal(getFrequencyTierKey(42), 'frequency.tier.veryCommon');
  assert.equal(getFrequencyTierKey(500), 'frequency.tier.veryCommon');
  assert.equal(getFrequencyTierKey(501), 'frequency.tier.common');
  assert.equal(getFrequencyTierKey(2500), 'frequency.tier.midFrequency');
  assert.equal(getFrequencyTierKey(2501), 'frequency.tier.lessCommon');
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
  assert.equal(modeIdFromLearningLang('PT-BR'), 'pt-br');
});

test('formatTranslateFrequencyRank returns structured rank metadata', () => {
  assert.deepEqual(formatTranslateFrequencyRank('frequency.rankInput', 12), {
    labelKey: 'frequency.rankInput',
    rank: 12,
    tierKey: 'frequency.tier.veryCommon'
  });
  assert.deepEqual(formatTranslateFrequencyRank('frequency.rankResult', null), {
    labelKey: 'frequency.rankResult',
    rank: null,
    tierKey: ''
  });
});
