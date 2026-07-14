import type { ReviewGrade } from "../../../shared/contracts";

export interface ReviewCardState {
  stability: number;
  difficulty: number;
  intervalDays: number;
  repetitions: number;
  lapses: number;
}

export interface ReviewSchedule extends ReviewCardState {
  dueAt: string;
  reviewedAt: string;
}

const dayMs = 86_400_000;

export function scheduleReview(card: ReviewCardState, grade: ReviewGrade, now: Date): ReviewSchedule {
  let stability = Math.max(0.2, card.stability);
  let difficulty = Math.min(10, Math.max(1, card.difficulty));
  let intervalDays: number;
  let repetitions = card.repetitions;
  let lapses = card.lapses;
  let delayMs = 0;

  if (grade === "again") {
    stability = Math.max(0.35, stability * 0.55);
    difficulty = Math.min(10, difficulty + 0.8);
    intervalDays = 0;
    repetitions = 0;
    lapses += 1;
    delayMs = 10 * 60_000;
  } else if (grade === "hard") {
    stability = Math.max(1, stability * 1.2);
    difficulty = Math.min(10, difficulty + 0.2);
    intervalDays = Math.max(1, Math.round(Math.max(card.intervalDays, 1) * 1.2));
    repetitions += 1;
  } else if (grade === "good") {
    stability = stability * (1.8 + Math.max(0, 6 - difficulty) * 0.08);
    difficulty = Math.max(1, difficulty - 0.15);
    intervalDays = repetitions === 0 ? 1 : Math.max(2, Math.round(Math.max(card.intervalDays, 1) * 2.2));
    repetitions += 1;
  } else {
    stability = stability * (2.4 + Math.max(0, 6 - difficulty) * 0.1);
    difficulty = Math.max(1, difficulty - 0.35);
    intervalDays = repetitions === 0 ? 4 : Math.max(5, Math.round(Math.max(card.intervalDays, 1) * 3.1));
    repetitions += 1;
  }

  const dueAt = new Date(now.getTime() + (delayMs || intervalDays * dayMs));
  return {
    stability: Number(stability.toFixed(3)), difficulty: Number(difficulty.toFixed(3)),
    intervalDays, repetitions, lapses, dueAt: dueAt.toISOString(), reviewedAt: now.toISOString(),
  };
}
