import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AppDatabase } from "../../src/server/db/database";
import { createDatabase } from "../../src/server/db/database";
import { migrate } from "../../src/server/db/migrate";
import { createApp } from "../../src/server/app";

let db: AppDatabase;

beforeEach(() => { db = createDatabase(":memory:"); migrate(db); });
afterEach(() => db.close());

function app() {
  return createApp({ db, config: {
    host: "127.0.0.1", port: 8787, dataDir: ".", databasePath: ":memory:", mediaDir: ".", backupDir: ".",
    auth: { secureCookies: false, sessionHours: 24, absoluteSessionHours: 168 },
    nineRouter: { url: "http://localhost:20128", key: "", chatModel: "", imageModel: "", sttModel: "", ttsModel: "", ttsVoice: "" },
  }, nineRouter: { health: async () => false } as never });
}

describe("auth API", () => {
  it("registers, returns one-time recovery code, and restores the cookie session", async () => {
    const agent = request.agent(app());
    const registered = await agent.post("/api/auth/register").send({ username: "HongHui", password: "correct horse battery staple", passwordConfirmation: "correct horse battery staple" });

    expect(registered.status).toBe(201);
    expect(registered.body.user).toMatchObject({ username: "HongHui" });
    expect(registered.body.recoveryCode).toMatch(/^[A-Z0-9-]{20,}$/);
    expect(registered.headers["set-cookie"][0]).toContain("HttpOnly");
    expect(registered.headers["set-cookie"][0]).toContain("SameSite=Lax");

    const me = await agent.get("/api/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.user.username).toBe("HongHui");
    const stored = db.prepare("SELECT password_hash passwordHash FROM users").get() as { passwordHash: string };
    expect(stored.passwordHash).not.toContain("correct horse");
  });

  it("logs out and logs back in case-insensitively", async () => {
    const agent = request.agent(app());
    await agent.post("/api/auth/register").send({ username: "Learner", password: "strong password 123", passwordConfirmation: "strong password 123" });
    expect((await agent.post("/api/auth/logout")).status).toBe(204);
    expect((await agent.get("/api/auth/me")).status).toBe(401);
    expect((await agent.post("/api/auth/login").send({ username: " learner ", password: "strong password 123" })).status).toBe(200);
    expect((await agent.get("/api/auth/me")).status).toBe(200);
  });

  it("resets password with a single-use recovery code and revokes old sessions", async () => {
    const oldAgent = request.agent(app());
    const registered = await oldAgent.post("/api/auth/register").send({ username: "recover-me", password: "old password 123", passwordConfirmation: "old password 123" });
    const recoveryCode = registered.body.recoveryCode as string;

    const reset = await request(app()).post("/api/auth/password/recover").send({ username: "recover-me", recoveryCode, password: "new password 456", passwordConfirmation: "new password 456" });
    expect(reset.status).toBe(200);
    expect(reset.body.recoveryCode).not.toBe(recoveryCode);
    expect((await oldAgent.get("/api/auth/me")).status).toBe(401);
    expect((await request(app()).post("/api/auth/password/recover").send({ username: "recover-me", recoveryCode, password: "another password 789", passwordConfirmation: "another password 789" })).status).toBe(400);
    expect((await request(app()).post("/api/auth/login").send({ username: "recover-me", password: "new password 456" })).status).toBe(200);
  });

  it("rejects duplicate usernames and uses generic invalid credentials", async () => {
    await request(app()).post("/api/auth/register").send({ username: "SameName", password: "strong password 123", passwordConfirmation: "strong password 123" });
    expect((await request(app()).post("/api/auth/register").send({ username: "samename", password: "strong password 123", passwordConfirmation: "strong password 123" })).status).toBe(409);
    const missing = await request(app()).post("/api/auth/login").send({ username: "missing", password: "wrong password 123" });
    const wrong = await request(app()).post("/api/auth/login").send({ username: "SameName", password: "wrong password 123" });
    expect(missing.body).toEqual(wrong.body);
  });
  it("protects application APIs when production gate is enabled", async () => {
    const protectedApp=createApp({db,config:{host:"127.0.0.1",port:8787,dataDir:".",databasePath:":memory:",mediaDir:".",backupDir:".",auth:{secureCookies:false,sessionHours:24,absoluteSessionHours:168},nineRouter:{url:"http://localhost:20128",key:"",chatModel:"",imageModel:"",sttModel:"",ttsModel:"",ttsVoice:""}},nineRouter:{health:async()=>false} as never,protectApi:true});
    expect((await request(protectedApp).get("/api/learning/dashboard")).status).toBe(401);
    expect((await request(protectedApp).get("/api/health")).status).toBe(200);
  });

  it("changes password, revokes old sessions, and rate-limits repeated failures", async () => {
    const oldAgent=request.agent(app());
    await oldAgent.post("/api/auth/register").send({username:"secure-user",password:"old password 123",passwordConfirmation:"old password 123"});
    const changed=await oldAgent.post("/api/auth/password/change").send({currentPassword:"old password 123",password:"new password 456",passwordConfirmation:"new password 456"});
    expect(changed.status).toBe(200);
    expect((await oldAgent.get("/api/auth/me")).status).toBe(200);
    expect((await request(app()).post("/api/auth/login").send({username:"secure-user",password:"old password 123"})).status).toBe(401);
    for(let attempt=0;attempt<5;attempt++) await request(app()).post("/api/auth/login").send({username:"missing-limit",password:"wrong password 123"});
    expect((await request(app()).post("/api/auth/login").send({username:"missing-limit",password:"wrong password 123"})).status).toBe(429);
  });

});
