export function resolveStartupTab(dailyCompleteToday) {
  return dailyCompleteToday ? 'translate' : 'daily';
}

export function nextFrequencyFilter(currentFilter, clickedFilter) {
  if (currentFilter === clickedFilter) return 'all';
  return clickedFilter;
}

export function defaultTranslateDirection(learningLang) {
  return { source: learningLang, target: 'EN' };
}

export function buildNotLearnedFrozenPool(entries, seenSet) {
  const frozen = new Set();
  if (!Array.isArray(entries) || !(seenSet instanceof Set)) return frozen;
  entries.forEach(entry => {
    const normalized = entry?.normalizedWord;
    if (normalized && !seenSet.has(normalized)) frozen.add(normalized);
  });
  return frozen;
}

export function frequencyEntryMatchesFilter(seen, filter, frozenNotLearnedSet = null, normalizedWord = '') {
  if (!filter || filter === 'all') return true;
  if (filter === 'unlocked') return seen;
  if (filter === 'not-learned') {
    if (frozenNotLearnedSet instanceof Set && frozenNotLearnedSet.size > 0 && normalizedWord) {
      return frozenNotLearnedSet.has(normalizedWord);
    }
    return !seen;
  }
  return true;
}

export function frequencyListTotal(entriesLength, unlockedCount, filter) {
  if (filter === 'unlocked') return unlockedCount;
  if (filter === 'not-learned') return entriesLength - unlockedCount;
  return entriesLength;
}

export function canonicalizeTranslateLanguage(value) {
  const code = String(value || '').trim().toUpperCase();
  if (code === 'EN' || code === 'EN-US' || code === 'EN-GB') return 'EN';
  if (code === 'PB' || code === 'PT' || code === 'PT-BR' || code === 'PT-PT') return 'PT-BR';
  if (code === 'FR' || code === 'FR-FR' || code === 'FR-CA') return 'FR';
  return '';
}

export function countWordsIgnoringPunctuation(text) {
  const matches = String(text || '').match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu);
  return matches ? matches.length : 0;
}

export function extractPrimaryWordToken(text) {
  const matches = String(text || '').match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu);
  if (!matches || matches.length !== 1) return null;
  return matches[0];
}

export function getFrequencyTierLabel(rank) {
  if (!rank) return '';
  if (rank <= 500) return 'very common';
  if (rank <= 1000) return 'common';
  if (rank <= 2500) return 'mid-frequency';
  return 'less common';
}

export function extractSingleLearningWord(inputText, translatedText, sourceLang, targetLang, learningLanguage) {
  const sourceCanonical = canonicalizeTranslateLanguage(sourceLang);
  const targetCanonical = canonicalizeTranslateLanguage(targetLang);
  if (sourceCanonical === learningLanguage && countWordsIgnoringPunctuation(inputText) === 1) {
    return extractPrimaryWordToken(inputText);
  }
  if (targetCanonical === learningLanguage && countWordsIgnoringPunctuation(translatedText) === 1) {
    return extractPrimaryWordToken(translatedText);
  }
  return null;
}

export function formatTranslateFrequencyRank(label, rank) {
  if (rank) return `${label} frequency rank #${rank} (${getFrequencyTierLabel(rank)})`;
  return `${label} frequency rank unavailable`;
}

export function isReviewGradeButtonsDisabled({ reviewEditing }) {
  return Boolean(reviewEditing);
}

export function learningLangFromModeId(modeId) {
  if (modeId === 'pt-br') return 'PT-BR';
  if (modeId === 'fr') return 'FR';
  return '';
}

export function modeIdFromLearningLang(language) {
  const code = String(language || '').trim().toUpperCase();
  if (code === 'PT-BR') return 'pt-br';
  if (code === 'FR') return 'fr';
  return '';
}

export function shouldShowPoolDaysFooter(isDev) {
  return Boolean(isDev);
}

export function shouldShowHeaderAddLanguageButton(userLanguages, inSettings = false) {
  if (inSettings) return false;
  return !Array.isArray(userLanguages) || userLanguages.length === 0;
}

export function shouldShowSettingsAddLanguageButton(userLanguages) {
  return Array.isArray(userLanguages) && userLanguages.length > 0;
}

export function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase();
}
