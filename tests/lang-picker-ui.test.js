import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

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

test('app and static HTML build picker options through the chip helper structure', () => {
  assert.match(app, /buildLangPickerOptionHtml/);
  assert.match(html, /lang-picker-flag/);
  assert.match(html, /lang-picker-name/);
  assert.match(html, /lang-picker-tick/);
  assert.doesNotMatch(html, /<input type="checkbox" value="pt-br" \/> 🇧🇷/);
});
