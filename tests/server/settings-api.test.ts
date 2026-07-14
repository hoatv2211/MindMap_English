import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { AppDatabase } from "../../src/server/db/database";
import { createDatabase } from "../../src/server/db/database";
import { migrate } from "../../src/server/db/migrate";
import { seedDatabase } from "../../src/server/db/seed";
import { createApp } from "../../src/server/app";
import { loadConfig } from "../../src/server/config";

let db: AppDatabase;
beforeEach(() => { db=createDatabase(":memory:"); migrate(db); seedDatabase(db); });
afterEach(() => db.close());

describe("settings API", () => {
  it("never returns the API key and persists safe preferences", async () => {
    const config=loadConfig({ NINEROUTER_KEY:"top-secret",NINEROUTER_CHAT_MODEL:"combo/chat" });
    const nineRouter={ health:vi.fn(async()=>true) };
    const app=createApp({db,config,nineRouter:nineRouter as never});
    await request(app).put("/api/settings").send({defaultDuration:10,apiKey:"leak"}).expect(200);
    const response=await request(app).get("/api/settings").expect(200);
    expect(response.body.hasNineRouterKey).toBe(true);
    expect(JSON.stringify(response.body)).not.toContain("top-secret");
    expect(JSON.stringify(response.body)).not.toContain("leak");
  });
  it("isolates preferences between authenticated users", async () => {
    const config=loadConfig();
    const protectedApp=createApp({db,config,nineRouter:{health:vi.fn(async()=>false)} as never,protectApi:true});
    const first=request.agent(protectedApp);
    const second=request.agent(protectedApp);
    await first.post("/api/auth/register").send({username:"settings-one",password:"strong password 123",passwordConfirmation:"strong password 123"}).expect(201);
    await second.post("/api/auth/register").send({username:"settings-two",password:"strong password 123",passwordConfirmation:"strong password 123"}).expect(201);
    await first.put("/api/settings").send({defaultDuration:10,weeklyGoalMinutes:80}).expect(200);
    await second.put("/api/settings").send({defaultDuration:20,weeklyGoalMinutes:140}).expect(200);
    expect((await first.get("/api/settings").expect(200)).body).toMatchObject({defaultDuration:10,weeklyGoalMinutes:80});
    expect((await second.get("/api/settings").expect(200)).body).toMatchObject({defaultDuration:20,weeklyGoalMinutes:140});
  });

});
