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
  getFrequencyTierKey,
  getReviewEmptyState,
  isDailyReviewComplete,
  learningLangFromModeId,
  modeIdFromLearningLang,
  nextFrequencyFilter,
  normalizeTranslateDirection,
  resolveStartupTab,
  resolveTranslateNativeLang,
  buildLangPickerOptionHtml,
  getLangPickerOptions,
  isLangPickerOutsideClick,
  pickSpeechVoice,
  sortLangPickerOptionsByLabel,
  shouldOpenLangPickerOnModeClick,
  shouldShowAddLanguageHint,
  shouldShowHeaderAddLanguageButton,
  shouldShowPoolDaysFooter,
  shouldShowSettingsAddLanguageButton,
  swapTranslateDirection,
  userHasLearningLanguages
} from '../src/client/ten-logic.js';

test('userHasLearningLanguages is false until the user adds a track', () => {
  assert.equal(userHasLearningLanguages([]), false);
  assert.equal(userHasLearningLanguages(null), false);
  assert.equal(userHasLearningLanguages(['FR']), true);
});

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
  assert.deepEqual(defaultTranslateDirection('ES-AR'), { source: 'ES-AR', target: 'EN' });
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

test('add-language hint shows for fresh users until they open the picker or add a language', () => {
  assert.equal(shouldShowAddLanguageHint([]), true);
  assert.equal(shouldShowAddLanguageHint(null), true);
  assert.equal(shouldShowAddLanguageHint([], { pickerOpen: true }), false);
  assert.equal(shouldShowAddLanguageHint(['FR']), false);
  assert.equal(shouldShowAddLanguageHint(['FR'], { pickerOpen: true }), false);
});

test('buildLangPickerOptionHtml renders a selectable chip with flag, name, and tick', () => {
  const html = buildLangPickerOptionHtml({
    modeId: 'pt-br',
    flag: '🇧🇷',
    label: 'Brazilian Portuguese'
  });
  assert.match(html, /class="lang-picker-option"/);
  assert.match(html, /type="checkbox"/);
  assert.match(html, /value="pt-br"/);
  assert.match(html, /class="lang-picker-flag"/);
  assert.match(html, /🇧🇷/);
  assert.match(html, /class="lang-picker-name"/);
  assert.match(html, /Brazilian Portuguese/);
  assert.match(html, /class="lang-picker-tick"/);
  assert.doesNotMatch(html, /\schecked/);
  assert.doesNotMatch(html, /type="checkbox"[^>]*>\s*[🇧🇷🇨🇦🇫🇷🇦🇷]/);
});

test('buildLangPickerOptionHtml escapes label HTML', () => {
  const html = buildLangPickerOptionHtml({
    modeId: 'fr',
    flag: '🇨🇦',
    label: 'Quebec <script> French & "co"'
  });
  assert.match(html, /Quebec &lt;script&gt; French &amp; &quot;co&quot;/);
  assert.doesNotMatch(html, /<script>/);
});

test('getLangPickerOptions includes owned languages as selected', () => {
  assert.deepEqual(getLangPickerOptions(['pt-br', 'fr'], ['fr']), [
    { modeId: 'pt-br', selected: false },
    { modeId: 'fr', selected: true }
  ]);
});

test('sortLangPickerOptionsByLabel orders by display name alphabetically', () => {
  const sorted = sortLangPickerOptionsByLabel([
    { modeId: 'pt-br', label: 'Brazilian Portuguese', selected: false },
    { modeId: 'fr', label: 'Quebec French', selected: true },
    { modeId: 'fr-fr', label: 'France French', selected: false },
    { modeId: 'es-ar', label: 'Argentinian Spanish', selected: false }
  ]);
  assert.deepEqual(sorted.map(option => option.modeId), ['es-ar', 'pt-br', 'fr-fr', 'fr']);
});

test('isLangPickerOutsideClick ignores clicks inside the picker or on ignored roots', () => {
  const picker = { contains(node) { return node === 'inside-picker' || node === 'inside-toggle'; } };
  const toggle = { contains(node) { return node === 'inside-toggle'; } };
  const flags = { contains(node) { return node === 'inside-flag'; } };
  assert.equal(isLangPickerOutsideClick('inside-picker', picker, toggle), false);
  assert.equal(isLangPickerOutsideClick('inside-toggle', picker, toggle), false);
  assert.equal(isLangPickerOutsideClick('inside-flag', picker, flags), false);
  assert.equal(isLangPickerOutsideClick('outside', picker, toggle, flags), true);
  assert.equal(isLangPickerOutsideClick(null, picker, toggle), false);
});

test('shouldOpenLangPickerOnModeClick is true only for the active learning flag', () => {
  assert.equal(shouldOpenLangPickerOnModeClick('fr', 'fr'), true);
  assert.equal(shouldOpenLangPickerOnModeClick('fr', 'pt-br'), false);
  assert.equal(shouldOpenLangPickerOnModeClick('', 'fr'), false);
});

test('mode and learning language ids round-trip', () => {
  assert.equal(learningLangFromModeId('fr'), 'FR');
  assert.equal(learningLangFromModeId('fr-fr'), 'FR-FR');
  assert.equal(learningLangFromModeId('es-ar'), 'ES-AR');
  assert.equal(modeIdFromLearningLang('PT-BR'), 'pt-br');
  assert.equal(modeIdFromLearningLang('FR-FR'), 'fr-fr');
  assert.equal(modeIdFromLearningLang('ES-AR'), 'es-ar');
});

test('canonicalizeTranslateLanguage maps French variants separately', () => {
  assert.equal(canonicalizeTranslateLanguage('fr-ca'), 'FR');
  assert.equal(canonicalizeTranslateLanguage('FR'), 'FR');
  assert.equal(canonicalizeTranslateLanguage('fr-fr'), 'FR-FR');
  assert.equal(canonicalizeTranslateLanguage('FR-FR'), 'FR-FR');
});

test('canonicalizeTranslateLanguage maps Spanish variants to ES-AR', () => {
  assert.equal(canonicalizeTranslateLanguage('es-ar'), 'ES-AR');
  assert.equal(canonicalizeTranslateLanguage('ES'), 'ES-AR');
  assert.equal(canonicalizeTranslateLanguage('ES-419'), 'ES-AR');
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

test('pickSpeechVoice prefers a Spanish voice over English for es-AR', () => {
  const english = { lang: 'en-US', name: 'Samantha', localService: true };
  const spanishMx = { lang: 'es-MX', name: 'Paulina', localService: true };
  assert.equal(pickSpeechVoice([english, spanishMx], 'es-AR'), spanishMx);
});

test('pickSpeechVoice prefers exact es-AR, then Latin American, then Spain', () => {
  const spain = { lang: 'es-ES', name: 'Monica', localService: true };
  const mexico = { lang: 'es-MX', name: 'Paulina', localService: true };
  const argentina = { lang: 'es-AR', name: 'Diego', localService: true };
  assert.equal(pickSpeechVoice([spain, mexico, argentina], 'es-AR'), argentina);
  assert.equal(pickSpeechVoice([spain, mexico], 'es-AR'), mexico);
  assert.equal(pickSpeechVoice([spain], 'es-AR'), spain);
});

test('pickSpeechVoice returns null when no voice matches the language family', () => {
  const english = { lang: 'en-US', name: 'Samantha', localService: true };
  assert.equal(pickSpeechVoice([english], 'es-AR'), null);
  assert.equal(pickSpeechVoice([], 'es-AR'), null);
  assert.equal(pickSpeechVoice(null, 'es-AR'), null);
});

test('pickSpeechVoice matches Portuguese and French regional tags', () => {
  const ptPt = { lang: 'pt-PT', name: 'Joana', localService: true };
  const ptBr = { lang: 'pt-BR', name: 'Luciana', localService: true };
  const frFr = { lang: 'fr-FR', name: 'Thomas', localService: true };
  const frCa = { lang: 'fr-CA', name: 'Amelie', localService: true };
  assert.equal(pickSpeechVoice([ptPt, ptBr], 'pt-BR'), ptBr);
  assert.equal(pickSpeechVoice([frFr, frCa], 'fr-CA'), frCa);
  assert.equal(pickSpeechVoice([frCa, frFr], 'fr-FR'), frFr);
});
