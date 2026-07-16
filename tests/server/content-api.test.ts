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

describe("content API", () => {
  it("lists topics and approved mindmaps", async () => {
    const app = createApp({ db });
    const topics = await request(app).get("/api/topics").expect(200);
    const maps = await request(app).get("/api/mindmaps").expect(200);
    expect(topics.body).toHaveLength(17);
    expect(maps.body).toHaveLength(17);
    expect(maps.body).toContainEqual(expect.objectContaining({ title: "Eating Essentials", status: "approved" }));
  });

  it("loads a map with reusable vocabulary nodes", async () => {
    const app = createApp({ db });
    const response = await request(app).get("/api/mindmaps/1").expect(200);
    expect(response.body.nodes.some((node: { label: string }) => node.label === "apple")).toBe(true);
    expect(response.body.nodes.filter((node: { vocabularyId: number | null }) => node.vocabularyId).length).toBeGreaterThan(10);
  });

  it("keeps generated content as draft until explicit approval", async () => {
    const app = createApp({ db });
    const draft = await request(app).post("/api/mindmaps/drafts").send({
      topicId: 1, title: "Ordering breakfast", source: "ai", nodes: [
        { parentIndex: null, nodeType: "root", label: "breakfast", meaningVi: "bữa sáng", color: "amber", x: 0, y: 0 },
        { parentIndex: 0, nodeType: "vocabulary", label: "scrambled eggs", term: "scrambled eggs", meaningVi: "trứng bác", color: "coral", x: 200, y: 0 },
      ],
    }).expect(201);
    expect(draft.body.status).toBe("draft");
    const approvedBefore = await request(app).get("/api/mindmaps").expect(200);
    expect(approvedBefore.body.some((map: { id: number }) => map.id === draft.body.id)).toBe(false);
    const approved = await request(app).post(`/api/mindmaps/${draft.body.id}/approve`).expect(200);
    expect(approved.body.status).toBe("approved");
  });

  it("updates node layout and label", async () => {
    const app = createApp({ db });
    const map = await request(app).get("/api/mindmaps/1");
    const apple = map.body.nodes.find((node: { label: string }) => node.label === "apple");
    const updated = await request(app).patch(`/api/mindmaps/1/nodes/${apple.id}`).send({ label: "green apple", x: 321 }).expect(200);
    expect(updated.body).toMatchObject({ label: "green apple", x: 321 });
  });

  it("queues vocabulary image generation and serves the completed media", async () => {
    const imageBytes = Buffer.from("fake png bytes");
    const nineRouter = { health: async () => true, generateImage: async () => ({ buffer: imageBytes, mimeType: "image/png" }) };
    const app = createApp({ db, nineRouter: nineRouter as never, protectApi: false });
    const map = await request(app).get("/api/mindmaps/1").expect(200);
    const apple = map.body.nodes.find((node: { label: string }) => node.label === "apple");

    const queued = await request(app).post(`/api/mindmaps/1/nodes/${apple.id}/image`).expect(202);
    expect(queued.body).toMatchObject({ status: "running" });
    const completed = await request(app).get(`/api/mindmaps/1/nodes/${apple.id}/image`).expect(200);
    expect(completed.body).toMatchObject({ status: "completed" });
    expect(completed.body.imageUrl).toMatch(/^\/media\/vocabulary\//);
    const refreshed = await request(app).get("/api/mindmaps/1").expect(200);
    expect(refreshed.body.nodes.find((node: { id:number }) => node.id === apple.id).imageUrl).toBe(completed.body.imageUrl);
    await request(app).get(completed.body.imageUrl).expect(200).expect("Content-Type", /image\/png/).expect(imageBytes);
  });
});
