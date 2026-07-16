import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppDatabase } from "../../src/server/db/database";
import { createDatabase } from "../../src/server/db/database";
import { migrate } from "../../src/server/db/migrate";
import { createApp } from "../../src/server/app";

let db:AppDatabase;
const config={host:"127.0.0.1",allowRemoteBinding:false,port:8787,appOrigin:undefined,dataDir:".",databasePath:":memory:",mediaDir:".",backupDir:".",auth:{secureCookies:false,cookieSameSite:"lax" as const,sessionHours:24,absoluteSessionHours:168},nineRouter:{url:"http://localhost:20128",key:"",chatModel:"test-model",imageModel:"",sttModel:"",ttsModel:"",ttsVoice:""}};
const draft={normalizedTerm:"negotiate",displayTerm:"negotiate",meaningVi:"dam phan",ipa:"",partOfSpeech:"verb",cefr:"B1",itemType:"word",examples:[{role:"basic",sentence:"We negotiate.",translationVi:"Chung ta dam phan.",usageNote:""},{role:"daily_life",sentence:"Can we negotiate the price?",translationVi:"Co the thuong luong gia khong?",usageNote:""},{role:"personalized",sentence:"I negotiate deadlines.",translationVi:"Toi dam phan thoi han.",usageNote:""}],placement:{mindmapId:null,parentNodeId:null,reason:"new topic",newMindmap:{title:"Negotiation",description:"Useful negotiation language",branchLabel:"Core verbs"}}};

beforeEach(()=>{db=createDatabase(":memory:");migrate(db);db.prepare("INSERT INTO topics(slug,title,title_vi) VALUES ('work','Work','Cong viec')").run()});
afterEach(()=>db.close());

describe("vocabulary inbox API",()=>{
  it("captures enriches edits approves and isolates an item",async()=>{
    const chatJson=vi.fn(async()=>draft);const nineRouter={health:async()=>true,getChatModel:()=>"test-model",chatJson,chatText:async()=>"ok"};
    const app=createApp({db,config,nineRouter:nineRouter as never});const owner=request.agent(app);const other=request.agent(app);
    await owner.post("/api/auth/register").send({username:"owner",password:"strong password 123",passwordConfirmation:"strong password 123"}).expect(201);
    await other.post("/api/auth/register").send({username:"other",password:"strong password 123",passwordConfirmation:"strong password 123"}).expect(201);
    const created=await owner.post("/api/vocabulary-inbox").send({rawText:"negotiate",contextText:"client call",sourceType:"quick_capture"}).expect(201);
    expect(created.body).toMatchObject({status:"ready",rawText:"negotiate"});
    expect(created.body.draft.examples).toHaveLength(3);
    await other.get(`/api/vocabulary-inbox/${created.body.id}`).expect(404);
    const edited={...created.body.draft,meaningVi:"thuong luong"};
    await owner.patch(`/api/vocabulary-inbox/${created.body.id}/draft`).send(edited).expect(200);
    const approved=await owner.post(`/api/vocabulary-inbox/${created.body.id}/approve`).send({}).expect(200);
    expect(approved.body.vocabularyId).toBeGreaterThan(0);
    expect((await owner.get("/api/vocabulary-inbox?status=approved").expect(200)).body).toHaveLength(1);
    expect((await other.get("/api/vocabulary-inbox").expect(200)).body).toHaveLength(0);
  });

  it("persists enrichment failure and retries",async()=>{
    const chatJson=vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(draft);const app=createApp({db,config,nineRouter:{health:async()=>false,getChatModel:()=>"test-model",chatJson,chatText:async()=>""} as never});const owner=request.agent(app);
    await owner.post("/api/auth/register").send({username:"retry",password:"strong password 123",passwordConfirmation:"strong password 123"});
    const created=await owner.post("/api/vocabulary-inbox").send({rawText:"negotiate"}).expect(201);expect(created.body.status).toBe("failed");
    const retried=await owner.post(`/api/vocabulary-inbox/${created.body.id}/enrich`).expect(200);expect(retried.body.status).toBe("ready");
    await owner.post(`/api/vocabulary-inbox/${created.body.id}/dismiss`).expect(200);expect((await owner.get(`/api/vocabulary-inbox/${created.body.id}`)).body.status).toBe("dismissed");
  });
});
