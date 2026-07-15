import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  computePoolDaysLeft,
  countUnseenPoolWords,
  normalizePoolWord,
  WORDS_PER_DAY
} from '../src/client/daily-pool.js';

export const POOL_WARN_DAYS = 7;

export const LANGUAGE_POOL_CONFIG = [
  { language: 'PT-BR', wordsFile: 'words.pt-br.json', flagEmoji: '🇧🇷', flagLabel: 'Brazil', label: 'Brazilian Portuguese' },
  { language: 'FR', wordsFile: 'words.fr-ca.json', flagEmoji: '🇨🇦', flagLabel: 'Quebec', label: 'Quebec French' },
  { language: 'FR-FR', wordsFile: 'words.fr-fr.json', flagEmoji: '🇫🇷', flagLabel: 'France', label: 'France French' },
  { language: 'ES-AR', wordsFile: 'words.es-ar.json', flagEmoji: '🇦🇷', flagLabel: 'Argentina', label: 'Argentinian Spanish' }
];

let poolCache = null;

export function clearPoolCacheForTests() {
  poolCache = null;
}

function getClientDir() {
  return join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'client');
}

export function loadWordPools(clientDir = getClientDir(), { cache = true } = {}) {
  if (cache && poolCache) return poolCache;
  const pools = {};
  for (const config of LANGUAGE_POOL_CONFIG) {
    const raw = readFileSync(join(clientDir, config.wordsFile), 'utf-8');
    pools[config.language] = JSON.parse(raw);
  }
  if (cache) poolCache = pools;
  return pools;
}

export function buildSeenSet(unlockedWords) {
  return new Set(
    (Array.isArray(unlockedWords) ? unlockedWords : [])
      .map(normalizePoolWord)
      .filter(Boolean)
  );
}

export function computeUserPoolRunway(pool, unlockedWords) {
  const seenSet = buildSeenSet(unlockedWords);
  const unseenCount = countUnseenPoolWords(pool, seenSet);
  const surfacedCount = pool.length - unseenCount;
  const daysLeft = computePoolDaysLeft(pool.length, surfacedCount, WORDS_PER_DAY);
  return { unseenCount, daysLeft, warning: daysLeft <= POOL_WARN_DAYS };
}

export function buildPoolHealthReport(users, poolsByLanguage) {
  const languages = [];
  let alertCount = 0;

  for (const config of LANGUAGE_POOL_CONFIG) {
    const pool = poolsByLanguage[config.language] || [];
    const poolSize = pool.length;
    const userRows = [];

    for (const user of users) {
      if (!Array.isArray(user.languages) || !user.languages.includes(config.language)) continue;
      const unlocked = user.unlockedWords?.[config.language] || [];
      const runway = computeUserPoolRunway(pool, unlocked);
      userRows.push({
        username: user.username,
        unseenCount: runway.unseenCount,
        daysLeft: runway.daysLeft,
        warning: runway.warning
      });
    }

    if (!userRows.length) continue;

    userRows.sort((a, b) => a.daysLeft - b.daysLeft);
    const minDaysLeft = userRows[0].daysLeft;
    const warning = userRows.some(row => row.warning);
    if (warning) alertCount++;

    languages.push({
      language: config.language,
      label: config.label,
      flagEmoji: config.flagEmoji,
      flagLabel: config.flagLabel,
      poolSize,
      minDaysLeft,
      warning,
      users: userRows
    });
  }

  languages.sort((a, b) => a.minDaysLeft - b.minDaysLeft);
  return { languages, alertCount };
}

export function buildDevOpsPayload(users, poolsByLanguage, feedback) {
  const poolHealth = buildPoolHealthReport(users, poolsByLanguage);
  return {
    ...poolHealth,
    feedback: Array.isArray(feedback) ? feedback : []
  };
}
