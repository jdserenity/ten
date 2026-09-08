import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  normalizeDetectedSourceLanguage,
  normalizeSourceLanguage,
  normalizeTargetLanguage,
  toDeepLTargetLanguage,
  toGoogleLanguageCode
} from '../server/language-codes.js';

const clientAppSource = readFileSync(
  new URL('../src/client/app.js', import.meta.url),
  'utf8'
);

test('server language codes preserve Caracas Venezuelan Spanish internally', () => {
  assert.equal(normalizeSourceLanguage('es-VE'), 'ES-VE');
  assert.equal(normalizeTargetLanguage('es-VE'), 'ES-VE');
  assert.equal(normalizeDetectedSourceLanguage('es-VE'), 'ES-VE');
});

test('translation providers receive their supported Spanish codes', () => {
  assert.equal(toGoogleLanguageCode('ES-VE'), 'es-VE');
  assert.equal(toGoogleLanguageCode('ES-AR'), 'es-AR');
  assert.equal(toDeepLTargetLanguage('ES-VE'), 'ES');
  assert.equal(toDeepLTargetLanguage('ES-AR'), 'ES');
});

test('client preserves the regional target for server-side provider routing', () => {
  const translateText = clientAppSource.match(
    /async function translateText[\s\S]*?(?=\nasync function extractErrorDetails)/
  );

  assert.ok(translateText, 'translateText implementation should exist');
  assert.match(translateText[0], /canonicalizeTranslateLanguage\(target\)/);
  assert.doesNotMatch(translateText[0], /toDeepLTargetLanguage/);
});
