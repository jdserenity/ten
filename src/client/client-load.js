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
