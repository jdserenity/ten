import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { isReviewGradeButtonsDisabled } from '../src/client/ten-logic.js';

test('isReviewGradeButtonsDisabled is false when review actions finished', () => {
  assert.equal(isReviewGradeButtonsDisabled({
    reviewSubmitting: false,
    reviewEditSubmitting: false,
    reviewEditing: false
  }), false);
});

test('isReviewGradeButtonsDisabled stays true while a grade request is in flight', () => {
  assert.equal(isReviewGradeButtonsDisabled({
    reviewSubmitting: true,
    reviewEditSubmitting: false,
    reviewEditing: false
  }), true);
});

test('review async handlers re-render after clearing busy flags', () => {
  const appPath = new URL('../src/client/app.js', import.meta.url);
  const app = readFileSync(appPath, 'utf8');

  const gradeFinally = app.match(/async function submitReviewGrade[\s\S]*?} finally \{([\s\S]*?)\n  \}/);
  assert.ok(gradeFinally, 'submitReviewGrade finally block exists');
  assert.match(gradeFinally[1], /renderReview\(\)/, 'submitReviewGrade must re-render after submit completes');

  const deleteFinally = app.match(/review-card-delete[\s\S]*?} finally \{([\s\S]*?)\n  \}/);
  assert.ok(deleteFinally, 'review delete finally block exists');
  assert.match(deleteFinally[1], /renderReview\(\)/, 'review delete must re-render after delete completes');
});
