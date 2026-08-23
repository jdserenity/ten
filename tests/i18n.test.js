import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appLangToApiCode,
  CATALOGS,
  detectAppLanguage,
  formatPoolDaysLabel,
  localeTagForAppLang,
  normalizeAppLang,
  resolveAppLang,
  t
} from '../src/client/i18n.js';

test('normalizeAppLang maps browser tags to supported locales', () => {
  assert.equal(normalizeAppLang('en'), 'en');
  assert.equal(normalizeAppLang('en-US'), 'en');
  assert.equal(normalizeAppLang('pt-BR'), 'pt-BR');
  assert.equal(normalizeAppLang('pt'), 'pt-BR');
  assert.equal(normalizeAppLang('fr'), '');
});

test('detectAppLanguage prefers the first supported browser language', () => {
  assert.equal(detectAppLanguage(['fr-FR', 'pt-BR']), 'pt-BR');
  assert.equal(detectAppLanguage(['de-DE', 'en-GB']), 'en');
  assert.equal(detectAppLanguage(['xx']), 'en');
});

test('resolveAppLang uses saved override when present', () => {
  assert.equal(resolveAppLang('pt-BR', ['en-US']), 'pt-BR');
  assert.equal(resolveAppLang(null, ['pt-BR']), 'pt-BR');
  assert.equal(resolveAppLang('', ['en-US']), 'en');
});

test('localeTagForAppLang maps UI locale to BCP 47 tags for date formatting', () => {
  assert.equal(localeTagForAppLang('en'), 'en-US');
  assert.equal(localeTagForAppLang('pt-BR'), 'pt-BR');
});

test('t interpolates variables and falls back to English', () => {
  assert.equal(t('en', 'settings.signedInAs'), 'Signed in as');
  assert.equal(t('pt-BR', 'login.signIn'), 'Entrar');
  assert.equal(t('pt-BR', 'feedback.title'), 'Sugestões');
  assert.equal(t('pt-BR', 'missing.key'), 'missing.key');
  assert.equal(t('en', 'daily.frequencyRank', { rank: 12, tier: 'common' }), 'Frequency rank #12 (common)');
});

test('appLangToApiCode maps UI locale to translate API codes', () => {
  assert.equal(appLangToApiCode('en'), 'EN');
  assert.equal(appLangToApiCode('pt-BR'), 'PT-BR');
});

test('formatPoolDaysLabel pluralizes in Portuguese', () => {
  assert.equal(formatPoolDaysLabel('en', 1, 'Brazil'), '~1 day left in Brazil pool');
  assert.equal(formatPoolDaysLabel('pt-BR', 2.5, 'Brasil'), '~2.5 dias restantes na lista Brasil');
});

const PT_PT_MARKERS = [
  'utilizador',
  'guardar',
  'ficheiro',
  'telemóvel',
  'ecrã',
  'autocarro',
  'facto',
  'introduza',
  'descarregar',
  'seleccion',
  'palavra-passe',
  'flashcard',
  'sentença',
  'nuance'
];

const PT_BR_SKIP_KEYS = new Set(['translate.lang.ptPt']);

test('pt-BR catalog avoids European Portuguese markers', () => {
  const catalog = CATALOGS['pt-BR'];
  for (const [key, value] of Object.entries(catalog)) {
    if (PT_BR_SKIP_KEYS.has(key)) continue;
    const lower = String(value).toLowerCase();
    for (const marker of PT_PT_MARKERS) {
      assert.equal(
        lower.includes(marker),
        false,
        `pt-BR key "${key}" contains European marker "${marker}": ${value}`
      );
    }
  }
});

test('pt-BR onboarding copy uses Brazilian Portuguese', () => {
  assert.equal(t('pt-BR', 'daily.addLanguage'), 'Adicione um idioma!');
  assert.equal(t('pt-BR', 'settings.signedInAs'), 'Logado como');
  assert.equal(t('pt-BR', 'translate.offline'), 'Sem internet: você precisa estar online para traduzir.');
});

test('tab labels are 5/new, 5/review, and Progress', () => {
  assert.equal(t('en', 'tab.daily'), '5/new');
  assert.equal(t('en', 'tab.review'), '5/review');
  assert.equal(t('en', 'tab.frequency'), 'Progress');
  assert.equal(t('pt-BR', 'tab.daily'), '5/novas');
  assert.equal(t('pt-BR', 'tab.review'), '5/revisar');
  assert.equal(t('pt-BR', 'tab.frequency'), 'Progresso');
});

test('dialect step title is Which language', () => {
  assert.equal(t('en', 'picker.whichFamily', { language: 'French' }), 'Which French?');
  assert.equal(t('pt-BR', 'picker.whichFamily', { language: 'Francês' }), 'Qual Francês?');
});

test('dialect picker copy is the region name only', () => {
  assert.equal(t('en', 'picker.dialect.ptBr'), 'Brazil');
  assert.equal(t('en', 'picker.dialect.fr'), 'Quebec');
  assert.equal(t('en', 'picker.dialect.frFr'), 'France');
  assert.equal(t('en', 'picker.dialect.esAr'), 'Argentina');
  assert.equal(t('pt-BR', 'picker.dialect.ptBr'), 'Brasil');
  assert.equal(t('pt-BR', 'picker.dialect.frFr'), 'França');
});

test('add-to-review button copy and configure flashcard labels', () => {
  assert.equal(t('en', 'daily.addAll'), 'Add all to review');
  assert.equal(t('pt-BR', 'daily.addAll'), 'Adicionar tudo à revisão');
  assert.equal(t('en', 'translate.addCard'), 'Add to review');
  assert.equal(t('en', 'translate.addCardBtn'), 'Add to review');
  assert.equal(t('pt-BR', 'translate.addCard'), 'Adicionar à revisão');
  assert.equal(t('en', 'translate.configureNote'), 'Configure flashcard');
  assert.equal(t('pt-BR', 'translate.configureNote'), 'Configurar cartão');
  assert.equal(t('en', 'translate.hideNoteConfig'), 'Hide flashcard config');
  assert.equal(CATALOGS.en['translate.addOpenReview'], undefined);
  assert.equal(CATALOGS['pt-BR']['translate.addOpenReview'], undefined);
});
