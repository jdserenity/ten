import { createEmptyCard, fsrs, Rating, State } from 'ts-fsrs';

const scheduler = fsrs();

const RATING_BY_NAME = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy
};

export { Rating, State, createEmptyCard };

export function applyRating(card, ratingName, now = new Date()) {
  const rating = RATING_BY_NAME[String(ratingName || '').toLowerCase()];
  if (!rating) throw new Error('Invalid rating.');
  return scheduler.next(card, now, rating);
}

export function rowToFsrsCard(row) {
  return {
    due: new Date(Number(row.due)),
    stability: Number(row.stability) || 0,
    difficulty: Number(row.difficulty) || 0,
    elapsed_days: Number(row.elapsed_days) || 0,
    scheduled_days: Number(row.scheduled_days) || 0,
    learning_steps: Number(row.learning_steps) || 0,
    reps: Number(row.reps) || 0,
    lapses: Number(row.lapses) || 0,
    state: Number(row.fsrs_state) || 0,
    last_review: row.last_review != null ? new Date(Number(row.last_review)) : undefined
  };
}

export function fsrsCardToRowFields(card) {
  return {
    due: card.due.getTime(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    fsrs_state: card.state,
    last_review: card.last_review ? card.last_review.getTime() : null
  };
}
