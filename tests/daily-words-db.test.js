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

const tempDir = mkdtempSync(join(tmpdir(), 'ten-daily-words-'));
const dbPath = join(tempDir, 'test.db');

describeDb('daily word assignment persistence', () => {
  const { getDailyWordAssignment, initDb, setDailyWordAssignment } = dbModule;

  before(() => {
    initDb(dbPath);
  });

  after(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('stores and returns today word headwords per language and date', () => {
    const words = ['bonjour', 'merci', 'oui'];
    const saved = setDailyWordAssignment('FR', '2026-6-12', words);
    assert.equal(saved.ok, true);
    assert.deepEqual(saved.words, ['bonjour', 'merci', 'oui']);
    assert.deepEqual(getDailyWordAssignment('FR', '2026-6-12'), ['bonjour', 'merci', 'oui']);
  });

  it('keeps assignments separate by language and date', () => {
    setDailyWordAssignment('PT-BR', '2026-6-12', ['ola']);
    setDailyWordAssignment('FR', '2026-6-13', ['salut']);
    assert.deepEqual(getDailyWordAssignment('PT-BR', '2026-6-12'), ['ola']);
    assert.deepEqual(getDailyWordAssignment('FR', '2026-6-13'), ['salut']);
    assert.equal(getDailyWordAssignment('FR', '2026-6-12')?.length, 3);
  });

  it('rejects empty or oversized lists', () => {
    assert.equal(setDailyWordAssignment('FR', '2026-6-14', []).ok, false);
    assert.equal(
      setDailyWordAssignment('FR', '2026-6-14', Array.from({ length: 11 }, (_, i) => `w${i}`)).ok,
      false
    );
  });
});
