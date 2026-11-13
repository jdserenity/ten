import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const html = readFileSync(new URL('../src/client/index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/client/app.js', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/client/styles.css', import.meta.url), 'utf8');
const DAILY_LINE_KEYS = ['s1l1', 's1l2'];

test('3/new context is one dropdown with one scene, collapsed by default', () => {
  assert.match(html, /<details id="sentence-reveal-1" class="sentence-reveal">/);
  assert.doesNotMatch(html, /id="sentence-reveal-2"/);
  assert.doesNotMatch(html, /id="(?:sentence-reveal-3|s2-[^"]+|s3-[^"]+)"/);
  assert.doesNotMatch(html, /id="sentence-reveal-1"[^>]*\sopen/);

  const order = ['sentence-reveal-1', 's1-scene', 's1l1-l2', 's1l2-l2']
    .map(id => html.indexOf(`id="${id}"`));
  assert.ok(order.every(index => index >= 0), 'one-scene dropdown ids exist');
  assert.deepEqual(order, [...order].sort((a, b) => a - b), 'open reveals one cohesive two-sentence scene');
});

test('the scene is one prose block with speak then numbered 1 and 2 add buttons', () => {
  assert.match(html, /class="scene-prose"/);
  assert.match(html, /id="s1-speak-btn"/);
  assert.doesNotMatch(html, /id="s2-speak-btn"/);
  assert.doesNotMatch(html, /id="s1l1-speak-btn"/);
  assert.doesNotMatch(html, /id="s1l2-speak-btn"/);
  assert.match(html, /id="s1l1-add-btn"[^>]*>1</);
  assert.match(html, /id="s1l2-add-btn"[^>]*>2</);
  assert.doesNotMatch(html, /id="s2l1-add-btn"/);
  assert.doesNotMatch(html, /id="s2l2-add-btn"/);
  const s1Order = ['s1-speak-btn', 's1l1-add-btn', 's1l2-add-btn']
    .map(id => html.indexOf(`id="${id}"`));
  assert.deepEqual(s1Order, [...s1Order].sort((a, b) => a - b), 'scene actions are speak, then 1, then 2');
  assert.match(styles, /\.scene-prose/);
  assert.match(styles, /\.scene-line-add/);
  assert.match(styles, /\.scene-actions\s*\{[^}]*flex-direction:\s*column/);
  assert.match(app, /sceneSpeakText/);
});

test('3/new sentence dropdown uses the context label', () => {
  assert.match(html, /id="sentence-language-label"[^>]*data-i18n="daily.sentenceInUse"/);
  assert.match(html, />new word used in context</);
  assert.doesNotMatch(html, /data-i18n="daily.anotherContext"/);
  assert.doesNotMatch(html, /data-i18n="daily.moreContext"/);
  assert.doesNotMatch(app, /tr\('daily\.sentenceInUse'/);
  assert.match(app, /dailySentenceRevealVisibility/);
  assert.match(app, /shouldResetDailySentenceReveal/);
  assert.match(app, /collapseDailySentenceReveals/);
  assert.match(app, /collectSentenceRevealAnimationKeys/);
  assert.match(app, /replaySentenceRevealAnimation/);
  assert.doesNotMatch(app, /if \(!reveal1\.open\)/);
});

test('sentence dropdown CSS uses a rotating triangle', () => {
  assert.match(styles, /\.sentence-reveal\s*>\s*summary\.sentences-label/);
  assert.match(styles, /\.sentence-reveal\s*>\s*summary\.sentences-label::after/);
  assert.match(styles, /border-left:\s*[^;]+solid/);
  assert.match(styles, /transform:\s*rotate\(90deg\)/);
  assert.doesNotMatch(styles, /transform:\s*rotate\(180deg\)/);
  assert.doesNotMatch(styles, /content:\s*['"]\+['"]/);
  assert.match(styles, /\.sentence-reveal:not\(\[open\]\)\s*>\s\*:not\(summary\)/);
  assert.match(styles, /@keyframes\s+sentence-reveal-in/);
  assert.match(styles, /\.sentence-reveal-animating/);
  assert.match(styles, /\.scene-prose\s*\{[^}]*padding-top:\s*14px/);
});

test('Add all to review saves the word and both lines from the one shown scene', async () => {
  const handlers = new Map();
  const saved = [];
  const word = {
    word: 'bonjour',
    sentences: [
      {
        lines: [
          { fr: 'First', en: 'One' },
          { fr: 'FirstB', en: 'OneB' }
        ]
      },
      {
        lines: [
          { fr: 'Second', en: 'Two' },
          { fr: 'SecondB', en: 'TwoB' }
        ]
      }
    ]
  };
  const original = JSON.stringify(word);
  const context = vm.createContext({
    document: {
      getElementById: id => ({
        addEventListener: (event, handler) => handlers.set(id, handler),
        classList: { contains: () => false },
        dataset: {}
      })
    },
    state: {
      todayWords: [word],
      currentWordIndex: 0,
      activeTab: 'daily',
      dailyGlosses: { wordGloss: 'hello', s1l1: 'One', s1l2: 'OneB' }
    },
    DAILY_LINE_KEYS,
    setStatus() {},
    tr: key => key,
    collectDailyLineTargets: () => [
      { key: 's1l1', l2: 'First', gloss: 'One' },
      { key: 's1l2', l2: 'FirstB', gloss: 'OneB' }
    ],
    sceneSpeakText: () => '',
    saveDailyAddButton: async (_buttonId, _wordText, save) => save(),
    dailyAddStatusText: () => '',
    addCard: async card => { saved.push(card); return true; },
    addSentenceCardWithGloss: async (back, front) => { saved.push({ front, back }); return true; }
  });
  const setup = app.slice(app.indexOf('function setupDailyEvents()'), app.indexOf('function setupDailyKeyboard()'));
  vm.runInContext(`${setup}; setupDailyEvents();`, context);
  await handlers.get('add-all-btn')();
  assert.deepEqual(saved.map(card => card.back), ['bonjour', 'First', 'FirstB']);
  assert.equal(JSON.stringify(word), original, 'stored examples remain intact');
});

test('context translations start hidden behind keyboard-accessible sentence buttons', () => {
  for (const key of DAILY_LINE_KEYS) {
    assert.match(html, new RegExp(`<button[^>]*id="${key}-l2"[^>]*type="button"[^>]*aria-expanded="false"[^>]*aria-controls="${key}-en"`));
    assert.match(html, new RegExp(`<span class="sentence-en hidden" id="${key}-en"`));
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
    DAILY_LINE_KEYS,
    clearSentenceRevealAnimations() {},
    sceneSpeakText: () => ''
  });
  const helpers = app.slice(app.indexOf('function setDailySentenceTranslationVisible('), app.indexOf('function sentenceRevealAnimationElements('));
  const setup = app.slice(app.indexOf('function setupDailyEvents()'), app.indexOf('function setupDailyKeyboard()'));
  vm.runInContext(`${helpers}\n${setup}\nsetupDailyEvents(); collapseDailySentenceReveals();`, context);
  element('s1l1-l2').handlers.click();
  assert.equal(element('s1l1-en').hidden, false);
  assert.equal(element('s1l2-en').hidden, true);
  assert.equal(element('s1l1-en').textContent, 'Saved s1l1-en');
  assert.equal(element('s1l1-l2').attributes['aria-expanded'], 'true');
  element('s1l2-l2').handlers.click();
  assert.equal(element('s1l2-en').hidden, false);
  vm.runInContext('collapseDailySentenceReveals();', context);
  for (const key of DAILY_LINE_KEYS) {
    assert.equal(element(`${key}-en`).hidden, true);
    assert.equal(element(`${key}-l2`).attributes['aria-expanded'], 'false');
  }
  assert.match(app, /shouldResetDailySentenceReveal\(state\.sentenceRevealWord, nextRevealWord\)\)\s*\{\s*collapseDailySentenceReveals\(\)/);
});

test('daily event setup succeeds with only elements present in the current page', () => {
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
  const context = vm.createContext({
    DAILY_LINE_KEYS,
    sceneSpeakText: () => '',
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
