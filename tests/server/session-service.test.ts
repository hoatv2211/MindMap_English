import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { AppDatabase } from "../../src/server/db/database";
import { createDatabase } from "../../src/server/db/database";
import { migrate } from "../../src/server/db/migrate";
import { seedDatabase } from "../../src/server/db/seed";
import { createApp } from "../../src/server/app";
import { LearningRepository } from "../../src/server/modules/learning/repository";
import { buildSession } from "../../src/server/modules/learning/session-service";

let db: AppDatabase;
beforeEach(() => { db=createDatabase(":memory:"); migrate(db); seedDatabase(db); });
afterEach(() => db.close());

describe("session composition", () => {
  it("prioritizes weak due items and avoids duplicates", () => {
    const candidates = Array.from({ length: 20 }, (_, index) => ({ vocabularyId: index + 1, status: index < 3 ? "weak" as const : "new" as const, due: index < 8, isNew: index >= 8, lapses: index < 3 ? 2 : 0 }));
    const plan = buildSession(candidates, 10);
    expect(plan).toHaveLength(8);
    expect(new Set(plan.map((item) => item.vocabularyId)).size).toBe(8);
    expect(plan.slice(0, 3).every((item) => item.status === "weak")).toBe(true);
  });

  it("creates, grades, and completes a persisted session", async () => {
    const app = createApp({ db });
    const created = await request(app).post("/api/learning/sessions").send({ duration: 10 });
    expect(created.status).toBe(201);
    expect(created.body.items).toHaveLength(8);
    const item = created.body.items[0];
    await request(app).post(`/api/learning/sessions/${created.body.id}/attempts`).send({ vocabularyId: item.vocabularyId, promptType: "meaning-recall", answer: item.meaningVi, isCorrect: true, responseMs: 1200, hintsUsed: 0, grade: "good" }).expect(201);
    const completed = await request(app).post(`/api/learning/sessions/${created.body.id}/complete`).expect(200);
    expect(completed.body.status).toBe("completed");
  });

  it("backfills seed vocabulary for existing accounts before starting a focused module", async () => {
    const app = createApp({ db });
    const agent = request.agent(app);
    await agent.post("/api/auth/register").send({ username: "learner", password: "strong password 123", passwordConfirmation: "strong password 123" }).expect(201);
    db.prepare("DELETE FROM user_vocabulary_state WHERE user_id=1").run();
    const paths = await agent.get("/api/learning-paths").expect(200);
    const moduleId = paths.body[0].modules[0].id;
    const created = await agent.post("/api/learning/sessions").send({ duration: 10, moduleId }).expect(201);
    expect(created.body.items.length).toBeGreaterThan(0);
    expect((db.prepare("SELECT COUNT(*) count FROM user_vocabulary_state WHERE user_id=1").get() as { count:number }).count).toBeGreaterThan(0);
  });

  it("returns dashboard and progress summaries", () => {
    const repository = new LearningRepository(db);
    expect(repository.getDashboard(false)).toMatchObject({ newCount: 66, streak: 0, aiOnline: false });
    expect(repository.getProgress()).toHaveProperty("accuracy30d");
  });
});
