import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { isReviewGradeButtonsDisabled } from '../src/client/ten-logic.js';

test('isReviewGradeButtonsDisabled is false when review actions finished', () => {
  assert.equal(isReviewGradeButtonsDisabled({ reviewEditing: false }), false);
});

test('isReviewGradeButtonsDisabled is true only while editing a card', () => {
  assert.equal(isReviewGradeButtonsDisabled({ reviewEditing: true }), true);
});

test('isReviewGradeButtonsDisabled ignores in-flight grade requests', () => {
  assert.equal(isReviewGradeButtonsDisabled({ reviewEditing: false }), false);
});

test('review async handlers re-render after clearing busy flags', () => {
  const appPath = new URL('../src/client/app.js', import.meta.url);
  const app = readFileSync(appPath, 'utf8');

  assert.doesNotMatch(app, /review-refresh-btn/, 'review refresh button should be removed');

  const gradeFinally = app.match(/async function submitReviewGrade[\s\S]*?} finally \{([\s\S]*?)\n  \}/);
  assert.ok(gradeFinally, 'submitReviewGrade finally block exists');
  assert.match(gradeFinally[1], /renderReview\(\)/, 'submitReviewGrade must re-render after submit completes');

  const deleteFinally = app.match(/review-card-delete[\s\S]*?} finally \{([\s\S]*?)\n  \}/);
  assert.ok(deleteFinally, 'review delete finally block exists');
  assert.match(deleteFinally[1], /renderReview\(\)/, 'review delete must re-render after delete completes');
});

test('review queue keeps the server due-date order instead of re-sorting by card id', () => {
  const app = readFileSync(new URL('../src/client/app.js', import.meta.url), 'utf8');
  const orderFn = app.match(/function orderReviewCards\(cards\) \{([\s\S]*?)\n\}/);
  assert.ok(orderFn, 'orderReviewCards exists');
  assert.doesNotMatch(orderFn[1], /a\.id\s*-\s*b\.id/, 'due cards must stay in earliest-due-first order from the server');
});

test('flipped review cards show how many times each grade was pressed', () => {
  const html = readFileSync(new URL('../src/client/index.html', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../src/client/app.js', import.meta.url), 'utf8');
  assert.match(html, /id="review-grade-stats"/);
  assert.match(app, /gradeCountEntries\(card\.gradeCounts\)/);
  assert.match(app, /review-grade-stats/);
});

test('both study tabs display the same combined daily progress counter', () => {
  const html = readFileSync(new URL('../src/client/index.html', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../src/client/app.js', import.meta.url), 'utf8');
  assert.match(html, /<p id="counter" class="study-progress-counter"><\/p>/);
  assert.match(html, /<p id="review-counter" class="study-progress-counter"><\/p>/);
  assert.match(app, /function updateDailyStudyProgressCounters\(\)/);
  assert.match(app, /\['counter', 'review-counter'\]/);
});
