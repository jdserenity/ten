export const DAILY_REVIEW_GOAL = 10;

export function resolveStartupTab({ dailyCompleteToday, reviewCompleteToday }) {
  if (!dailyCompleteToday) return 'daily';
  if (!reviewCompleteToday) return 'review';
  return 'translate';
}

export function isDailyReviewComplete(reviewedCountToday, goal = DAILY_REVIEW_GOAL) {
  return reviewedCountToday >= goal;
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
