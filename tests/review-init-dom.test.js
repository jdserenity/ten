import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const html = readFileSync(new URL('../src/client/index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/client/app.js', import.meta.url), 'utf8');

function htmlHasId(id) {
  return new RegExp(`id=["']${id}["']`).test(html);
}

test('app.js imports nextFrequencyFilter for frequency filter setup', () => {
  assert.match(app, /nextFrequencyFilter/);
  const importBlock = app.match(/import \{[\s\S]*?\} from '\.\/ten-logic\.js'/);
  assert.ok(importBlock, 'ten-logic import block exists');
  assert.match(importBlock[0], /nextFrequencyFilter/);
});

test('review setup uses existing review DOM ids and no refresh button', () => {
  const requiredIds = [
    'review-show-answer-btn',
    'review-card-delete',
    'review-grade-row',
    'review-empty',
    'review-empty-label',
    'review-empty-message',
    'review-card-panel',
    'review-due-count',
    'review-total-count'
  ];
  requiredIds.forEach(id => {
    assert.ok(htmlHasId(id), `index.html must include #${id}`);
  });
  assert.doesNotMatch(app, /review-refresh-btn/);
});
