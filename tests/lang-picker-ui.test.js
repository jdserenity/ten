import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  buildLangPickerFamilyHtml,
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
  assert.match(app, /buildLangPickerFamilyHtml/);
  assert.match(app, /buildLangPickerOptionHtml/);
  assert.match(app, /getLangPickerFamilies/);
  assert.match(app, /getLangPickerDialects/);
  assert.match(app, /getLangPickerDialectLabelKey/);
  assert.match(app, /getPickerDialectLabel/);
  assert.match(app, /applyLangPickerDialectToggle/);
  assert.match(app, /sortLangPickerOptionsByLabel/);
  assert.match(app, /isLangPickerOutsideClick/);
  assert.match(app, /shouldOpenLangPickerOnModeClick/);
  assert.match(app, /toggleLanguagePicker\('flags'\)/);
  assert.match(app, /header-mode-lang-picker/);
  assert.match(app, /bindLangPickerOutsideClick/);
  assert.match(app, /saveUserLanguages\(selected,\s*\{\s*replace:\s*true/);
  assert.match(html, /lang-picker-flag/);
  assert.match(html, /lang-picker-name/);
  assert.match(html, /lang-picker-tick/);
  assert.match(html, /id="header-mode-lang-picker"/);
  assert.doesNotMatch(html, /<input type="checkbox" value="pt-br" \/> 🇧🇷/);
});

test('static header picker first-paint lists main languages, not dialects', () => {
  const block = html.match(/id="header-lang-picker"[\s\S]*?lang-picker-options">([\s\S]*?)<\/div>/);
  assert.ok(block, 'header picker options exist');
  const families = [...block[1].matchAll(/data-family="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(families, ['fr', 'pt', 'es']);
  assert.doesNotMatch(block[1], /type="checkbox"/);
  assert.doesNotMatch(block[1], /value="es-ar"|value="pt-br"|value="fr-fr"|value="fr"/);
});

test('dialect step reuses the primary button as Back; no separate back control', () => {
  assert.doesNotMatch(html, /id="header-lang-back-btn"/);
  assert.doesNotMatch(html, /id="settings-lang-back-btn"/);
  assert.doesNotMatch(html, /id="header-mode-lang-back-btn"/);
  assert.doesNotMatch(html, /class="lang-picker-back"/);
  assert.match(html, /id="header-lang-confirm-btn"/);
  assert.match(html, /id="settings-lang-confirm-btn"/);
  assert.match(html, /id="header-mode-lang-confirm-btn"/);
  assert.match(app, /langPickerPrimaryAction/);
  assert.match(app, /shouldCloseLangPickerOnOutsideClick/);
  assert.match(app, /pickerSelectedModeIds/);
  assert.match(app, /readPickerSelectedModeIds/);
  assert.doesNotMatch(app, /readPickerSelections\(/);
});

test('family and dialect chips share the same type size', () => {
  assert.match(styles, /\.lang-picker-option\s*\{[^}]*font-size:\s*14px/s);
  assert.doesNotMatch(styles, /\.lang-picker-family\s*\{[^}]*font:\s*inherit/s);
  assert.match(app, /picker\.whichFamily/);
  assert.doesNotMatch(app, /picker\.chooseDialect/);
});

test('lang picker CSS styles family rows', () => {
  assert.match(styles, /\.lang-picker-family/);
  assert.match(styles, /\.lang-picker-chevron/);
  assert.match(styles, /\.lang-picker-family\.is-selected/);
  assert.doesNotMatch(styles, /\.lang-picker-back/);
});

test('buildLangPickerFamilyHtml is the family-row helper used by tests', () => {
  const htmlOption = buildLangPickerFamilyHtml({
    familyId: 'es',
    flag: '🇪🇸',
    label: 'Spanish',
    selected: false
  });
  assert.match(htmlOption, /data-family="es"/);
  assert.match(htmlOption, /Spanish/);
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

test('fresh-user add-language hint is a chalk-style arrow near the header +', () => {
  assert.match(html, /id="add-lang-hint"/);
  assert.match(html, /add-lang-hint-chalk/);
  assert.match(html, /feTurbulence/);
  assert.match(styles, /\.add-lang-hint\s*\{[^}]*pointer-events:\s*none/s);
  assert.match(styles, /@keyframes\s+add-lang-hint-bob/);
  assert.match(styles, /prefers-reduced-motion:\s*reduce[^{]*\{\s*\.add-lang-hint\s*\{\s*animation:\s*none/s);
  assert.match(app, /shouldShowAddLanguageHint/);
  assert.match(app, /updateAddLanguageHint/);
});
