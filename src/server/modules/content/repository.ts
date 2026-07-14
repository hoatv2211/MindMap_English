import { z } from "zod";
import type { AppDatabase } from "../../db/database";
import { withTransaction } from "../../db/database";
import type { Mindmap, MindmapNode } from "../../../shared/contracts";

const DraftNodeSchema = z.object({
  parentIndex: z.number().int().nullable(),
  nodeType: z.enum(["root", "branch", "vocabulary"]),
  label: z.string().min(1),
  meaningVi: z.string().default(""),
  ipa: z.string().default(""),
  color: z.enum(["coral", "amber", "leaf", "sky", "violet"]),
  x: z.number(),
  y: z.number(),
  term: z.string().optional(),
  cefr: z.enum(["A1", "A2", "B1", "B2"]).default("B1"),
});

export const SaveDraftSchema = z.object({
  topicId: z.number().int().positive(),
  title: z.string().min(2).max(120),
  description: z.string().max(500).default(""),
  source: z.enum(["ai", "user"]).default("user"),
  nodes: z.array(DraftNodeSchema).min(1),
});

export const UpdateNodeSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  meaningVi: z.string().max(200).optional(),
  ipa: z.string().max(100).optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  color: z.enum(["coral", "amber", "leaf", "sky", "violet"]).optional(),
});

export type SaveDraftInput = z.infer<typeof SaveDraftSchema>;
export type UpdateNodeInput = z.infer<typeof UpdateNodeSchema>;

interface TopicRow {
  id: number; slug: string; title: string; title_vi: string; description: string;
  icon: string; color: string; sort_order: number;
}

interface MindmapRow {
  id: number; topic_id: number; title: string; description: string;
  status: "draft" | "approved" | "trashed"; source: "seed" | "ai" | "user";
}

interface NodeRow {
  id: number; parent_id: number | null; vocabulary_id: number | null;
  node_type: "root" | "branch" | "vocabulary"; label: string; meaning_vi: string;
  ipa: string; color: "coral" | "amber" | "leaf" | "sky" | "violet";
  position_x: number; position_y: number; vocabulary_status: "new" | "learning" | "weak" | "stable" | null;
}

export class ContentRepository {
  constructor(private readonly db: AppDatabase) {}

  listTopics(userId?: number) {
    const ownerCount=userId===undefined?"1=1":"(m.source='seed' OR m.user_id=?)";
    return (this.db.prepare(`
      SELECT t.*, COUNT(CASE WHEN m.status='approved' AND ${ownerCount} THEN 1 END) mindmap_count
      FROM topics t LEFT JOIN mindmaps m ON m.topic_id=t.id
      GROUP BY t.id ORDER BY t.sort_order, t.id
    `).all(...(userId===undefined?[]:[userId])) as Array<TopicRow & { mindmap_count: number }>).map((row) => ({
      id: row.id, slug: row.slug, title: row.title, titleVi: row.title_vi,
      description: row.description, icon: row.icon, color: row.color,
      mindmapCount: row.mindmap_count,
    }));
  }

  listMindmaps(status: "approved" | "draft" | "all" = "approved", userId?: number) {
    const statusWhere = status === "all" ? "m.status != 'trashed'" : "m.status = ?";
    const ownerWhere = userId === undefined ? "1=1" : "(m.source='seed' OR m.user_id=?)";
    const where = `${statusWhere} AND ${ownerWhere}`;
    const statement = this.db.prepare(`
      SELECT m.*, t.title_vi topic_title_vi, COUNT(n.id) node_count
      FROM mindmaps m JOIN topics t ON t.id=m.topic_id
      LEFT JOIN mindmap_nodes n ON n.mindmap_id=m.id
      WHERE ${where} GROUP BY m.id ORDER BY m.updated_at DESC, m.id DESC
    `);
    const args: unknown[] = [];
    if (status !== "all") args.push(status);
    if (userId !== undefined) args.push(userId);
    const rows = statement.all(...args);
    return (rows as Array<MindmapRow & { topic_title_vi: string; node_count: number }>).map((row) => ({
      id: row.id, topicId: row.topic_id, title: row.title, description: row.description,
      status: row.status, source: row.source, topicTitleVi: row.topic_title_vi, nodeCount: row.node_count,
    }));
  }

  getMindmap(id: number, userId?: number): Mindmap | null {
    const map = this.db.prepare(`SELECT * FROM mindmaps WHERE id=? AND status!='trashed' ${userId === undefined ? "" : "AND (source='seed' OR user_id=?)"}`).get(...(userId === undefined ? [id] : [id, userId])) as MindmapRow | undefined;
    if (!map) return null;
    const rows = this.db.prepare(`
      SELECT n.*, v.status vocabulary_status FROM mindmap_nodes n
      LEFT JOIN vocabulary v ON v.id=n.vocabulary_id
      WHERE n.mindmap_id=? ORDER BY n.sort_order, n.id
    `).all(id) as NodeRow[];
    const nodes: MindmapNode[] = rows.map((row) => ({
      id: row.id, parentId: row.parent_id, vocabularyId: row.vocabulary_id,
      nodeType: row.node_type, label: row.label, meaningVi: row.meaning_vi,
      ipa: row.ipa, color: row.color, x: row.position_x, y: row.position_y,
      status: row.vocabulary_status ?? "new",
    }));
    return { id: map.id, topicId: map.topic_id, title: map.title, description: map.description, status: map.status, source: map.source, nodes };
  }

  saveMindmapDraft(input: SaveDraftInput, userId?: number): Mindmap {
    const parsed = SaveDraftSchema.parse(input);
    return withTransaction(this.db, () => {
      const result = this.db.prepare(`INSERT INTO mindmaps(topic_id,title,description,status,source,user_id) VALUES (?,?,?,?,?,?)`)
        .run(parsed.topicId, parsed.title, parsed.description, "draft", parsed.source, userId ?? null);
      const mapId = Number(result.lastInsertRowid);
      const nodeIds: number[] = [];
      const insertVocabulary = this.db.prepare(`INSERT OR IGNORE INTO vocabulary(term,normalized_term,meaning_vi,ipa,part_of_speech,cefr) VALUES (?,?,?,?,?,?)`);
      const getVocabulary = this.db.prepare("SELECT id FROM vocabulary WHERE normalized_term=?");
      const insertReview = this.db.prepare("INSERT OR IGNORE INTO review_cards(vocabulary_id) VALUES (?)");
      const insertNode = this.db.prepare(`INSERT INTO mindmap_nodes(mindmap_id,parent_id,vocabulary_id,node_type,label,meaning_vi,ipa,color,position_x,position_y,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
      parsed.nodes.forEach((node, index) => {
        let vocabularyId: number | null = null;
        if (node.nodeType === "vocabulary") {
          const term = node.term ?? node.label;
          const normalized = term.trim().toLowerCase();
          insertVocabulary.run(term, normalized, node.meaningVi, node.ipa, term.includes(" ") ? "phrase" : "word", node.cefr);
          vocabularyId = (getVocabulary.get(normalized) as { id: number }).id;
          insertReview.run(vocabularyId);
          if (userId !== undefined) this.db.prepare("INSERT OR IGNORE INTO user_vocabulary_state(user_id,vocabulary_id,status) VALUES (?,?,'new')").run(userId,vocabularyId);
        }
        const parentId = node.parentIndex === null ? null : nodeIds[node.parentIndex] ?? null;
        const nodeId = Number(insertNode.run(mapId, parentId, vocabularyId, node.nodeType, node.label, node.meaningVi, node.ipa, node.color, node.x, node.y, index).lastInsertRowid);
        nodeIds.push(nodeId);
      });
      this.db.prepare("INSERT INTO draft_revisions(mindmap_id,revision,content_json) VALUES (?,?,?)").run(mapId, 1, JSON.stringify(parsed));
      return this.getMindmap(mapId, userId)!;
    });
  }

  updateMindmapNode(mapId: number, nodeId: number, input: UpdateNodeInput, userId?: number): MindmapNode | null {
    const parsed = UpdateNodeSchema.parse(input);
    if (userId === undefined ? !this.getMindmap(mapId) : !this.db.prepare("SELECT 1 FROM mindmaps WHERE id=? AND user_id=? AND status!='trashed'").get(mapId,userId)) return null;
    const existing = this.db.prepare("SELECT * FROM mindmap_nodes WHERE id=? AND mindmap_id=?").get(nodeId, mapId) as Record<string, unknown> | undefined;
    if (!existing) return null;
    const fields: string[] = [];
    const values: unknown[] = [];
    const mapping: Record<keyof UpdateNodeInput, string> = { label: "label", meaningVi: "meaning_vi", ipa: "ipa", x: "position_x", y: "position_y", color: "color" };
    for (const [key, column] of Object.entries(mapping) as Array<[keyof UpdateNodeInput, string]>) {
      const value = parsed[key];
      if (value !== undefined) { fields.push(`${column}=?`); values.push(value); }
    }
    if (fields.length) {
      values.push(nodeId, mapId);
      this.db.prepare(`UPDATE mindmap_nodes SET ${fields.join(",")}, updated_at=CURRENT_TIMESTAMP WHERE id=? AND mindmap_id=?`).run(...values);
      if (parsed.label || parsed.meaningVi || parsed.ipa) {
        const row = this.db.prepare("SELECT vocabulary_id FROM mindmap_nodes WHERE id=?").get(nodeId) as { vocabulary_id: number | null };
        if (row.vocabulary_id) {
          this.db.prepare(`UPDATE vocabulary SET term=COALESCE(?,term), normalized_term=COALESCE(?,normalized_term), meaning_vi=COALESCE(?,meaning_vi), ipa=COALESCE(?,ipa), updated_at=CURRENT_TIMESTAMP WHERE id=?`)
            .run(parsed.label ?? null, parsed.label?.trim().toLowerCase() ?? null, parsed.meaningVi ?? null, parsed.ipa ?? null, row.vocabulary_id);
        }
      }
    }
    return this.getMindmap(mapId, userId)?.nodes.find((node) => node.id === nodeId) ?? null;
  }

  approveMindmapDraft(id: number, userId?: number): Mindmap | null {
    const result = this.db.prepare(`UPDATE mindmaps SET status='approved', updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='draft' ${userId === undefined ? "" : "AND user_id=?"}`).run(...(userId === undefined ? [id] : [id, userId]));
    if (!result.changes) return null;
    this.db.prepare("UPDATE draft_revisions SET approved_at=CURRENT_TIMESTAMP WHERE mindmap_id=? AND approved_at IS NULL").run(id);
    return this.getMindmap(id, userId);
  }
}
