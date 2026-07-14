import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { AppDatabase } from "../../src/server/db/database";
import { createDatabase } from "../../src/server/db/database";
import { migrate } from "../../src/server/db/migrate";
import { seedDatabase } from "../../src/server/db/seed";
import { createApp } from "../../src/server/app";
import { WordIndex } from "../../src/server/modules/dictionary/word-index";

let db: AppDatabase;

beforeEach(() => {
  db = createDatabase(":memory:");
  migrate(db);
  seedDatabase(db);
});

afterEach(() => db.close());

describe("WordIndex", () => {
  it("normalizes exact lookups and caps prefix completion", () => {
    const index = new WordIndex(["Apple", "application", "apply", "appoint", "appraise", "approach", "approval"]);
    expect(index.has("  APPLE ")).toBe(true);
    expect(index.complete("app")).toEqual(["apple", "application", "apply", "appoint", "appraise", "approach"]);
  });

  it("suggests nearby spellings", () => {
    const index = new WordIndex(["apple", "apply", "maple"]);
    expect(index.suggest("aple")).toContain("apple");
  });
});

describe("dictionary API", () => {
  it("looks up seeded vocabulary without calling AI", async () => {
    const health = vi.fn(async () => false);
    const app = createApp({ db, nineRouter: { health } as never });
    const response = await request(app).get("/api/dictionary/lookup").query({ term: "Apple" }).expect(200);
    expect(response.body).toMatchObject({
      term: "Apple",
      normalizedTerm: "apple",
      known: true,
      existingVocabularyId: expect.any(Number),
    });
    expect(health).not.toHaveBeenCalled();
  });

  it("returns typo suggestions and prefix completions", async () => {
    const app = createApp({ db, nineRouter: { health: vi.fn(async () => false) } as never });
    const lookup = await request(app).get("/api/dictionary/lookup").query({ term: "aple" }).expect(200);
    expect(lookup.body.suggestions).toContain("apple");
    const complete = await request(app).get("/api/dictionary/complete").query({ prefix: "a" }).expect(200);
    expect(complete.body.items.length).toBeLessThanOrEqual(6);
  });
});
