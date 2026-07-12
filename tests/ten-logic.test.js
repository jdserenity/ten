import assert from 'node:assert/strict';
import test from 'node:test';
import {
  frequencyEntryMatchesFilter,
  frequencyListTotal,
  nextFrequencyFilter,
  resolveStartupTab
} from '../src/client/ten-logic.js';

test('resolveStartupTab opens 10/day unless daily is already complete today', () => {
  assert.equal(resolveStartupTab(false), 'daily');
  assert.equal(resolveStartupTab(true), 'translate');
});

test('nextFrequencyFilter toggles off when the same filter is clicked again', () => {
  assert.equal(nextFrequencyFilter('all', 'unlocked'), 'unlocked');
  assert.equal(nextFrequencyFilter('unlocked', 'unlocked'), 'all');
  assert.equal(nextFrequencyFilter('not-learned', 'not-learned'), 'all');
});

test('nextFrequencyFilter switches between unlocked and not-learned', () => {
  assert.equal(nextFrequencyFilter('unlocked', 'not-learned'), 'not-learned');
  assert.equal(nextFrequencyFilter('not-learned', 'unlocked'), 'unlocked');
});

test('frequencyEntryMatchesFilter respects unlocked and not-learned views', () => {
  assert.equal(frequencyEntryMatchesFilter(true, 'all'), true);
  assert.equal(frequencyEntryMatchesFilter(false, 'all'), true);
  assert.equal(frequencyEntryMatchesFilter(true, 'unlocked'), true);
  assert.equal(frequencyEntryMatchesFilter(false, 'unlocked'), false);
  assert.equal(frequencyEntryMatchesFilter(true, 'not-learned'), false);
  assert.equal(frequencyEntryMatchesFilter(false, 'not-learned'), true);
});

test('frequencyListTotal counts the active filter pool', () => {
  assert.equal(frequencyListTotal(5000, 120, 'all'), 5000);
  assert.equal(frequencyListTotal(5000, 120, 'unlocked'), 120);
  assert.equal(frequencyListTotal(5000, 120, 'not-learned'), 4880);
});
