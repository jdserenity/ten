import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appLangToApiCode,
  detectAppLanguage,
  formatPoolDaysLabel,
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

test('t interpolates variables and falls back to English', () => {
  assert.equal(t('en', 'settings.signedInAs'), 'Signed in as');
  assert.equal(t('pt-BR', 'login.signIn'), 'Entrar');
  assert.equal(t('pt-BR', 'missing.key'), 'missing.key');
  assert.equal(t('en', 'daily.frequencyRank', { rank: 12, tier: 'common' }), 'Frequency rank #12 (common)');
});

test('appLangToApiCode maps UI locale to translate API codes', () => {
  assert.equal(appLangToApiCode('en'), 'EN');
  assert.equal(appLangToApiCode('pt-BR'), 'PT-BR');
});

test('formatPoolDaysLabel pluralizes in Portuguese', () => {
  assert.equal(formatPoolDaysLabel('en', 1, 'Brazil'), '~1 day left in Brazil pool');
  assert.equal(formatPoolDaysLabel('pt-BR', 2.5, 'Brasil'), '~2.5 dias restantes no pool Brasil');
});
