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
  image_url: string | null;
}

export class ContentRepository {
  constructor(private readonly db: AppDatabase) {}

  createPersonalCopy(mapId: number, userId: number): Mindmap | null {
    const existing=this.db.prepare("SELECT id FROM mindmaps WHERE user_id=? AND copied_from_mindmap_id=? AND status!='trashed'").get(userId,mapId) as {id:number}|undefined;
    if(existing)return this.getMindmap(existing.id,userId);
    const source=this.db.prepare("SELECT id,topic_id,title,description FROM mindmaps WHERE id=? AND source='seed' AND status='approved'").get(mapId) as {id:number;topic_id:number;title:string;description:string}|undefined;
    if(!source)return null;
    return withTransaction(this.db,()=>{
      const duplicate=this.db.prepare("SELECT id FROM mindmaps WHERE user_id=? AND copied_from_mindmap_id=? AND status!='trashed'").get(userId,mapId) as {id:number}|undefined;
      if(duplicate)return this.getMindmap(duplicate.id,userId);
      const result=this.db.prepare("INSERT INTO mindmaps(topic_id,title,description,status,source,user_id,copied_from_mindmap_id) VALUES (?,?,?,'approved','user',?,?)").run(source.topic_id,source.title,source.description,userId,mapId);
      const copyId=Number(result.lastInsertRowid);
      const rows=this.db.prepare("SELECT * FROM mindmap_nodes WHERE mindmap_id=? ORDER BY sort_order,id").all(mapId) as Array<Record<string,unknown>>;
      const ids=new Map<number,number>();
      const insert=this.db.prepare("INSERT INTO mindmap_nodes(mindmap_id,parent_id,vocabulary_id,node_type,label,meaning_vi,ipa,color,position_x,position_y,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?)");
      for(const row of rows){
        const oldId=Number(row.id);
        const nodeId=Number(insert.run(copyId,null,row.vocabulary_id,row.node_type,row.label,row.meaning_vi,row.ipa,row.color,row.position_x,row.position_y,row.sort_order).lastInsertRowid);
        ids.set(oldId,nodeId);
      }
      const updateParent=this.db.prepare("UPDATE mindmap_nodes SET parent_id=? WHERE id=? AND mindmap_id=?");
      for(const row of rows){
        if(row.parent_id===null)continue;
        const nodeId=ids.get(Number(row.id));const parentId=ids.get(Number(row.parent_id));
        if(!nodeId||!parentId)throw new Error("Mindmap copy hierarchy is incomplete");
        updateParent.run(parentId,nodeId,copyId);
      }
      return this.getMindmap(copyId,userId);
    });
  }

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
      SELECT n.*, v.status vocabulary_status, v.image_url FROM mindmap_nodes n
      LEFT JOIN vocabulary v ON v.id=n.vocabulary_id
      WHERE n.mindmap_id=? ORDER BY n.sort_order, n.id
    `).all(id) as NodeRow[];
    const nodes: MindmapNode[] = rows.map((row) => ({
      id: row.id, parentId: row.parent_id, vocabularyId: row.vocabulary_id,
      nodeType: row.node_type, label: row.label, meaningVi: row.meaning_vi,
      ipa: row.ipa, color: row.color, x: row.position_x, y: row.position_y,
      status: row.vocabulary_status ?? "new",
      imageUrl: row.image_url ?? null,
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

  appendMindmapExtension(mapId:number,draft:{branches:Array<{parentLabel:string;meaningVi:string;color:"coral"|"amber"|"leaf"|"sky"|"violet";words:Array<{term:string;meaningVi:string;ipa:string;cefr:"A1"|"A2"|"B1"|"B2";example:string;exampleVi:string}>}>},userId?:number):Mindmap{
    return withTransaction(this.db,()=>{
      if(userId!==undefined&&!this.db.prepare("SELECT 1 FROM mindmaps WHERE id=? AND (source='seed' OR user_id=?) AND status!='trashed'").get(mapId,userId))throw new Error("Mindmap not found");
      const existingNodes=this.db.prepare("SELECT id,label,color,position_x x,position_y y FROM mindmap_nodes WHERE mindmap_id=?").all(mapId) as Array<{id:number;label:string;color:"coral"|"amber"|"leaf"|"sky"|"violet";x:number;y:number}>;
      const insertVocabulary=this.db.prepare("INSERT OR IGNORE INTO vocabulary(term,normalized_term,meaning_vi,ipa,part_of_speech,cefr) VALUES (?,?,?,?,?,?)");
      const getVocabulary=this.db.prepare("SELECT id FROM vocabulary WHERE normalized_term=?");
      const insertExample=this.db.prepare("INSERT INTO examples(vocabulary_id,sentence,translation_vi,situation) SELECT ?,?,?,'ai extension' WHERE NOT EXISTS (SELECT 1 FROM examples WHERE vocabulary_id=? AND sentence=?)");
      const insertReview=this.db.prepare("INSERT OR IGNORE INTO review_cards(vocabulary_id) VALUES (?)");
      const insertUserState=this.db.prepare("INSERT OR IGNORE INTO user_vocabulary_state(user_id,vocabulary_id,status) VALUES (?,?,'new')");
      const insertNode=this.db.prepare("INSERT INTO mindmap_nodes(mindmap_id,parent_id,vocabulary_id,node_type,label,meaning_vi,ipa,color,position_x,position_y,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?)");
      let sortOrder=Number(this.db.prepare("SELECT COALESCE(MAX(sort_order),0) value FROM mindmap_nodes WHERE mindmap_id=?").pluck().get(mapId));
      for(const [branchIndex,branch] of draft.branches.entries()){
        let parent=existingNodes.find(node=>node.label.toLowerCase()===branch.parentLabel.toLowerCase());
        if(!parent){const root=existingNodes.find(node=>!node.label.includes(" "))??existingNodes[0];const x=(root?.x??0)+260+branchIndex*60;const y=(root?.y??0)+120+branchIndex*90;const id=Number(insertNode.run(mapId,root?.id??null,null,"branch",branch.parentLabel,branch.meaningVi,"",branch.color,x,y,++sortOrder).lastInsertRowid);parent={id,label:branch.parentLabel,color:branch.color,x,y};existingNodes.push(parent)}
        for(const [wordIndex,word] of branch.words.entries()){
          const normalized=word.term.trim().toLowerCase();insertVocabulary.run(word.term,normalized,word.meaningVi,word.ipa,word.term.includes(" ")?"phrase":"word",word.cefr);const vocabularyId=(getVocabulary.get(normalized) as {id:number}).id;insertExample.run(vocabularyId,word.example,word.exampleVi,vocabularyId,word.example);insertReview.run(vocabularyId);if(userId!==undefined)insertUserState.run(userId,vocabularyId);const exists=this.db.prepare("SELECT id FROM mindmap_nodes WHERE mindmap_id=? AND vocabulary_id=?").get(mapId,vocabularyId);if(!exists)insertNode.run(mapId,parent.id,vocabularyId,"vocabulary",word.term,word.meaningVi,word.ipa,parent.color,parent.x+150+(wordIndex%3)*55,parent.y+80+Math.floor(wordIndex/3)*70,++sortOrder);
        }
      }
      this.db.prepare("UPDATE mindmaps SET updated_at=CURRENT_TIMESTAMP WHERE id=?").run(mapId);
      return this.getMindmap(mapId,userId)!;
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
