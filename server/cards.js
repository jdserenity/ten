import { createEmptyCard, State, applyRating, rowToFsrsCard, fsrsCardToRowFields } from './fsrs.js';
import { getDb, normalizeLanguage } from './db.js';

function trimField(value) {
  return String(value || '').trim();
}

function mapRowToReviewCard(row) {
  return {
    id: row.id,
    queueKind: Number(row.fsrs_state) === State.New ? 'new' : 'due',
    front: row.front,
    back: row.back,
    context: row.context || ''
  };
}

export function addCard(language, { front, back, context = '' }) {
  const lang = normalizeLanguage(language);
  const cleanFront = trimField(front);
  const cleanBack = trimField(back);
  const cleanContext = trimField(context);
  if (!lang || !cleanFront || !cleanBack) return { ok: false, reason: 'invalid' };

  const empty = createEmptyCard();
  const fsrsFields = fsrsCardToRowFields(empty);
  try {
    const result = getDb()
      .prepare(`
        INSERT INTO cards (
          language, front, back, context,
          due, stability, difficulty, elapsed_days, scheduled_days,
          learning_steps, reps, lapses, fsrs_state, last_review
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        lang, cleanFront, cleanBack, cleanContext,
        fsrsFields.due, fsrsFields.stability, fsrsFields.difficulty,
        fsrsFields.elapsed_days, fsrsFields.scheduled_days,
        fsrsFields.learning_steps, fsrsFields.reps, fsrsFields.lapses,
        fsrsFields.fsrs_state, fsrsFields.last_review
      );
    return { ok: true, id: Number(result.lastInsertRowid), duplicate: false };
  } catch (error) {
    if (String(error?.message || '').includes('UNIQUE constraint failed')) {
      return { ok: false, reason: 'duplicate' };
    }
    throw error;
  }
}

export function getCardById(id) {
  const cardId = Number(id);
  if (!Number.isInteger(cardId) || cardId <= 0) return null;
  return getDb().prepare('SELECT * FROM cards WHERE id = ?').get(cardId) || null;
}

export function deleteCard(id) {
  const cardId = Number(id);
  if (!Number.isInteger(cardId) || cardId <= 0) return { ok: false, reason: 'invalid' };
  const result = getDb().prepare('DELETE FROM cards WHERE id = ?').run(cardId);
  return { ok: true, deleted: result.changes > 0 };
}

export function updateCard(id, { front, back, context }) {
  const cardId = Number(id);
  if (!Number.isInteger(cardId) || cardId <= 0) return { ok: false, reason: 'invalid' };

  const row = getCardById(cardId);
  if (!row) return { ok: false, reason: 'not_found' };

  const cleanFront = trimField(front);
  const cleanBack = trimField(back);
  const cleanContext = context === undefined ? trimField(row.context) : trimField(context);
  if (!cleanFront || !cleanBack) return { ok: false, reason: 'invalid' };

  try {
    const result = getDb()
      .prepare('UPDATE cards SET front = ?, back = ?, context = ? WHERE id = ?')
      .run(cleanFront, cleanBack, cleanContext, cardId);
    if (!result.changes) return { ok: false, reason: 'not_found' };
    return { ok: true, id: cardId };
  } catch (error) {
    if (String(error?.message || '').includes('UNIQUE constraint failed')) {
      return { ok: false, reason: 'duplicate' };
    }
    throw error;
  }
}

export function getReviewQueue(language, nowMs = Date.now()) {
  const lang = normalizeLanguage(language);
  if (!lang) return { ok: false, reason: 'invalid' };

  const newRows = getDb()
    .prepare(`
      SELECT * FROM cards
      WHERE language = ? AND fsrs_state = ?
      ORDER BY created_at ASC, id ASC
    `)
    .all(lang, State.New);

  const dueRows = getDb()
    .prepare(`
      SELECT * FROM cards
      WHERE language = ? AND fsrs_state != ? AND due <= ?
      ORDER BY due ASC, id ASC
    `)
    .all(lang, State.New, nowMs);

  const totalCount = getDb()
    .prepare('SELECT COUNT(*) AS count FROM cards WHERE language = ?')
    .get(lang).count;

  const cards = [...newRows, ...dueRows].map(mapRowToReviewCard);
  return { ok: true, cards, totalCount };
}

export function answerCard(id, rating, now = new Date()) {
  const row = getCardById(id);
  if (!row) return { ok: false, reason: 'not_found' };

  const fsrsCard = rowToFsrsCard(row);
  const { card: nextCard } = applyRating(fsrsCard, rating, now);
  const fields = fsrsCardToRowFields(nextCard);

  getDb()
    .prepare(`
      UPDATE cards SET
        due = ?, stability = ?, difficulty = ?, elapsed_days = ?,
        scheduled_days = ?, learning_steps = ?, reps = ?, lapses = ?,
        fsrs_state = ?, last_review = ?
      WHERE id = ?
    `)
    .run(
      fields.due, fields.stability, fields.difficulty, fields.elapsed_days,
      fields.scheduled_days, fields.learning_steps, fields.reps, fields.lapses,
      fields.fsrs_state, fields.last_review, row.id
    );

  return { ok: true, id: row.id };
}
