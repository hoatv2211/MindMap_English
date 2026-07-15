import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AppDatabase } from "../../src/server/db/database";
import { createDatabase } from "../../src/server/db/database";
import { migrate } from "../../src/server/db/migrate";
import { VocabularyInboxRepository } from "../../src/server/modules/vocabulary-inbox/repository";
import { VocabularyEnrichmentService } from "../../src/server/modules/vocabulary-inbox/enrichment-service";
import { LearningRepository } from "../../src/server/modules/learning/repository";
import type { VocabularyEnrichmentDraft } from "../../src/shared/contracts";

let db:AppDatabase;
let repository:VocabularyInboxRepository;
let branchId:number;

const draft:VocabularyEnrichmentDraft={
  normalizedTerm:"negotiate",displayTerm:"negotiate",meaningVi:"dam phan",ipa:"/n??????ie?t/",partOfSpeech:"verb",cefr:"B1",itemType:"word",
  examples:[
    {role:"basic",sentence:"We need to negotiate.",translationVi:"Chung ta can dam phan.",usageNote:""},
    {role:"daily_life",sentence:"Can we negotiate the price?",translationVi:"Chung ta co the thuong luong gia khong?",usageNote:""},
    {role:"personalized",sentence:"I negotiate project deadlines.",translationVi:"Toi dam phan thoi han du an.",usageNote:""},
  ],
  placement:{mindmapId:1,parentNodeId:1,reason:"Work communication",newMindmap:null},
};

beforeEach(()=>{
  db=createDatabase(":memory:");migrate(db);
  db.prepare("INSERT INTO users(username,normalized_username,password_hash) VALUES ('one','one','hash'),('two','two','hash')").run();
  db.prepare("INSERT INTO topics(slug,title,title_vi) VALUES ('work','Work','Cong viec')").run();
  db.prepare("INSERT INTO mindmaps(topic_id,title,status,source,user_id) VALUES (1,'Work talk','approved','user',1)").run();
  branchId=Number(db.prepare("INSERT INTO mindmap_nodes(mindmap_id,node_type,label,color,sort_order) VALUES (1,'branch','Meetings','sky',0)").run().lastInsertRowid);
  draft.placement={mindmapId:1,parentNodeId:branchId,reason:"Work communication",newMindmap:null};
  repository=new VocabularyInboxRepository(db);
});
afterEach(()=>db.close());

describe("VocabularyInboxRepository",()=>{
  it("captures once per user and isolates lists",()=>{
    const first=repository.capture(1,{rawText:"  Negotiate  ",contextText:"work",sourceType:"quick_capture",sourceReference:""});
    const duplicate=repository.capture(1,{rawText:"negotiate",contextText:"",sourceType:"agent_chat",sourceReference:"thread:1"});
    const other=repository.capture(2,{rawText:"negotiate",contextText:"",sourceType:"quick_capture",sourceReference:""});
    expect(duplicate.id).toBe(first.id);
    expect(other.id).not.toBe(first.id);
    expect(repository.list(1)).toHaveLength(1);
    expect(repository.get(2,first.id)).toBeNull();
  });

  it("stores a validated ready draft and failure state",()=>{
    const item=repository.capture(1,{rawText:"negotiate",contextText:"",sourceType:"quick_capture",sourceReference:""});
    repository.markProcessing(1,item.id);
    repository.saveDraft(1,item.id,draft,{model:"test-model",promptVersion:"v1",skillVersion:"1.1.0"});
    expect(repository.get(1,item.id)?.status).toBe("ready");
    expect(repository.get(1,item.id)?.draft?.examples).toHaveLength(3);
    repository.markFailed(1,item.id,"provider unavailable");
    expect(repository.get(1,item.id)).toMatchObject({status:"failed",errorMessage:"provider unavailable"});
  });

  it("approves atomically into vocabulary examples mindmap and SRS",()=>{
    const item=repository.capture(1,{rawText:"negotiate",contextText:"",sourceType:"mindmap",sourceReference:"map:1",hintMindmapId:1,hintParentNodeId:branchId});
    repository.saveDraft(1,item.id,draft,{model:"test",promptVersion:"v1",skillVersion:"1.1.0"});
    const result=repository.approve(1,item.id,{});
    expect(result.vocabularyId).toBeGreaterThan(0);
    expect(result.mindmapId).toBe(1);
    expect((db.prepare("SELECT COUNT(*) value FROM user_vocabulary_examples WHERE user_id=1 AND vocabulary_id=?").get(result.vocabularyId) as {value:number}).value).toBe(3);
    expect((db.prepare("SELECT status FROM user_vocabulary_state WHERE user_id=1 AND vocabulary_id=?").get(result.vocabularyId) as {status:string}).status).toBe("new");
    expect((db.prepare("SELECT COUNT(*) value FROM mindmap_nodes WHERE mindmap_id=1 AND vocabulary_id=?").get(result.vocabularyId) as {value:number}).value).toBe(1);
    expect(repository.approve(1,item.id,{})).toEqual(result);
    const learning=new LearningRepository(db);const session=learning.createSession(10,1) as {items:Array<{example:string|null}>};expect(session.items[0].example).toBe("We need to negotiate.");
    const otherSession=learning.createSession(10,2);expect(otherSession.items).toHaveLength(0);
  });

  it("never resets existing SRS progress or accepts another user destination",()=>{
    db.prepare("INSERT INTO vocabulary(term,normalized_term,meaning_vi) VALUES ('negotiate','negotiate','dam phan')").run();
    db.prepare("INSERT INTO user_vocabulary_state(user_id,vocabulary_id,status,repetitions,lapses) VALUES (1,1,'stable',9,2)").run();
    const item=repository.capture(1,{rawText:"negotiate",contextText:"",sourceType:"quick_capture",sourceReference:""});
    repository.saveDraft(1,item.id,draft,{model:"test",promptVersion:"v1",skillVersion:"1.1.0"});
    repository.approve(1,item.id,{});
    expect(db.prepare("SELECT status,repetitions,lapses FROM user_vocabulary_state WHERE user_id=1 AND vocabulary_id=1").get()).toMatchObject({status:"stable",repetitions:9,lapses:2});
    expect(()=>repository.approve(2,item.id,{})).toThrow();
  });
});

describe("VocabularyEnrichmentService",()=>{
  it("uses bounded account context and stores a ready draft",async()=>{
    db.prepare("INSERT INTO mindmaps(topic_id,title,status,source,user_id) VALUES (1,'Other private map','approved','user',2)").run();
    const item=repository.capture(1,{rawText:"negotiate",contextText:"client meeting",sourceType:"quick_capture",sourceReference:""});
    let prompt="";
    const client={getChatModel:()=>"test-model",chatJson:async(_schema:unknown,messages:Array<{content:string}>)=>{prompt=messages.map(message=>message.content).join("\n");return draft}};
    const service=new VocabularyEnrichmentService(db,repository,client as never,process.cwd());
    const ready=await service.enrich(1,item.id);
    expect(ready.status).toBe("ready");
    expect(ready.draft?.examples.map(example=>example.role)).toEqual(["basic","daily_life","personalized"]);
    expect(prompt).toContain("Work talk");
    expect(prompt).not.toContain("Other private map");
  });

  it("persists a sanitized failure and supports retry",async()=>{
    const item=repository.capture(1,{rawText:"fallback",contextText:"",sourceType:"quick_capture",sourceReference:""});
    const failing={getChatModel:()=>"test-model",chatJson:async()=>{throw new Error("provider secret detail")}};
    const service=new VocabularyEnrichmentService(db,repository,failing as never,process.cwd());
    await expect(service.enrich(1,item.id)).rejects.toThrow("provider secret detail");
    expect(repository.get(1,item.id)).toMatchObject({status:"failed",errorMessage:"AI enrichment unavailable"});
  });
});
