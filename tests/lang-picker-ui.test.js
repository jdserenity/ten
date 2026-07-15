import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  buildLangPickerOptionHtml,
  getLangPickerOptions
} from '../src/client/ten-logic.js';

const styles = readFileSync(new URL('../src/client/styles.css', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/client/app.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../src/client/index.html', import.meta.url), 'utf8');

test('lang picker CSS styles options as selectable chips, not bare checkboxes', () => {
  assert.match(styles, /\.lang-picker-options\s*\{[^}]*flex-direction:\s*column/s);
  assert.match(styles, /\.lang-picker-option\s*\{[^}]*border-radius:\s*10px/s);
  assert.match(styles, /\.lang-picker-option\s+input\s*\{[^}]*opacity:\s*0/s);
  assert.match(styles, /\.lang-picker-option:has\(input:checked\)/);
  assert.match(styles, /\.lang-picker-tick/);
  assert.match(styles, /\.lang-picker-flag/);
  assert.match(styles, /\.lang-picker-name/);
});

test('lang picker does not draw a focus outline when an option is clicked', () => {
  assert.doesNotMatch(styles, /\.lang-picker-option:focus-within/);
  assert.match(styles, /\.lang-picker-option\s+input\s*\{[^}]*outline:\s*none/s);
});

test('settings and header share the same lang-picker chip classes', () => {
  assert.match(html, /id="settings-lang-picker"\s+class="lang-picker/);
  assert.match(html, /id="header-lang-picker"\s+class="lang-picker/);
  assert.match(styles, /\.settings-panel\s+\.lang-picker\s*\{[^}]*position:\s*static/s);
});

test('app and static HTML build picker options through the chip helper structure', () => {
  assert.match(app, /buildLangPickerOptionHtml/);
  assert.match(app, /getLangPickerOptions/);
  assert.match(app, /sortLangPickerOptionsByLabel/);
  assert.match(app, /isLangPickerOutsideClick/);
  assert.match(app, /bindLangPickerOutsideClick/);
  assert.match(app, /saveUserLanguages\(selected,\s*\{\s*replace:\s*true/);
  assert.match(html, /lang-picker-flag/);
  assert.match(html, /lang-picker-name/);
  assert.match(html, /lang-picker-tick/);
  assert.doesNotMatch(html, /<input type="checkbox" value="pt-br" \/> 🇧🇷/);
});

test('static header picker lists languages alphabetically by English name', () => {
  const block = html.match(/id="header-lang-picker"[\s\S]*?lang-picker-options">([\s\S]*?)<\/div>/);
  assert.ok(block, 'header picker options exist');
  const values = [...block[1].matchAll(/value="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(values, ['es-ar', 'pt-br', 'fr-fr', 'fr']);
});

test('getLangPickerOptions marks owned languages as selected so they can be deselected', () => {
  assert.deepEqual(
    getLangPickerOptions(['pt-br', 'fr', 'fr-fr', 'es-ar'], ['fr', 'es-ar']),
    [
      { modeId: 'pt-br', selected: false },
      { modeId: 'fr', selected: true },
      { modeId: 'fr-fr', selected: false },
      { modeId: 'es-ar', selected: true }
    ]
  );
  assert.deepEqual(
    getLangPickerOptions(['pt-br', 'fr'], []),
    [
      { modeId: 'pt-br', selected: false },
      { modeId: 'fr', selected: false }
    ]
  );
});

test('buildLangPickerOptionHtml can render an already-selected language', () => {
  const htmlOption = buildLangPickerOptionHtml({
    modeId: 'fr',
    flag: '🇨🇦',
    label: 'Quebec French',
    selected: true
  });
  assert.match(htmlOption, /type="checkbox"[^>]*checked/);
  assert.match(htmlOption, /value="fr"/);
});
