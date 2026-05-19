const WORDS_PER_DAY = 10;
const FREQUENCY_FILE_BY_LANGUAGE = {
  'PT-BR': '/frequency-pt-br.json',
  FR: '/frequency-fr.json'
};
const SEEN_DAILY_WORDS_STORAGE_KEY = 'ten-seen-daily-words-v1';

const MODE_CONFIGS = {
  'pt-br': {
    id: 'pt-br',
    label: 'Brazilian Portuguese',
    shortLabel: 'Brazilian',
    translatorLabel: 'Portuguese',
    wordsPath: '/words.pt.json',
    sentenceKey: 'pt',
    speechLang: 'pt-BR',
    learningLang: 'PT-BR',
    ankiDeck: 'Brazilian Portuguese',
    ankiModel: 'Basic',
    htmlLang: 'pt-BR',
    flagLabel: 'Brazil'
  },
  fr: {
    id: 'fr',
    label: 'Quebec French',
    shortLabel: 'Quebec',
    translatorLabel: 'French',
    wordsPath: '/words.fr.json',
    sentenceKey: 'fr',
    speechLang: 'fr-CA',
    learningLang: 'FR',
    ankiDeck: 'French',
    ankiModel: 'Basic',
    htmlLang: 'fr-CA',
    flagLabel: 'Quebec'
  }
};

const state = {
  activeMode: 'pt-br',
  activeTab: 'translate',
  settings: {
    translateSource: MODE_CONFIGS['pt-br'].learningLang,
    translateTarget: 'EN',
    ankiDeck: MODE_CONFIGS['pt-br'].ankiDeck,
    ankiModel: MODE_CONFIGS['pt-br'].ankiModel
  },
  lastDetectedSourceLang: '',
  hasTranslatedInSession: false,
  noteConfigOpen: false,
  words: [],
  todayWords: [],
  currentWordIndex: 0,
  seenWordIndexes: new Set(),
  reviewCards: [],
  reviewDueCount: 0,
  reviewTotalCount: 0,
  reviewCurrentIndex: 0,
  reviewAnswerVisible: false,
  reviewSubmitting: false,
  frequencyByLanguage: {
    'PT-BR': [],
    FR: []
  },
  frequencyMapByLanguage: {
    'PT-BR': new Map(),
    FR: new Map()
  },
  seenDailyWordsByLanguage: {
    'PT-BR': new Set(),
    FR: new Set()
  },
  frequencyLoadedLanguages: new Set()
};

let dailyDots = [];
let applyingMode = false;

function getModeConfig(modeId = state.activeMode) {
  return MODE_CONFIGS[modeId] || MODE_CONFIGS['pt-br'];
}

function getLearningLanguage(modeId = state.activeMode) {
  return getModeConfig(modeId).learningLang;
}

function canonicalizeTranslateLanguage(value) {
  const code = String(value || '').trim().toUpperCase();
  if (code === 'EN' || code === 'EN-US' || code === 'EN-GB') return 'EN';
  if (code === 'PB' || code === 'PT' || code === 'PT-BR' || code === 'PT-PT') return 'PT-BR';
  if (code === 'FR' || code === 'FR-FR' || code === 'FR-CA') return 'FR';
  return '';
}

function displayTranslateLanguage(code) {
  const canonical = canonicalizeTranslateLanguage(code);
  if (canonical === 'EN') return 'English';
  if (canonical === 'FR') return 'French';
  if (canonical === 'PT-BR') return 'Brazilian Portuguese';
  return code || '';
}

function displayFrequencyLanguage(code) {
  const canonical = canonicalizeTranslateLanguage(code);
  if (canonical === 'FR') return 'French';
  return 'Brazilian Portuguese';
}

function updateFrequencyModeLabel() {
  const label = document.getElementById('frequency-mode-label');
  if (!label) return;
  label.textContent = `${displayFrequencyLanguage(getFrequencyLanguageForMode())} dictionary`;
}

function canonicalizeDetectedSourceLanguage(value) {
  const code = String(value || '').trim().toUpperCase();
  if (!code) return '';
  if (code === 'EN' || code === 'EN-US' || code === 'EN-GB') return 'EN';
  if (code === 'PB' || code === 'PT-BR' || code === 'PT-PT' || code === 'PT') return 'PT-BR';
  if (code === 'FR' || code === 'FR-FR' || code === 'FR-CA') return 'FR';
  return code;
}

function displayDetectedSourceLanguage(value) {
  const code = String(value || '').trim().toUpperCase();
  if (!code) return '';
  if (code === 'EN') return 'English';
  if (code === 'EN-US') return 'English (US)';
  if (code === 'EN-GB') return 'English (UK)';
  if (code === 'PB' || code === 'PT-BR') return 'Brazilian Portuguese';
  if (code === 'PT-PT') return 'European Portuguese';
  if (code === 'PT') return 'Portuguese';
  if (code === 'FR') return 'French';
  if (code === 'FR-CA') return 'French (Canada)';
  if (code === 'FR-FR') return 'French (France)';
  return code;
}

function shouldShowDetectedSourceMismatch(selectedSource, detectedSource) {
  const selectedCanonical = canonicalizeTranslateLanguage(selectedSource);
  const detectedCanonical = canonicalizeDetectedSourceLanguage(detectedSource);
  if (!selectedCanonical || !detectedCanonical) return false;
  return selectedCanonical !== detectedCanonical;
}

function normalizeTranslateDirection(source, target) {
  const learningLang = getLearningLanguage();
  const sourceLang = canonicalizeTranslateLanguage(source) || learningLang;
  let targetLang = canonicalizeTranslateLanguage(target) || 'EN';
  if (sourceLang !== 'EN' && sourceLang !== learningLang) {
    return { source: learningLang, target: 'EN' };
  }
  if (targetLang !== 'EN' && targetLang !== learningLang) targetLang = 'EN';
  if (sourceLang === targetLang) targetLang = sourceLang === 'EN' ? learningLang : 'EN';
  return { source: sourceLang, target: targetLang };
}

function toDeepLTargetLanguage(code) {
  return canonicalizeTranslateLanguage(code) || 'EN';
}

function formatError(error) {
  if (!error) return 'Something went wrong.';
  if (typeof error === 'string') return error;
  if (error.message) return error.message;
  return 'Something went wrong.';
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function htmlToText(html) {
  const div = document.createElement('div');
  div.innerHTML = String(html || '');
  return (div.textContent || '').trim();
}

function capitalizeFirstWord(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const firstLetterIndex = text.search(/\p{L}/u);
  if (firstLetterIndex < 0) return text;
  const firstLetter = text[firstLetterIndex];
  return `${text.slice(0, firstLetterIndex)}${firstLetter.toLocaleUpperCase()}${text.slice(firstLetterIndex + 1)}`;
}

function escapeAnkiQuery(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"');
}

function normalizeFrequencyWord(value) {
  return String(value || '')
    .trim()
    .toLocaleLowerCase()
    .normalize('NFC');
}

function getFrequencyLanguageForMode(modeId = state.activeMode) {
  return getModeConfig(modeId).learningLang;
}

function getSeenDailyWordsSet(language = getFrequencyLanguageForMode()) {
  if (!state.seenDailyWordsByLanguage[language]) {
    state.seenDailyWordsByLanguage[language] = new Set();
  }
  return state.seenDailyWordsByLanguage[language];
}

function loadSeenDailyWordsFromStorage() {
  const base = {
    'PT-BR': new Set(),
    FR: new Set()
  };
  try {
    const raw = localStorage.getItem(SEEN_DAILY_WORDS_STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return base;
    Object.keys(base).forEach(language => {
      const words = Array.isArray(parsed[language]) ? parsed[language] : [];
      base[language] = new Set(words.map(normalizeFrequencyWord).filter(Boolean));
    });
    return base;
  } catch (_) {
    return base;
  }
}

function persistSeenDailyWordsToStorage() {
  try {
    const payload = {};
    Object.keys(state.seenDailyWordsByLanguage).forEach(language => {
      payload[language] = Array.from(state.seenDailyWordsByLanguage[language] || []);
    });
    localStorage.setItem(SEEN_DAILY_WORDS_STORAGE_KEY, JSON.stringify(payload));
  } catch (_) {}
}

function markLearningWordSeenInFrequency(rawWord) {
  const normalized = normalizeFrequencyWord(rawWord);
  if (!normalized) return;
  const language = getFrequencyLanguageForMode();
  const seenSet = getSeenDailyWordsSet(language);
  seenSet.add(normalized);
  persistSeenDailyWordsToStorage();
  state.todayWords.forEach((entry, idx) => {
    if (entry?.word && normalizeFrequencyWord(entry.word) === normalized) {
      state.seenWordIndexes.add(idx);
    }
  });
  updateDailyDots();
  if (state.activeTab === 'frequency') {
    renderFrequencyDictionary();
  }
}

function markCurrentDailyWordSeen() {
  const word = state.todayWords[state.currentWordIndex];
  if (!word || !word.word) return;
  markLearningWordSeenInFrequency(word.word);
}

function getCurrentDailyWordFrequencyRank() {
  const word = state.todayWords[state.currentWordIndex];
  if (!word || !word.word) return null;
  const language = getFrequencyLanguageForMode();
  const rankMap = state.frequencyMapByLanguage[language];
  if (!(rankMap instanceof Map)) return null;
  return rankMap.get(normalizeFrequencyWord(word.word)) || null;
}

function getFrequencyTierLabel(rank) {
  if (!rank) return '';
  if (rank <= 500) return 'very common';
  if (rank <= 1000) return 'common';
  if (rank <= 2500) return 'mid-frequency';
  return 'less common';
}

function countWordsIgnoringPunctuation(text) {
  const matches = String(text || '').match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu);
  return matches ? matches.length : 0;
}

function getFrequencyRank(language, word) {
  const map = state.frequencyMapByLanguage[language];
  if (!(map instanceof Map)) return null;
  return map.get(normalizeFrequencyWord(word)) || null;
}

function setStatus(elementId, message, tone = '') {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = message || '';
  el.className = 'status-line';
  if (tone) el.classList.add(tone);
}

function getSentenceText(sentence) {
  if (!sentence || typeof sentence !== 'object') return '';
  const mode = getModeConfig();
  return String(sentence[mode.sentenceKey] || sentence.pt || sentence.fr || '').trim();
}

function speakText(text, button) {
  const phrase = String(text || '').trim();
  if (!phrase || !window.speechSynthesis) return;

  window.speechSynthesis.cancel();
  document.querySelectorAll('.speaking').forEach(el => el.classList.remove('speaking'));

  const utt = new SpeechSynthesisUtterance(phrase);
  utt.lang = getModeConfig().speechLang;
  utt.rate = 0.85;
  if (button) {
    utt.onstart = () => button.classList.add('speaking');
    utt.onend = utt.onerror = () => button.classList.remove('speaking');
  }
  window.speechSynthesis.speak(utt);
}

function dateKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function hashDate(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  }
  return Math.abs(h);
}

function seededShuffle(arr, seed) {
  const copy = [...arr];
  let s = seed;
  const next = () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0x100000000;
  };
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function updateDateLabel() {
  const now = new Date();
  document.getElementById('date-label').textContent =
    now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function buildDailyDots() {
  const dotsEl = document.getElementById('dots');
  dotsEl.innerHTML = '';
  dailyDots = state.todayWords.map((_, index) => {
    const dot = document.createElement('button');
    dot.className = 'dot';
    dot.type = 'button';
    dot.title = `Go to card ${index + 1}`;
    dot.addEventListener('click', () => gotoDailyWord(index));
    dotsEl.appendChild(dot);
    return dot;
  });
  updateDailyDots();
}

function updateDailyDots() {
  dailyDots.forEach((dot, index) => {
    dot.className = 'dot' + (index === state.currentWordIndex ? ' active' : state.seenWordIndexes.has(index) ? ' seen' : '');
  });
}

function renderDailyWord(index) {
  const word = state.todayWords[index];
  if (!word) {
    document.getElementById('word').textContent = 'Daily words unavailable';
    document.getElementById('translation').textContent = 'Word list could not be loaded.';
    document.getElementById('daily-frequency-rank').textContent = '';
    document.getElementById('s1-l2').textContent = '';
    document.getElementById('s1-en').textContent = '';
    document.getElementById('s2-l2').textContent = '';
    document.getElementById('s2-en').textContent = '';
    document.getElementById('counter').textContent = '0 / 0';
    document.getElementById('prev-btn').disabled = true;
    document.getElementById('next-btn').disabled = true;
    document.getElementById('speak-btn').disabled = true;
    document.getElementById('s1-speak-btn').disabled = true;
    document.getElementById('s2-speak-btn').disabled = true;
    return;
  }

  state.currentWordIndex = index;
  if (state.activeTab === 'daily') {
    markCurrentDailyWordSeen();
  }

  const firstSentence = word.sentences && word.sentences[0] ? word.sentences[0] : {};
  const secondSentence = word.sentences && word.sentences[1] ? word.sentences[1] : {};
  const firstSentenceText = getSentenceText(firstSentence);
  const secondSentenceText = getSentenceText(secondSentence);

  document.getElementById('word').textContent = word.word;
  document.getElementById('translation').textContent = word.translation;
  const rank = getCurrentDailyWordFrequencyRank();
  document.getElementById('daily-frequency-rank').textContent = rank
    ? `Frequency rank #${rank} (${getFrequencyTierLabel(rank)})`
    : 'Frequency rank unavailable';
  document.getElementById('s1-l2').textContent = firstSentenceText;
  document.getElementById('s1-en').textContent = firstSentence.en || '';
  document.getElementById('s2-l2').textContent = secondSentenceText;
  document.getElementById('s2-en').textContent = secondSentence.en || '';
  document.getElementById('counter').textContent = `${index + 1} / ${state.todayWords.length}`;
  document.getElementById('prev-btn').disabled = index === 0;
  document.getElementById('next-btn').disabled = index === state.todayWords.length - 1;
  document.getElementById('speak-btn').disabled = !word.word;
  document.getElementById('s1-speak-btn').disabled = !firstSentenceText;
  document.getElementById('s2-speak-btn').disabled = !secondSentenceText;
  updateDailyDots();
}

function gotoDailyWord(index) {
  if (!state.todayWords.length) return;
  const bounded = Math.max(0, Math.min(index, state.todayWords.length - 1));
  renderDailyWord(bounded);
  window.speechSynthesis?.cancel();
  document.querySelectorAll('.speaking').forEach(el => el.classList.remove('speaking'));
}

function showDailyUnavailable(reason) {
  state.words = [];
  state.todayWords = [];
  state.currentWordIndex = 0;
  state.seenWordIndexes = new Set();
  document.getElementById('dots').innerHTML = '';
  dailyDots = [];
  renderDailyWord(0);
  const poolInfo = document.getElementById('pool-info');
  poolInfo.textContent = reason;
  poolInfo.classList.add('warning');
  setStatus('daily-save-status', 'Daily list is unavailable until the active word list loads again.', 'error');
}

function updateModeToggleUi() {
  const mode = getModeConfig();
  document.querySelectorAll('.mode-toggle-btn').forEach(button => {
    const isActive = button.dataset.mode === mode.id;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
}

function updateLanguageCopy() {
  const mode = getModeConfig();
  const backLabel = document.getElementById('card-back-label');
  const backInput = document.getElementById('card-back-input');
  const sentenceLabel = document.getElementById('sentence-language-label');
  const fromLabel = document.getElementById('translate-from-label');
  if (backLabel) backLabel.textContent = `Back (${mode.translatorLabel})`;
  if (backInput) backInput.placeholder = `${mode.translatorLabel} translation`;
  if (sentenceLabel) sentenceLabel.textContent = `${mode.translatorLabel} in use`;
  if (fromLabel && !state.lastDetectedSourceLang) fromLabel.textContent = mode.shortLabel;
  document.documentElement.lang = mode.htmlLang;
}

async function setLearningMode(modeId, options = {}) {
  const mode = getModeConfig(modeId);
  const resetTranslate = options.resetTranslate !== false;
  if (applyingMode || (state.activeMode === mode.id && !options.force)) return;
  applyingMode = true;
  try {
    window.speechSynthesis?.cancel();
    document.querySelectorAll('.speaking').forEach(el => el.classList.remove('speaking'));

    state.activeMode = mode.id;
    sessionStorage.setItem('ten-active-mode', mode.id);
    state.settings.translateSource = mode.learningLang;
    state.settings.translateTarget = 'EN';
    state.settings.ankiDeck = mode.ankiDeck;
    state.settings.ankiModel = mode.ankiModel;
    state.lastDetectedSourceLang = '';

    updateModeToggleUi();
    updateLanguageCopy();
    updateFrequencyModeLabel();
    fillSettingsInputs();

    if (resetTranslate) clearTranslateDraft();

    try {
      await initDailyWords();
      try {
        await ensureFrequencyLanguageLoaded(mode.learningLang);
      } catch (_) {}
      renderDailyWord(state.currentWordIndex);
      setStatus('daily-save-status', '');
    } catch (error) {
      showDailyUnavailable(formatError(error));
    }

    if (state.activeTab === 'frequency') {
      clearFrequencySearch();
      await loadFrequencyTabData();
    }

    if (state.activeTab === 'review') {
      await loadReviewFromAnki({ refreshTotal: true });
    }
  } finally {
    applyingMode = false;
  }
}

function fillSettingsInputs() {
  const direction = normalizeTranslateDirection(state.settings.translateSource, state.settings.translateTarget);
  state.settings.translateSource = direction.source;
  state.settings.translateTarget = direction.target;
  updateTranslateDirectionUi();
}

function persistSettingsFromInputs() {
  const direction = normalizeTranslateDirection(state.settings.translateSource, state.settings.translateTarget);
  state.settings.translateSource = direction.source;
  state.settings.translateTarget = direction.target;
  return state.settings;
}

async function translateText(text, source, target) {
  const cleanText = String(text || '').trim();
  if (!cleanText) throw new Error('Enter text before translating.');
  const sourceLang = canonicalizeTranslateLanguage(source);
  const targetLang = toDeepLTargetLanguage(target);
  const payload = {
    text: cleanText,
    sourceLang,
    targetLang
  };

  const response = await fetch('/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const details = await extractErrorDetails(response);
    throw new Error(`Translate request failed (${response.status})${details ? `: ${details}` : '.'}`);
  }

  const body = await response.json();
  if (!body || typeof body.translatedText !== 'string') {
    throw new Error('Unexpected translate response.');
  }
  return {
    translatedText: body.translatedText.trim(),
    detectedSourceLang: String(body.detectedSourceLang || '').trim()
  };
}

async function extractErrorDetails(response) {
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  try {
    if (contentType.includes('application/json')) {
      const body = await response.json();
      if (body && typeof body.error === 'string' && body.error.trim()) return body.error.trim();
      if (body && typeof body.message === 'string' && body.message.trim()) return body.message.trim();
      return '';
    }

    const text = (await response.text()).trim();
    return text ? text.slice(0, 240) : '';
  } catch (_) {
    return '';
  }
}

async function ankiInvoke(_settings, action, params = {}) {
  const response = await fetch('/api/anki', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, version: 6, params })
  });

  if (!response.ok) {
    const details = await extractErrorDetails(response);
    throw new Error(`AnkiConnect request failed (${response.status})${details ? `: ${details}` : '.'}`);
  }

  const body = await response.json();
  if (body && body.error) throw new Error(body.error);
  return body ? body.result : null;
}

async function addNoteToAnki({ front, back, context }, statusElementId) {
  const settings = persistSettingsFromInputs();
  const cleanFront = capitalizeFirstWord(front);
  const cleanBack = capitalizeFirstWord(back);
  const cleanContext = String(context || '').trim();

  if (!cleanFront || !cleanBack) {
    setStatus(statusElementId, 'Front and back are required.', 'error');
    return false;
  }

  setStatus(statusElementId, 'Sending to AnkiConnect...');

  try {
    const contextHtml = cleanContext
      ? `<br><br><em>${escapeHtml(cleanContext).replace(/\n/g, '<br>')}</em>`
      : '';

    await ankiInvoke(settings, 'addNote', {
      note: {
        deckName: settings.ankiDeck,
        modelName: settings.ankiModel,
        fields: {
          Front: escapeHtml(cleanFront),
          Back: `${escapeHtml(cleanBack)}${contextHtml}`
        },
        options: { allowDuplicate: false },
        tags: ['ten', 'ten-pwa']
      }
    });

    setStatus(statusElementId, 'Card sent to AnkiConnect.', 'success');
    return true;
  } catch (error) {
    setStatus(statusElementId, formatError(error), 'error');
    return false;
  }
}

async function removeNoteFromAnki (noteId) {
  const settings = persistSettingsFromInputs();
  await ankiInvoke(settings, 'deleteNotes', {"notes": [noteId]})
}

function mapCardInfoToReviewCard(info) {
  const fields = info && info.fields && typeof info.fields === 'object' ? info.fields : {};
  const frontRaw = fields.Front?.value ?? info.question ?? '';
  const backRaw = fields.Back?.value ?? info.answer ?? '';
  const contextRaw =
    fields.Context?.value ??
    fields.Example?.value ??
    '';

  return {
    cardId: Number(info.cardId),
    noteId: Number(info.note),
    due: Number(info.due) || 0,
    front: htmlToText(frontRaw),
    back: htmlToText(backRaw),
    context: htmlToText(contextRaw)
  };
}

function getCurrentReviewCard() {
  if (!state.reviewCards.length) return null;
  if (state.reviewCurrentIndex < 0) state.reviewCurrentIndex = 0;
  if (state.reviewCurrentIndex >= state.reviewCards.length) state.reviewCurrentIndex = 0;
  return state.reviewCards[state.reviewCurrentIndex];
}

function removeCurrentReviewCard() {
  const card = getCurrentReviewCard();
  if (!card) return null;
  state.reviewCards.splice(state.reviewCurrentIndex, 1);
  if (state.reviewCurrentIndex >= state.reviewCards.length) {
    state.reviewCurrentIndex = Math.max(0, state.reviewCards.length - 1);
  }
  state.reviewAnswerVisible = false;
  state.reviewDueCount = Math.max(0, state.reviewDueCount - 1);
  return card;
}

function removeReviewCardsByNoteId(noteId) {
  const before = state.reviewCards.length;
  state.reviewCards = state.reviewCards.filter(card => card.noteId !== noteId);
  const removed = before - state.reviewCards.length;
  if (removed > 0) {
    state.reviewDueCount = Math.max(0, state.reviewDueCount - removed);
    if (state.reviewCurrentIndex >= state.reviewCards.length) {
      state.reviewCurrentIndex = Math.max(0, state.reviewCards.length - 1);
    }
    state.reviewAnswerVisible = false;
  }
  return removed;
}

function renderReview() {
  const dueCount = state.reviewDueCount;
  document.getElementById('review-due-count').textContent = String(dueCount);
  document.getElementById('review-total-count').textContent = String(state.reviewTotalCount);

  const empty = document.getElementById('review-empty');
  const cardPanel = document.getElementById('review-card-panel');
  const answerWrap = document.getElementById('review-answer-wrap');
  const gradeRow = document.getElementById('review-grade-row');
  const showAnswerBtn = document.getElementById('review-show-answer-btn');

  const card = getCurrentReviewCard();
  if (!card) {
    empty.classList.remove('hidden');
    cardPanel.classList.add('hidden');
    showAnswerBtn.classList.remove('hidden');
    answerWrap.classList.add('hidden');
    gradeRow.classList.add('hidden');
    return;
  }

  document.getElementById('review-front-text').textContent = card.front;
  document.getElementById('review-back-text').textContent = card.back;

  const contextEl = document.getElementById('review-context');
  contextEl.textContent = card.context;
  contextEl.classList.toggle('hidden', !card.context);

  showAnswerBtn.classList.toggle('hidden', state.reviewAnswerVisible);
  answerWrap.classList.toggle('hidden', !state.reviewAnswerVisible);
  gradeRow.classList.toggle('hidden', !state.reviewAnswerVisible);

  empty.classList.add('hidden');
  cardPanel.classList.remove('hidden');
}

async function loadReviewFromAnki(options = {}) {
  const refreshTotal = Boolean(options.refreshTotal) || state.reviewTotalCount <= 0;
  const settings = persistSettingsFromInputs();
  const deck = String(settings.ankiDeck || '').trim();
  if (!deck) {
    setStatus('review-status', 'Set a valid Anki deck in mode settings.', 'error');
    state.reviewCards = [];
    state.reviewDueCount = 0;
    state.reviewTotalCount = 0;
    state.reviewCurrentIndex = 0;
    state.reviewAnswerVisible = false;
    renderReview();
    return;
  }

  setStatus('review-status', 'Loading due cards from Anki...');

  try {
    const escapedDeck = escapeAnkiQuery(deck);
    const baseQuery = `deck:"${escapedDeck}"`;

    const [dueIds, totalIds] = await Promise.all([
      ankiInvoke(settings, 'findCards', { query: `${baseQuery} is:due` }),
      refreshTotal ? ankiInvoke(settings, 'findCards', { query: baseQuery }) : Promise.resolve(null)
    ]);

    const dueList = Array.isArray(dueIds) ? dueIds : [];
    const totalList = Array.isArray(totalIds) ? totalIds : null;

    let cards = [];
    if (dueList.length) {
      const infos = await ankiInvoke(settings, 'cardsInfo', { cards: dueList });
      cards = (Array.isArray(infos) ? infos : [])
        .map(mapCardInfoToReviewCard)
        .filter(card => Number.isFinite(card.cardId))
        .sort((a, b) => a.due - b.due);
    }

    state.reviewCards = cards;
    state.reviewDueCount = cards.length;
    if (totalList) {
      state.reviewTotalCount = totalList.length;
    } else {
      state.reviewTotalCount = Math.max(state.reviewTotalCount, cards.length);
    }
    state.reviewCurrentIndex = 0;
    state.reviewAnswerVisible = false;

    renderReview();
    setStatus('review-status', cards.length ? `Loaded ${cards.length} due card(s) from Anki.` : 'No due cards right now.');
  } catch (error) {
    const message = formatError(error);
    const unsupportedAnswerCards = /unsupported action|unknown action|answerCards/i.test(message);
    if (unsupportedAnswerCards) {
      setStatus('review-status', 'Your AnkiConnect does not support answerCards. Please update AnkiConnect.', 'error');
    } else {
      setStatus('review-status', message, 'error');
    }
    state.reviewCards = [];
    state.reviewDueCount = 0;
    state.reviewCurrentIndex = 0;
    state.reviewAnswerVisible = false;
    renderReview();
  }
}

async function submitReviewGrade(grade) {
  const easeMap = { again: 1, hard: 2, good: 3, easy: 4 };
  const ease = easeMap[grade];
  const card = getCurrentReviewCard();
  if (!card || !ease || state.reviewSubmitting) return;

  const settings = persistSettingsFromInputs();
  setStatus('review-status', `Submitting "${grade}" to Anki...`);
  state.reviewSubmitting = true;

  try {
    await ankiInvoke(settings, 'answerCards', {
      answers: [{ cardId: card.cardId, ease }]
    });

    removeCurrentReviewCard();
    renderReview();
    const remaining = state.reviewDueCount;
    if (remaining > 0) {
      setStatus('review-status', `Saved "${grade}". ${remaining} due card(s) left in queue.`, 'success');
    } else {
      setStatus('review-status', `Saved "${grade}". Queue complete. Tap refresh to re-sync.`, 'success');
    }
  } catch (error) {
    const message = formatError(error);
    const unsupportedAnswerCards = /unsupported action|unknown action|answerCards/i.test(message);
    if (unsupportedAnswerCards) {
      setStatus('review-status', 'answerCards is unavailable in your AnkiConnect version. Update the add-on.', 'error');
    } else {
      setStatus('review-status', message, 'error');
    }
  } finally {
    state.reviewSubmitting = false;
  }
}

async function ensureFrequencyLanguageLoaded(language) {
  if (state.frequencyLoadedLanguages.has(language)) return;
  const path = FREQUENCY_FILE_BY_LANGUAGE[language];
  if (!path) throw new Error(`No frequency file configured for ${language}.`);
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path} (${response.status}).`);
  }
  const words = await response.json();
  if (!Array.isArray(words) || !words.length) {
    throw new Error(`${path} is empty.`);
  }
  const entries = words.map((word, index) => ({
    rank: index + 1,
    word: String(word || '').trim(),
    normalizedWord: normalizeFrequencyWord(word)
  })).filter(entry => entry.word && entry.normalizedWord);
  state.frequencyByLanguage[language] = entries;
  state.frequencyMapByLanguage[language] = new Map(entries.map(entry => [entry.normalizedWord, entry.rank]));
  state.frequencyLoadedLanguages.add(language);
}

function getFrequencySearchQuery() {
  const input = document.getElementById('frequency-search-input');
  return input ? input.value.trim() : '';
}

function clearFrequencySearch() {
  const input = document.getElementById('frequency-search-input');
  if (input) input.value = '';
  updateFrequencySearchHint('', 0, false);
}

function parseFrequencySearchQuery(raw) {
  const query = String(raw || '').trim();
  if (!query) return { type: 'none' };
  const rankQuery = query.replace(/^#/, '');
  if (/^\d+$/.test(rankQuery)) {
    return { type: 'rank', rankDigits: rankQuery };
  }
  return { type: 'word', normalized: normalizeFrequencyWord(query) };
}

function entryMatchesFrequencySearch(entry, parsed) {
  if (!parsed || parsed.type === 'none') return true;
  if (parsed.type === 'rank') {
    return String(entry.rank).startsWith(parsed.rankDigits);
  }
  if (parsed.type === 'word') {
    return entry.normalizedWord.includes(parsed.normalized);
  }
  return true;
}

function updateFrequencySearchHint(matchCount, totalCount, hasQuery) {
  const hintEl = document.getElementById('frequency-search-hint');
  if (!hintEl) return;
  if (!hasQuery) {
    hintEl.textContent = '';
    hintEl.classList.add('hidden');
    return;
  }
  hintEl.classList.remove('hidden');
  if (matchCount === 0) {
    hintEl.textContent = 'No matches';
    return;
  }
  hintEl.textContent = matchCount === totalCount
    ? `${matchCount} entries`
    : `${matchCount} of ${totalCount} entries`;
}

function renderFrequencyDictionary() {
  const listEl = document.getElementById('frequency-list');
  const totalEl = document.getElementById('frequency-total-count');
  const seenEl = document.getElementById('frequency-seen-count');
  if (!listEl || !totalEl || !seenEl) return;

  const language = getFrequencyLanguageForMode();
  const entries = Array.isArray(state.frequencyByLanguage[language]) ? state.frequencyByLanguage[language] : [];
  const seenSet = getSeenDailyWordsSet(language);
  const parsed = parseFrequencySearchQuery(getFrequencySearchQuery());
  const hasQuery = parsed.type !== 'none';
  let seenCount = 0;
  let matchCount = 0;
  const fragment = document.createDocumentFragment();

  entries.forEach(entry => {
    if (!entryMatchesFrequencySearch(entry, parsed)) return;
    matchCount++;
    const row = document.createElement('div');
    const seen = seenSet.has(entry.normalizedWord);
    if (seen) seenCount++;
    row.className = `frequency-item${seen ? ' seen' : ''}`;

    const rank = document.createElement('span');
    rank.className = 'frequency-rank';
    rank.textContent = `#${entry.rank}`;

    const word = document.createElement('span');
    word.className = 'frequency-word';
    word.textContent = entry.word;

    row.append(rank, word);
    fragment.appendChild(row);
  });

  listEl.innerHTML = '';
  listEl.appendChild(fragment);
  totalEl.textContent = String(entries.length);
  seenEl.textContent = String(seenCount);
  updateFrequencySearchHint(matchCount, entries.length, hasQuery);
}

async function loadFrequencyTabData() {
  setStatus('frequency-status', 'Loading frequency dictionary...');
  const language = getFrequencyLanguageForMode();
  try {
    await ensureFrequencyLanguageLoaded(language);
    renderFrequencyDictionary();
    setStatus('frequency-status', `Showing ${displayFrequencyLanguage(language)} frequency dictionary.`, 'success');
  } catch (error) {
    renderFrequencyDictionary();
    setStatus('frequency-status', formatError(error), 'error');
  }
}

function getLearningWordFromSingleTranslation(inputText, translatedText, sourceLang, targetLang) {
  const learningLanguage = getFrequencyLanguageForMode();
  const sourceCanonical = canonicalizeTranslateLanguage(sourceLang);
  const targetCanonical = canonicalizeTranslateLanguage(targetLang);
  if (sourceCanonical === learningLanguage && countWordsIgnoringPunctuation(inputText) === 1) {
    return inputText;
  }
  if (targetCanonical === learningLanguage && countWordsIgnoringPunctuation(translatedText) === 1) {
    return translatedText;
  }
  return null;
}

function updateTranslateFrequencyRank(inputText, translatedText, sourceLang, targetLang) {
  const outputEl = document.getElementById('translate-frequency-rank');
  if (!outputEl) return;

  const learningWord = getLearningWordFromSingleTranslation(inputText, translatedText, sourceLang, targetLang);
  if (!learningWord) {
    outputEl.textContent = '';
    outputEl.className = 'status-line';
    return;
  }

  markLearningWordSeenInFrequency(learningWord);

  const learningLanguage = getFrequencyLanguageForMode();
  const sourceCanonical = canonicalizeTranslateLanguage(sourceLang);
  const label = sourceCanonical === learningLanguage ? 'Input' : 'Result';
  const rank = getFrequencyRank(learningLanguage, learningWord);

  if (rank) {
    outputEl.textContent = `${label} frequency rank #${rank} (${getFrequencyTierLabel(rank)})`;
    outputEl.className = 'status-line success';
  } else {
    outputEl.textContent = `${label} frequency rank unavailable`;
    outputEl.className = 'status-line';
  }
}

function setActiveTab(tabId) {
  if (!tabId) return;
  state.activeTab = tabId;
  document.querySelectorAll('.top-tab').forEach(button => {
    const isActive = button.dataset.tab === tabId;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-selected', String(isActive));
  });
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `tab-${tabId}`);
  });
  if (tabId === 'daily') {
    markCurrentDailyWordSeen();
    updateDailyDots();
    renderFrequencyDictionary();
  }
  if (tabId === 'review') {
    loadReviewFromAnki();
  }
  if (tabId === 'frequency') {
    loadFrequencyTabData();
  }
}

function isTypingContext() {
  const active = document.activeElement;
  if (!active) return false;
  const tag = active.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || active.isContentEditable;
}

function getDraftFields() {
  return {
    front: capitalizeFirstWord(document.getElementById('card-front-input').value),
    back: capitalizeFirstWord(document.getElementById('card-back-input').value),
    context: document.getElementById('card-context-input').value.trim()
  };
}

function setNoteConfigOpen(open) {
  const draftCard = document.getElementById('flashcard-draft-card');
  const configureBtn = document.getElementById('toggle-note-config-btn');
  const canConfigure = state.hasTranslatedInSession;
  state.noteConfigOpen = canConfigure ? Boolean(open) : false;
  if (draftCard) {
    draftCard.classList.toggle('hidden', !state.noteConfigOpen);
  }
  if (configureBtn) {
    configureBtn.disabled = !canConfigure;
    configureBtn.textContent = state.noteConfigOpen ? 'Hide note config' : 'Configure note';
  }
}

function updateTranslateResultUi() {
  const resultWrap = document.getElementById('translate-result-wrap');
  const quickAddBtn = document.getElementById('quick-add-card-btn');
  if (resultWrap) {
    resultWrap.classList.toggle('hidden', !state.hasTranslatedInSession);
  }
  if (quickAddBtn) {
    quickAddBtn.disabled = !state.hasTranslatedInSession;
  }
  setNoteConfigOpen(state.noteConfigOpen);
}

function updateTranslateDirectionUi() {
  const fromSide = document.getElementById('translate-from-side');
  const fromCaption = document.getElementById('translate-from-caption');
  const fromLabel = document.getElementById('translate-from-label');
  const toLabel = document.getElementById('translate-to-label');
  if (!fromLabel || !toLabel || !fromCaption || !fromSide) return;

  const selectedSourceLabel = displayTranslateLanguage(state.settings.translateSource);
  const selectedTargetLabel = displayTranslateLanguage(state.settings.translateTarget);
  const showMismatch = shouldShowDetectedSourceMismatch(state.settings.translateSource, state.lastDetectedSourceLang);
  if (showMismatch) {
    const detectedDisplay = displayDetectedSourceLanguage(state.lastDetectedSourceLang);
    fromCaption.textContent = 'Auto-detected';
    fromLabel.textContent = `${detectedDisplay} (selected ${selectedSourceLabel})`;
    fromSide.classList.add('detected-mismatch');
  } else {
    fromCaption.textContent = 'From';
    fromLabel.textContent = selectedSourceLabel;
    fromSide.classList.remove('detected-mismatch');
  }
  toLabel.textContent = selectedTargetLabel;
}

function swapTranslateDirection() {
  const learningLang = getLearningLanguage();
  const nextSource = state.settings.translateTarget === 'EN' ? 'EN' : learningLang;
  const nextTarget = nextSource === 'EN' ? learningLang : 'EN';
  state.settings.translateSource = nextSource;
  state.settings.translateTarget = nextTarget;
  state.lastDetectedSourceLang = '';
  updateTranslateDirectionUi();
}

function clearTranslateDraft() {
  const translateInput = document.getElementById('translate-input');
  translateInput.value = '';
  document.getElementById('translate-result-text').textContent = '';
  document.getElementById('card-front-input').value = '';
  document.getElementById('card-back-input').value = '';
  document.getElementById('card-context-input').value = '';
  state.lastDetectedSourceLang = '';
  state.hasTranslatedInSession = false;
  setStatus('translate-status', '');
  setStatus('translate-frequency-rank', '');
  setStatus('quick-add-status', '');
  setStatus('card-save-status', '');
  updateTranslateResultUi();
  translateInput.focus({ preventScroll: true });
  translateInput.setSelectionRange(0, 0);
}

function setupFrequencyEvents() {
  const searchInput = document.getElementById('frequency-search-input');
  if (!searchInput) return;
  searchInput.addEventListener('input', () => {
    renderFrequencyDictionary();
  });
  searchInput.addEventListener('search', () => {
    renderFrequencyDictionary();
  });
}

function setupTabEvents() {
  document.querySelectorAll('.top-tab').forEach(button => {
    button.addEventListener('click', () => setActiveTab(button.dataset.tab));
  });
}

function setupModeEvents() {
  document.querySelectorAll('.mode-toggle-btn').forEach(button => {
    button.addEventListener('click', async () => {
      const nextMode = button.dataset.mode;
      if (!nextMode || nextMode === state.activeMode) return;
      await setLearningMode(nextMode, { resetTranslate: true });
    });
  });
}

function setupDailyEvents() {
  document.getElementById('prev-btn').addEventListener('click', () => {
    gotoDailyWord(state.currentWordIndex - 1);
  });
  document.getElementById('next-btn').addEventListener('click', () => {
    gotoDailyWord(state.currentWordIndex + 1);
  });
  document.getElementById('speak-btn').addEventListener('click', () => {
    const word = state.todayWords[state.currentWordIndex];
    speakText(word ? word.word : '', document.getElementById('speak-btn'));
  });
  document.getElementById('s1-speak-btn').addEventListener('click', () => {
    const word = state.todayWords[state.currentWordIndex];
    const text = word && word.sentences && word.sentences[0] ? getSentenceText(word.sentences[0]) : '';
    speakText(text, document.getElementById('s1-speak-btn'));
  });
  document.getElementById('s2-speak-btn').addEventListener('click', () => {
    const word = state.todayWords[state.currentWordIndex];
    const text = word && word.sentences && word.sentences[1] ? getSentenceText(word.sentences[1]) : '';
    speakText(text, document.getElementById('s2-speak-btn'));
  });

  document.getElementById('save-daily-card-btn').addEventListener('click', async () => {
    const word = state.todayWords[state.currentWordIndex];
    if (!word) {
      setStatus('daily-save-status', 'No daily card available to add.', 'error');
      return;
    }

    const context = (word.sentences || [])
      .map(sentence => getSentenceText(sentence))
      .filter(Boolean)
      .join('\n');

    const added = await addNoteToAnki(
      { front: word.translation, back: word.word, context },
      'daily-save-status'
    );
    if (added && state.activeTab === 'frequency') {
      renderFrequencyDictionary();
    }
  });
}

function setupDailyKeyboard() {
  document.addEventListener('keydown', event => {
    if (state.activeTab !== 'daily' || isTypingContext()) return;
    if (!state.todayWords.length) return;

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      gotoDailyWord(state.currentWordIndex + 1);
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      gotoDailyWord(state.currentWordIndex - 1);
    }
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      const word = state.todayWords[state.currentWordIndex];
      speakText(word ? word.word : '', document.getElementById('speak-btn'));
    }
  });
}

function setupTranslateEvents() {
  document.getElementById('swap-languages-btn').addEventListener('click', () => {
    swapTranslateDirection();
  });
  document.getElementById('clear-translate-btn').addEventListener('click', () => {
    clearTranslateDraft();
  });

  document.getElementById('translate-btn').addEventListener('click', async () => {
    const text = document.getElementById('translate-input').value.trim();
    if (!text) {
      setStatus('translate-status', 'Enter text before translating.', 'error');
      return;
    }
    if (!navigator.onLine) {
      setStatus('translate-status', 'Offline: translation requires internet access.', 'error');
      return;
    }

    const settings = persistSettingsFromInputs();
    const source = settings.translateSource;
    const target = settings.translateTarget;
    const translateBtn = document.getElementById('translate-btn');
    translateBtn.disabled = true;
    state.lastDetectedSourceLang = '';
    updateTranslateDirectionUi();
    setStatus('translate-status', '');

    try {
      const result = await translateText(text, source, target);
      const learningLanguage = getFrequencyLanguageForMode();
      try {
        await ensureFrequencyLanguageLoaded(learningLanguage);
      } catch (_) {}
      state.lastDetectedSourceLang = result.detectedSourceLang;
      updateTranslateDirectionUi();
      document.getElementById('translate-result-text').textContent = result.translatedText;
      const englishText = target === 'EN' ? result.translatedText : text;
      const translatedLearningText = target === 'EN' ? text : result.translatedText;
      document.getElementById('card-front-input').value = capitalizeFirstWord(englishText);
      document.getElementById('card-back-input').value = capitalizeFirstWord(translatedLearningText);
      document.getElementById('card-context-input').value = text.split(/\s+/).length > 1 ? text : '';
      state.hasTranslatedInSession = true;
      setStatus('translate-status', '');
      updateTranslateFrequencyRank(text, result.translatedText, source, target);
      setStatus('quick-add-status', '');
      updateTranslateResultUi();
    } catch (error) {
      setStatus('translate-status', formatError(error), 'error');
      setStatus('translate-frequency-rank', '');
    } finally {
      translateBtn.disabled = false;
    }
  });

  document.getElementById('quick-add-card-btn').addEventListener('click', async () => {
    if (!state.hasTranslatedInSession) return;
    const draft = getDraftFields();
    await addNoteToAnki(draft, 'quick-add-status');
  });

  document.getElementById('toggle-note-config-btn').addEventListener('click', () => {
    setNoteConfigOpen(!state.noteConfigOpen);
  });

  document.getElementById('save-card-btn').addEventListener('click', async () => {
    const draft = getDraftFields();
    await addNoteToAnki(draft, 'card-save-status');
  });

  document.getElementById('add-anki-btn').addEventListener('click', async () => {
    const draft = getDraftFields();
    const ok = await addNoteToAnki(draft, 'card-save-status');
    if (ok) {
      setActiveTab('review');
    }
  });
}

function setupReviewEvents() {
  document.getElementById('review-show-answer-btn').addEventListener('click', () => {
    if (!getCurrentReviewCard()) return;
    state.reviewAnswerVisible = true;
    renderReview();
  });

  document.getElementById('review-refresh-btn').addEventListener('click', () => {
    loadReviewFromAnki({ refreshTotal: true });
  });

  document.querySelectorAll('#review-grade-row button[data-grade]').forEach(button => {
    button.addEventListener('click', () => {
      submitReviewGrade(button.dataset.grade);
    });
  });

  document.getElementById('review-card-delete').addEventListener('click', async () => {
    const card = getCurrentReviewCard();
    if (!card || state.reviewSubmitting) return;

    setStatus('review-status', 'Deleting note from Anki...');
    state.reviewSubmitting = true;
    try {
      await removeNoteFromAnki(card.noteId);
      const removed = removeReviewCardsByNoteId(card.noteId);
      const totalReduction = removed > 0 ? removed : 1;
      state.reviewTotalCount = Math.max(0, state.reviewTotalCount - totalReduction);
      renderReview();
      if (state.reviewDueCount > 0) {
        setStatus('review-status', 'Deleted note from Anki.', 'success');
      } else {
        setStatus('review-status', 'Deleted note from Anki. Queue complete. Tap refresh to re-sync.', 'success');
      }
    } catch (error) {
      setStatus('review-status', formatError(error), 'error');
    } finally {
      state.reviewSubmitting = false;
    }
  });
}

async function initDailyWords() {
  const mode = getModeConfig();
  const response = await fetch(mode.wordsPath);
  if (!response.ok) throw new Error(`Failed to load ${mode.wordsPath} (${response.status}).`);
  const words = await response.json();
  if (!Array.isArray(words) || !words.length) throw new Error(`${mode.wordsPath} is empty.`);

  state.words = words;
  const seed = hashDate(dateKey());
  state.todayWords = seededShuffle(words, seed).slice(0, WORDS_PER_DAY);
  state.currentWordIndex = 0;
  const seenSet = getSeenDailyWordsSet(getFrequencyLanguageForMode());
  state.seenWordIndexes = new Set(
    state.todayWords
      .map((entry, idx) => seenSet.has(normalizeFrequencyWord(entry.word)) ? idx : -1)
      .filter(idx => idx >= 0)
  );
  buildDailyDots();
  renderDailyWord(0);

  const totalDays = Math.floor(words.length / WORDS_PER_DAY);
  const poolInfo = document.getElementById('pool-info');
  poolInfo.textContent = `~${totalDays} day${totalDays !== 1 ? 's' : ''} left in ${mode.flagLabel} pool`;
  poolInfo.classList.toggle('warning', totalDays <= 7);
}

async function init() {
  updateDateLabel();
  state.seenDailyWordsByLanguage = loadSeenDailyWordsFromStorage();
  const savedMode = sessionStorage.getItem('ten-active-mode');
  if (savedMode && MODE_CONFIGS[savedMode]) {
    state.activeMode = savedMode;
  }
  setupTabEvents();
  setupModeEvents();
  setupDailyEvents();
  setupDailyKeyboard();
  setupTranslateEvents();
  setupFrequencyEvents();
  setupReviewEvents();
  updateFrequencyModeLabel();
  updateTranslateResultUi();
  setNoteConfigOpen(false);
  await setLearningMode(state.activeMode, { force: true, resetTranslate: false });

  renderReview();
  document.body.classList.add('ready');

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

init().catch(() => {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('error').textContent = 'Failed to initialize app.';
  document.getElementById('error').style.display = 'flex';
});
