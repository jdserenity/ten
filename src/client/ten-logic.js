export function resolveStartupTab(dailyCompleteToday) {
  return dailyCompleteToday ? 'translate' : 'daily';
}

export function nextFrequencyFilter(currentFilter, clickedFilter) {
  if (currentFilter === clickedFilter) return 'all';
  return clickedFilter;
}

export function frequencyEntryMatchesFilter(seen, filter) {
  if (!filter || filter === 'all') return true;
  if (filter === 'unlocked') return seen;
  if (filter === 'not-learned') return !seen;
  return true;
}

export function frequencyListTotal(entriesLength, unlockedCount, filter) {
  if (filter === 'unlocked') return unlockedCount;
  if (filter === 'not-learned') return entriesLength - unlockedCount;
  return entriesLength;
}
