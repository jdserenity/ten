/**
 * check-words.js — validate dialect 5/new word pools.
 * Usage: node scripts/check-words.js
 * Also exportable for unit tests.
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLIENT_DIR = join(__dirname, '../src/client');
const MIN_SENTENCE_LEN = 20;
const MAX_SENTENCE_LEN = 140;

const POOL_META = {
  'words.pt-br.json': {
    sentenceKey: 'pt',
    requireDiacritics: false,
    allowedSentenceCounts: [2, 3],
    legacySoft: true
  },
  'words.fr-ca.json': { sentenceKey: 'fr', requireDiacritics: true, allowedSentenceCounts: [3] },
  'words.fr-fr.json': { sentenceKey: 'fr', requireDiacritics: true, allowedSentenceCounts: [3] },
  'words.es-ar.json': { sentenceKey: 'es', requireDiacritics: true, allowedSentenceCounts: [3] }
};

/** Glue / function words banned as headwords (all flavours). */
export const GLUE_HEADWORDS = new Set([
  // Romance shared / Romance-ish
  'a', 'à', 'al', 'ao', 'aos', 'as', 'o', 'os', 'um', 'uma', 'uns', 'umas',
  'el', 'la', 'las', 'los', 'un', 'una', 'unos', 'unas', 'del', 'de', 'da', 'do', 'das', 'dos',
  'y', 'e', 'et', 'ou', 'or', 'pero', 'mas', 'mais', 'mais', 'mais',
  'que', 'qué', 'qui', 'quoi', 'cual', 'cuál', 'como', 'cómo', 'cuando', 'cuándo',
  'si', 'sí', 'se', 'ne', 'pas', 'no', 'não', 'non', 'oui', 'yes',
  'yo', 'tú', 'tu', 'él', 'ella', 'ellos', 'ellas', 'usted', 'ustedes', 'nosotros', 'vosotros',
  'je', 'il', 'elle', 'nous', 'vous', 'ils', 'elles', 'on', 'me', 'te', 'le', 'les', 'lui', 'leur',
  'eu', 'você', 'vocês', 'ele', 'ela', 'eles', 'elas', 'nós', 'lhes',
  'mi', 'mí', 'ti', 'su', 'sus', 'nuestro', 'nuestra', 'mon', 'ton', 'son', 'ma', 'ta', 'sa', 'mes', 'tes', 'ses',
  'meu', 'minha', 'teu', 'tua', 'seu', 'sua',
  'en', 'dans', 'sur', 'avec', 'pour', 'par', 'chez', 'sans', 'sous',
  'por', 'para', 'con', 'sin', 'sobre', 'entre', 'hacia', 'hasta', 'desde',
  'em', 'com', 'sem', 'sobre', 'entre', 'para', 'por',
  'the', 'and', 'of', 'to', 'in', 'on', 'at', 'for', 'from', 'with', 'by',
  'i', 'you', 'he', 'she', 'we', 'they', 'it', 'my', 'your', 'his', 'her', 'our', 'their',
  'this', 'that', 'these', 'those', 'is', 'are', 'was', 'were', 'be', 'been', 'am',
  'ce', 'cet', 'cette', 'ces', 'ça', 'cela', 'esto', 'eso', 'aquello', 'este', 'esta', 'ese', 'esa',
  'isso', 'isto', 'aquilo', 'esse', 'essa', 'este', 'esta',
  'vos', // pronoun — ok in ES-AR sentences, never a headword
  'lo', 'le', 'les', 'nos', 'os',
  'aux', 'au', 'des', 'du',
  'ya', 'já', 'já',
  'hay', 'il y a'
].map(w => w.toLowerCase()));

const DIACRITIC_RE = /[àâäáãåéèêëíìîïóòôöõúùûüçñœæÀÂÄÁÃÅÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÇÑŒÆ]/;

export function normalizeHeadword(word) {
  return String(word || '').trim().toLowerCase();
}

export function isGlueHeadword(word) {
  return GLUE_HEADWORDS.has(normalizeHeadword(word));
}

export function getSentenceText(sentence, sentenceKey) {
  if (!sentence || typeof sentence !== 'object') return '';
  return String(sentence[sentenceKey] || '').trim();
}

/**
 * Validate one pool array. Returns { ok, errors: string[] }.
 */
export function checkWordPool(entries, meta, fileLabel = 'pool') {
  const errors = [];
  if (!Array.isArray(entries)) {
    return { ok: false, errors: [`${fileLabel}: root must be a JSON array`] };
  }

  const seen = new Set();
  entries.forEach((entry, index) => {
    const loc = `${fileLabel}[${index}]`;
    if (!entry || typeof entry !== 'object') {
      errors.push(`${loc}: entry must be an object`);
      return;
    }
    const word = String(entry.word || '').trim();
    if (!word) {
      errors.push(`${loc}: missing word`);
      return;
    }
    const key = normalizeHeadword(word);
    if (seen.has(key)) errors.push(`${loc}: duplicate headword "${word}"`);
    seen.add(key);
    if (!meta.legacySoft && isGlueHeadword(word)) {
      errors.push(`${loc}: glue/function headword not allowed ("${word}")`);
    }

    const translation = String(entry.translation || '').trim();
    if (!translation) errors.push(`${loc}: missing translation`);

    if (!Array.isArray(entry.sentences)) {
      errors.push(`${loc}: sentences must be an array`);
      return;
    }
    if (!meta.allowedSentenceCounts.includes(entry.sentences.length)) {
      errors.push(
        `${loc}: expected ${meta.allowedSentenceCounts.join(' or ')} sentences, got ${entry.sentences.length}`
      );
    }

    let entryHasDiacritic = DIACRITIC_RE.test(word) || DIACRITIC_RE.test(translation);
    entry.sentences.forEach((sentence, sIndex) => {
      const sloc = `${loc}.sentences[${sIndex}]`;
      const l2 = getSentenceText(sentence, meta.sentenceKey);
      const en = String(sentence?.en || '').trim();
      if (!l2) errors.push(`${sloc}: missing ${meta.sentenceKey} text`);
      if (!meta.legacySoft && !en) errors.push(`${sloc}: missing en text`);
      if (l2 && (l2.length < MIN_SENTENCE_LEN || l2.length > MAX_SENTENCE_LEN)) {
        errors.push(`${sloc}: ${meta.sentenceKey} length ${l2.length} outside ${MIN_SENTENCE_LEN}-${MAX_SENTENCE_LEN}`);
      }
      if (DIACRITIC_RE.test(l2)) entryHasDiacritic = true;
    });

    if (meta.requireDiacritics && entry.sentences.length && !entryHasDiacritic) {
      errors.push(
        `${loc}: no diacritics in word/translation/sentences (likely missing accents for "${word}")`
      );
    }
  });

  return { ok: errors.length === 0, errors };
}

export function listPoolFiles(clientDir = CLIENT_DIR) {
  return readdirSync(clientDir)
    .filter(name => Object.prototype.hasOwnProperty.call(POOL_META, name))
    .sort();
}

export function checkAllPools(clientDir = CLIENT_DIR) {
  const allErrors = [];
  for (const name of listPoolFiles(clientDir)) {
    const meta = POOL_META[name];
    const raw = readFileSync(join(clientDir, name), 'utf-8');
    let entries;
    try {
      entries = JSON.parse(raw);
    } catch (error) {
      allErrors.push(`${name}: invalid JSON (${error.message})`);
      continue;
    }
    const result = checkWordPool(entries, meta, name);
    allErrors.push(...result.errors);
  }
  return { ok: allErrors.length === 0, errors: allErrors };
}

function main() {
  const result = checkAllPools();
  if (!result.ok) {
    console.error(`words:check failed (${result.errors.length} issue(s)):`);
    result.errors.forEach(line => console.error(`  - ${line}`));
    process.exit(1);
  }
  console.log(`words:check ok (${listPoolFiles().join(', ')})`);
}

if (process.argv[1] && basename(fileURLToPath(import.meta.url)) === basename(process.argv[1])) {
  main();
}
