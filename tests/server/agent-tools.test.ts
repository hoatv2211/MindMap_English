import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppDatabase } from "../../src/server/db/database";
import { createDatabase } from "../../src/server/db/database";
import { migrate } from "../../src/server/db/migrate";
import { seedDatabase } from "../../src/server/db/seed";
import { ContentRepository } from "../../src/server/modules/content/repository";
import { LearningRepository } from "../../src/server/modules/learning/repository";
import { AgentToolService } from "../../src/server/modules/agent/tool-service";

let db: AppDatabase;
beforeEach(() => { db=createDatabase(":memory:"); migrate(db); seedDatabase(db); });
afterEach(() => db.close());

describe("AgentToolService", () => {
  it("creates an AI result as an unapproved draft", async () => {
    db.prepare("INSERT INTO users(username,normalized_username,password_hash) VALUES ('owner','owner','hash')").run();
    const client = { chatJson: vi.fn(async () => ({ title: "Breakfast talk", description: "Useful breakfast language", branches: [
      { label: "drinks", meaningVi: "Ä‘á»“ uá»‘ng", color: "sky", words: [{ term: "black coffee", meaningVi: "cÃ  phÃª Ä‘en", ipa: "/blÃ¦k ËˆkÉ’f.i/", cefr: "B1", example: "I take my coffee black.", exampleVi: "TÃ´i uá»‘ng cÃ  phÃª Ä‘en." }, { term: "refill", meaningVi: "chÃ¢m thÃªm", ipa: "/ËŒriËËˆfÉªl/", cefr: "B1", example: "Could I get a refill?", exampleVi: "Cho tÃ´i chÃ¢m thÃªm Ä‘Æ°á»£c khÃ´ng?" }] },
      { label: "orders", meaningVi: "gá»i mÃ³n", color: "coral", words: [{ term: "on the side", meaningVi: "Ä‘á»ƒ riÃªng", ipa: "", cefr: "B1", example: "Sauce on the side, please.", exampleVi: "Cho sá»‘t Ä‘á»ƒ riÃªng." }, { term: "to go", meaningVi: "mang Ä‘i", ipa: "", cefr: "A2", example: "Can I get this to go?", exampleVi: "Cho tÃ´i mang Ä‘i Ä‘Æ°á»£c khÃ´ng?" }] },
      { label: "food", meaningVi: "mÃ³n Äƒn", color: "amber", words: [{ term: "scrambled eggs", meaningVi: "trá»©ng bÃ¡c", ipa: "", cefr: "A2", example: "I'll have scrambled eggs.", exampleVi: "TÃ´i dÃ¹ng trá»©ng bÃ¡c." }, { term: "toast", meaningVi: "bÃ¡nh mÃ¬ nÆ°á»›ng", ipa: "", cefr: "A2", example: "Two slices of toast, please.", exampleVi: "Cho hai lÃ¡t bÃ¡nh mÃ¬ nÆ°á»›ng." }] },
    ] })) };
    const service = new AgentToolService(db, new ContentRepository(db), new LearningRepository(db), client as never);
    const generated = await service.generateMindmapDraft({ topic: "breakfast", situation: "cafe", cefr: "B1" }, 1);
    const saved = service.saveGeneratedDraft(1, generated.draft, 1);
    expect(saved.status).toBe("draft");
    expect(new ContentRepository(db).listMindmaps("approved", 1)).toHaveLength(17);
    expect((db.prepare("SELECT user_id userId FROM generation_jobs WHERE id=?").get(generated.jobId) as {userId:number}).userId).toBe(1);
    expect((db.prepare("SELECT user_id userId FROM mindmaps WHERE id=?").get(saved.id) as {userId:number}).userId).toBe(1);
  });

  it("records failed generation without mutating mindmaps", async () => {
    const client = { chatJson: vi.fn(async () => { throw new Error("offline"); }) };
    const service = new AgentToolService(db, new ContentRepository(db), new LearningRepository(db), client as never);
    await expect(service.generateMindmapDraft({ topic: "travel", situation: "airport", cefr: "B1" })).rejects.toThrow("offline");
    const job = db.prepare("SELECT status FROM generation_jobs ORDER BY id DESC LIMIT 1").get() as { status: string };
    expect(job.status).toBe("failed");
    expect(new ContentRepository(db).listMindmaps("all")).toHaveLength(17);
  });

  it("uses plain chat text for tutor replies", async () => {
    const client = { chatText: vi.fn(async () => "Hello! How can I help?") };
    const service = new AgentToolService(db, new ContentRepository(db), new LearningRepository(db), client as never);
    await expect(service.tutor("hello")).resolves.toEqual({ reply: "Hello! How can I help?", suggestions: [] });
    expect(client.chatText).toHaveBeenCalledOnce();
  });

  it("generates and saves an extension draft into an existing mindmap", async () => {
    db.prepare("INSERT INTO users(username,normalized_username,password_hash) VALUES ('owner','owner','hash')").run();
    const seedMap = db.prepare("SELECT id FROM mindmaps WHERE title='Daily Routine'").get() as {id:number};
    const client = { chatJson: vi.fn(async () => ({ mindmapTitle:"Daily Routine", branches:[{parentLabel:"morning",meaningVi:"buổi sáng",color:"amber",words:[{term:"make the bed",meaningVi:"dọn giường",ipa:"",cefr:"A2",example:"I make the bed after I wake up.",exampleVi:"Tôi dọn giường sau khi thức dậy."},{term:"pack my bag",meaningVi:"soạn cặp/túi",ipa:"",cefr:"A2",example:"I pack my bag before work.",exampleVi:"Tôi soạn túi trước khi đi làm."}]}] })) };
    const service = new AgentToolService(db, new ContentRepository(db), new LearningRepository(db), client as never);
    const draft = await service.generateMindmapExtensionDraft({ mindmapId:seedMap.id, instruction:"thêm từ A2 buổi sáng" }, 1);
    expect(draft.duplicates).toEqual([]);
    const saved = service.saveMindmapExtensionDraft(seedMap.id, draft.draft, 1);
    expect(saved.nodes.some(node => node.label === "make the bed")).toBe(true);
    expect(db.prepare("SELECT 1 FROM user_vocabulary_state WHERE user_id=1 AND vocabulary_id=(SELECT id FROM vocabulary WHERE normalized_term='make the bed')").get()).toBeTruthy();
  });});
