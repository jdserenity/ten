export const DAILY_REVIEW_GOAL = 5;

export function userHasLearningLanguages(languages) {
  return Array.isArray(languages) && languages.length > 0;
}

export function resolveStartupTab({ dailyCompleteToday, reviewCompleteToday }) {
  if (!dailyCompleteToday) return 'daily';
  if (!reviewCompleteToday) return 'review';
  return 'translate';
}

export function isDailyReviewComplete(reviewedCountToday, goal = DAILY_REVIEW_GOAL) {
  return reviewedCountToday >= goal;
}

export function getReviewEmptyState(totalCardCount) {
  if (!totalCardCount) {
    return {
      labelKey: 'review.empty.needCardsLabel',
      messageKey: 'review.empty.needCardsMessage'
    };
  }
  return {
    labelKey: 'review.empty.allClearLabel',
    messageKey: 'review.empty.allClearMessage'
  };
}

export function nextFrequencyFilter(currentFilter, clickedFilter) {
  if (currentFilter === clickedFilter) return 'all';
  return clickedFilter;
}

export function defaultTranslateDirection(learningLang, nativeLang = 'EN') {
  const target = resolveTranslateNativeLang(learningLang, nativeLang);
  return { source: learningLang, target };
}

export function resolveTranslateNativeLang(learningLang, nativeLang) {
  const canonical = canonicalizeTranslateLanguage(nativeLang) || 'EN';
  if (canonical === learningLang) return 'EN';
  return canonical;
}

export function normalizeTranslateDirection(source, target, learningLang, nativeLang = 'EN') {
  const pole = resolveTranslateNativeLang(learningLang, nativeLang);
  const sourceLang = canonicalizeTranslateLanguage(source) || learningLang;
  let targetLang = canonicalizeTranslateLanguage(target) || pole;
  if (sourceLang !== pole && sourceLang !== learningLang) {
    return { source: learningLang, target: pole };
  }
  if (targetLang !== pole && targetLang !== learningLang) targetLang = pole;
  if (sourceLang === targetLang) targetLang = sourceLang === pole ? learningLang : pole;
  return { source: sourceLang, target: targetLang };
}

export function swapTranslateDirection(source, target, learningLang, nativeLang = 'EN') {
  const pole = resolveTranslateNativeLang(learningLang, nativeLang);
  const nextSource = canonicalizeTranslateLanguage(target) === pole ? pole : learningLang;
  const nextTarget = nextSource === pole ? learningLang : pole;
  return { source: nextSource, target: nextTarget };
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
  if (code === 'FR' || code === 'FR-CA') return 'FR';
  if (code === 'FR-FR') return 'FR-FR';
  if (code === 'ES' || code === 'ES-AR' || code === 'ES-419') return 'ES-AR';
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

export function getFrequencyTierKey(rank) {
  if (!rank) return '';
  if (rank <= 500) return 'frequency.tier.veryCommon';
  if (rank <= 1000) return 'frequency.tier.common';
  if (rank <= 2500) return 'frequency.tier.midFrequency';
  return 'frequency.tier.lessCommon';
}

export function getFrequencyTierLabel(rank) {
  return getFrequencyTierKey(rank);
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

export function formatTranslateFrequencyRank(labelKey, rank) {
  if (rank) return { labelKey, rank, tierKey: getFrequencyTierKey(rank) };
  return { labelKey, rank: null, tierKey: '' };
}

export function isReviewGradeButtonsDisabled({ reviewEditing }) {
  return Boolean(reviewEditing);
}

export function learningLangFromModeId(modeId) {
  if (modeId === 'pt-br') return 'PT-BR';
  if (modeId === 'fr') return 'FR';
  if (modeId === 'fr-fr') return 'FR-FR';
  if (modeId === 'es-ar') return 'ES-AR';
  return '';
}

export function modeIdFromLearningLang(language) {
  const code = String(language || '').trim().toUpperCase();
  if (code === 'PT-BR') return 'pt-br';
  if (code === 'FR') return 'fr';
  if (code === 'FR-FR') return 'fr-fr';
  if (code === 'ES-AR') return 'es-ar';
  return '';
}

export function shouldShowPoolDaysFooter(isDev) {
  return Boolean(isDev);
}

export function shouldShowHeaderAddLanguageButton(userLanguages, inSettings = false) {
  if (inSettings) return false;
  return !Array.isArray(userLanguages) || userLanguages.length === 0;
}

export function shouldShowAddLanguageHint(userLanguages, { pickerOpen = false } = {}) {
  if (pickerOpen) return false;
  return shouldShowHeaderAddLanguageButton(userLanguages);
}

export function shouldShowSettingsAddLanguageButton(userLanguages) {
  return Array.isArray(userLanguages) && userLanguages.length > 0;
}

export function escapeLangPickerText(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function getLangPickerOptions(offeredModeIds, ownedModeIds = []) {
  const owned = new Set(Array.isArray(ownedModeIds) ? ownedModeIds : []);
  return (Array.isArray(offeredModeIds) ? offeredModeIds : []).map(modeId => ({
    modeId,
    selected: owned.has(modeId)
  }));
}

export const LANG_FAMILIES = {
  es: { id: 'es', modeIds: ['es-ar'] },
  fr: { id: 'fr', modeIds: ['fr', 'fr-fr'] },
  pt: { id: 'pt', modeIds: ['pt-br'] }
};
const LANG_FAMILY_ORDER = ['es', 'fr', 'pt'];

function toModeIdSet(value) {
  if (value instanceof Set) return value;
  return new Set(Array.isArray(value) ? value : []);
}

export function getLangFamilyId(modeId) {
  const id = String(modeId || '');
  if (id === 'es-ar') return 'es';
  if (id === 'fr' || id === 'fr-fr') return 'fr';
  if (id === 'pt-br') return 'pt';
  return '';
}

export function getLangPickerFamilies(offeredModeIds, selectedModeIds = []) {
  const offered = toModeIdSet(offeredModeIds);
  const selected = toModeIdSet(selectedModeIds);
  return LANG_FAMILY_ORDER.flatMap(familyId => {
    const modeIds = LANG_FAMILIES[familyId].modeIds.filter(modeId => offered.has(modeId));
    if (!modeIds.length) return [];
    return [{ familyId, modeIds, selected: modeIds.some(modeId => selected.has(modeId)) }];
  });
}

export function getLangPickerDialects(familyId, offeredModeIds, selectedModeIds = []) {
  const family = LANG_FAMILIES[familyId];
  if (!family) return [];
  const offered = toModeIdSet(offeredModeIds);
  const selected = toModeIdSet(selectedModeIds);
  return family.modeIds
    .filter(modeId => offered.has(modeId))
    .map(modeId => ({ modeId, selected: selected.has(modeId) }));
}

export function getLangPickerDialectLabelKey(modeId) {
  if (modeId === 'pt-br') return 'picker.dialect.ptBr';
  if (modeId === 'fr') return 'picker.dialect.fr';
  if (modeId === 'fr-fr') return 'picker.dialect.frFr';
  if (modeId === 'es-ar') return 'picker.dialect.esAr';
  return '';
}

export function langPickerPrimaryAction(step) {
  return step === 'dialect' ? 'back' : 'confirm';
}

export function shouldCloseLangPickerOnOutsideClick(step) {
  return step !== 'dialect';
}

export function applyLangPickerDialectToggle(selectedModeIds, modeId, checked) {
  const next = new Set(toModeIdSet(selectedModeIds));
  if (checked) next.add(modeId);
  else next.delete(modeId);
  return [...next];
}

export function buildLangPickerFamilyHtml({ familyId, flag = '', label = '', selected = false } = {}) {
  const safeFamily = String(familyId || '').replace(/"/g, '');
  const safeFlag = escapeLangPickerText(flag);
  const safeLabel = escapeLangPickerText(label);
  const selectedClass = selected ? ' is-selected' : '';
  return `<button type="button" class="lang-picker-option lang-picker-family${selectedClass}" data-family="${safeFamily}"><span class="lang-picker-flag">${safeFlag}</span><span class="lang-picker-name">${safeLabel}</span><span class="lang-picker-tick" aria-hidden="true"></span><span class="lang-picker-chevron" aria-hidden="true"></span></button>`;
}

export function sortLangPickerOptionsByLabel(options, locale) {
  return [...(Array.isArray(options) ? options : [])].sort((a, b) =>
    String(a?.label || '').localeCompare(String(b?.label || ''), locale || undefined, { sensitivity: 'base' })
  );
}

export function isLangPickerOutsideClick(target, pickerEl, ...ignoreEls) {
  if (!target || !pickerEl) return false;
  if (pickerEl.contains(target)) return false;
  for (const ignoreEl of ignoreEls) {
    if (ignoreEl?.contains?.(target)) return false;
  }
  return true;
}

export function shouldOpenLangPickerOnModeClick(clickedModeId, activeModeId) {
  return Boolean(clickedModeId && activeModeId && clickedModeId === activeModeId);
}

export function buildLangPickerOptionHtml({ modeId, flag = '', label = '', selected = false } = {}) {
  const safeMode = String(modeId || '').replace(/"/g, '');
  const safeFlag = escapeLangPickerText(flag);
  const safeLabel = escapeLangPickerText(label);
  const checked = selected ? ' checked' : '';
  return `<label class="lang-picker-option"><input type="checkbox" value="${safeMode}"${checked} /><span class="lang-picker-flag">${safeFlag}</span><span class="lang-picker-name">${safeLabel}</span><span class="lang-picker-tick" aria-hidden="true"></span></label>`;
}

export function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase();
}

/** Preferred BCP-47 fallbacks when an exact regional TTS voice is missing. */
const SPEECH_LANG_FALLBACKS = {
  'es-ar': ['es-419', 'es-mx', 'es-us', 'es-uy', 'es-cl', 'es-co', 'es-pe', 'es-ve', 'es-es', 'es'],
  'pt-br': ['pt-br', 'pt', 'pt-pt'],
  'fr-ca': ['fr-ca', 'fr', 'fr-fr'],
  'fr-fr': ['fr-fr', 'fr', 'fr-ca']
};

function normalizeSpeechLangTag(value) {
  return String(value || '').trim().toLowerCase().replace(/_/g, '-');
}

function speechLangBase(tag) {
  const normalized = normalizeSpeechLangTag(tag);
  return normalized.split('-')[0] || '';
}

/**
 * Pick the best installed Web Speech voice for a target BCP-47 tag.
 * Browsers often ignore utt.lang alone and keep the default English voice —
 * especially for rare tags like es-AR — so callers must assign utt.voice.
 */
export function pickSpeechVoice(voices, speechLang) {
  const target = normalizeSpeechLangTag(speechLang);
  if (!target || !Array.isArray(voices) || voices.length === 0) return null;

  const base = speechLangBase(target);
  if (!base) return null;

  const fallbacks = SPEECH_LANG_FALLBACKS[target] || [target, base];
  const preference = [target, ...fallbacks.filter(tag => tag !== target)];

  let best = null;
  let bestScore = -1;

  for (const voice of voices) {
    const voiceLang = normalizeSpeechLangTag(voice?.lang);
    if (!voiceLang || speechLangBase(voiceLang) !== base) continue;

    let rank = preference.findIndex(tag => voiceLang === tag || voiceLang.startsWith(`${tag}-`));
    if (rank < 0) {
      // Same language family but not in the preferred list (still better than English).
      rank = preference.length;
    }

    // Lower rank is better; prefer local voices as a tie-breaker.
    const score = (preference.length - rank) * 10 + (voice.localService ? 1 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = voice;
    }
  }

  return best;
}

export function isEnglishSpeechLang(speechLang) {
  return speechLangBase(speechLang) === 'en';
}

export function voiceMatchesSpeechLang(voice, speechLang) {
  if (!voice) return false;
  const targetBase = speechLangBase(speechLang);
  const voiceBase = speechLangBase(voice?.lang);
  if (!targetBase || !voiceBase) return false;
  if (targetBase === 'en') return voiceBase === 'en';
  return voiceBase === targetBase;
}

export function canSpeakWithInstalledVoice(voices, speechLang) {
  const voice = pickSpeechVoice(voices, speechLang);
  return voiceMatchesSpeechLang(voice, speechLang);
}

export function dailySentenceRevealVisibility(hasSentenceTexts) {
  const s1 = Boolean(hasSentenceTexts?.[0]);
  const s2 = Boolean(hasSentenceTexts?.[1]);
  const s3 = Boolean(hasSentenceTexts?.[2]);
  return {
    showOuter: s1,
    showNested2: s1 && s2,
    showNested3: s1 && s2 && s3
  };
}

export function shouldResetDailySentenceReveal(previousWord, nextWord) {
  return String(previousWord || '') !== String(nextWord || '');
}

export function collectSentenceRevealAnimationKeys(openFlags, fromLevel = 0) {
  const outer = Boolean(openFlags?.[0]);
  const nested2 = Boolean(openFlags?.[1]);
  const nested3 = Boolean(openFlags?.[2]);
  const start = Math.max(0, Number(fromLevel) || 0);
  const keys = [];
  if (start === 0 && !outer) return keys;
  if (start <= 0) keys.push('s1');
  if (!nested2) {
    if (start <= 0) keys.push('another2');
    return keys;
  }
  if (start <= 1) keys.push('s2');
  if (!nested3) {
    if (start <= 1) keys.push('another3');
    return keys;
  }
  if (start <= 2) keys.push('s3');
  return keys;
}
