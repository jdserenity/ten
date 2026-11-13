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

const sceneCard = {
  word: 'manger',
  translation: 'to eat',
  sentences: [
    {
      lines: [
        { fr: 'Je mange du pain.', en: 'I eat bread.' },
        { fr: 'Sans ça, j\'ai faim.', en: 'Without that, I am hungry.' }
      ]
    },
    {
      lines: [
        { fr: 'Nous avons mangé trop vite.', en: 'We ate too quickly.' },
        { fr: 'Ensuite plus personne n\'avait faim.', en: 'Afterward nobody was hungry.' }
      ]
    }
  ]
};

test('buildDailyGlossFields includes word and first-scene gloss keys for legacy scenes', () => {
  const fields = buildDailyGlossFields(sampleCard, 'fr');
  assert.equal(fields.length, 2);
  assert.equal(fields[0].key, 'wordGloss');
  assert.equal(fields[0].englishFallback, 'hello');
  assert.deepEqual(fields.slice(1).map(f => f.key), ['s1l1']);
  assert.equal(fields[1].englishFallback, 'Hello, how are you?');
});

test('buildDailyGlossFields emits only the first scene lines', () => {
  const fields = buildDailyGlossFields(sceneCard, 'fr');
  assert.deepEqual(fields.map(f => f.key), ['wordGloss', 's1l1', 's1l2']);
  assert.equal(fields[2].sourceText, 'Sans ça, j\'ai faim.');
  assert.equal(fields[2].englishFallback, 'Without that, I am hungry.');
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
  assert.equal(glossesByWord.bonjour.s1l1, 'Hello, how are you?');
  assert.equal(cardGlossesAreComplete(glossesByWord.bonjour, buildDailyGlossFields(sampleCard, 'fr')), true);
});

test('ensureDailyGlosses reuses stored glosses and fills only missing entries', async () => {
  const calls = [];
  const glossesByWord = await ensureDailyGlosses({
    storedGlossesByWord: {
      bonjour: {
        wordGloss: 'hello',
        s1l1: 'Hello, how are you?',
        s2l1: 'He says hello every morning.',
        s3l1: 'Hello everyone!'
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
  assert.equal(glossesByWord.bonjour.s3l1, 'Hello everyone!');
});

test('pruneGlossesForCards drops glosses for words no longer in today assignment', () => {
  const pruned = pruneGlossesForCards({
    bonjour: { wordGloss: 'hello' },
    merci: { wordGloss: 'thanks' }
  }, [{ word: 'bonjour' }]);
  assert.deepEqual(pruned, { bonjour: { wordGloss: 'hello' } });
});
