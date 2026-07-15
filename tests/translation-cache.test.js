import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
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

const tempDir = mkdtempSync(join(tmpdir(), 'ten-translation-cache-'));
const dbPath = join(tempDir, 'test.db');

describeDb('translation cache', () => {
  const {
    getCachedTranslation,
    initDb,
    setCachedTranslation
  } = dbModule;

  before(() => {
    initDb(dbPath);
  });

  after(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns null on cache miss', () => {
    assert.equal(getCachedTranslation('FR', 'EN', 'bonjour'), null);
  });

  it('stores and returns cached translations by source, target, and text hash', () => {
    const saved = setCachedTranslation('FR', 'EN', 'bonjour', 'hello');
    assert.equal(saved.ok, true);
    assert.equal(getCachedTranslation('FR', 'EN', 'bonjour'), 'hello');
    assert.equal(getCachedTranslation('FR', 'EN', 'Bonjour'), 'hello');
    assert.equal(getCachedTranslation('FR', 'PT-BR', 'bonjour'), null);
  });

  it('updates an existing cache row for the same key', () => {
    setCachedTranslation('PT-BR', 'EN', 'casa', 'house');
    setCachedTranslation('PT-BR', 'EN', 'casa', 'home');
    assert.equal(getCachedTranslation('PT-BR', 'EN', 'casa'), 'home');
  });
});
