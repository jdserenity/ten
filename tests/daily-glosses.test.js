import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildDailyGlossFields,
  cardGlossesAreComplete,
  ensureDailyGlosses,
  pruneGlossesForCards,
  resolveGlossFromCacheOrFallback
} from '../server/daily-glosses.js';

const sampleCard = {
  word: 'bonjour',
  translation: 'hello',
  sentences: [
    { fr: 'Bonjour, comment ça va?', en: 'Hello, how are you?' },
    { fr: 'Il dit bonjour chaque matin.', en: 'He says hello every morning.' },
    { fr: 'Bonjour à tous!', en: 'Hello everyone!' }
  ]
};

test('buildDailyGlossFields includes word and present sentences only', () => {
  const fields = buildDailyGlossFields(sampleCard, 'fr');
  assert.equal(fields.length, 4);
  assert.equal(fields[0].key, 'wordGloss');
  assert.equal(fields[0].englishFallback, 'hello');
});

test('resolveGlossFromCacheOrFallback uses English JSON without cache lookup', () => {
  const resolved = resolveGlossFromCacheOrFallback({
    sourceText: 'bonjour',
    sourceLang: 'FR',
    targetLang: 'EN',
    englishFallback: 'hello'
  }, () => null);
  assert.equal(resolved.gloss, 'hello');
  assert.equal(resolved.resolved, true);
});

test('resolveGlossFromCacheOrFallback reads translation cache before provider', () => {
  const resolved = resolveGlossFromCacheOrFallback({
    sourceText: 'bonjour',
    sourceLang: 'FR',
    targetLang: 'PT-BR',
    englishFallback: 'hello'
  }, () => 'olá');
  assert.equal(resolved.gloss, 'olá');
});

test('ensureDailyGlosses stores English fallbacks and only calls provider for missing fields', async () => {
  const calls = [];
  const glossesByWord = await ensureDailyGlosses({
    storedGlossesByWord: {},
    cards: [sampleCard],
    sentenceKey: 'fr',
    sourceLang: 'FR',
    targetLang: 'EN',
    getCachedTranslation: () => null,
    setCachedTranslation: () => ({ ok: true }),
    translateProvider: async text => {
      calls.push(text);
      return 'should-not-run';
    }
  });
  assert.equal(calls.length, 0);
  assert.equal(glossesByWord.bonjour.wordGloss, 'hello');
  assert.equal(glossesByWord.bonjour.s1Gloss, 'Hello, how are you?');
  assert.equal(cardGlossesAreComplete(glossesByWord.bonjour, buildDailyGlossFields(sampleCard, 'fr')), true);
});

test('ensureDailyGlosses reuses stored glosses and fills only missing entries', async () => {
  const calls = [];
  const glossesByWord = await ensureDailyGlosses({
    storedGlossesByWord: {
      bonjour: {
        wordGloss: 'hello',
        s1Gloss: 'Hello, how are you?',
        s2Gloss: 'He says hello every morning.',
        s3Gloss: 'Hello everyone!'
      }
    },
    cards: [sampleCard],
    sentenceKey: 'fr',
    sourceLang: 'FR',
    targetLang: 'EN',
    getCachedTranslation: () => null,
    setCachedTranslation: () => ({ ok: true }),
    translateProvider: async text => {
      calls.push(text);
      return 'new';
    }
  });
  assert.equal(calls.length, 0);
  assert.equal(glossesByWord.bonjour.s3Gloss, 'Hello everyone!');
});

test('pruneGlossesForCards drops glosses for words no longer in today assignment', () => {
  const pruned = pruneGlossesForCards({
    bonjour: { wordGloss: 'hello' },
    merci: { wordGloss: 'thanks' }
  }, [{ word: 'bonjour' }]);
  assert.deepEqual(pruned, { bonjour: { wordGloss: 'hello' } });
});
