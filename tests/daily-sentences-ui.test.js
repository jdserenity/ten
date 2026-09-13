import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const html = readFileSync(new URL('../src/client/index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/client/app.js', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/client/styles.css', import.meta.url), 'utf8');

test('5/new example sentences are nested dropdowns collapsed by default', () => {
  assert.match(html, /<details id="sentence-reveal-1" class="sentence-reveal">/);
  assert.match(html, /<details id="sentence-reveal-2" class="sentence-reveal sentence-reveal-nested">/);
  assert.doesNotMatch(html, /id="(?:sentence-reveal-3|s3-[^"]+)"/);
  assert.doesNotMatch(html, /id="sentence-reveal-[123]"[^>]*\sopen/);

  const order = ['sentence-reveal-1', 's1-l2', 'sentence-reveal-2', 's2-l2']
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

test('Add all to review saves the word and only the first two examples', async () => {
  const handlers = new Map();
  const saved = [];
  const word = { word: 'bonjour', sentences: [{ fr: 'First' }, { fr: 'Second' }, { fr: 'Third' }] };
  const original = JSON.stringify(word);
  const context = vm.createContext({
    document: { getElementById: id => ({ addEventListener: (event, handler) => handlers.set(id, handler) }) },
    state: { todayWords: [word], currentWordIndex: 0, activeTab: 'daily', dailyGlosses: { wordGloss: 'hello', s1Gloss: 'One', s2Gloss: 'Two' } },
    setStatus() {}, tr: key => key,
    getSentenceText: sentence => sentence.fr,
    addCard: async card => { saved.push(card); return true; },
    addSentenceCardWithGloss: async (back, front) => { saved.push({ front, back }); return true; }
  });
  const setup = app.slice(app.indexOf('function setupDailyEvents()'), app.indexOf('function setupDailyKeyboard()'));
  vm.runInContext(`${setup}; setupDailyEvents();`, context);
  await handlers.get('add-all-btn')();
  assert.deepEqual(saved.map(card => card.back), ['bonjour', 'First', 'Second']);
  assert.equal(JSON.stringify(word), original, 'all three stored examples remain intact');
});

test('context translations start hidden behind keyboard-accessible sentence buttons', () => {
  for (const number of [1, 2]) {
    assert.match(html, new RegExp(`<button[^>]*id="s${number}-l2"[^>]*type="button"[^>]*aria-expanded="false"[^>]*aria-controls="s${number}-en"`));
    assert.match(html, new RegExp(`<span class="sentence-en hidden" id="s${number}-en"`));
  }
});

test('click reveals only the saved translation and changing cards hides both again', () => {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, {
      textContent: id.endsWith('-en') ? `Saved ${id}` : '',
      hidden: true, attributes: {}, handlers: {}, open: true,
      classList: { toggle(name, value) { element(id).hidden = value; } },
      setAttribute(name, value) { this.attributes[name] = value; },
      addEventListener(event, handler) { this.handlers[event] = handler; }
    });
    return elements.get(id);
  };
  const context = vm.createContext({
    document: { getElementById: element },
    clearSentenceRevealAnimations() {}
  });
  const helpers = app.slice(app.indexOf('function setDailySentenceTranslationVisible('), app.indexOf('function sentenceRevealAnimationElements('));
  const setup = app.slice(app.indexOf('function setupDailyEvents()'), app.indexOf('function setupDailyKeyboard()'));
  vm.runInContext(`${helpers}\n${setup}\nsetupDailyEvents(); collapseDailySentenceReveals();`, context);
  element('s1-l2').handlers.click();
  assert.equal(element('s1-en').hidden, false);
  assert.equal(element('s2-en').hidden, true);
  assert.equal(element('s1-en').textContent, 'Saved s1-en');
  assert.equal(element('s1-l2').attributes['aria-expanded'], 'true');
  element('s2-l2').handlers.click();
  assert.equal(element('s2-en').hidden, false);
  vm.runInContext('collapseDailySentenceReveals();', context);
  for (const number of [1, 2]) {
    assert.equal(element(`s${number}-en`).hidden, true);
    assert.equal(element(`s${number}-l2`).attributes['aria-expanded'], 'false');
  }
  assert.match(app, /shouldResetDailySentenceReveal\(state\.sentenceRevealWord, nextRevealWord\)\)\s*\{\s*collapseDailySentenceReveals\(\)/);
});

test('daily event setup succeeds with only elements present in the current page', () => {
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
  const context = vm.createContext({
    document: { getElementById: id => ids.has(id) ? { addEventListener() {} } : null }
  });
  const setup = app.slice(app.indexOf('function setupDailyEvents()'), app.indexOf('function setupDailyKeyboard()'));
  assert.doesNotThrow(() => vm.runInContext(`${setup}; setupDailyEvents();`, context));
});

test('the two-example page requests fresh assets instead of the old PWA URLs', () => {
  const script = html.match(/<script type="module" src="([^"]+)"/)[1];
  const stylesheet = html.match(/<link rel="stylesheet" href="([^"]+)"/)[1];
  assert.match(script, /^\/app\.js\?v=.+/);
  assert.notEqual(script, '/app.js?v=21');
  assert.match(stylesheet, /^\/styles\.css\?v=.+/);
});

test('revealed translations fade and slide in while respecting reduced motion', () => {
  assert.match(styles, /\.sentence-en:not\(\.hidden\),\s*\.sentence-reveal-animating\s*\{\s*animation: sentence-reveal-in 0\.32s ease;/);
  assert.match(styles, /@keyframes sentence-reveal-in\s*\{\s*from\s*\{ opacity: 0; transform: translateY\(-8px\); \}\s*to\s*\{ opacity: 1; transform: none;/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\.sentence-en:not\(\.hidden\),\s*\.sentence-reveal-animating \{ animation: none; \}/);
});
