const WORDS_PER_DAY = 10;

const STORAGE_KEYS = {
  settings: 'ten-settings-v2'
};

const DEFAULT_SETTINGS = {
  translateEndpoint: 'http://127.0.0.1:5000/translate',
  translateApiKey: '',
  translateSource: 'auto',
  translateTarget: 'en',
  ankiEndpoint: 'http://127.0.0.1:8765',
  ankiDeck: 'Brazilian Portuguese',
  ankiModel: 'Basic'
};

const state = {
  activeTab: 'daily',
  settingsOpen: false,
  settings: loadSettings(),
  hasTranslatedInSession: false,
  noteConfigOpen: false,
  words: [],
  todayWords: [],
  currentWordIndex: 0,
  seenWordIndexes: new Set(),
  reviewCards: [],
  reviewTotalCount: 0,
  reviewCurrentIndex: 0,
  reviewAnswerVisible: false,
  reviewSubmitting: false
};

let dailyDots = [];

function readStoredJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (_) {
    return fallback;
  }
}

function writeStoredJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (_) {}
}

function loadSettings() {
  const stored = readStoredJson(STORAGE_KEYS.settings, {});
  return { ...DEFAULT_SETTINGS, ...(stored && typeof stored === 'object' ? stored : {}) };
}

function saveSettings(settings) {
  writeStoredJson(STORAGE_KEYS.settings, settings);
}

function normalizeTranslateDirection(source, target) {
  const sourceLang = source === 'en' ? 'en' : 'pb';
  let targetLang = target === 'pb' ? 'pb' : 'en';
  if (sourceLang === targetLang) {
    targetLang = sourceLang === 'pb' ? 'en' : 'pb';
  }
  return { source: sourceLang, target: targetLang };
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

function setStatus(elementId, message, tone = '') {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = message || '';
  el.className = 'status-line';
  if (tone) el.classList.add(tone);
}

function speakText(text, button) {
  const phrase = String(text || '').trim();
  if (!phrase || !window.speechSynthesis) return;

  window.speechSynthesis.cancel();
  document.querySelectorAll('.speaking').forEach(el => el.classList.remove('speaking'));

  const utt = new SpeechSynthesisUtterance(phrase);
  utt.lang = 'pt-BR';
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

function setSettingsOpen(open) {
  state.settingsOpen = Boolean(open);
  const panel = document.getElementById('settings-panel');
  const button = document.getElementById('settings-toggle-btn');
  if (!panel || !button) return;
  panel.classList.toggle('hidden', !state.settingsOpen);
  document.body.classList.toggle('settings-open', state.settingsOpen);
  button.textContent = state.settingsOpen ? 'Close settings' : 'Settings';
  button.setAttribute('aria-expanded', String(state.settingsOpen));
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
    document.getElementById('translation').textContent = 'words.json could not be loaded.';
    document.getElementById('s1-pt').textContent = '';
    document.getElementById('s1-en').textContent = '';
    document.getElementById('s2-pt').textContent = '';
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
  state.seenWordIndexes.add(index);

  const firstSentence = word.sentences && word.sentences[0] ? word.sentences[0] : {};
  const secondSentence = word.sentences && word.sentences[1] ? word.sentences[1] : {};

  document.getElementById('word').textContent = word.word;
  document.getElementById('translation').textContent = word.translation;
  document.getElementById('s1-pt').textContent = firstSentence.pt || '';
  document.getElementById('s1-en').textContent = firstSentence.en || '';
  document.getElementById('s2-pt').textContent = secondSentence.pt || '';
  document.getElementById('s2-en').textContent = secondSentence.en || '';
  document.getElementById('counter').textContent = `${index + 1} / ${state.todayWords.length}`;
  document.getElementById('prev-btn').disabled = index === 0;
  document.getElementById('next-btn').disabled = index === state.todayWords.length - 1;
  document.getElementById('speak-btn').disabled = !word.word;
  document.getElementById('s1-speak-btn').disabled = !firstSentence.pt;
  document.getElementById('s2-speak-btn').disabled = !secondSentence.pt;
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
  setStatus('daily-save-status', 'Daily list is unavailable until words.json loads again.', 'error');
}

function fillSettingsInputs() {
  document.getElementById('translate-endpoint-input').value = state.settings.translateEndpoint;
  document.getElementById('anki-endpoint-input').value = state.settings.ankiEndpoint;
  document.getElementById('anki-deck-input').value = state.settings.ankiDeck;
  document.getElementById('anki-model-input').value = state.settings.ankiModel;
  const direction = normalizeTranslateDirection(state.settings.translateSource, state.settings.translateTarget);
  state.settings.translateSource = direction.source;
  state.settings.translateTarget = direction.target;
  updateTranslateDirectionUi();
}

function collectSettingsFromInputs() {
  const direction = normalizeTranslateDirection(state.settings.translateSource, state.settings.translateTarget);
  return {
    translateEndpoint: document.getElementById('translate-endpoint-input').value.trim(),
    translateSource: direction.source,
    translateTarget: direction.target,
    ankiEndpoint: document.getElementById('anki-endpoint-input').value.trim(),
    ankiDeck: document.getElementById('anki-deck-input').value.trim(),
    ankiModel: document.getElementById('anki-model-input').value.trim(),
  };
}

function persistSettingsFromInputs(showMessage = false) {
  state.settings = { ...DEFAULT_SETTINGS, ...collectSettingsFromInputs() };
  saveSettings(state.settings);
  if (showMessage) { setStatus('settings-status', 'Settings saved locally on this device.', 'success'); }
  return state.settings;
}

async function libreTranslate(settings, text, source, target) {
  const endpoint = String(settings.translateEndpoint || '').trim();
  if (!endpoint) throw new Error('Set a LibreTranslate endpoint first.');

  const payload = {
    q: text,
    source,
    target,
    format: 'text',
    endpoint,
    apiKey: settings.translateApiKey
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
  return body.translatedText.trim();
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

async function ankiInvoke(settings, action, params = {}) {
  const endpoint = String(settings.ankiEndpoint || '').trim();
  if (!endpoint) throw new Error('Set an AnkiConnect endpoint first.');

  const response = await fetch('/api/anki', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint, action, version: 6, params })
  });

  if (!response.ok) { throw new Error(`AnkiConnect request failed (${response.status}).`); }

  const body = await response.json();
  if (body && body.error) throw new Error(body.error);
  return body ? body.result : null;
}

async function addNoteToAnki({ front, back, context }, statusElementId) {
  const settings = persistSettingsFromInputs(false);
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
  const settings = persistSettingsFromInputs(false);
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

function renderReview() {
  const dueCount = state.reviewCards.length;
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

async function loadReviewFromAnki() {
  const settings = persistSettingsFromInputs(false);
  const deck = String(settings.ankiDeck || '').trim();
  if (!deck) {
    setStatus('review-status', 'Set an Anki deck in Connection settings first.', 'error');
    state.reviewCards = [];
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
      ankiInvoke(settings, 'findCards', { query: baseQuery })
    ]);

    const dueList = Array.isArray(dueIds) ? dueIds : [];
    const totalList = Array.isArray(totalIds) ? totalIds : [];

    let cards = [];
    if (dueList.length) {
      const infos = await ankiInvoke(settings, 'cardsInfo', { cards: dueList });
      cards = (Array.isArray(infos) ? infos : [])
        .map(mapCardInfoToReviewCard)
        .filter(card => Number.isFinite(card.cardId))
        .sort((a, b) => a.due - b.due);
    }

    state.reviewCards = cards;
    state.reviewTotalCount = totalList.length;
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

  const settings = persistSettingsFromInputs(false);
  setStatus('review-status', `Submitting "${grade}" to Anki...`);
  state.reviewSubmitting = true;

  try {
    await ankiInvoke(settings, 'answerCards', {
      answers: [{ cardId: card.cardId, ease }]
    });

    setStatus('review-status', `Saved "${grade}". Loading next due card...`, 'success');
    await loadReviewFromAnki();
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
  if (tabId === 'review') {
    loadReviewFromAnki();
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
  const fromLabel = document.getElementById('translate-from-label');
  const toLabel = document.getElementById('translate-to-label');
  if (!fromLabel || !toLabel) return;
  fromLabel.textContent = state.settings.translateSource === 'en' ? 'English' : 'Brazilian';
  toLabel.textContent = state.settings.translateTarget === 'en' ? 'English' : 'Brazilian';
}

function swapTranslateDirection() {
  const nextSource = state.settings.translateTarget === 'en' ? 'en' : 'pb';
  const nextTarget = nextSource === 'en' ? 'pb' : 'en';
  state.settings.translateSource = nextSource;
  state.settings.translateTarget = nextTarget;
  saveSettings(state.settings);
  updateTranslateDirectionUi();
}

function clearTranslateDraft() {
  document.getElementById('translate-input').value = '';
  document.getElementById('translate-result-text').textContent = '';
  document.getElementById('card-front-input').value = '';
  document.getElementById('card-back-input').value = '';
  document.getElementById('card-context-input').value = '';
  state.hasTranslatedInSession = false;
  setStatus('translate-status', '');
  setStatus('quick-add-status', '');
  setStatus('card-save-status', '');
  updateTranslateResultUi();
}

function setupTabEvents() {
  document.querySelectorAll('.top-tab').forEach(button => {
    button.addEventListener('click', () => setActiveTab(button.dataset.tab));
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
    const text = word && word.sentences && word.sentences[0] ? word.sentences[0].pt : '';
    speakText(text, document.getElementById('s1-speak-btn'));
  });
  document.getElementById('s2-speak-btn').addEventListener('click', () => {
    const word = state.todayWords[state.currentWordIndex];
    const text = word && word.sentences && word.sentences[1] ? word.sentences[1].pt : '';
    speakText(text, document.getElementById('s2-speak-btn'));
  });

  document.getElementById('save-daily-card-btn').addEventListener('click', async () => {
    const word = state.todayWords[state.currentWordIndex];
    if (!word) {
      setStatus('daily-save-status', 'No daily card available to add.', 'error');
      return;
    }

    const context = (word.sentences || [])
      .map(sentence => sentence && sentence.pt ? sentence.pt : '')
      .filter(Boolean)
      .join('\n');

    await addNoteToAnki(
      { front: word.translation, back: word.word, context },
      'daily-save-status'
    );
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
    const textForTranslation = text.toLocaleLowerCase();

    const settings = persistSettingsFromInputs(false);
    const source = settings.translateSource;
    const target = settings.translateTarget;
    const translateBtn = document.getElementById('translate-btn');
    translateBtn.disabled = true;
    setStatus('translate-status', 'Translating...');

    try {
      const translated = await libreTranslate(settings, textForTranslation, source, target);
      document.getElementById('translate-result-text').textContent = translated;
      const englishText = target === 'pb' ? text : translated;
      const portugueseText = target === 'pb' ? translated : text;
      document.getElementById('card-front-input').value = capitalizeFirstWord(englishText);
      document.getElementById('card-back-input').value = capitalizeFirstWord(portugueseText);
      document.getElementById('card-context-input').value = text.split(/\s+/).length > 1 ? text : '';
      state.hasTranslatedInSession = true;
      setStatus('translate-status', 'Translated.', 'success');
      setStatus('quick-add-status', '');
      updateTranslateResultUi();
    } catch (error) {
      setStatus('translate-status', formatError(error), 'error');
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

function setupSettingsEvents() {
  document.getElementById('settings-toggle-btn').addEventListener('click', () => {
    setSettingsOpen(!state.settingsOpen);
  });

  document.getElementById('save-settings-btn').addEventListener('click', () => {
    persistSettingsFromInputs(true);
  });
}

function setupReviewEvents() {
  document.getElementById('review-show-answer-btn').addEventListener('click', () => {
    if (!getCurrentReviewCard()) return;
    state.reviewAnswerVisible = true;
    renderReview();
  });

  document.getElementById('review-refresh-btn').addEventListener('click', () => {
    loadReviewFromAnki();
  });

  document.querySelectorAll('#review-grade-row button[data-grade]').forEach(button => {
    button.addEventListener('click', () => {
      submitReviewGrade(button.dataset.grade);
    });
  });

  document.getElementById('review-card-delete').addEventListener('click', async () => {
    await removeNoteFromAnki(getCurrentReviewCard().noteId)
    loadReviewFromAnki()
  })
}

async function initDailyWords() {
  const response = await fetch('/words.json');
  if (!response.ok) throw new Error(`Failed to load words.json (${response.status}).`);
  const words = await response.json();
  if (!Array.isArray(words) || !words.length) throw new Error('words.json is empty.');

  state.words = words;
  const seed = hashDate(dateKey());
  state.todayWords = seededShuffle(words, seed).slice(0, WORDS_PER_DAY);
  state.currentWordIndex = 0;
  state.seenWordIndexes = new Set();
  buildDailyDots();
  renderDailyWord(0);

  const totalDays = Math.floor(words.length / WORDS_PER_DAY);
  const poolInfo = document.getElementById('pool-info');
  poolInfo.textContent = `~${totalDays} day${totalDays !== 1 ? 's' : ''} left in pool`;
  poolInfo.classList.toggle('warning', totalDays <= 7);
}

async function init() {
  updateDateLabel();
  fillSettingsInputs();
  setupTabEvents();
  setupDailyEvents();
  setupDailyKeyboard();
  setupTranslateEvents();
  setupSettingsEvents();
  setupReviewEvents();
  updateTranslateResultUi();
  setNoteConfigOpen(false);
  setSettingsOpen(false);

  try { await initDailyWords();
  } catch (error) { showDailyUnavailable(formatError(error)); }

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
