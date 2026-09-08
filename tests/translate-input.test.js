import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { translateInputLanguageTag } from '../src/client/ten-logic.js';

const html = readFileSync(new URL('../src/client/index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/client/app.js', import.meta.url), 'utf8');

test('translateInputLanguageTag maps translation sources to regional HTML language tags', () => {
  assert.equal(translateInputLanguageTag('EN'), 'en');
  assert.equal(translateInputLanguageTag('PT-BR'), 'pt-BR');
  assert.equal(translateInputLanguageTag('FR'), 'fr-CA');
  assert.equal(translateInputLanguageTag('FR-FR'), 'fr-FR');
  assert.equal(translateInputLanguageTag('ES-AR'), 'es-AR');
  assert.equal(translateInputLanguageTag('unknown'), '');
});

test('translate textarea enables language-aware typing support', () => {
  const textarea = html.match(/<textarea id="translate-input"[^>]*>/)?.[0] || '';
  assert.match(textarea, /spellcheck="true"/);
  assert.match(textarea, /autocorrect="on"/);
  assert.match(textarea, /autocapitalize="sentences"/);
  assert.match(app, /translateInput\.lang = inputLanguage/);
});

test('translation language changes preserve the entry and clear only stale output', () => {
  const swapBlock = app.match(/function swapTranslateDirection\(\) \{[\s\S]*?\n\}/)?.[0] || '';
  const modeBlock = app.match(/async function setLearningMode[\s\S]*?\n\}/)?.[0] || '';
  const resultBlock = app.match(/function clearTranslateResult\(\) \{[\s\S]*?\n\}/)?.[0] || '';
  assert.match(swapBlock, /clearTranslateResult\(\)/);
  assert.doesNotMatch(swapBlock, /clearTranslateDraft\(\)/);
  assert.match(modeBlock, /if \(resetTranslate\) clearTranslateResult\(\)/);
  assert.doesNotMatch(resultBlock, /translateInput[^\n]*value\s*=\s*''/);
  assert.match(app, /clear-translate-btn'[\s\S]*?clearTranslateDraft\(\)/);
});
