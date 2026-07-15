import assert from 'node:assert/strict';
import test from 'node:test';
import { dailyGlossPrefetchIndices, planBootDataLoads } from '../src/client/client-load.js';

test('planBootDataLoads prioritizes the startup tab and prefetches the rest', () => {
  assert.deepEqual(planBootDataLoads('daily'), {
    priority: ['daily'],
    background: ['review', 'frequency']
  });
  assert.deepEqual(planBootDataLoads('review'), {
    priority: ['review'],
    background: ['daily', 'frequency']
  });
  assert.deepEqual(planBootDataLoads('frequency'), {
    priority: ['frequency'],
    background: ['daily', 'review']
  });
  assert.deepEqual(planBootDataLoads('translate'), {
    priority: [],
    background: ['daily', 'review', 'frequency']
  });
});

test('dailyGlossPrefetchIndices walks forward through the deck then backward', () => {
  assert.deepEqual(dailyGlossPrefetchIndices(0, 10), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(dailyGlossPrefetchIndices(5, 10), [6, 7, 8, 9, 0, 1, 2, 3, 4]);
  assert.deepEqual(dailyGlossPrefetchIndices(0, 1), []);
  assert.deepEqual(dailyGlossPrefetchIndices(-1, 3), [0, 1, 2]);
});
