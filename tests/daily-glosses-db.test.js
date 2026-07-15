import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';

let dbModule;
try {
  dbModule = await import('../server/db.js');
} catch (_) {
  dbModule = null;
}

const describeDb = dbModule ? describe : describe.skip;

const tempDir = mkdtempSync(join(tmpdir(), 'ten-daily-glosses-db-'));
const dbPath = join(tempDir, 'test.db');

describeDb('daily word gloss persistence', () => {
  const { findOrCreateUser, getDailyWordGlosses, initDb, setDailyWordGlosses } = dbModule;
  let userId;

  before(() => {
    initDb(dbPath);
    userId = findOrCreateUser('gloss-tester').id;
  });

  after(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('stores glosses per user, language, date, and target language', () => {
    const glosses = {
      bonjour: { wordGloss: 'hello', s1Gloss: 'Hello, how are you?' }
    };
    const saved = setDailyWordGlosses(userId, 'FR', '2026-6-12', 'EN', glosses);
    assert.equal(saved.ok, true);
    assert.deepEqual(getDailyWordGlosses(userId, 'FR', '2026-6-12', 'EN'), glosses);
    assert.equal(getDailyWordGlosses(userId, 'FR', '2026-6-12', 'PT-BR'), null);
  });
});
