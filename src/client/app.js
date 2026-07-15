import {
  buildNotLearnedFrozenPool,
  canonicalizeTranslateLanguage,
  defaultTranslateDirection,
  extractSingleLearningWord,
  formatTranslateFrequencyRank,
  frequencyEntryMatchesFilter,
  frequencyListTotal,
  getFrequencyTierLabel,
  isReviewGradeButtonsDisabled,
  learningLangFromModeId,
  modeIdFromLearningLang,
  nextFrequencyFilter,
  resolveStartupTab,
  shouldShowHeaderAddLanguageButton,
  shouldShowPoolDaysFooter,
  shouldShowSettingsAddLanguageButton
} from './ten-logic.js';
import {
  computePoolDaysLeft,
  countUnseenPoolWords,
  formatPoolDaysLabel,
  pickDailyWords,
  resolveDailyWordsFromAssignment,
  WORDS_PER_DAY
} from './daily-pool.js';

const FREQUENCY_FILE_BY_LANGUAGE = {
  'PT-BR': '/frequency-pt-br.json',
  FR: '/frequency-fr.json'
};
const SEEN_DAILY_WORDS_STORAGE_KEY = 'ten-seen-daily-words-v1';
const ACTIVE_MODE_STORAGE_KEY = 'ten-active-mode';
const USER_STORAGE_KEY = 'ten-user-v1';
const OFFERED_MODE_IDS = ['pt-br', 'fr'];

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
    htmlLang: 'fr-CA',
    flagLabel: 'Quebec'
  }
};

const state = {
  user: null,
  activeMode: 'fr',
  activeTab: 'daily',
  languagePickerContext: '',
  feedbackOpen: false,
  settings: {
    translateSource: MODE_CONFIGS['fr'].learningLang,
    translateTarget: 'EN'
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
  reviewEditing: false,
  reviewEditSubmitting: false,
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
  frequencyLoadedLanguages: new Set(),
  frequencyListFilter: 'all',
  frequencyNotLearnedFrozen: null,
  frequencyInlineTranslations: new Map(),
  frequencyTranslatingWords: new Set()
};

let dailyDots = [];
let applyingMode = false;

function authHeaders(extra = {}) {
  const headers = { ...extra };
  if (state.user?.id) headers['X-User-Id'] = String(state.user.id);
  return headers;
}

async function apiFetch(url, options = {}) {
  const headers = authHeaders(options.headers || {});
  if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  return fetch(url, { ...options, headers });
}

function getUserLearningLanguages() {
  return Array.isArray(state.user?.languages) ? state.user.languages : [];
}

function getUserModeIds() {
  return getUserLearningLanguages()
    .map(modeIdFromLearningLang)
    .filter(modeId => MODE_CONFIGS[modeId]);
}

function saveUserToStorage(user) {
  if (!user?.id) return;
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify({ id: user.id, username: user.username }));
}

function loadUserFromStorage() {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.id) return null;
    return parsed;
  } catch (_) {
    return null;
  }
}

function clearUserStorage() {
  localStorage.removeItem(USER_STORAGE_KEY);
}

function applyUserPayload(payload) {
  if (!payload?.id) return null;
  state.user = {
    id: payload.id,
    username: payload.username,
    isDev: Boolean(payload.isDev),
    languages: Array.isArray(payload.languages) ? payload.languages : []
  };
  document.body.classList.toggle('dev-mode', state.user.isDev);
  document.body.classList.toggle('prod-mode', !state.user.isDev);
  saveUserToStorage(state.user);
  return state.user;
}

function showLoginScreen(message = '') {
  document.getElementById('login-screen')?.classList.remove('hidden');
  document.getElementById('app')?.classList.add('hidden');
  setStatus('login-status', message);
}

function showAppShell() {
  document.getElementById('login-screen')?.classList.add('hidden');
  document.getElementById('app')?.classList.remove('hidden');
}

async function fetchCurrentUser() {
  const stored = loadUserFromStorage();
  if (!stored?.id) return null;
  if (!state.user?.id) {
    state.user = { id: stored.id, username: stored.username || '', isDev: false, languages: [] };
  }
  const response = await apiFetch('/api/me', { cache: 'no-store' });
  if (!response.ok) {
    state.user = null;
    clearUserStorage();
    return null;
  }
  const body = await response.json();
  return applyUserPayload(body);
}

async function restoreSession() {
  const stored = loadUserFromStorage();
  if (!stored?.id) return null;
  state.user = { id: stored.id, username: stored.username || '', isDev: false, languages: [] };
  return fetchCurrentUser();
}

async function loginWithUsername(username) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username })
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Could not sign in.');
  }
  const body = await response.json();
  return applyUserPayload(body);
}

function resolveActiveModeForUser() {
  const modeIds = getUserModeIds();
  if (!modeIds.length) return null;
  const saved = loadSavedActiveMode();
  if (saved && modeIds.includes(saved)) return saved;
  return modeIds[0];
}

function getAvailablePickerModeIds(context = 'header') {
  const owned = new Set(getUserModeIds());
  if (context === 'header' && !owned.size) return [...OFFERED_MODE_IDS];
  return OFFERED_MODE_IDS.filter(modeId => !owned.has(modeId));
}

function readPickerSelections(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll('input[type="checkbox"]:checked'))
    .map(input => String(input.value || '').trim())
    .filter(modeId => MODE_CONFIGS[modeId]);
}

function renderPickerOptions(container, context) {
  if (!container) return;
  const modeIds = getAvailablePickerModeIds(context);
  container.innerHTML = modeIds.map(modeId => {
    const mode = MODE_CONFIGS[modeId];
    const flag = modeId === 'pt-br' ? '🇧🇷' : '🇨🇦';
    return `<label class="lang-picker-option"><input type="checkbox" value="${modeId}" /> ${flag} ${mode.label}</label>`;
  }).join('');
  if (!modeIds.length) {
    container.innerHTML = '<p class="status-line">You already have every language.</p>';
  }
}

function setLanguagePickerOpen(context, open) {
  state.languagePickerContext = open ? context : '';
  const headerPicker = document.getElementById('header-lang-picker');
  const settingsPicker = document.getElementById('settings-lang-picker');
  headerPicker?.classList.toggle('hidden', !(open && context === 'header'));
  settingsPicker?.classList.toggle('hidden', !(open && context === 'settings'));
}

async function saveUserLanguages(modeIds, { replace = false } = {}) {
  const languages = modeIds.map(learningLangFromModeId).filter(Boolean);
  const response = await apiFetch('/api/user-languages', {
    method: 'PUT',
    body: JSON.stringify({ languages, replace })
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Could not save languages.');
  }
  const body = await response.json();
  state.user.languages = Array.isArray(body.languages) ? body.languages : languages;
  renderAuthChrome();
  const nextMode = resolveActiveModeForUser();
  if (nextMode) {
    await setLearningMode(nextMode, { force: true, resetTranslate: true });
  } else {
    showDailyUnavailable('Add a language to start learning.');
  }
  if (state.activeTab === 'settings') renderSettings();
}

function renderAuthChrome() {
  const languages = getUserLearningLanguages();
  const modeIds = getUserModeIds();
  const headerAddWrap = document.getElementById('header-lang-add-wrap');
  const headerAddBtn = document.getElementById('header-lang-add-btn');
  const settingsAddBtn = document.getElementById('settings-lang-add-btn');
  const modeToggle = document.getElementById('mode-toggle');

  headerAddWrap?.classList.toggle('hidden', !shouldShowHeaderAddLanguageButton(languages));
  headerAddBtn?.classList.toggle('hidden', !shouldShowHeaderAddLanguageButton(languages));
  settingsAddBtn?.classList.toggle('hidden', !shouldShowSettingsAddLanguageButton(languages));
  modeToggle?.classList.toggle('hidden', !modeIds.length);

  document.querySelectorAll('.mode-toggle-btn').forEach(button => {
    const modeId = button.dataset.mode;
    const visible = modeIds.includes(modeId);
    button.classList.toggle('hidden', !visible);
    button.disabled = !visible;
  });
  updateModeToggleUi();
  renderSettings();
}

function renderSettings() {
  const usernameLabel = document.getElementById('settings-username-label');
  if (usernameLabel) usernameLabel.textContent = state.user?.username || '';
  const list = document.getElementById('settings-lang-list');
  if (list) {
    list.innerHTML = getUserModeIds().map(modeId => {
      const mode = MODE_CONFIGS[modeId];
      const flag = modeId === 'pt-br' ? '🇧🇷' : '🇨🇦';
      return `<span class="settings-lang-chip">${flag} ${mode.label}</span>`;
    }).join('');
  }
  const feedbackSection = document.getElementById('settings-feedback-section');
  feedbackSection?.classList.toggle('hidden', !state.user?.isDev);
  renderPickerOptions(document.querySelector('#header-lang-picker .lang-picker-options'), 'header');
  renderPickerOptions(document.querySelector('.settings-lang-picker-options'), 'settings');
}

async function loadSettingsFeedback() {
  if (!state.user?.isDev) return;
  const list = document.getElementById('settings-feedback-list');
  if (!list) return;
  try {
    const response = await apiFetch('/api/feedback', { cache: 'no-store' });
    if (!response.ok) return;
    const body = await response.json();
    const entries = Array.isArray(body.feedback) ? body.feedback : [];
    if (!entries.length) {
      list.innerHTML = '<p class="status-line">No feedback yet.</p>';
      return;
    }
    list.innerHTML = entries.map(entry => {
      const when = entry.createdAt
        ? new Date(entry.createdAt * 1000).toLocaleString()
        : '';
      return `<article class="settings-feedback-item"><div class="settings-feedback-meta">${entry.username || 'user'} · ${when}</div><p>${escapeHtml(entry.body || '')}</p></article>`;
    }).join('');
  } catch (_) {}
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function openFeedbackOverlay(seedText = '') {
  const overlay = document.getElementById('feedback-overlay');
  const expanded = document.getElementById('feedback-expanded-input');
  if (!overlay || !expanded) return;
  state.feedbackOpen = true;
  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden', 'false');
  requestAnimationFrame(() => overlay.classList.add('open'));
  expanded.value = seedText;
  setStatus('feedback-status', '');
  expanded.focus({ preventScroll: true });
}

function closeFeedbackOverlay() {
  const overlay = document.getElementById('feedback-overlay');
  if (!overlay) return;
  state.feedbackOpen = false;
  overlay.classList.remove('open');
  overlay.setAttribute('aria-hidden', 'true');
  setTimeout(() => {
    if (!state.feedbackOpen) overlay.classList.add('hidden');
  }, 180);
  document.getElementById('feedback-compact-input')?.blur();
}

async function submitFeedback(body) {
  const text = String(body || '').trim();
  if (!text) throw new Error('Write something first.');
  const response = await apiFetch('/api/feedback', {
    method: 'POST',
    body: JSON.stringify({ body: text })
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'Could not send feedback.');
  }
  if (state.user?.isDev) await loadSettingsFeedback();
}

function getModeConfig(modeId = state.activeMode) {
  return MODE_CONFIGS[modeId] || MODE_CONFIGS['fr'];
}

function getLearningLanguage(modeId = state.activeMode) {
  return getModeConfig(modeId).learningLang;
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

function capitalizeFirstWord(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const firstLetterIndex = text.search(/\p{L}/u);
  if (firstLetterIndex < 0) return text;
  const firstLetter = text[firstLetterIndex];
  return `${text.slice(0, firstLetterIndex)}${firstLetter.toLocaleUpperCase()}${text.slice(firstLetterIndex + 1)}`;
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

function loadSeenDailyWordsFromLocalStorage() {
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

async function persistUnlockedWordToServer(language, normalized) {
  if (!normalized) return;
  try {
    await apiFetch('/api/unlocked-words', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language, word: normalized })
    });
  } catch (_) {}
}

async function initUnlockedWordsFromServer() {
  const languages = ['PT-BR', 'FR'];
  const merged = {
    'PT-BR': new Set(),
    FR: new Set()
  };

  try {
    const response = await apiFetch('/api/unlocked-words');
    if (response.ok) {
      const body = await response.json();
      const wordsByLanguage = body?.wordsByLanguage;
      if (wordsByLanguage && typeof wordsByLanguage === 'object') {
        languages.forEach(language => {
          const words = Array.isArray(wordsByLanguage[language]) ? wordsByLanguage[language] : [];
          merged[language] = new Set(words.map(normalizeFrequencyWord).filter(Boolean));
        });
      }
    }
  } catch (_) {}

  const local = loadSeenDailyWordsFromLocalStorage();
  const localPayload = {};
  let hasLocal = false;
  languages.forEach(language => {
    if (!local[language].size) return;
    hasLocal = true;
    localPayload[language] = Array.from(local[language]);
    local[language].forEach(word => merged[language].add(word));
  });

  if (hasLocal) {
    try {
      const response = await apiFetch('/api/unlocked-words/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wordsByLanguage: localPayload })
      });
      if (response.ok) {
        const body = await response.json();
        const wordsByLanguage = body?.wordsByLanguage;
        if (wordsByLanguage && typeof wordsByLanguage === 'object') {
          languages.forEach(language => {
            const words = Array.isArray(wordsByLanguage[language]) ? wordsByLanguage[language] : [];
            merged[language] = new Set(words.map(normalizeFrequencyWord).filter(Boolean));
          });
        }
        localStorage.removeItem(SEEN_DAILY_WORDS_STORAGE_KEY);
      }
    } catch (_) {}
  }

  return merged;
}

function markLearningWordSeenInFrequency(rawWord) {
  const normalized = normalizeFrequencyWord(rawWord);
  if (!normalized) return;
  const language = getFrequencyLanguageForMode();
  const seenSet = getSeenDailyWordsSet(language);
  const isNew = !seenSet.has(normalized);
  seenSet.add(normalized);
  if (isNew) persistUnlockedWordToServer(language, normalized);
  state.todayWords.forEach((entry, idx) => {
    if (entry?.word && normalizeFrequencyWord(entry.word) === normalized) {
      state.seenWordIndexes.add(idx);
    }
  });
  updateDailyDots();
  if (state.activeTab === 'frequency') {
    renderFrequencyDictionary();
  }
  updatePoolInfo();
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

function loadSavedActiveMode() {
  const fromLocal = localStorage.getItem(ACTIVE_MODE_STORAGE_KEY);
  if (fromLocal && MODE_CONFIGS[fromLocal]) return fromLocal;
  const fromSession = sessionStorage.getItem(ACTIVE_MODE_STORAGE_KEY);
  if (fromSession && MODE_CONFIGS[fromSession]) {
    localStorage.setItem(ACTIVE_MODE_STORAGE_KEY, fromSession);
    sessionStorage.removeItem(ACTIVE_MODE_STORAGE_KEY);
    return fromSession;
  }
  return null;
}

function dateKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
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
    ['word-add-btn','s1-add-btn','s2-add-btn','add-all-btn'].forEach(id => {
      const b = document.getElementById(id); if (b) b.disabled = true;
    });
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

  const hasS1 = !!(firstSentenceText && firstSentence.en);
  const hasS2 = !!(secondSentenceText && secondSentence.en);
  const hasWord = !!word.word;

  const btnWord = document.getElementById('word-add-btn'); if (btnWord) btnWord.disabled = !hasWord;
  const btnS1 = document.getElementById('s1-add-btn'); if (btnS1) btnS1.disabled = !hasS1;
  const btnS2 = document.getElementById('s2-add-btn'); if (btnS2) btnS2.disabled = !hasS2;
  const btnAll = document.getElementById('add-all-btn'); if (btnAll) btnAll.disabled = !(hasWord && hasS1 && hasS2);

  updateDailyDots();
  maybeCelebrateDailyComplete(index);
}

function gotoDailyWord(index) {
  if (!state.todayWords.length) return;
  const bounded = Math.max(0, Math.min(index, state.todayWords.length - 1));
  if (bounded !== state.currentWordIndex) {
    setStatus('daily-save-status', '');
  }
  renderDailyWord(bounded);
  void persistDailyCardIndex(bounded);
  window.speechSynthesis?.cancel();
  document.querySelectorAll('.speaking').forEach(el => el.classList.remove('speaking'));
}

async function fetchDailyWordAssignment(language, dayKey) {
  try {
    const params = new URLSearchParams({ language, dateKey: dayKey });
    const response = await apiFetch(`/api/daily-words?${params}`, { cache: 'no-store' });
    if (!response.ok) return null;
    const body = await response.json();
    const words = body?.words;
    return Array.isArray(words) && words.length ? words : null;
  } catch (_) {
    return null;
  }
}

async function persistDailyWordAssignment(language, dayKey, headwords) {
  if (!Array.isArray(headwords) || !headwords.length) return;
  try {
    await apiFetch('/api/daily-words', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      keepalive: true,
      body: JSON.stringify({ language, dateKey: dayKey, words: headwords })
    });
  } catch (_) {}
}

async function fetchDailyCardIndex(language, dayKey) {
  try {
    const params = new URLSearchParams({ language, dateKey: dayKey });
    const response = await apiFetch(`/api/daily-progress?${params}`, { cache: 'no-store' });
    if (!response.ok) return null;
    const body = await response.json();
    if (!body || body.cardIndex === null || body.cardIndex === undefined) return null;
    const index = Number(body.cardIndex);
    return Number.isInteger(index) && index >= 0 ? index : null;
  } catch (_) {
    return null;
  }
}

async function persistDailyCardIndex(cardIndex) {
  if (!state.todayWords.length) return;
  const language = getFrequencyLanguageForMode();
  const dayKey = dateKey();
  const bounded = Math.max(0, Math.min(cardIndex, state.todayWords.length - 1));
  try {
    await apiFetch('/api/daily-progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      keepalive: true,
      body: JSON.stringify({ language, dateKey: dayKey, cardIndex: bounded })
    });
  } catch (_) {}
}

const DAILY_CONFETTI_STORAGE_PREFIX = 'ten-daily-confetti-v1';

function getDailyConfettiStorageKey() {
  return `${DAILY_CONFETTI_STORAGE_PREFIX}:${getFrequencyLanguageForMode()}:${dateKey()}`;
}

function hasCelebratedDailyCompleteToday() {
  return localStorage.getItem(getDailyConfettiStorageKey()) === '1';
}

function markDailyCompleteCelebrated() {
  localStorage.setItem(getDailyConfettiStorageKey(), '1');
}

function fireDailyCompleteConfetti() {
  if (typeof confetti !== 'function') return;
  const burst = (options = {}) =>
    confetti({
      disableForReducedMotion: true,
      particleCount: 120,
      spread: 100,
      startVelocity: 42,
      gravity: 0.9,
      ticks: 220,
      origin: { y: 0.62 },
      ...options
    });

  burst({ angle: 60 });
  burst({ angle: 120 });
  setTimeout(() => {
    burst({ particleCount: 80, spread: 130, origin: { x: 0.5, y: 0.55 } });
  }, 180);
}

function maybeCelebrateDailyComplete(index) {
  if (index !== WORDS_PER_DAY - 1 || hasCelebratedDailyCompleteToday()) return;
  markDailyCompleteCelebrated();
  fireDailyCompleteConfetti();
}

function updatePoolInfo() {
  if (!state.words.length) return;
  const mode = getModeConfig();
  const seenSet = getSeenDailyWordsSet();
  const unseenCount = countUnseenPoolWords(state.words, seenSet);
  const poolDays = computePoolDaysLeft(state.words.length, state.words.length - unseenCount, WORDS_PER_DAY);
  const poolInfo = document.getElementById('pool-info');
  if (!poolInfo) return;
  if (!shouldShowPoolDaysFooter(state.user?.isDev)) {
    poolInfo.textContent = '';
    poolInfo.classList.remove('warning');
    return;
  }
  poolInfo.textContent = formatPoolDaysLabel(poolDays, mode.flagLabel);
  poolInfo.classList.toggle('warning', poolDays <= 7);
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
  const reviewBackLabel = document.getElementById('review-edit-back-label');
  const sentenceLabel = document.getElementById('sentence-language-label');
  const fromLabel = document.getElementById('translate-from-label');
  if (backLabel) backLabel.textContent = `Back (${mode.translatorLabel})`;
  if (backInput) backInput.placeholder = `${mode.translatorLabel} translation`;
  if (reviewBackLabel) reviewBackLabel.textContent = `Back (${mode.translatorLabel})`;
  if (sentenceLabel) sentenceLabel.textContent = `${mode.translatorLabel} in use`;
  if (fromLabel && !state.lastDetectedSourceLang) fromLabel.textContent = mode.shortLabel;
  document.documentElement.lang = mode.htmlLang;
}

async function setLearningMode(modeId, options = {}) {
  const mode = getModeConfig(modeId);
  const resetTranslate = options.resetTranslate !== false;
  if (!getUserModeIds().includes(mode.id) && !options.force) return;
  if (applyingMode || (state.activeMode === mode.id && !options.force)) return;
  applyingMode = true;
  try {
    window.speechSynthesis?.cancel();
    document.querySelectorAll('.speaking').forEach(el => el.classList.remove('speaking'));

    state.activeMode = mode.id;
    localStorage.setItem(ACTIVE_MODE_STORAGE_KEY, mode.id);
    state.settings.translateSource = mode.learningLang;
    state.settings.translateTarget = 'EN';
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
      await loadReviewQueue({ refreshTotal: true });
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

async function addCard({ front, back, context }, statusElementId) {
  const mode = getModeConfig();
  const cleanFront = capitalizeFirstWord(front);
  const cleanBack = capitalizeFirstWord(back);
  const cleanContext = String(context || '').trim();

  if (!cleanFront || !cleanBack) {
    setStatus(statusElementId, 'Front and back are required.', 'error');
    return false;
  }

  setStatus(statusElementId, 'Saving card...');

  try {
    const response = await apiFetch('/api/cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: mode.learningLang,
        front: cleanFront,
        back: cleanBack,
        context: cleanContext
      })
    });

    if (!response.ok) {
      const details = await extractErrorDetails(response);
      if (response.status === 409) {
        setStatus(statusElementId, 'Card already exists.', 'error');
        return false;
      }
      throw new Error(`Card request failed (${response.status})${details ? `: ${details}` : '.'}`);
    }

    setStatus(statusElementId, 'Card saved.', 'success');
    return true;
  } catch (error) {
    setStatus(statusElementId, formatError(error), 'error');
    return false;
  }
}

async function removeCard(cardId) {
  const response = await apiFetch(`/api/cards/${cardId}`, { method: 'DELETE' });
  if (!response.ok) {
    const details = await extractErrorDetails(response);
    throw new Error(`Delete failed (${response.status})${details ? `: ${details}` : '.'}`);
  }
}

async function patchCard(cardId, { front, back, context }) {
  const response = await apiFetch(`/api/cards/${cardId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ front, back, context })
  });
  if (!response.ok) {
    const details = await extractErrorDetails(response);
    if (response.status === 409) throw new Error('Card already exists.');
    throw new Error(`Update failed (${response.status})${details ? `: ${details}` : '.'}`);
  }
}

async function addSentenceCard(sentence, statusElementId) {
  const mode = getModeConfig();
  const l2 = String(sentence ? (sentence[mode.sentenceKey] || sentence.pt || sentence.fr || '') : '').trim();
  const en = String(sentence ? (sentence.en || '') : '').trim();
  if (!l2 || !en) {
    setStatus(statusElementId, 'Missing sentence or translation.', 'error');
    return false;
  }
  return await addCard({ front: en, back: l2 }, statusElementId);
}

function mapApiCardToReviewCard(card) {
  return {
    id: Number(card.id),
    queueKind: card.queueKind === 'new' ? 'new' : 'due',
    front: String(card.front || ''),
    back: String(card.back || ''),
    context: String(card.context || '')
  };
}

function orderReviewCards(cards) {
  return cards.sort((a, b) => {
    if (a.queueKind !== b.queueKind) return a.queueKind === 'new' ? -1 : 1;
    return a.id - b.id;
  });
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
  state.reviewEditing = false;
  state.reviewDueCount = Math.max(0, state.reviewDueCount - 1);
  return card;
}

function removeReviewCardById(cardId) {
  const before = state.reviewCards.length;
  state.reviewCards = state.reviewCards.filter(card => card.id !== cardId);
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

function setReviewEditing(open) {
  state.reviewEditing = Boolean(open);
  if (!open) {
    const frontInput = document.getElementById('review-edit-front');
    const backInput = document.getElementById('review-edit-back');
    if (frontInput) frontInput.value = '';
    if (backInput) backInput.value = '';
  }
}

function fillReviewEditFields(card) {
  const frontInput = document.getElementById('review-edit-front');
  const backInput = document.getElementById('review-edit-back');
  if (!card || !frontInput || !backInput) return;
  frontInput.value = card.front;
  backInput.value = card.back;
}

function renderReview() {
  window.speechSynthesis?.cancel();
  document.querySelectorAll('.speaking').forEach(el => el.classList.remove('speaking'));

  const dueCount = state.reviewDueCount;
  document.getElementById('review-due-count').textContent = String(dueCount);
  document.getElementById('review-total-count').textContent = String(state.reviewTotalCount);

  const empty = document.getElementById('review-empty');
  const cardPanel = document.getElementById('review-card-panel');
  const displayWrap = document.getElementById('review-display-wrap');
  const editWrap = document.getElementById('review-edit-wrap');
  const answerWrap = document.getElementById('review-answer-wrap');
  const gradeRow = document.getElementById('review-grade-row');
  const showAnswerBtn = document.getElementById('review-show-answer-btn');
  const editBtn = document.getElementById('review-card-edit');
  const deleteBtn = document.getElementById('review-card-delete');
  const saveBtn = document.getElementById('review-edit-save');
  const cancelBtn = document.getElementById('review-edit-cancel');

  const card = getCurrentReviewCard();
  if (!card) {
    setReviewEditing(false);
    empty?.classList.remove('hidden');
    cardPanel?.classList.add('hidden');
    return;
  }

  const editing = state.reviewEditing;
  displayWrap?.classList.toggle('hidden', editing);
  editWrap?.classList.toggle('hidden', !editing);
  showAnswerBtn?.classList.toggle('hidden', editing || state.reviewAnswerVisible);
  answerWrap?.classList.toggle('hidden', editing || !state.reviewAnswerVisible);
  gradeRow?.classList.toggle('hidden', editing || !state.reviewAnswerVisible);

  document.getElementById('review-front-text').textContent = card.front;
  document.getElementById('review-back-text').textContent = card.back;

  const contextEl = document.getElementById('review-context');
  contextEl.textContent = card.context;
  contextEl.classList.toggle('hidden', editing || !card.context);

  const speakBtn = document.getElementById('review-speak-btn');
  if (speakBtn) {
    speakBtn.disabled = editing || !state.reviewAnswerVisible || !card.back;
  }

  const actionBusy = state.reviewSubmitting || state.reviewEditSubmitting;
  const gradeButtonsDisabled = isReviewGradeButtonsDisabled({ reviewEditing: editing });
  if (editBtn) editBtn.disabled = actionBusy || editing;
  if (deleteBtn) deleteBtn.disabled = actionBusy;
  if (showAnswerBtn) showAnswerBtn.disabled = actionBusy || editing;
  if (saveBtn) saveBtn.disabled = actionBusy;
  if (cancelBtn) cancelBtn.disabled = actionBusy;
  if (gradeRow) {
    gradeRow.querySelectorAll('button[data-grade]').forEach(button => {
      button.disabled = gradeButtonsDisabled;
    });
  }

  empty.classList.add('hidden');
  cardPanel.classList.remove('hidden');
}

async function loadReviewQueue(options = {}) {
  const refreshTotal = Boolean(options.refreshTotal) || state.reviewTotalCount <= 0;
  const mode = getModeConfig();
  setStatus('review-status', '');

  try {
    const response = await apiFetch(`/api/cards/queue?language=${encodeURIComponent(mode.learningLang)}`);
    if (!response.ok) {
      const details = await extractErrorDetails(response);
      throw new Error(`Review request failed (${response.status})${details ? `: ${details}` : '.'}`);
    }

    const body = await response.json();
    const cards = orderReviewCards(
      (Array.isArray(body.cards) ? body.cards : [])
        .map(mapApiCardToReviewCard)
        .filter(card => Number.isFinite(card.id))
    );

    state.reviewCards = cards;
    state.reviewDueCount = cards.length;
    if (refreshTotal) {
      state.reviewTotalCount = Number(body.totalCount) || cards.length;
    } else {
      state.reviewTotalCount = Math.max(state.reviewTotalCount, cards.length);
    }
    state.reviewCurrentIndex = 0;
    state.reviewAnswerVisible = false;
    state.reviewEditing = false;
    state.reviewSubmitting = false;
    state.reviewEditSubmitting = false;

    renderReview();
    setStatus('review-status', '');
  } catch (error) {
    setStatus('review-status', formatError(error), 'error');
    state.reviewCards = [];
    state.reviewDueCount = 0;
    state.reviewCurrentIndex = 0;
    state.reviewAnswerVisible = false;
    state.reviewEditing = false;
    state.reviewSubmitting = false;
    state.reviewEditSubmitting = false;
    renderReview();
  }
}

async function submitReviewGrade(grade) {
  const card = getCurrentReviewCard();
  if (!card || !grade || state.reviewSubmitting) return;

  setStatus('review-status', '');
  state.reviewSubmitting = true;

  try {
    const response = await apiFetch(`/api/cards/${card.id}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating: grade })
    });

    if (!response.ok) {
      const details = await extractErrorDetails(response);
      throw new Error(`Grade request failed (${response.status})${details ? `: ${details}` : '.'}`);
    }

    removeCurrentReviewCard();
    setStatus('review-status', '');
  } catch (error) {
    setStatus('review-status', formatError(error), 'error');
  } finally {
    state.reviewSubmitting = false;
    renderReview();
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

function clearNotLearnedFrozenPool() {
  state.frequencyNotLearnedFrozen = null;
}

function snapshotNotLearnedFrozenPool() {
  const language = getFrequencyLanguageForMode();
  const entries = Array.isArray(state.frequencyByLanguage[language]) ? state.frequencyByLanguage[language] : [];
  const seenSet = getSeenDailyWordsSet(language);
  state.frequencyNotLearnedFrozen = buildNotLearnedFrozenPool(entries, seenSet);
}

function clearFrequencySearch() {
  const input = document.getElementById('frequency-search-input');
  if (input) input.value = '';
  state.frequencyListFilter = 'all';
  clearNotLearnedFrozenPool();
  updateFrequencyStatFilterUi();
  updateFrequencySearchHint(0, 0, false);
}

function updateFrequencyStatFilterUi() {
  const unlockedBtn = document.getElementById('frequency-unlocked-stat');
  const notLearnedBtn = document.getElementById('frequency-not-learned-stat');
  const filter = state.frequencyListFilter;
  if (unlockedBtn) {
    unlockedBtn.classList.toggle('active', filter === 'unlocked');
    unlockedBtn.setAttribute('aria-pressed', String(filter === 'unlocked'));
  }
  if (notLearnedBtn) {
    notLearnedBtn.classList.toggle('active', filter === 'not-learned');
    notLearnedBtn.setAttribute('aria-pressed', String(filter === 'not-learned'));
  }
}

function setFrequencyListFilter(filter) {
  state.frequencyListFilter = filter;
  if (filter === 'not-learned') {
    snapshotNotLearnedFrozenPool();
  } else {
    clearNotLearnedFrozenPool();
  }
  updateFrequencyStatFilterUi();
  renderFrequencyDictionary();
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

function formatFrequencyInlineTranslation(translation) {
  return `= ${translation}`;
}

function frequencyTranslationKey(language, normalizedWord) {
  return `${language}:${normalizedWord}`;
}

async function translateFrequencyWord(entry) {
  const language = getFrequencyLanguageForMode();
  const normalized = entry.normalizedWord;
  const mapKey = frequencyTranslationKey(language, normalized);
  if (!normalized || state.frequencyTranslatingWords.has(mapKey)) return;

  state.frequencyTranslatingWords.add(mapKey);
  renderFrequencyDictionary();

  try {
    const result = await translateText(entry.word, language, 'EN');
    state.frequencyInlineTranslations.set(mapKey, {
      text: formatFrequencyInlineTranslation(result.translatedText),
      error: false
    });
    markLearningWordSeenInFrequency(entry.word);
  } catch (error) {
    state.frequencyInlineTranslations.set(mapKey, {
      text: formatError(error),
      error: true
    });
  } finally {
    state.frequencyTranslatingWords.delete(mapKey);
    renderFrequencyDictionary();
  }
}

function renderFrequencyDictionary() {
  const listEl = document.getElementById('frequency-list');
  const seenEl = document.getElementById('frequency-seen-count');
  const notLearnedEl = document.getElementById('frequency-not-learned-count');
  if (!listEl || !seenEl || !notLearnedEl) return;

  const language = getFrequencyLanguageForMode();
  const entries = Array.isArray(state.frequencyByLanguage[language]) ? state.frequencyByLanguage[language] : [];
  const seenSet = getSeenDailyWordsSet(language);
  const parsed = parseFrequencySearchQuery(getFrequencySearchQuery());
  const hasQuery = parsed.type !== 'none';
  const filter = state.frequencyListFilter;
  const frozenNotLearned = state.frequencyNotLearnedFrozen;
  const totalUnlocked = entries.reduce(
    (count, entry) => count + (seenSet.has(entry.normalizedWord) ? 1 : 0),
    0
  );
  let matchCount = 0;
  const fragment = document.createDocumentFragment();
  const listTotal = filter === 'not-learned' && frozenNotLearned instanceof Set
    ? frozenNotLearned.size
    : frequencyListTotal(entries.length, totalUnlocked, filter);

  entries.forEach(entry => {
    const seen = seenSet.has(entry.normalizedWord);
    if (!frequencyEntryMatchesFilter(seen, filter, frozenNotLearned, entry.normalizedWord)) return;
    if (!entryMatchesFrequencySearch(entry, parsed)) return;
    matchCount++;
    const row = document.createElement('div');
    row.className = `frequency-item${seen ? ' seen' : ''}`;

    const rank = document.createElement('span');
    rank.className = 'frequency-rank';
    rank.textContent = `#${entry.rank}`;

    const wordWrap = document.createElement('div');
    wordWrap.className = 'frequency-word-wrap';

    const wordBtn = document.createElement('button');
    wordBtn.type = 'button';
    wordBtn.className = 'frequency-word';
    wordBtn.textContent = entry.word;
    const mapKey = frequencyTranslationKey(language, entry.normalizedWord);
    const isTranslating = state.frequencyTranslatingWords.has(mapKey);
    wordBtn.disabled = isTranslating;
    wordBtn.addEventListener('click', () => {
      translateFrequencyWord(entry);
    });

    const inline = state.frequencyInlineTranslations.get(mapKey);
    if (isTranslating) {
      const pending = document.createElement('span');
      pending.className = 'frequency-inline-translation';
      pending.textContent = '…';
      wordWrap.append(wordBtn, pending);
    } else if (inline) {
      const translation = document.createElement('span');
      translation.className = `frequency-inline-translation${inline.error ? ' error' : ''}`;
      translation.textContent = inline.text;
      wordWrap.append(wordBtn, translation);
    } else {
      wordWrap.append(wordBtn);
    }

    row.append(rank, wordWrap);
    fragment.appendChild(row);
  });

  listEl.innerHTML = '';
  listEl.appendChild(fragment);
  seenEl.textContent = String(totalUnlocked);
  notLearnedEl.textContent = String(entries.length - totalUnlocked);
  updateFrequencySearchHint(matchCount, listTotal, hasQuery);
}

async function loadFrequencyTabData() {
  const language = getFrequencyLanguageForMode();
  try {
    await ensureFrequencyLanguageLoaded(language);
    if (state.frequencyListFilter === 'not-learned') {
      snapshotNotLearnedFrozenPool();
    }
    renderFrequencyDictionary();
    setStatus('frequency-status', '');
  } catch (error) {
    renderFrequencyDictionary();
    setStatus('frequency-status', formatError(error), 'error');
  }
}

function updateTranslateFrequencyRank(inputText, translatedText, sourceLang, targetLang) {
  const outputEl = document.getElementById('translate-frequency-rank');
  if (!outputEl) return;

  const learningLanguage = getFrequencyLanguageForMode();
  const learningWord = extractSingleLearningWord(inputText, translatedText, sourceLang, targetLang, learningLanguage);
  if (!learningWord) {
    outputEl.textContent = '';
    outputEl.className = 'frequency-meta';
    return;
  }

  markLearningWordSeenInFrequency(learningWord);

  const sourceCanonical = canonicalizeTranslateLanguage(sourceLang);
  const label = sourceCanonical === learningLanguage ? 'Input' : 'Result';
  const rank = getFrequencyRank(learningLanguage, learningWord);
  const message = formatTranslateFrequencyRank(label, rank);

  outputEl.textContent = message;
  outputEl.className = rank ? 'frequency-meta success' : 'frequency-meta';
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
  if (tabId === 'translate') {
    const direction = defaultTranslateDirection(getLearningLanguage());
    state.settings.translateSource = direction.source;
    state.settings.translateTarget = direction.target;
    state.lastDetectedSourceLang = '';
    fillSettingsInputs();
  }
  if (tabId === 'review') {
    loadReviewQueue();
  }
  if (tabId === 'frequency') {
    loadFrequencyTabData();
  }
  if (tabId === 'settings') {
    renderSettings();
    loadSettingsFeedback();
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

function getTranslateSpeakText() {
  const learningLang = getLearningLanguage();
  const inputText = document.getElementById('translate-input')?.value.trim() || '';
  const resultText = document.getElementById('translate-result-text')?.textContent.trim() || '';
  if (canonicalizeTranslateLanguage(state.settings.translateSource) === learningLang) {
    return inputText;
  }
  if (canonicalizeTranslateLanguage(state.settings.translateTarget) === learningLang) {
    return resultText;
  }
  return '';
}

function getTranslateSpeakSlot() {
  const learningLang = getLearningLanguage();
  const sourceIsLearning =
    canonicalizeTranslateLanguage(state.settings.translateSource) === learningLang;
  return sourceIsLearning
    ? document.getElementById('translate-speak-slot-input')
    : document.getElementById('translate-speak-slot-result');
}

function updateTranslateSpeakUi() {
  const speakBtn = document.getElementById('translate-speak-btn');
  if (!speakBtn) return;

  const hasSpeakText = Boolean(getTranslateSpeakText());
  const show = state.hasTranslatedInSession && hasSpeakText;
  const slot = getTranslateSpeakSlot();

  speakBtn.disabled = !show;
  speakBtn.classList.toggle('translate-speak-visible', show);

  if (show && slot && speakBtn.parentElement !== slot) {
    slot.appendChild(speakBtn);
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
  updateTranslateSpeakUi();
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
  clearTranslateDraft();
}

function clearTranslateFrequencyRank() {
  const outputEl = document.getElementById('translate-frequency-rank');
  if (!outputEl) return;
  outputEl.textContent = '';
  outputEl.className = 'frequency-meta';
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
  clearTranslateFrequencyRank();
  setStatus('quick-add-status', '');
  setStatus('card-save-status', '');
  updateTranslateResultUi();
  translateInput.focus({ preventScroll: true });
  translateInput.setSelectionRange(0, 0);
}

function setupFrequencyEvents() {
  const searchInput = document.getElementById('frequency-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderFrequencyDictionary();
    });
    searchInput.addEventListener('search', () => {
      renderFrequencyDictionary();
    });
  }

  document.getElementById('frequency-unlocked-stat')?.addEventListener('click', () => {
    setFrequencyListFilter(nextFrequencyFilter(state.frequencyListFilter, 'unlocked'));
  });

  document.getElementById('frequency-not-learned-stat')?.addEventListener('click', () => {
    setFrequencyListFilter(nextFrequencyFilter(state.frequencyListFilter, 'not-learned'));
  });
}

function setupLoginEvents() {
  const input = document.getElementById('login-username-input');
  const button = document.getElementById('login-continue-btn');
  const submit = async () => {
    const username = input?.value.trim();
    if (!username) {
      setStatus('login-status', 'Enter a username.', 'error');
      return;
    }
    button.disabled = true;
    setStatus('login-status', 'Signing in...');
    try {
      await loginWithUsername(username);
      document.getElementById('loading').style.display = 'none';
      await bootApp();
    } catch (error) {
      setStatus('login-status', formatError(error), 'error');
    } finally {
      button.disabled = false;
    }
  };
  button?.addEventListener('click', submit);
  input?.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      submit();
    }
  });
}

function setupAuthEvents() {
  document.getElementById('header-lang-add-btn')?.addEventListener('click', () => {
    const open = state.languagePickerContext !== 'header';
    setLanguagePickerOpen('header', open);
    renderPickerOptions(document.querySelector('#header-lang-picker .lang-picker-options'), 'header');
  });

  document.getElementById('header-lang-confirm-btn')?.addEventListener('click', async () => {
    const selected = readPickerSelections(document.querySelector('#header-lang-picker .lang-picker-options'));
    if (!selected.length) {
      setStatus('daily-save-status', 'Pick at least one language.', 'error');
      return;
    }
    try {
      await saveUserLanguages(selected, { replace: false });
      setLanguagePickerOpen('header', false);
    } catch (error) {
      setStatus('daily-save-status', formatError(error), 'error');
    }
  });

  document.getElementById('settings-lang-add-btn')?.addEventListener('click', () => {
    const open = state.languagePickerContext !== 'settings';
    setLanguagePickerOpen('settings', open);
    renderPickerOptions(document.querySelector('.settings-lang-picker-options'), 'settings');
  });

  document.getElementById('settings-lang-confirm-btn')?.addEventListener('click', async () => {
    const selected = readPickerSelections(document.querySelector('.settings-lang-picker-options'));
    if (!selected.length) {
      setStatus('daily-save-status', 'Pick at least one language.', 'error');
      return;
    }
    try {
      await saveUserLanguages(selected, { replace: false });
      setLanguagePickerOpen('settings', false);
      renderSettings();
    } catch (error) {
      setStatus('daily-save-status', formatError(error), 'error');
    }
  });

  document.getElementById('settings-switch-user-btn')?.addEventListener('click', () => {
    clearUserStorage();
    state.user = null;
    window.location.reload();
  });
}

function setupFeedbackEvents() {
  const compact = document.getElementById('feedback-compact-input');
  compact?.addEventListener('focus', () => {
    openFeedbackOverlay(compact.value);
    compact.value = '';
  });

  document.getElementById('feedback-close-btn')?.addEventListener('click', () => {
    closeFeedbackOverlay();
  });

  document.getElementById('feedback-overlay')?.addEventListener('click', event => {
    if (event.target?.id === 'feedback-overlay') closeFeedbackOverlay();
  });

  document.getElementById('feedback-submit-btn')?.addEventListener('click', async () => {
    const expanded = document.getElementById('feedback-expanded-input');
    const button = document.getElementById('feedback-submit-btn');
    button.disabled = true;
    try {
      await submitFeedback(expanded?.value || '');
      setStatus('feedback-status', 'Thanks — feedback sent.', 'success');
      if (expanded) expanded.value = '';
      setTimeout(() => closeFeedbackOverlay(), 500);
    } catch (error) {
      setStatus('feedback-status', formatError(error), 'error');
    } finally {
      button.disabled = false;
    }
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

  // Small + buttons (beside word and each sentence)
  document.getElementById('word-add-btn').addEventListener('click', async () => {
    const word = state.todayWords[state.currentWordIndex];
    if (!word) {
      setStatus('daily-save-status', 'No daily card available to add.', 'error');
      return;
    }
    const added = await addCard(
      { front: word.translation, back: word.word },
      'daily-save-status'
    );
    if (added && state.activeTab === 'frequency') {
      renderFrequencyDictionary();
    }
  });

  document.getElementById('s1-add-btn').addEventListener('click', async () => {
    const word = state.todayWords[state.currentWordIndex];
    const sent = word && word.sentences && word.sentences[0] ? word.sentences[0] : null;
    if (!sent) {
      setStatus('daily-save-status', 'No sentence available.', 'error');
      return;
    }
    await addSentenceCard(sent, 'daily-save-status');
  });

  document.getElementById('s2-add-btn').addEventListener('click', async () => {
    const word = state.todayWords[state.currentWordIndex];
    const sent = word && word.sentences && word.sentences[1] ? word.sentences[1] : null;
    if (!sent) {
      setStatus('daily-save-status', 'No sentence available.', 'error');
      return;
    }
    await addSentenceCard(sent, 'daily-save-status');
  });

  // Bottom "+Add all" — adds word + both sentences (3 cards)
  document.getElementById('add-all-btn').addEventListener('click', async () => {
    const word = state.todayWords[state.currentWordIndex];
    if (!word) {
      setStatus('daily-save-status', 'No daily card available.', 'error');
      return;
    }
    const s1 = word.sentences && word.sentences[0] ? word.sentences[0] : null;
    const s2 = word.sentences && word.sentences[1] ? word.sentences[1] : null;

    setStatus('daily-save-status', 'Saving 3 cards...');

    const wOk = await addCard({ front: word.translation, back: word.word }, 'daily-save-status');
    const s1Ok = s1 ? await addSentenceCard(s1, 'daily-save-status') : false;
    const s2Ok = s2 ? await addSentenceCard(s2, 'daily-save-status') : false;

    const total = (wOk ? 1 : 0) + (s1Ok ? 1 : 0) + (s2Ok ? 1 : 0);
    if (total > 0) {
      setStatus('daily-save-status', `Added ${total} card${total > 1 ? 's' : ''}.`, 'success');
    }
    if (wOk && state.activeTab === 'frequency') {
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

  document.getElementById('translate-speak-btn')?.addEventListener('click', () => {
    const text = getTranslateSpeakText();
    speakText(text, document.getElementById('translate-speak-btn'));
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
      // Always start the draft with an empty context for a new translation result.
      // The back field should receive only the learning-language phrase.
      document.getElementById('card-context-input').value = '';

      state.hasTranslatedInSession = true;
      setStatus('translate-status', '');
      updateTranslateFrequencyRank(text, result.translatedText, source, target);
      setStatus('quick-add-status', '');
      updateTranslateResultUi();
    } catch (error) {
      setStatus('translate-status', formatError(error), 'error');
      clearTranslateFrequencyRank();
    } finally {
      translateBtn.disabled = false;
    }
  });

  document.getElementById('quick-add-card-btn').addEventListener('click', async () => {
    if (!state.hasTranslatedInSession) return;
    const draft = getDraftFields();
    await addCard(draft, 'quick-add-status');
  });

  document.getElementById('toggle-note-config-btn').addEventListener('click', () => {
    setNoteConfigOpen(!state.noteConfigOpen);
  });

  document.getElementById('save-card-btn').addEventListener('click', async () => {
    const draft = getDraftFields();
    await addCard(draft, 'card-save-status');
  });

  document.getElementById('add-review-btn').addEventListener('click', async () => {
    const draft = getDraftFields();
    const ok = await addCard(draft, 'card-save-status');
    if (ok) {
      setActiveTab('review');
    }
  });
}

function setupReviewEvents() {
  document.getElementById('review-show-answer-btn')?.addEventListener('click', () => {
    if (!getCurrentReviewCard()) return;
    state.reviewAnswerVisible = true;
    renderReview();
  });

  document.getElementById('review-speak-btn')?.addEventListener('click', () => {
    const card = getCurrentReviewCard();
    if (!card || !state.reviewAnswerVisible) return;
    speakText(card.back, document.getElementById('review-speak-btn'));
  });

  document.getElementById('review-card-edit')?.addEventListener('click', () => {
    const card = getCurrentReviewCard();
    if (!card || state.reviewSubmitting || state.reviewEditSubmitting) return;
    fillReviewEditFields(card);
    state.reviewAnswerVisible = true;
    setReviewEditing(true);
    renderReview();
    document.getElementById('review-edit-front')?.focus({ preventScroll: true });
  });

  document.getElementById('review-edit-cancel')?.addEventListener('click', () => {
    if (state.reviewEditSubmitting) return;
    setReviewEditing(false);
    renderReview();
  });

  document.getElementById('review-edit-save')?.addEventListener('click', async () => {
    const card = getCurrentReviewCard();
    if (!card || state.reviewEditSubmitting || state.reviewSubmitting) return;

    const front = capitalizeFirstWord(document.getElementById('review-edit-front')?.value || '');
    const back = capitalizeFirstWord(document.getElementById('review-edit-back')?.value || '');
    if (!front || !back) {
      setStatus('review-status', 'Front and back are required.', 'error');
      return;
    }

    setStatus('review-status', 'Saving changes...');
    state.reviewEditSubmitting = true;
    renderReview();

    try {
      await patchCard(card.id, { front, back, context: card.context });
      card.front = front;
      card.back = back;
      setReviewEditing(false);
      renderReview();
      setStatus('review-status', 'Card updated.', 'success');
    } catch (error) {
      setStatus('review-status', formatError(error), 'error');
    } finally {
      state.reviewEditSubmitting = false;
      renderReview();
    }
  });

  document.querySelectorAll('#review-grade-row button[data-grade]').forEach(button => {
    button.addEventListener('click', () => {
      submitReviewGrade(button.dataset.grade);
    });
  });

  document.getElementById('review-card-delete')?.addEventListener('click', async () => {
    const card = getCurrentReviewCard();
    if (!card || state.reviewSubmitting) return;

    setStatus('review-status', 'Deleting card...');
    state.reviewSubmitting = true;
    try {
      await removeCard(card.id);
      removeReviewCardById(card.id);
      state.reviewTotalCount = Math.max(0, state.reviewTotalCount - 1);
      if (state.reviewDueCount > 0) {
        setStatus('review-status', 'Card deleted.', 'success');
      } else {
        setStatus('review-status', 'Card deleted. Queue complete.', 'success');
      }
    } catch (error) {
      setStatus('review-status', formatError(error), 'error');
    } finally {
      state.reviewSubmitting = false;
      renderReview();
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
  const dayKey = dateKey();
  const language = getFrequencyLanguageForMode();
  const seenSet = getSeenDailyWordsSet(language);

  let todayWords = [];
  const savedAssignment = await fetchDailyWordAssignment(language, dayKey);
  if (savedAssignment) {
    todayWords = resolveDailyWordsFromAssignment(words, savedAssignment);
  }
  if (!todayWords.length) {
    todayWords = pickDailyWords(words, seenSet, dayKey, WORDS_PER_DAY);
    if (todayWords.length) {
      await persistDailyWordAssignment(language, dayKey, todayWords.map(entry => entry.word));
    }
  }
  state.todayWords = todayWords;

  const savedIndex = await fetchDailyCardIndex(language, dayKey);
  const maxIndex = Math.max(0, state.todayWords.length - 1);
  state.currentWordIndex = savedIndex === null ? 0 : Math.min(savedIndex, maxIndex);
  state.seenWordIndexes = new Set(
    state.todayWords
      .map((entry, idx) => seenSet.has(normalizeFrequencyWord(entry.word)) ? idx : -1)
      .filter(idx => idx >= 0)
  );
  buildDailyDots();
  renderDailyWord(state.currentWordIndex);
  if (savedIndex !== null && state.currentWordIndex !== savedIndex) {
    persistDailyCardIndex(state.currentWordIndex);
  }

  updatePoolInfo();
}

async function bootApp() {
  showAppShell();
  renderAuthChrome();
  state.seenDailyWordsByLanguage = await initUnlockedWordsFromServer();
  const nextMode = resolveActiveModeForUser();
  if (nextMode) state.activeMode = nextMode;
  setupTabEvents();
  setupModeEvents();
  setupDailyEvents();
  setupDailyKeyboard();
  setupTranslateEvents();
  setupFrequencyEvents();
  setupReviewEvents();
  setupAuthEvents();
  setupFeedbackEvents();
  updateFrequencyModeLabel();
  updateTranslateResultUi();
  setNoteConfigOpen(false);
  if (nextMode) {
    await setLearningMode(state.activeMode, { force: true, resetTranslate: false });
  } else {
    showDailyUnavailable('Add a language to start learning.');
  }

  setActiveTab(resolveStartupTab(hasCelebratedDailyCompleteToday()));

  renderReview();
  document.body.classList.add('ready');
}

async function init() {
  updateDateLabel();
  setupLoginEvents();

  const user = await restoreSession();
  if (!user) {
    showLoginScreen();
    document.getElementById('loading').style.display = 'none';
    return;
  }

  document.getElementById('loading').style.display = 'none';
  await bootApp();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(reg => reg.unregister())).catch(() => {});
  }
}

init().catch(error => {
  console.error('Ten init failed:', error);
  document.getElementById('loading').style.display = 'none';
  const errorEl = document.getElementById('error');
  const detail = error instanceof Error ? error.message : String(error);
  errorEl.textContent = detail ? `Failed to initialize app: ${detail}` : 'Failed to initialize app.';
  errorEl.style.display = 'flex';
});
