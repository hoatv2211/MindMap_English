import { z } from "zod";
import type { AppDatabase } from "../../db/database";
import { VocabularyEnrichmentDraftSchema } from "../../../shared/contracts";
import { LearnerContextService } from "../agent/learner-context";
import { loadTutorSkill } from "../agent/skill-loader";
import type { NineRouterClient } from "../agent/ninerouter-client";
import type { VocabularyInboxRepository } from "./repository";

const EnrichmentSchema=VocabularyEnrichmentDraftSchema.superRefine((value,context)=>{
  const roles=value.examples.map(example=>example.role);
  for(const role of ["basic","daily_life","personalized"] as const)if(!roles.includes(role))context.addIssue({code:"custom",message:`Missing ${role} example`,path:["examples"]});
  if(new Set(value.examples.map(example=>example.sentence.trim().toLowerCase())).size!==3)context.addIssue({code:"custom",message:"Examples must be distinct",path:["examples"]});
});

export class VocabularyEnrichmentService{
  private readonly context: LearnerContextService;
  constructor(private readonly db:AppDatabase,private readonly repository:VocabularyInboxRepository,private readonly client:NineRouterClient,private readonly projectRoot:string=process.cwd()){this.context=new LearnerContextService(db)}

  async enrich(userId:number,itemId:number){
    const item=this.repository.get(userId,itemId);if(!item)throw new Error("Vocabulary inbox item not found");
    this.repository.markProcessing(userId,itemId);
    const skill=loadTutorSkill(this.projectRoot);
    const snapshot=this.context.get(userId,skill.version).snapshot;
    const maps=this.db.prepare(`SELECT m.id,m.title,n.id nodeId,n.label FROM mindmaps m LEFT JOIN mindmap_nodes n ON n.mindmap_id=m.id AND n.node_type='branch' WHERE m.status!='trashed' AND (m.source='seed' OR m.user_id=?) ORDER BY m.updated_at DESC,m.id,n.sort_order LIMIT 40`).all(userId) as Array<{id:number;title:string;nodeId:number|null;label:string|null}>;
    const candidates=maps.map(row=>({mindmapId:row.id,title:row.title,parentNodeId:row.nodeId,branch:row.label}));
    try{
      const draft=await this.client.chatJson(EnrichmentSchema,[
        {role:"system",content:`${skill.content}\n\nReturn JSON only. Create exactly three distinct examples with roles basic, daily_life, personalized. Do not save or mutate data.`},
        {role:"user",content:JSON.stringify({note:{rawText:item.rawText,contextText:item.contextText},learner:{progress:snapshot.progress,vocabulary:snapshot.vocabulary,recentSentences:snapshot.recentSentences.slice(0,3)},mindmapCandidates:candidates,shape:{normalizedTerm:"",displayTerm:"",meaningVi:"",ipa:"",partOfSpeech:"",cefr:"A1|A2|B1|B2",itemType:"word|phrase|sentence",examples:[{role:"basic|daily_life|personalized",sentence:"",translationVi:"",usageNote:""}],placement:{mindmapId:null,parentNodeId:null,reason:"",newMindmap:null}}})},
      ]);
      return this.repository.saveDraft(userId,itemId,draft,{model:this.client.getChatModel(),promptVersion:"vocabulary-inbox-v1",skillVersion:skill.version});
    }catch(error){this.repository.markFailed(userId,itemId,"AI enrichment unavailable");throw error}
  }
}
