export const SUPPORTED_APP_LANGS = ['en'];
const DEFAULT_APP_LANG = 'en';

const en = {
  'app.loading': 'Loading...',
  'app.initFailed': 'Failed to initialize app.',
  'app.initFailedDetail': 'Failed to initialize app: {detail}',
  'login.username': 'Username',
  'login.signIn': 'Sign in',
  'login.enterUsername': 'Enter a username.',
  'login.signingIn': 'Signing in...',
  'login.couldNotSignIn': 'Could not sign in.',
  'header.feedbackPlaceholder': 'feedback',
  'header.feedbackAria': 'Send feedback',
  'header.settingsAria': 'Settings',
  'header.settingsTitle': 'Settings',
  'header.addLanguagesAria': 'Add languages',
  'header.addLanguagesTitle': 'Add languages',
  'header.learningModeAria': 'Learning mode',
  'header.switchPtBr': 'Switch to Brazilian Portuguese',
  'header.switchFr': 'Switch to Quebec French',
  'header.switchFrFr': 'Switch to France French',
  'header.switchEsAr': 'Switch to Argentinian Spanish',
  'header.switchEsVe': 'Switch to Venezuelean Spanish',
  'picker.chooseLanguages': 'Choose languages',
  'picker.addLanguages': 'Add languages',
  'picker.add': 'Add',
  'picker.save': 'Save',
  'picker.back': 'Back',
  'picker.family.es': 'Spanish',
  'picker.family.fr': 'French',
  'picker.family.pt': 'Portuguese',
  'picker.whichFamily': 'Which {language}?',
  'picker.dialect.ptBr': 'Brazil',
  'picker.dialect.fr': 'Quebec',
  'picker.dialect.frFr': 'France',
  'picker.dialect.esAr': 'Argentina',
  'picker.dialect.esVe': 'Venezuela',
  'picker.ptBr': 'Brazilian Portuguese',
  'picker.fr': 'Quebec French',
  'picker.frFr': 'France French',
  'picker.esAr': 'Argentinian Spanish',
  'picker.esVe': 'Venezuelean Spanish',
  'picker.allLanguages': 'You already have every language.',
  'settings.title': 'Settings',
  'settings.closeAria': 'Close settings',
  'settings.signedInAs': 'Signed in as',
  'settings.languages': 'Languages',
  'settings.addLanguageAria': 'Add a language',
  'settings.addLanguageTitle': 'Add a language',
  'settings.couldNotSaveLanguages': 'Could not save languages.',
  'settings.signOut': 'Sign out',
  'settings.feedbackTitle': 'Feedback',
  'settings.noFeedback': 'No feedback yet.',
  'feedback.title': 'Feedback',
  'feedback.closeAria': 'Close feedback',
  'feedback.submit': 'Submit',
  'feedback.thanks': 'Thanks — feedback sent.',
  'feedback.writeFirst': 'Write something first.',
  'feedback.couldNotSend': 'Could not send feedback.',
  'tab.daily': '3/new',
  'tab.review': '7/review',
  'tab.frequency': 'Progress',
  'tab.translate': 'Translate',
  'tab.mainAria': 'Main tabs',
  'daily.hearWord': 'Hear pronunciation',
  'daily.addWord': 'Add word as card',
  'daily.hearSentence': 'Hear sentence',
  'daily.addSentence': 'Add sentence as card',
  'daily.prev': '← Prev',
  'daily.next': 'Next →',
  'daily.addAll': 'Add all to review',
  'daily.unavailable': 'Daily words unavailable',
  'daily.glossLoading': '…',
  'daily.glossUnavailable': 'Translation unavailable',
  'daily.frequencyRank': 'Frequency rank #{rank} ({tier})',
  'daily.frequencyRankUnavailable': 'Frequency rank unavailable',
  'daily.noCardToAdd': 'No daily card available to add.',
  'daily.noSentence': 'No sentence available.',
  'daily.noCard': 'No daily card available.',
  'daily.savingCards': 'Saving 3 cards...',
  'daily.addedCards': 'Added {count} card.',
  'daily.addedCardsPlural': 'Added {count} cards.',
  'daily.missingSentence': 'Missing sentence or translation.',
  'daily.addLanguage': 'Add a language!',
  'daily.pickLanguage': 'Pick at least one language.',
  'daily.sentenceInUse': 'new word used in context',
  'daily.anotherContext': 'another',
  'daily.goToCard': 'Go to card {n}',
  'translate.title': 'Translate',
  'translate.directionAria': 'Translation direction',
  'translate.from': 'From',
  'translate.to': 'To',
  'translate.autoDetected': 'Auto-detected',
  'translate.autoDetectedDetail': '{detected} (selected {selected})',
  'translate.swapAria': 'Swap languages',
  'translate.swapTitle': 'Swap languages',
  'translate.text': 'Text',
  'translate.placeholder': 'Type or paste text to translate...',
  'translate.button': 'Translate',
  'translate.clearAria': 'Clear translation input and result',
  'translate.clearTitle': 'Clear',
  'translate.result': 'Result',
  'translate.addCard': 'Add to review',
  'translate.configureNote': 'Configure flashcard',
  'translate.hideNoteConfig': 'Hide flashcard config',
  'translate.noteConfig': 'Flashcard note config',
  'translate.front': 'Front ({language})',
  'translate.frontPlaceholder': '{language} word, phrase, or sentence',
  'translate.back': 'Back ({language})',
  'translate.backPlaceholder': '{language} translation',
  'translate.context': 'Context (optional)',
  'translate.contextPlaceholder': 'Sentence, nuance, or reminder',
  'translate.addCardBtn': 'Add to review',
  'translate.enterText': 'Enter text before translating.',
  'translate.offline': 'Offline: translation requires internet access.',
  'translate.lang.english': 'English',
  'translate.lang.french': 'French',
  'translate.lang.ptBr': 'Brazilian Portuguese',
  'translate.lang.portuguese': 'Portuguese',
  'translate.lang.enUs': 'English (US)',
  'translate.lang.enGb': 'English (UK)',
  'translate.lang.ptPt': 'European Portuguese',
  'translate.lang.frCa': 'French (Canada)',
  'translate.lang.frFr': 'French (France)',
  'translate.lang.esAr': 'Argentinian Spanish',
  'translate.lang.esVe': 'Venezuelean Spanish',
  'translate.lang.spanish': 'Spanish',
  'translate.lang.esArRegion': 'Spanish (Argentina)',
  'translate.lang.esVeRegion': 'Spanish (Venezuela)',
  'translate.lang.es419': 'Spanish (Latin America)',
  'frequency.dictionary': '{language} dictionary',
  'frequency.unlocked': 'Unlocked',
  'frequency.notLearned': 'Not learned',
  'frequency.search': 'Search',
  'frequency.searchPlaceholder': 'Rank (#42) or word…',
  'frequency.noMatches': 'No matches',
  'frequency.matchCount': '{count} entries',
  'frequency.matchCountOf': '{match} of {total} entries',
  'frequency.tier.veryCommon': 'very common',
  'frequency.tier.common': 'common',
  'frequency.tier.midFrequency': 'mid-frequency',
  'frequency.tier.lessCommon': 'less common',
  'frequency.rankInput': 'Input',
  'frequency.rankResult': 'Result',
  'frequency.rankWithTier': '{label} frequency rank #{rank} ({tier})',
  'frequency.rankUnavailable': '{label} frequency rank unavailable',
  'review.toStudy': 'To study',
  'review.totalCards': 'Total cards',
  'review.empty.needCardsLabel': 'Need cards',
  'review.empty.needCardsMessage': 'Add flashcards from 3/new (use the ＋ buttons), then come back here to review.',
  'review.empty.allClearLabel': 'All clear',
  'review.empty.allClearMessage': 'No new or due cards for this language. Add cards from Translate or 3/new.',
  'review.front': 'Front',
  'review.back': 'Back',
  'review.hearBack': 'Hear back',
  'review.frontEdit': 'Front ({language})',
  'review.frontPlaceholder': 'Front of card',
  'review.backPlaceholder': 'Back of card',
  'review.saveChanges': 'Save changes',
  'review.cancel': 'Cancel',
  'review.showAnswer': 'Show answer',
  'review.grade.again': 'Again',
  'review.grade.hard': 'Hard',
  'review.grade.good': 'Good',
  'review.grade.easy': 'Easy',
  'review.editCard': 'Edit card',
  'review.deleteCard': 'Delete Card',
  'review.savingChanges': 'Saving changes...',
  'review.cardUpdated': 'Card updated.',
  'review.deleting': 'Deleting card...',
  'review.cardDeleted': 'Card deleted.',
  'review.cardDeletedEmpty': 'Card deleted. Add more cards from 3/new to keep reviewing.',
  'card.frontBackRequired': 'Front and back are required.',
  'card.saving': 'Saving card...',
  'card.alreadyExists': 'Card already exists.',
  'card.saved': 'Card saved.',
  'card.alreadyExistsLanguage': 'Card already exists for this language.',
  'error.generic': 'Something went wrong.',
  'error.translateEnterText': 'Enter text before translating.',
  'pool.daysLeft': '~{count} {unit} left in {flag} pool',
  'pool.day': 'day',
  'pool.days': 'days',
  'mode.ptBr': 'Brazilian Portuguese',
  'mode.fr': 'Quebec French',
  'mode.frFr': 'France French',
  'mode.ptBrShort': 'Brazilian',
  'mode.frShort': 'Quebec',
  'mode.frFrShort': 'France',
  'mode.ptBrTranslator': 'Portuguese',
  'mode.frTranslator': 'French',
  'mode.frFrTranslator': 'French',
  'mode.brazilFlag': 'Brazil',
  'mode.quebecFlag': 'Quebec',
  'mode.franceFlag': 'France',
  'mode.esAr': 'Argentinian Spanish',
  'mode.esArShort': 'Argentina',
  'mode.esArTranslator': 'Spanish',
  'mode.argentinaFlag': 'Argentina',
  'mode.esVe': 'Venezuelean Spanish',
  'mode.esVeShort': 'Venezuela',
  'mode.esVeTranslator': 'Spanish',
  'mode.venezuelaFlag': 'Venezuela'
};

export const CATALOGS = { en };

export function normalizeAppLang(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const lower = raw.toLowerCase();
  if (lower === 'en' || lower.startsWith('en-')) return 'en';
  return SUPPORTED_APP_LANGS.includes(raw) ? raw : '';
}

export function detectAppLanguage(languages) {
  const list = Array.isArray(languages) ? languages : [languages];
  for (const entry of list) {
    const normalized = normalizeAppLang(entry);
    if (normalized) return normalized;
  }
  return DEFAULT_APP_LANG;
}

export function resolveAppLang(savedAppLang, browserLanguages) {
  const saved = normalizeAppLang(savedAppLang);
  if (saved) return saved;
  return detectAppLanguage(browserLanguages);
}

export function appLangToApiCode() {
  return 'EN';
}

export function localeTagForAppLang() {
  return 'en-US';
}

export function t(lang, key, vars = {}) {
  const locale = normalizeAppLang(lang) || DEFAULT_APP_LANG;
  const catalog = CATALOGS[locale] || CATALOGS.en;
  const fallback = CATALOGS.en[key] || key;
  const template = catalog[key] || fallback;
  return String(template).replace(/\{(\w+)\}/g, (_, name) => {
    if (Object.prototype.hasOwnProperty.call(vars, name)) return String(vars[name]);
    return `{${name}}`;
  });
}

export function formatPoolDaysLabel(lang, days, flagLabel) {
  const count = Number.isInteger(days) ? String(days) : days.toFixed(1);
  const unit = days === 1 ? t(lang, 'pool.day') : t(lang, 'pool.days');
  return t(lang, 'pool.daysLeft', { count, unit, flag: flagLabel });
}
