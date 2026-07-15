/** Which tab data loads first on boot vs in the background. */
export function planBootDataLoads(startupTab) {
  const priority = [];
  const background = [];

  if (startupTab === 'review') {
    priority.push('review');
    background.push('daily');
  } else if (startupTab === 'frequency') {
    priority.push('frequency');
    background.push('daily', 'review');
  } else if (startupTab === 'translate') {
    background.push('daily', 'review');
  } else {
    priority.push('daily');
    background.push('review');
  }

  if (startupTab !== 'frequency') background.push('frequency');
  return { priority, background };
}

/** Card indices to prefetch glosses for after the visible card (forward, then backward). */
export function dailyGlossPrefetchIndices(currentIndex, total) {
  if (!Number.isInteger(total) || total <= 0) return [];
  const index = Number.isInteger(currentIndex) ? currentIndex : 0;
  const indices = [];
  for (let i = index + 1; i < total; i++) indices.push(i);
  for (let i = 0; i < index; i++) indices.push(i);
  return indices;
}
