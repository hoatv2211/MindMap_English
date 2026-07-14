import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppDatabase } from "../../src/server/db/database";
import { createDatabase } from "../../src/server/db/database";
import { migrate } from "../../src/server/db/migrate";
import { createApp } from "../../src/server/app";

let db:AppDatabase;
beforeEach(()=>{db=createDatabase(":memory:");migrate(db)});afterEach(()=>db.close());
const config={host:"127.0.0.1",port:8787,dataDir:".",databasePath:":memory:",mediaDir:".",backupDir:".",auth:{secureCookies:false,sessionHours:24,absoluteSessionHours:168},nineRouter:{url:"http://localhost:20128",key:"",chatModel:"",imageModel:"",sttModel:"",ttsModel:"",ttsVoice:""}};

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
});

