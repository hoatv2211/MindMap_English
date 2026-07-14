import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AppDatabase } from "../../src/server/db/database";
import { createDatabase } from "../../src/server/db/database";
import { migrate } from "../../src/server/db/migrate";
import { seedDatabase } from "../../src/server/db/seed";

let db: AppDatabase;

beforeEach(() => {
  db = createDatabase(":memory:");
  migrate(db);
});

afterEach(() => db.close());

describe("database migration", () => {
  it("creates required tables and enables foreign keys", () => {
    const names = (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>).map((row) => row.name);
    expect(names).toEqual(expect.arrayContaining([
      "topics", "mindmaps", "mindmap_nodes", "vocabulary", "review_cards",
      "learning_sessions", "generation_jobs", "settings", "backups",
    ]));
    expect(names).toEqual(expect.arrayContaining([
      "sentence_notebook", "speaking_sessions", "speaking_session_items",
      "speaking_attempts", "document_sources", "document_sections",
      "document_highlights",
    ]));
    expect(db.pragma("foreign_keys", { simple: true })).toBe(1);
  });

  it("seeds seventeen topics and one practical eating map idempotently", () => {
    seedDatabase(db);
    seedDatabase(db);
    const topicCount = (db.prepare("SELECT COUNT(*) count FROM topics").get() as { count: number }).count;
    const mapCount = (db.prepare("SELECT COUNT(*) count FROM mindmaps").get() as { count: number }).count;
    const wordCount = (db.prepare("SELECT COUNT(*) count FROM vocabulary").get() as { count: number }).count;
    expect(topicCount).toBe(17);
    expect(mapCount).toBe(1);
    expect(wordCount).toBeGreaterThanOrEqual(18);
  });
});
