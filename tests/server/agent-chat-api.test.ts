import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppDatabase } from "../../src/server/db/database";
import { createDatabase } from "../../src/server/db/database";
import { migrate } from "../../src/server/db/migrate";
import { createApp } from "../../src/server/app";

let db:AppDatabase;
beforeEach(()=>{db=createDatabase(":memory:");migrate(db)});afterEach(()=>db.close());
const config={host:"127.0.0.1",allowRemoteBinding:false,port:8787,appOrigin:undefined,dataDir:".",databasePath:":memory:",mediaDir:".",backupDir:".",auth:{secureCookies:false,cookieSameSite:"lax" as const,sessionHours:24,absoluteSessionHours:168},nineRouter:{url:"http://localhost:20128",key:"",chatModel:"",imageModel:"",sttModel:"",ttsModel:"",ttsVoice:""}};

describe("agent thread API",()=>{
  it("creates, sends, persists, and reopens a skill-backed conversation",async()=>{
    const chatText=vi.fn(async()=>"Dùng present perfect cho trải nghiệm chưa nêu thời điểm.");
    const app=createApp({db,config,nineRouter:{health:async()=>true,chatText} as never});const agent=request.agent(app);
    await agent.post("/api/auth/register").send({username:"learner",password:"strong password 123",passwordConfirmation:"strong password 123"});
    const created=await agent.post("/api/agent/threads").send({});expect(created.status).toBe(201);
    const sent=await agent.post(`/api/agent/threads/${created.body.id}/messages`).send({message:"Giải thích present perfect"});
    expect(sent.status).toBe(201);expect(sent.body.reply).toContain("present perfect");
    const prompt=(chatText.mock.calls as unknown as Array<[Array<{content:string}>]>)[0][0][0].content;expect(prompt).toContain("MindMap English Tutor");expect(prompt).toContain("Learner snapshot");
    const messages=await agent.get(`/api/agent/threads/${created.body.id}/messages`);expect(messages.body).toHaveLength(2);
    expect((await agent.get("/api/agent/threads")).body[0].title).toContain("Giải thích");
  });
  it("retries failed messages and manages thread lifecycle",async()=>{
    const chatText=vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce("Retry thành công.");
    const app=createApp({db,config,nineRouter:{health:async()=>true,chatText} as never});
    const owner=request.agent(app);const other=request.agent(app);
    await owner.post("/api/auth/register").send({username:"owner",password:"strong password 123",passwordConfirmation:"strong password 123"});
    await other.post("/api/auth/register").send({username:"other",password:"strong password 123",passwordConfirmation:"strong password 123"});
    const thread=(await owner.post("/api/agent/threads").send({})).body;
    await owner.post(`/api/agent/threads/${thread.id}/messages`).send({message:"Giải thích used to"}).expect(500);
    const failed=(await owner.get(`/api/agent/threads/${thread.id}/messages`).expect(200)).body;
    expect(failed).toHaveLength(2);expect(failed[1]).toMatchObject({role:"assistant",status:"failed"});
    await other.post(`/api/agent/threads/${thread.id}/messages/${failed[1].id}/retry`).expect(404);
    const retried=await owner.post(`/api/agent/threads/${thread.id}/messages/${failed[1].id}/retry`).expect(200);
    expect(retried.body.reply).toBe("Retry thành công.");
    const messages=(await owner.get(`/api/agent/threads/${thread.id}/messages`)).body;
    expect(messages).toHaveLength(2);expect(messages[1]).toMatchObject({status:"completed",content:"Retry thành công."});
    await owner.patch(`/api/agent/threads/${thread.id}`).send({title:"Used to practice"}).expect(204);
    await owner.patch(`/api/agent/threads/${thread.id}`).send({archived:true}).expect(204);
    expect((await owner.get("/api/agent/threads")).body).toHaveLength(0);
    expect((await owner.get("/api/agent/threads?archived=true")).body[0].title).toBe("Used to practice");
    await owner.patch(`/api/agent/threads/${thread.id}`).send({archived:false}).expect(204);
    expect((await owner.get("/api/agent/threads")).body).toHaveLength(1);
  });
});
