import { sceneLines } from '../src/client/ten-logic.js';

export function getSentenceLearningText(sentence, sentenceKey) {
  if (!sentence || typeof sentence !== 'object') return '';
  return String(sentence[sentenceKey] || '').trim();
}

export function buildDailyGlossFields(card, sentenceKey) {
  const fields = [{
    key: 'wordGloss',
    sourceText: String(card?.word || '').trim(),
    englishFallback: String(card?.translation || '').trim()
  }];
  const scenes = Array.isArray(card?.sentences) ? card.sentences : [];
  scenes.slice(0, 1).forEach((scene, sceneIndex) => {
    sceneLines(scene, sentenceKey).forEach((line, lineIndex) => {
      if (!line.l2) return;
      fields.push({
        key: `s${sceneIndex + 1}l${lineIndex + 1}`,
        sourceText: line.l2,
        englishFallback: line.en
      });
    });
  });
  return fields;
}

export function resolveGlossFromCacheOrFallback({ sourceText, sourceLang, targetLang, englishFallback }, getCached) {
  const clean = String(sourceText || '').trim();
  if (!clean) return { gloss: '', resolved: true };
  const target = String(targetLang || '').trim().toUpperCase();
  if (target === 'EN') {
    const fallback = String(englishFallback || '').trim();
    if (fallback) return { gloss: fallback, resolved: true };
  }
  const cached = getCached(sourceLang, target, clean);
  if (cached) return { gloss: cached, resolved: true };
  return { gloss: '', resolved: false };
}

export function cardGlossesAreComplete(cardGlosses, fields) {
  if (!cardGlosses || typeof cardGlosses !== 'object') return false;
  return fields.every(field => {
    if (!field.sourceText) return true;
    return Boolean(String(cardGlosses[field.key] || '').trim());
  });
}

export function pruneGlossesForCards(glossesByWord, cards) {
  const allowed = new Set(cards.map(card => String(card?.word || '').trim()).filter(Boolean));
  const next = {};
  allowed.forEach(word => {
    if (glossesByWord?.[word]) next[word] = glossesByWord[word];
  });
  return next;
}

export async function ensureDailyGlosses({
  storedGlossesByWord,
  cards,
  sentenceKey,
  sourceLang,
  targetLang,
  getCachedTranslation,
  setCachedTranslation,
  translateProvider
}) {
  const glossesByWord = pruneGlossesForCards(storedGlossesByWord || {}, cards);
  const missing = [];

  cards.forEach(card => {
    const word = String(card?.word || '').trim();
    if (!word) return;
    if (!glossesByWord[word]) glossesByWord[word] = {};
    const fields = buildDailyGlossFields(card, sentenceKey);
    fields.forEach(field => {
      if (!field.sourceText) return;
      if (String(glossesByWord[word][field.key] || '').trim()) return;
      const resolved = resolveGlossFromCacheOrFallback({
        sourceText: field.sourceText,
        sourceLang,
        targetLang,
        englishFallback: field.englishFallback
      }, getCachedTranslation);
      if (resolved.resolved) {
        glossesByWord[word][field.key] = resolved.gloss;
        return;
      }
      missing.push({ word, field });
    });
  });

  for (const item of missing) {
    const translated = await translateProvider(item.field.sourceText);
    const gloss = String(translated || '').trim();
    if (!gloss) continue;
    setCachedTranslation(sourceLang, targetLang, item.field.sourceText, gloss);
    glossesByWord[item.word][item.field.key] = gloss;
  }

  return glossesByWord;
}
