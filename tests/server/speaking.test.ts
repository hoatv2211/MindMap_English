import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { AppDatabase } from "../../src/server/db/database";
import { createDatabase } from "../../src/server/db/database";
import { migrate } from "../../src/server/db/migrate";
import { createApp } from "../../src/server/app";
import { compareTranscript } from "../../src/server/modules/speaking/diff";

let db: AppDatabase;

beforeEach(() => { db = createDatabase(":memory:"); migrate(db); });
afterEach(() => db.close());

describe("compareTranscript", () => {
  it("ignores punctuation and marks matching tokens", () => {
    const result = compareTranscript("Hello, world!", "hello world");
    expect(result.score).toBe(1);
    expect(result.tokens).toEqual([
      { token: "Hello", status: "match" },
      { token: "world", status: "match" },
    ]);
  });

  it("marks missing, extra, and replacement tokens", () => {
    expect(compareTranscript("I need the menu", "I want menu please").tokens).toEqual([
      { token: "I", status: "match" },
      { token: "need", status: "replacement" },
      { token: "want", status: "replacement" },
      { token: "the", status: "missing" },
      { token: "menu", status: "match" },
      { token: "please", status: "extra" },
    ]);
  });
});

describe("speaking API", () => {
  const createTestApp = () => createApp({ db, nineRouter: { health: vi.fn(async () => false) } as never });

  it("adds and lists unique notebook sentences", async () => {
    const app = createTestApp();
    const input = { sentence: "Could I have the menu, please?", translationVi: "Cho tôi xin thực đơn.", sourceType: "user" };
    const created = await request(app).post("/api/speaking/notebook").send(input).expect(201);
    expect(created.body.fingerprint).toBeTruthy();
    await request(app).post("/api/speaking/notebook").send(input).expect(409);
    const list = await request(app).get("/api/speaking/notebook").expect(200);
    expect(list.body).toHaveLength(1);
  });

  it("runs a session, stores attempts, and reports metrics", async () => {
    const app = createTestApp();
    const sentence = await request(app).post("/api/speaking/notebook").send({ sentence: "Could I have the menu please", sourceType: "user" }).expect(201);
    const session = await request(app).post("/api/speaking/sessions").send({ sentenceIds: [sentence.body.id] }).expect(201);
    const attempt = await request(app).post(`/api/speaking/sessions/${session.body.id}/attempts`).send({
      sentenceId: sentence.body.id,
      transcript: "Could I have menu please",
      durationMs: 2400,
    }).expect(201);
    expect(attempt.body.contentScore).toBeGreaterThan(0.7);
    expect(attempt.body.diff).toContainEqual({ token: "the", status: "missing" });
    await request(app).post(`/api/speaking/sessions/${session.body.id}/complete`).expect(200);
    const metrics = await request(app).get("/api/speaking/metrics").expect(200);
    expect(metrics.body).toMatchObject({ attempts7d: 1, speakingSeconds7d: 2 });
  });
});
