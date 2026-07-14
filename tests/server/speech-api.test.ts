import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { AppDatabase } from "../../src/server/db/database";
import { createDatabase } from "../../src/server/db/database";
import { migrate } from "../../src/server/db/migrate";
import { seedDatabase } from "../../src/server/db/seed";
import { createApp } from "../../src/server/app";

let db: AppDatabase;
beforeEach(() => { db=createDatabase(":memory:"); migrate(db); seedDatabase(db); });
afterEach(() => db.close());

describe("speech API", () => {
  it("validates audio and proxies transcription", async () => {
    const nineRouter={ health:vi.fn(async()=>true), transcribe:vi.fn(async()=>"I would like a coffee."), synthesizeSpeech:vi.fn(async()=>({buffer:Buffer.from("audio"),mimeType:"audio/mpeg"})) };
    const app=createApp({db,nineRouter:nineRouter as never});
    await request(app).post("/api/speech/transcribe").attach("audio",Buffer.from("webm"),{filename:"speech.webm",contentType:"audio/webm"}).expect(200,{text:"I would like a coffee."});
    const audio=await request(app).post("/api/speech/synthesize").send({text:"Hello"}).expect(200);
    expect(audio.headers["content-type"]).toContain("audio/mpeg");
  });

  it("rejects unsupported files", async () => {
    const app=createApp({db,nineRouter:{health:vi.fn(async()=>false)} as never});
    await request(app).post("/api/speech/transcribe").attach("audio",Buffer.from("bad"),{filename:"bad.txt",contentType:"text/plain"}).expect(400);
  });
});
