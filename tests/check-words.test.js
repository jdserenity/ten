import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkWordPool, isGlueHeadword } from '../scripts/check-words.js';

const frMeta = { sentenceKey: 'fr', requireDiacritics: true, allowedSentenceCounts: [3] };
const ptMeta = { sentenceKey: 'pt', requireDiacritics: true, allowedSentenceCounts: [2, 3] };

function frCard(overrides = {}) {
  return {
    word: 'manger',
    level: 'A1',
    translation: 'to eat',
    sentences: [
      { fr: 'Je mange du pain tous les matins.', en: 'I eat bread every morning.' },
      { fr: 'Nous avons mangé trop vite hier soir.', en: 'We ate too quickly last night.' },
      { fr: 'Tu veux manger quelque chose maintenant?', en: 'Do you want to eat something now?' }
    ],
    ...overrides
  };
}

describe('isGlueHeadword', () => {
  it('flags articles and pronouns', () => {
    assert.equal(isGlueHeadword('je'), true);
    assert.equal(isGlueHeadword('de'), true);
    assert.equal(isGlueHeadword('vos'), true);
    assert.equal(isGlueHeadword('manger'), false);
  });
});

describe('checkWordPool', () => {
  it('accepts a good FR card', () => {
    const result = checkWordPool([frCard()], frMeta, 'words.fr-fr.json');
    assert.equal(result.ok, true, result.errors.join('; '));
  });

  it('rejects glue headwords', () => {
    const result = checkWordPool([frCard({ word: 'je' })], frMeta, 'words.fr-fr.json');
    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /glue/);
  });

  it('rejects wrong sentence count', () => {
    const card = frCard();
    card.sentences = card.sentences.slice(0, 2);
    const result = checkWordPool([card], frMeta, 'words.fr-fr.json');
    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /expected 3/);
  });

  it('rejects ASCII-only French entries', () => {
    const result = checkWordPool([
      {
        word: 'ecole',
        level: 'A1',
        translation: 'school',
        sentences: [
          { fr: 'Je vais a lecole demain matin.', en: 'I am going to school tomorrow morning.' },
          { fr: 'Cette ecole est tres grande ici.', en: 'This school is very big here.' },
          { fr: 'Les eleves aiment leur ecole locale.', en: 'The students like their local school.' }
        ]
      }
    ], frMeta, 'words.fr-fr.json');
    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /diacritic/);
  });

  it('allows legacy PT with 2 sentences', () => {
    const result = checkWordPool([
      {
        word: 'sossego',
        level: 'B1',
        translation: 'peace and quiet',
        sentences: [
          { pt: 'Preciso de um pouco de sossego agora.', en: 'I need a bit of peace and quiet now.' },
          { pt: 'No fim de semana só quero sossego.', en: 'On the weekend I only want peace and quiet.' }
        ]
      }
    ], ptMeta, 'words.pt-br.json');
    assert.equal(result.ok, true, result.errors.join('; '));
  });

  it('rejects a missing level', () => {
    const card = frCard();
    delete card.level;
    const result = checkWordPool([card], frMeta, 'words.fr-fr.json');
    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /level must be A1/);
  });

  it('rejects an unknown level', () => {
    const result = checkWordPool([frCard({ level: 'C1' })], frMeta, 'words.fr-fr.json');
    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /level must be A1/);
  });

  it('accepts A2, B1, and B2', () => {
    for (const level of ['A2', 'B1', 'B2']) {
      const result = checkWordPool([frCard({ level })], frMeta, 'words.fr-fr.json');
      assert.equal(result.ok, true, `${level}: ${result.errors.join('; ')}`);
    }
  });

  it('rejects duplicate headwords', () => {
    const result = checkWordPool([frCard(), frCard()], frMeta, 'words.fr-fr.json');
    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /duplicate/);
  });
});
