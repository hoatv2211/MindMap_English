import { z } from "zod";
import type { AppDatabase } from "../../db/database";
import type { ContentRepository, SaveDraftInput } from "../content/repository";
import type { LearningRepository } from "../learning/repository";
import { NineRouterClient } from "./ninerouter-client";
import { MindmapDraftInputSchema, type MindmapDraftInput } from "../../../shared/contracts";

export const GeneratedMindmapSchema = z.object({
  title: z.string().min(2).max(120),
  description: z.string().max(500).default(""),
  branches: z.array(z.object({
    label: z.string().min(1), meaningVi: z.string().min(1), color: z.enum(["coral", "amber", "leaf", "sky", "violet"]),
    words: z.array(z.object({ term: z.string().min(1), meaningVi: z.string().min(1), ipa: z.string().default(""), cefr: z.enum(["A1", "A2", "B1", "B2"]), example: z.string().min(1), exampleVi: z.string().min(1) })).min(2).max(6),
  })).min(3).max(7),
});
export type GeneratedMindmap = z.infer<typeof GeneratedMindmapSchema>;

export const DocumentExtractionSchema = z.object({
  vocabulary: z.array(z.object({ term: z.string().min(1), meaningVi: z.string().min(1), category: z.enum(["recommended", "optional", "skip"]), reason: z.string().min(1).max(200) })).max(30),
  sentences: z.array(z.object({ sentence: z.string().min(1), category: z.enum(["recommended", "optional", "skip"]), reason: z.string().min(1).max(200) })).max(20),
});

export class AgentToolService {
  constructor(
    private readonly db: AppDatabase,
    private readonly content: ContentRepository,
    private readonly learning: LearningRepository,
    private readonly client: NineRouterClient,
  ) {}

  getLearningProfile() { return this.learning.getProgress(); }

  async generateMindmapDraft(input: MindmapDraftInput) {
    const parsed = MindmapDraftInputSchema.parse(input);
    const jobId = Number(this.db.prepare("INSERT INTO generation_jobs(job_type,status,request_json) VALUES ('mindmap','running',?)").run(JSON.stringify(parsed)).lastInsertRowid);
    try {
      const generated = await this.client.chatJson(GeneratedMindmapSchema, [
        {
          role: "system",
          content: "Create practical B1-B2 English vocabulary mindmaps for Vietnamese learners. Return JSON only, without Markdown. Use exactly 3 branches and exactly 3 words per branch. Avoid rare vocabulary. Every word needs IPA, Vietnamese meaning, CEFR level, one short daily-life English example, and its Vietnamese translation.",
        },
        {
          role: "user",
          content: `Topic: ${parsed.topic}. Situation: ${parsed.situation || "daily life"}. Level: ${parsed.cefr}. Return this exact shape: {"title":"...","description":"...","branches":[{"label":"...","meaningVi":"...","color":"coral|amber|leaf|sky|violet","words":[{"term":"...","meaningVi":"...","ipa":"/.../","cefr":"A1|A2|B1|B2","example":"...","exampleVi":"..."}]}]}`,
        },
      ]);
      this.db.prepare("UPDATE generation_jobs SET status='completed',result_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(JSON.stringify(generated), jobId);
      return { jobId, draft: generated, duplicates: this.findDuplicates(generated) };
    } catch (error) {
      this.db.prepare("UPDATE generation_jobs SET status='failed',error=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(error instanceof Error ? error.message : "Unknown error", jobId);
      throw error;
    }
  }

  saveGeneratedDraft(topicId: number, generated: GeneratedMindmap) {
    const rootX = 0; const rootY = 0;
    const nodes: SaveDraftInput["nodes"] = [{ parentIndex: null, nodeType: "root", label: generated.title, meaningVi: generated.description, ipa: "", color: "amber", x: rootX, y: rootY, cefr: "B1" }];
    generated.branches.forEach((branch, branchIndex) => {
      const angle = (Math.PI * 2 * branchIndex) / generated.branches.length;
      const branchNodeIndex = nodes.length;
      const branchX = Math.cos(angle) * 320; const branchY = Math.sin(angle) * 240;
      nodes.push({ parentIndex: 0, nodeType: "branch", label: branch.label, meaningVi: branch.meaningVi, ipa: "", color: branch.color, x: branchX, y: branchY, cefr: "B1" });
      branch.words.forEach((word, wordIndex) => {
        nodes.push({ parentIndex: branchNodeIndex, nodeType: "vocabulary", label: word.term, term: word.term, meaningVi: word.meaningVi, ipa: word.ipa, cefr: word.cefr, color: branch.color, x: branchX + Math.cos(angle + (wordIndex - 1) * 0.32) * 190, y: branchY + Math.sin(angle + (wordIndex - 1) * 0.32) * 150 });
      });
    });
    return this.content.saveMindmapDraft({ topicId, title: generated.title, description: generated.description, source: "ai", nodes });
  }

  async tutor(message: string) {
    const profile = this.getLearningProfile();
    const reply = await this.client.chatText([
      { role: "system", content: `You are a concise, practical English tutor for a Vietnamese learner progressing from beginner to B1-B2. Adapt examples to this local learning profile: ${JSON.stringify(profile)}` },
      { role: "user", content: message },
    ]);
    return { reply, suggestions: [] };
  }

  async generateDocumentExtractionDraft(documentId: number, sectionIds: number[], text: string) {
    const request = { documentId, sectionIds };
    const jobId = Number(this.db.prepare("INSERT INTO generation_jobs(job_type,status,request_json) VALUES ('document-extraction','running',?)").run(JSON.stringify(request)).lastInsertRowid);
    try {
      const draft = await this.client.chatJson(DocumentExtractionSchema, [
        { role: "system", content: "Extract practical English learning candidates for a Vietnamese learner. Return JSON only. Do not invent quotations. Categorize each item as recommended, optional, or skip and provide one short reason." },
        { role: "user", content: `Source text:\n${text.slice(0, 30000)}\n\nReturn: {"vocabulary":[{"term":"...","meaningVi":"...","category":"recommended|optional|skip","reason":"..."}],"sentences":[{"sentence":"...","category":"recommended|optional|skip","reason":"..."}]}` },
      ]);
      this.db.prepare("UPDATE generation_jobs SET status='completed',result_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(JSON.stringify(draft), jobId);
      return { jobId, draft };
    } catch (error) {
      this.db.prepare("UPDATE generation_jobs SET status='failed',error=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(error instanceof Error ? error.message : "Unknown error", jobId);
      throw error;
    }
  }

  private findDuplicates(generated: GeneratedMindmap) {
    const terms = generated.branches.flatMap((branch) => branch.words.map((word) => word.term.toLowerCase()));
    if (!terms.length) return [];
    const placeholders = terms.map(() => "?").join(",");
    return (this.db.prepare(`SELECT term,meaning_vi meaningVi FROM vocabulary WHERE normalized_term IN (${placeholders})`).all(...terms) as Array<{ term: string; meaningVi: string }>);
  }
}


