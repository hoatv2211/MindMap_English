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
    const client = { chatJson: vi.fn(async () => ({ title: "Breakfast talk", description: "Useful breakfast language", branches: [
      { label: "drinks", meaningVi: "đồ uống", color: "sky", words: [{ term: "black coffee", meaningVi: "cà phê đen", ipa: "/blæk ˈkɒf.i/", cefr: "B1", example: "I take my coffee black.", exampleVi: "Tôi uống cà phê đen." }, { term: "refill", meaningVi: "châm thêm", ipa: "/ˌriːˈfɪl/", cefr: "B1", example: "Could I get a refill?", exampleVi: "Cho tôi châm thêm được không?" }] },
      { label: "orders", meaningVi: "gọi món", color: "coral", words: [{ term: "on the side", meaningVi: "để riêng", ipa: "", cefr: "B1", example: "Sauce on the side, please.", exampleVi: "Cho sốt để riêng." }, { term: "to go", meaningVi: "mang đi", ipa: "", cefr: "A2", example: "Can I get this to go?", exampleVi: "Cho tôi mang đi được không?" }] },
      { label: "food", meaningVi: "món ăn", color: "amber", words: [{ term: "scrambled eggs", meaningVi: "trứng bác", ipa: "", cefr: "A2", example: "I'll have scrambled eggs.", exampleVi: "Tôi dùng trứng bác." }, { term: "toast", meaningVi: "bánh mì nướng", ipa: "", cefr: "A2", example: "Two slices of toast, please.", exampleVi: "Cho hai lát bánh mì nướng." }] },
    ] })) };
    const service = new AgentToolService(db, new ContentRepository(db), new LearningRepository(db), client as never);
    const generated = await service.generateMindmapDraft({ topic: "breakfast", situation: "cafe", cefr: "B1" });
    const saved = service.saveGeneratedDraft(1, generated.draft);
    expect(saved.status).toBe("draft");
    expect(new ContentRepository(db).listMindmaps("approved")).toHaveLength(1);
  });

  it("records failed generation without mutating mindmaps", async () => {
    const client = { chatJson: vi.fn(async () => { throw new Error("offline"); }) };
    const service = new AgentToolService(db, new ContentRepository(db), new LearningRepository(db), client as never);
    await expect(service.generateMindmapDraft({ topic: "travel", situation: "airport", cefr: "B1" })).rejects.toThrow("offline");
    const job = db.prepare("SELECT status FROM generation_jobs ORDER BY id DESC LIMIT 1").get() as { status: string };
    expect(job.status).toBe("failed");
    expect(new ContentRepository(db).listMindmaps("all")).toHaveLength(1);
  });

  it("uses plain chat text for tutor replies", async () => {
    const client = { chatText: vi.fn(async () => "Hello! How can I help?") };
    const service = new AgentToolService(db, new ContentRepository(db), new LearningRepository(db), client as never);
    await expect(service.tutor("hello")).resolves.toEqual({ reply: "Hello! How can I help?", suggestions: [] });
    expect(client.chatText).toHaveBeenCalledOnce();
  });});
