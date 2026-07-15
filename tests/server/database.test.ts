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
      "document_highlights", "users", "auth_sessions", "password_recovery_codes",
      "auth_rate_limits", "user_settings", "learner_context_cache", "agent_response_cache",
      "vocabulary_inbox_items", "vocabulary_inbox_drafts", "user_vocabulary_examples",
    ]));
    expect(db.pragma("foreign_keys", { simple: true })).toBe(1);
    const mindmapColumns=(db.prepare("PRAGMA table_info(mindmaps)").all() as Array<{name:string}>).map(row=>row.name);
    expect(mindmapColumns).toContain("copied_from_mindmap_id");
    const copyIndexes=db.prepare("PRAGMA index_list(mindmaps)").all() as Array<{name:string;unique:number}>;
    expect(copyIndexes).toContainEqual(expect.objectContaining({name:"idx_mindmaps_personal_copy",unique:1}));
  });

  it("seeds a practical starter map for every topic idempotently", () => {
    seedDatabase(db);
    seedDatabase(db);
    const topicCount = (db.prepare("SELECT COUNT(*) count FROM topics").get() as { count: number }).count;
    const mapCount = (db.prepare("SELECT COUNT(*) count FROM mindmaps").get() as { count: number }).count;
    const wordCount = (db.prepare("SELECT COUNT(*) count FROM vocabulary").get() as { count: number }).count;
    expect(topicCount).toBe(17);
    expect(mapCount).toBe(17);
    expect((db.prepare("SELECT COUNT(DISTINCT topic_id) count FROM mindmaps WHERE source='seed' AND status='approved'").get() as {count:number}).count).toBe(17);
    expect(wordCount).toBeGreaterThanOrEqual(66);
  });
  it("adds per-user SRS columns and idempotent profile triggers", () => {
    migrate(db);
    const columns=(db.prepare("PRAGMA table_info(user_vocabulary_state)").all() as Array<{name:string}>).map(row=>row.name);
    expect(columns).toEqual(expect.arrayContaining(["stability","difficulty","interval_days","repetitions","lapses","due_at","last_reviewed_at"]));
    const triggerCount=(db.prepare("SELECT COUNT(*) count FROM sqlite_master WHERE type='trigger' AND name LIKE 'trg_%_profile_%'").get() as {count:number}).count;
    expect(triggerCount).toBeGreaterThan(10);
    db.prepare("INSERT INTO users(username,normalized_username,password_hash) VALUES ('revision','revision','hash')").run();
    const before=(db.prepare("SELECT profile_revision value FROM users WHERE id=1").get() as {value:number}).value;
    db.prepare("INSERT INTO user_learning_progress(user_id) VALUES (1)").run();
    const after=(db.prepare("SELECT profile_revision value FROM users WHERE id=1").get() as {value:number}).value;
    expect(after).toBeGreaterThan(before);
  });
  it("adds vocabulary inbox ownership and draft constraints", () => {
    const itemColumns=(db.prepare("PRAGMA table_info(vocabulary_inbox_items)").all() as Array<{name:string}>).map(row=>row.name);
    expect(itemColumns).toEqual(expect.arrayContaining(["user_id","raw_text","status","source_type","approved_vocabulary_id"]));
    const draftColumns=db.prepare("PRAGMA table_info(vocabulary_inbox_drafts)").all() as Array<{name:string;pk:number}>;
    expect(draftColumns.find(column=>column.name==="inbox_item_id")?.pk).toBe(1);
    const exampleIndexes=db.prepare("PRAGMA index_list(user_vocabulary_examples)").all() as Array<{name:string;unique:number}>;
    expect(exampleIndexes.some(index=>index.unique===1)).toBe(true);
  });

});
