export const WORDS_PER_DAY = 10;

export function normalizePoolWord(value) {
  return String(value || '')
    .trim()
    .toLocaleLowerCase()
    .normalize('NFC');
}

export function hashDate(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  }
  return Math.abs(h);
}

export function seededShuffle(arr, seed) {
  const copy = [...arr];
  let s = seed;
  const next = () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0x100000000;
  };
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function countUnseenPoolWords(pool, seenNormalizedSet) {
  let count = 0;
  for (const entry of pool) {
    const normalized = normalizePoolWord(entry?.word);
    if (normalized && !seenNormalizedSet.has(normalized)) count++;
  }
  return count;
}

export function pickDailyWords(pool, seenNormalizedSet, dayKey, wordsPerDay = WORDS_PER_DAY) {
  const unseen = pool.filter(entry => {
    const normalized = normalizePoolWord(entry?.word);
    return normalized && !seenNormalizedSet.has(normalized);
  });
  const shuffled = seededShuffle(unseen, hashDate(dayKey));
  return shuffled.slice(0, wordsPerDay);
}

export function resolveDailyWordsFromAssignment(pool, assignedHeadwords) {
  if (!Array.isArray(assignedHeadwords) || !assignedHeadwords.length) return [];
  const poolByNorm = new Map();
  for (const entry of pool) {
    const normalized = normalizePoolWord(entry?.word);
    if (normalized) poolByNorm.set(normalized, entry);
  }
  const resolved = [];
  for (const headword of assignedHeadwords) {
    const entry = poolByNorm.get(normalizePoolWord(headword));
    if (entry) resolved.push(entry);
  }
  return resolved;
}

export function computePoolDaysLeft(poolSize, surfacedCount, wordsPerDay = WORDS_PER_DAY) {
  const remaining = Math.max(0, poolSize - surfacedCount);
  return Math.round((remaining / wordsPerDay) * 10) / 10;
}

export function formatPoolDaysLabel(days, flagLabel) {
  const formatted = Number.isInteger(days) ? String(days) : days.toFixed(1);
  const unit = days === 1 ? 'day' : 'days';
  return `~${formatted} ${unit} left in ${flagLabel} pool`;
}
