import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { AppDatabase } from "../../src/server/db/database";
import { createDatabase } from "../../src/server/db/database";
import { migrate } from "../../src/server/db/migrate";
import { seedDatabase } from "../../src/server/db/seed";
import { createApp } from "../../src/server/app";

let db: AppDatabase;
beforeEach(() => { db = createDatabase(":memory:"); migrate(db); seedDatabase(db); });
afterEach(() => db.close());

describe("learning paths API", () => {
  it("lists CEFR paths with modules and progress", async () => {
    const app = createApp({ db });
    const response = await request(app).get("/api/learning-paths").expect(200);
    expect(response.body).toHaveLength(4);
    expect(response.body[0]).toMatchObject({ level: "A1", title: "A1 Beginner" });
    expect(response.body[0].modules.length).toBeGreaterThan(3);
    expect(response.body[0].modules[0]).toMatchObject({ title: "Introduce Yourself", status: "active" });
  });

  it("loads a module with linked topic and starts a focused session", async () => {
    const app = createApp({ db });
    const paths = await request(app).get("/api/learning-paths").expect(200);
    const moduleId = paths.body[0].modules.find((item: { slug: string }) => item.slug === "food-and-drinks").id;
    const detail = await request(app).get(`/api/learning-paths/modules/${moduleId}`).expect(200);
    expect(detail.body).toMatchObject({ title: "Food & Drinks", level: "A1" });
    expect(detail.body.mindmap?.title).toBe("Eating Essentials");
    const session = await request(app).post("/api/learning/sessions").send({ duration: 10, moduleId }).expect(201);
    expect(session.body.items.length).toBeGreaterThan(0);
    expect(session.body.items.every((item: { activityType: string }) => Boolean(item.activityType))).toBe(true);
  });

  it("updates module progress after completing a focused session", async () => {
    const app = createApp({ db });
    const agent = request.agent(app);
    await agent.post("/api/auth/register").send({ username: "learner", password: "strong password 123", passwordConfirmation: "strong password 123" }).expect(201);
    const paths = await agent.get("/api/learning-paths").expect(200);
    const moduleId = paths.body[0].modules[0].id;
    const session = await agent.post("/api/learning/sessions").send({ duration: 10, moduleId }).expect(201);
    for (const item of session.body.items) await agent.post(`/api/learning/sessions/${session.body.id}/attempts`).send({ vocabularyId: item.vocabularyId, promptType: item.activityType, answer: item.term, isCorrect: true, responseMs: 800, hintsUsed: 0, grade: "good" }).expect(201);
    await agent.post(`/api/learning/sessions/${session.body.id}/complete`).expect(200);
    const updated = await agent.get("/api/learning-paths").expect(200);
    const module = updated.body[0].modules.find((item: { id:number }) => item.id === moduleId);
    expect(module.progressPercent).toBeGreaterThan(0);
  });

  it("unlocks the next module when the previous module reaches 100%", async () => {
    const app = createApp({ db });
    const agent = request.agent(app);
    await agent.post("/api/auth/register").send({ username: "unlocker", password: "strong password 123", passwordConfirmation: "strong password 123" }).expect(201);
    const paths = await agent.get("/api/learning-paths").expect(200);
    const firstModule = paths.body[0].modules[0];
    const secondModule = paths.body[0].modules[1];
    expect(secondModule.status).toBe("locked");
    const totalItems = firstModule.totalWords;
    db.prepare("INSERT INTO user_module_progress(user_id,module_id,status,completed_items,total_items) VALUES (?,?,?,?,?)").run(1, firstModule.id, "completed", totalItems, totalItems);

    const updated = await agent.get("/api/learning-paths").expect(200);
    expect(updated.body[0].modules[0]).toMatchObject({ status: "completed", progressPercent: 100 });
    expect(updated.body[0].modules[1]).toMatchObject({ id: secondModule.id, status: "active" });
  });
});
