import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const html = readFileSync(new URL('../src/client/index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/client/app.js', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/client/styles.css', import.meta.url), 'utf8');

test('5/new example sentences are nested dropdowns collapsed by default', () => {
  assert.match(html, /<details id="sentence-reveal-1" class="sentence-reveal">/);
  assert.match(html, /<details id="sentence-reveal-2" class="sentence-reveal sentence-reveal-nested">/);
  assert.match(html, /<details id="sentence-reveal-3" class="sentence-reveal sentence-reveal-nested">/);
  assert.doesNotMatch(html, /id="sentence-reveal-[123]"[^>]*\sopen/);

  const order = ['sentence-reveal-1', 's1-l2', 'sentence-reveal-2', 's2-l2', 'sentence-reveal-3', 's3-l2']
    .map(id => html.indexOf(`id="${id}"`));
  assert.ok(order.every(index => index >= 0), 'nested sentence dropdown ids exist');
  assert.deepEqual(order, [...order].sort((a, b) => a - b), 'each open reveals the next sentence, then another dropdown');
});

test('5/new sentence dropdown uses the context label instead of language in use', () => {
  assert.match(html, /id="sentence-language-label"[^>]*data-i18n="daily.sentenceInUse"/);
  assert.match(html, />new word used in context</);
  assert.match(html, /data-i18n="daily.anotherContext"/);
  assert.match(html, />another</);
  assert.doesNotMatch(html, /data-i18n="daily.moreContext"/);
  assert.doesNotMatch(app, /tr\('daily\.sentenceInUse'/);
  assert.match(app, /dailySentenceRevealVisibility/);
  assert.match(app, /shouldResetDailySentenceReveal/);
  assert.match(app, /collapseDailySentenceReveals/);
  assert.match(app, /collectSentenceRevealAnimationKeys/);
  assert.match(app, /replaySentenceRevealAnimation/);
  assert.doesNotMatch(app, /if \(!reveal1\.open\)/);
});

test('sentence dropdown CSS uses a rotating triangle and hides nested headers after open', () => {
  assert.match(styles, /\.sentence-reveal\s*>\s*summary\.sentences-label/);
  assert.match(styles, /\.sentence-reveal\s*>\s*summary\.sentences-label::after/);
  assert.match(styles, /border-left:\s*[^;]+solid/);
  assert.match(styles, /transform:\s*rotate\(90deg\)/);
  assert.doesNotMatch(styles, /transform:\s*rotate\(180deg\)/);
  assert.doesNotMatch(styles, /content:\s*['"]\+['"]/);
  assert.match(styles, /\.sentence-reveal:not\(\[open\]\)\s*>\s\*:not\(summary\)/);
  assert.match(styles, /\.sentence-reveal-nested\[open\]\s*>\s*summary/);
  assert.match(styles, /@keyframes\s+sentence-reveal-in/);
  assert.match(styles, /\.sentence-reveal-animating/);
  assert.match(styles, /padding-top:\s*14px/);
});
