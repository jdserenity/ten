import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

const html = readFileSync(new URL('../src/client/index.html', import.meta.url), 'utf8');

test('normalizeAppLang only supports English as the app language', () => {
  assert.equal(normalizeAppLang('en'), 'en');
  assert.equal(normalizeAppLang('en-US'), 'en');
  assert.equal(normalizeAppLang('pt-BR'), '');
  assert.equal(normalizeAppLang('pt'), '');
  assert.equal(normalizeAppLang('fr'), '');
});

test('detectAppLanguage always returns English', () => {
  assert.equal(detectAppLanguage(['fr-FR', 'pt-BR']), 'en');
  assert.equal(detectAppLanguage(['pt-BR']), 'en');
  assert.equal(detectAppLanguage(['de-DE', 'en-GB']), 'en');
  assert.equal(detectAppLanguage(['xx']), 'en');
});

test('resolveAppLang ignores any saved non-English override', () => {
  assert.equal(resolveAppLang('pt-BR', ['en-US']), 'en');
  assert.equal(resolveAppLang(null, ['pt-BR']), 'en');
  assert.equal(resolveAppLang('', ['en-US']), 'en');
});

test('localeTagForAppLang always returns the English BCP 47 tag', () => {
  assert.equal(localeTagForAppLang('en'), 'en-US');
  assert.equal(localeTagForAppLang('pt-BR'), 'en-US');
});

test('there is no Portuguese app-language catalog or settings option', () => {
  assert.deepEqual(Object.keys(CATALOGS), ['en']);
  assert.equal(CATALOGS['pt-BR'], undefined);
  assert.doesNotMatch(html, /settings-app-lang/);
  assert.doesNotMatch(html, /data-app-lang/);
  const app = readFileSync(new URL('../src/client/app.js', import.meta.url), 'utf8');
  assert.doesNotMatch(app, /renderSettingsAppLangButtons|saveAppLanguage|settings-app-lang/);
});

test('t interpolates variables and falls back to English', () => {
  assert.equal(t('en', 'settings.signedInAs'), 'Signed in as');
  assert.equal(t('pt-BR', 'login.signIn'), 'Sign in');
  assert.equal(t('pt-BR', 'missing.key'), 'missing.key');
  assert.equal(t('en', 'daily.frequencyRank', { rank: 12, tier: 'common' }), 'Frequency rank #12 (common)');
});

test('appLangToApiCode always maps the UI locale to English', () => {
  assert.equal(appLangToApiCode('en'), 'EN');
  assert.equal(appLangToApiCode('pt-BR'), 'EN');
});

test('formatPoolDaysLabel formats in English', () => {
  assert.equal(formatPoolDaysLabel('en', 1, 'Brazil'), '~1 day left in Brazil pool');
  assert.equal(formatPoolDaysLabel('pt-BR', 2.5, 'Brazil'), '~2.5 days left in Brazil pool');
});

test('tab labels are 3/new, 7/review, and Progress', () => {
  assert.equal(t('en', 'tab.daily'), '3/new');
  assert.equal(t('en', 'tab.review'), '7/review');
  assert.equal(t('en', 'tab.frequency'), 'Progress');
});

test('Translate is the third tab and Progress is the fourth tab', () => {
  const tabs = [...html.matchAll(/<button class="top-tab(?: active)?" data-tab="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(tabs, ['daily', 'review', 'translate', 'frequency']);
});

test('dialect step title is Which language', () => {
  assert.equal(t('en', 'picker.whichFamily', { language: 'French' }), 'Which French?');
});

test('dialect picker copy is the region name only', () => {
  assert.equal(t('en', 'picker.dialect.ptBr'), 'Brazil');
  assert.equal(t('en', 'picker.dialect.fr'), 'Quebec');
  assert.equal(t('en', 'picker.dialect.frFr'), 'France');
  assert.equal(t('en', 'picker.dialect.esAr'), 'Argentina');
  assert.equal(t('en', 'picker.dialect.esVe'), 'Venezuela');
});

test('add-to-review button copy and configure flashcard labels', () => {
  assert.equal(t('en', 'daily.addAll'), 'Add all to review');
  assert.equal(t('en', 'translate.addCard'), 'Add to review');
  assert.equal(t('en', 'translate.addCardBtn'), 'Add to review');
  assert.equal(t('en', 'translate.configureNote'), 'Configure flashcard');
  assert.equal(t('en', 'translate.hideNoteConfig'), 'Hide flashcard config');
  assert.equal(CATALOGS.en['translate.addOpenReview'], undefined);
});
