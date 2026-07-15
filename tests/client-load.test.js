import assert from 'node:assert/strict';
import test from 'node:test';
import { planBootDataLoads } from '../src/client/client-load.js';

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
