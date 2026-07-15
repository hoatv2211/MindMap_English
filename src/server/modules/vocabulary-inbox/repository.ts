import { createHash } from "node:crypto";
import type { AppDatabase } from "../../db/database";
import { withTransaction } from "../../db/database";
import { VocabularyCaptureInputSchema, VocabularyEnrichmentDraftSchema, type VocabularyCaptureInput, type VocabularyEnrichmentDraft, type VocabularyInboxStatus } from "../../../shared/contracts";

interface DraftMeta { model:string;promptVersion:string;skillVersion:string }
interface ApprovalInput { mindmapId?:number|null;parentNodeId?:number|null }
interface InboxRow {id:number;user_id:number;raw_text:string;normalized_text:string;context_text:string;source_type:string;source_reference:string;hint_mindmap_id:number|null;hint_parent_node_id:number|null;status:VocabularyInboxStatus;error_message:string|null;approved_vocabulary_id:number|null;approved_mindmap_id:number|null;created_at:string;updated_at:string;approved_at:string|null}
interface DraftRow {normalized_term:string;display_term:string;meaning_vi:string;ipa:string;part_of_speech:string;cefr:"A1"|"A2"|"B1"|"B2";item_type:"word"|"phrase"|"sentence";examples_json:string;placement_json:string;model:string;prompt_version:string;skill_version:string;user_edited:number}

function normalized(value:string){return value.trim().normalize("NFKC").toLowerCase().replace(/\s+/g," ")}
function fingerprint(userId:number,sentence:string){return createHash("sha256").update(`${userId}:${normalized(sentence)}`).digest("hex")}

export class VocabularyInboxRepository{
  constructor(private readonly db:AppDatabase){}

  capture(userId:number,input:VocabularyCaptureInput){
    const parsed=VocabularyCaptureInputSchema.parse(input);const normalizedText=normalized(parsed.rawText);
    this.verifyHints(userId,parsed.hintMindmapId??null,parsed.hintParentNodeId??null);
    const existing=this.db.prepare("SELECT id FROM vocabulary_inbox_items WHERE user_id=? AND normalized_text=? AND status IN ('queued','processing','ready','failed') ORDER BY id DESC LIMIT 1").get(userId,normalizedText) as {id:number}|undefined;
    if(existing)return this.get(userId,existing.id)!;
    const vocabulary=this.db.prepare("SELECT id FROM vocabulary WHERE normalized_term=?").get(normalizedText) as {id:number}|undefined;
    const id=Number(this.db.prepare(`INSERT INTO vocabulary_inbox_items(user_id,raw_text,normalized_text,context_text,source_type,source_reference,hint_mindmap_id,hint_parent_node_id,approved_vocabulary_id) VALUES (?,?,?,?,?,?,?,?,?)`).run(userId,parsed.rawText.trim(),normalizedText,parsed.contextText,parsed.sourceType,parsed.sourceReference,parsed.hintMindmapId??null,parsed.hintParentNodeId??null,vocabulary?.id??null).lastInsertRowid);
    return this.get(userId,id)!;
  }

  list(userId:number,status?:VocabularyInboxStatus){
    const rows=(status?this.db.prepare("SELECT * FROM vocabulary_inbox_items WHERE user_id=? AND status=? ORDER BY updated_at DESC,id DESC").all(userId,status):this.db.prepare("SELECT * FROM vocabulary_inbox_items WHERE user_id=? ORDER BY updated_at DESC,id DESC").all(userId)) as InboxRow[];
    return rows.map(row=>this.map(row));
  }

  get(userId:number,id:number){const row=this.db.prepare("SELECT * FROM vocabulary_inbox_items WHERE id=? AND user_id=?").get(id,userId) as InboxRow|undefined;return row?this.map(row):null}
  markProcessing(userId:number,id:number){return this.updateStatus(userId,id,"processing",null)}
  markFailed(userId:number,id:number,message:string){return this.updateStatus(userId,id,"failed",message.slice(0,300))}
  dismiss(userId:number,id:number){return this.updateStatus(userId,id,"dismissed",null)}

  saveDraft(userId:number,id:number,input:VocabularyEnrichmentDraft,meta:DraftMeta,userEdited=false){
    const draft=VocabularyEnrichmentDraftSchema.parse(input);if(!this.get(userId,id))throw new Error("Vocabulary inbox item not found");
    this.db.prepare(`INSERT INTO vocabulary_inbox_drafts(inbox_item_id,normalized_term,display_term,meaning_vi,ipa,part_of_speech,cefr,item_type,examples_json,placement_json,model,prompt_version,skill_version,user_edited) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(inbox_item_id) DO UPDATE SET normalized_term=excluded.normalized_term,display_term=excluded.display_term,meaning_vi=excluded.meaning_vi,ipa=excluded.ipa,part_of_speech=excluded.part_of_speech,cefr=excluded.cefr,item_type=excluded.item_type,examples_json=excluded.examples_json,placement_json=excluded.placement_json,model=excluded.model,prompt_version=excluded.prompt_version,skill_version=excluded.skill_version,user_edited=excluded.user_edited,updated_at=CURRENT_TIMESTAMP`).run(id,draft.normalizedTerm,draft.displayTerm,draft.meaningVi,draft.ipa,draft.partOfSpeech,draft.cefr,draft.itemType,JSON.stringify(draft.examples),JSON.stringify(draft.placement),meta.model,meta.promptVersion,meta.skillVersion,userEdited?1:0);
    this.updateStatus(userId,id,"ready",null);return this.get(userId,id)!;
  }

  approve(userId:number,id:number,input:ApprovalInput){
    return withTransaction(this.db,()=>{
      const item=this.get(userId,id);if(!item)throw new Error("Vocabulary inbox item not found");
      if(item.status==="approved"&&item.approvedVocabularyId)return{vocabularyId:item.approvedVocabularyId,mindmapId:item.approvedMindmapId};
      if(item.status!=="ready"||!item.draft)throw new Error("Vocabulary inbox item is not ready");
      const draft=item.draft;
      let vocabulary=this.db.prepare("SELECT id FROM vocabulary WHERE normalized_term=?").get(draft.normalizedTerm) as {id:number}|undefined;
      if(!vocabulary){const result=this.db.prepare("INSERT INTO vocabulary(term,normalized_term,ipa,part_of_speech,meaning_vi,cefr) VALUES (?,?,?,?,?,?)").run(draft.displayTerm,draft.normalizedTerm,draft.ipa,draft.partOfSpeech,draft.meaningVi,draft.cefr);vocabulary={id:Number(result.lastInsertRowid)}}
      this.db.prepare("INSERT OR IGNORE INTO review_cards(vocabulary_id) VALUES (?)").run(vocabulary.id);
      this.db.prepare("INSERT OR IGNORE INTO user_vocabulary_state(user_id,vocabulary_id,status) VALUES (?,?,'new')").run(userId,vocabulary.id);
      const insertExample=this.db.prepare("INSERT OR IGNORE INTO user_vocabulary_examples(user_id,vocabulary_id,sentence,translation_vi,example_role,usage_note,fingerprint,source_inbox_item_id) VALUES (?,?,?,?,?,?,?,?)");
      for(const example of draft.examples)insertExample.run(userId,vocabulary.id,example.sentence,example.translationVi,example.role,example.usageNote,fingerprint(userId,example.sentence),id);
      const destination=this.resolveDestination(userId,item,input,draft);
      if(destination.mindmapId&&destination.parentNodeId){const parent=this.db.prepare("SELECT color,position_x x,position_y y FROM mindmap_nodes WHERE id=? AND mindmap_id=?").get(destination.parentNodeId,destination.mindmapId) as {color:string;x:number;y:number}|undefined;if(!parent)throw new Error("Mindmap branch not found");const exists=this.db.prepare("SELECT id FROM mindmap_nodes WHERE mindmap_id=? AND vocabulary_id=?").get(destination.mindmapId,vocabulary.id);if(!exists)this.db.prepare("INSERT INTO mindmap_nodes(mindmap_id,parent_id,vocabulary_id,node_type,label,meaning_vi,ipa,color,position_x,position_y,sort_order) VALUES (?,?,?,'vocabulary',?,?,?,?,?,?,?)").run(destination.mindmapId,destination.parentNodeId,vocabulary.id,draft.displayTerm,draft.meaningVi,draft.ipa,parent.color,parent.x+180,parent.y,999)}
      this.db.prepare("UPDATE vocabulary_inbox_items SET status='approved',approved_vocabulary_id=?,approved_mindmap_id=?,approved_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP,error_message=NULL WHERE id=? AND user_id=?").run(vocabulary.id,destination.mindmapId,id,userId);
      return{vocabularyId:vocabulary.id,mindmapId:destination.mindmapId};
    });
  }

  private resolveDestination(userId:number,item:ReturnType<VocabularyInboxRepository["map"]>,input:ApprovalInput,draft:VocabularyEnrichmentDraft){
    let mindmapId=input.mindmapId??draft.placement.mindmapId??item.hintMindmapId;let parentNodeId=input.parentNodeId??draft.placement.parentNodeId??item.hintParentNodeId;
    if(mindmapId){const map=this.db.prepare("SELECT id FROM mindmaps WHERE id=? AND user_id=? AND status!='trashed'").get(mindmapId,userId);if(!map)throw new Error("Mindmap not found")}
    if(!mindmapId&&draft.placement.newMindmap){const topicId=Number(this.db.prepare("SELECT id FROM topics ORDER BY sort_order,id LIMIT 1").pluck().get());mindmapId=Number(this.db.prepare("INSERT INTO mindmaps(topic_id,title,description,status,source,user_id) VALUES (?,?,?,'draft','ai',?)").run(topicId,draft.placement.newMindmap.title,draft.placement.newMindmap.description,userId).lastInsertRowid);const rootId=Number(this.db.prepare("INSERT INTO mindmap_nodes(mindmap_id,node_type,label,color,sort_order) VALUES (?,'root',?,'amber',0)").run(mindmapId,draft.placement.newMindmap.title).lastInsertRowid);parentNodeId=Number(this.db.prepare("INSERT INTO mindmap_nodes(mindmap_id,parent_id,node_type,label,color,sort_order,position_x) VALUES (?,?,'branch',?,'sky',1,280)").run(mindmapId,rootId,draft.placement.newMindmap.branchLabel).lastInsertRowid)}
    return{mindmapId:mindmapId??null,parentNodeId:parentNodeId??null};
  }

  private verifyHints(userId:number,mindmapId:number|null,parentNodeId:number|null){if(mindmapId&&!this.db.prepare("SELECT 1 FROM mindmaps WHERE id=? AND user_id=? AND status!='trashed'").get(mindmapId,userId))throw new Error("Mindmap not found");if(parentNodeId&&!this.db.prepare("SELECT 1 FROM mindmap_nodes n JOIN mindmaps m ON m.id=n.mindmap_id WHERE n.id=? AND m.user_id=?").get(parentNodeId,userId))throw new Error("Mindmap branch not found")}
  private updateStatus(userId:number,id:number,status:VocabularyInboxStatus,error:string|null){const result=this.db.prepare("UPDATE vocabulary_inbox_items SET status=?,error_message=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?").run(status,error,id,userId);if(!result.changes)throw new Error("Vocabulary inbox item not found");return this.get(userId,id)!}
  private map(row:InboxRow){const draftRow=this.db.prepare("SELECT * FROM vocabulary_inbox_drafts WHERE inbox_item_id=?").get(row.id) as DraftRow|undefined;const draft=draftRow?VocabularyEnrichmentDraftSchema.parse({normalizedTerm:draftRow.normalized_term,displayTerm:draftRow.display_term,meaningVi:draftRow.meaning_vi,ipa:draftRow.ipa,partOfSpeech:draftRow.part_of_speech,cefr:draftRow.cefr,itemType:draftRow.item_type,examples:JSON.parse(draftRow.examples_json),placement:JSON.parse(draftRow.placement_json)}):null;return{id:row.id,userId:row.user_id,rawText:row.raw_text,normalizedText:row.normalized_text,contextText:row.context_text,sourceType:row.source_type,sourceReference:row.source_reference,hintMindmapId:row.hint_mindmap_id,hintParentNodeId:row.hint_parent_node_id,status:row.status,errorMessage:row.error_message,approvedVocabularyId:row.approved_vocabulary_id,approvedMindmapId:row.approved_mindmap_id,createdAt:row.created_at,updatedAt:row.updated_at,approvedAt:row.approved_at,draft}}
}
