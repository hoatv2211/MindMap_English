import { describe, expect, it } from "vitest";
import { scheduleReview } from "../../src/server/modules/learning/srs";

const base = { stability: 1, difficulty: 5, intervalDays: 1, repetitions: 1, lapses: 0 };
const now = new Date("2026-07-13T10:00:00.000Z");

describe("scheduleReview", () => {
  it("resets a forgotten card for near-term relearning", () => {
    const result = scheduleReview(base, "again", now);
    expect(result.intervalDays).toBe(0);
    expect(result.repetitions).toBe(0);
    expect(result.lapses).toBe(1);
    expect(result.dueAt).toBe("2026-07-13T10:10:00.000Z");
  });

  it("increases intervals by grade", () => {
    const hard = scheduleReview(base, "hard", now);
    const good = scheduleReview(base, "good", now);
    const easy = scheduleReview(base, "easy", now);
    expect(hard.intervalDays).toBeLessThan(good.intervalDays);
    expect(good.intervalDays).toBeLessThan(easy.intervalDays);
  });
});
