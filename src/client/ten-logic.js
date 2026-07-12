export function resolveStartupTab(dailyCompleteToday) {
  return dailyCompleteToday ? 'translate' : 'daily';
}

export function nextFrequencyFilter(currentFilter, clickedFilter) {
  if (currentFilter === clickedFilter) return 'all';
  return clickedFilter;
}

export function frequencyEntryMatchesFilter(seen, filter) {
  if (!filter || filter === 'all') return true;
  if (filter === 'unlocked') return seen;
  if (filter === 'not-learned') return !seen;
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
