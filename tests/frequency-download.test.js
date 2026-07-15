import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isActivEsWordCandidate,
  parseActivEsArgentinaCsv
} from '../scripts/download-frequency-dictionaries.js';

const SAMPLE_CSV = `"","word","ar_orf","es_orf","mx_orf","aes_orf","ar_ord","es_ord","mx_ord","aes_ord"
"1","a",2654.57,2541.01,2537.99,2576.18,9.92,10,10,9.98
"2","á",0.24,0.1,0.13,0.15,0.16,0.05,0.08,0.09
"3","aa",0.36,0.1,0.13,0.19,0.16,0.05,0.08,0.09
"4","aaaaaa",0.12,0,0,0.04,0.08,0,0,0.02
"5","che",120.5,10.2,8.1,45.3,8.5,4.2,3.9,5.1
"6","vos",95.2,12.1,11.0,40.0,7.8,4.0,3.8,4.9
"7","hola",0,80.0,75.0,78.0,0,9.0,8.5,8.8
`;

test('isActivEsWordCandidate rejects junk and non-words', () => {
  assert.equal(isActivEsWordCandidate('che'), true);
  assert.equal(isActivEsWordCandidate('aaaaaa'), false);
  assert.equal(isActivEsWordCandidate('a'), false);
  assert.equal(isActivEsWordCandidate('123'), false);
});

test('parseActivEsArgentinaCsv sorts by Argentina frequency and skips zero ar_orf', () => {
  const words = parseActivEsArgentinaCsv(SAMPLE_CSV, 10);
  assert.deepEqual(words.slice(0, 3), ['che', 'vos', 'aa']);
  assert.equal(words.includes('hola'), false);
  assert.equal(words.includes('aaaaaa'), false);
  assert.equal(words.includes('a'), false);
});
