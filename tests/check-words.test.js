import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkWordPool, isGlueHeadword } from '../scripts/check-words.js';

const frMeta = { sentenceKey: 'fr', requireDiacritics: true, allowedSentenceCounts: [1, 2, 3] };
const ptMeta = { sentenceKey: 'pt', requireDiacritics: true, allowedSentenceCounts: [1, 2, 3] };

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

  it('accepts one two-line scene for new cards', () => {
    const result = checkWordPool([
      {
        word: 'manger',
        level: 'A1',
        translation: 'to eat',
        sentences: [
          {
            lines: [
              { fr: 'Je mange du pain tous les matins.', en: 'I eat bread every morning.' },
              { fr: 'Sans ça, la journée commence mal.', en: 'Without that, the day starts badly.' }
            ]
          }
        ]
      }
    ], frMeta, 'words.fr-fr.json');
    assert.equal(result.ok, true, result.errors.join('; '));
  });

  it('still accepts legacy multi-scene cards', () => {
    const card = frCard();
    card.sentences = card.sentences.slice(0, 2);
    const result = checkWordPool([card], frMeta, 'words.fr-fr.json');
    assert.equal(result.ok, true, result.errors.join('; '));
  });

  it('rejects a wrong sentence count', () => {
    const card = frCard();
    card.sentences = [];
    const result = checkWordPool([card], frMeta, 'words.fr-fr.json');
    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /expected 1 or 2 or 3/);
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

  it('accepts two-line scenes and long lines with no character cap', () => {
    const longFr = 'Je mange du pain tous les matins avec ma sœur parce que c\'est notre petite tradition depuis l\'enfance et on n\'abandonne jamais ça.';
    const result = checkWordPool([
      {
        word: 'manger',
        level: 'A1',
        translation: 'to eat',
        sentences: [
          {
            lines: [
              { fr: longFr, en: 'I eat bread every morning with my sister because it is our little tradition from childhood and we never give that up.' },
              { fr: 'Sans ça, la journée commence mal.', en: 'Without that, the day starts badly.' }
            ]
          }
        ]
      }
    ], frMeta, 'words.fr-fr.json');
    assert.equal(result.ok, true, result.errors.join('; '));
  });

  it('rejects lines scenes that are not exactly two lines', () => {
    const result = checkWordPool([
      {
        word: 'manger',
        level: 'A1',
        translation: 'to eat',
        sentences: [
          {
            lines: [
              { fr: 'Je mange du pain tous les matins.', en: 'I eat bread every morning.' }
            ]
          }
        ]
      }
    ], frMeta, 'words.fr-fr.json');
    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /exactly 2 lines/);
  });

  it('still accepts legacy flat single-line scenes', () => {
    const result = checkWordPool([frCard()], frMeta, 'words.fr-fr.json');
    assert.equal(result.ok, true, result.errors.join('; '));
  });
});
