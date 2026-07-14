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
});
