import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildDevOpsPayload,
  buildPoolHealthReport,
  buildSeenSet,
  computeUserPoolRunway,
  POOL_WARN_DAYS
} from '../server/pool-health.js';

const tinyPool = [
  { word: 'casa' },
  { word: 'perro' },
  { word: 'gato' },
  { word: 'sol' },
  { word: 'luna' },
  { word: 'mar' },
  { word: 'rio' },
  { word: 'pan' },
  { word: 'agua' },
  { word: 'fuego' },
  { word: 'tierra' },
  { word: 'aire' },
  { word: 'nube' },
  { word: 'bosque' },
  { word: 'ciudad' },
  { word: 'campo' },
  { word: 'camino' },
  { word: 'puerta' },
  { word: 'ventana' },
  { word: 'mesa' }
];

describe('buildSeenSet', () => {
  it('normalizes unlocked words', () => {
    const seen = buildSeenSet(['Casa', ' PERRO ']);
    assert.equal(seen.has('casa'), true);
    assert.equal(seen.has('perro'), true);
  });
});

describe('computeUserPoolRunway', () => {
  it('counts days left from unseen pool words', () => {
    const runway = computeUserPoolRunway(tinyPool, ['casa', 'perro']);
    assert.equal(runway.unseenCount, 18);
    assert.equal(runway.daysLeft, 1.8);
    assert.equal(runway.warning, true);
  });

  it('marks warning at the pool warn threshold', () => {
    const pool = Array.from({ length: 80 }, (_, index) => ({ word: `w${index}` }));
    const unlocked = pool.slice(0, 10).map(entry => entry.word);
    const runway = computeUserPoolRunway(pool, unlocked);
    assert.equal(runway.daysLeft, POOL_WARN_DAYS);
    assert.equal(runway.warning, true);
  });
});

describe('buildPoolHealthReport', () => {
  const pools = {
    'PT-BR': Array.from({ length: 100 }, (_, index) => ({ word: `pt${index}` })),
    FR: [{ word: 'bonjour' }],
    'FR-FR': Array.from({ length: 100 }, (_, index) => ({ word: `fr${index}` })),
    'ES-AR': tinyPool
  };

  it('sorts languages by tightest user runway', () => {
    const users = [
      {
        username: 'alice',
        languages: ['ES-AR', 'FR'],
        unlockedWords: { 'ES-AR': tinyPool.slice(0, 17).map(entry => entry.word), FR: [] }
      },
      {
        username: 'bob',
        languages: ['ES-AR'],
        unlockedWords: { 'ES-AR': [] }
      }
    ];
    const report = buildPoolHealthReport(users, pools);
    assert.equal(report.languages[0].language, 'FR');
    assert.equal(report.languages[0].minDaysLeft, 0.1);
    assert.equal(report.languages[1].language, 'ES-AR');
    assert.equal(report.languages[1].minDaysLeft, 0.3);
    assert.equal(report.languages[1].users[0].username, 'alice');
    assert.equal(report.languages.length, 4);
    assert.equal(report.alertCount, 2);
  });

  it('includes all four language pools even without active users', () => {
    const report = buildPoolHealthReport([], pools);
    assert.equal(report.languages.length, 4);
    assert.equal(report.languages[0].language, 'FR');
    assert.equal(report.languages[0].minDaysLeft, 0.1);
    assert.equal(report.languages.find(lang => lang.language === 'PT-BR')?.hasUsers, false);
    assert.equal(report.languages.find(lang => lang.language === 'PT-BR')?.minDaysLeft, 10);
    assert.equal(report.alertCount, 2);
  });
});

describe('buildDevOpsPayload', () => {
  it('includes feedback entries', () => {
    const payload = buildDevOpsPayload([], {}, [{ id: 1, body: 'hi', username: 'jd' }]);
    assert.equal(payload.feedback.length, 1);
    assert.equal(payload.feedback[0].body, 'hi');
  });
});
