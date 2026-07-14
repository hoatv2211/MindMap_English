import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppDatabase } from "../../src/server/db/database";
import { createDatabase } from "../../src/server/db/database";
import { migrate } from "../../src/server/db/migrate";
import { ChatRepository } from "../../src/server/modules/agent/chat-repository";
import { LearnerContextService } from "../../src/server/modules/agent/learner-context";

let db:AppDatabase;
beforeEach(()=>{db=createDatabase(":memory:");migrate(db)});afterEach(()=>db.close());
function user(name:string){return Number(db.prepare("INSERT INTO users(username,normalized_username,password_hash) VALUES (?,?,?)").run(name,name,"hash").lastInsertRowid)}

describe("persistent tutor chat",()=>{
  it("keeps threads and messages isolated by user",()=>{
    const first=user("first"),second=user("second");const repo=new ChatRepository(db);
    const thread=repo.createThread(first);
    repo.addMessage(first,thread.id,"user","Explain present perfect");
    expect(repo.listThreads(first)).toHaveLength(1);
    expect(repo.listMessages(first,thread.id)).toHaveLength(1);
    expect(repo.listMessages(second,thread.id)).toBeNull();
    expect(repo.archiveThread(second,thread.id)).toBe(false);
    expect(repo.archiveThread(first,thread.id)).toBe(true);
  });

  it("builds and reuses a bounded learner context by profile revision",()=>{
    const id=user("learner");
    db.prepare("INSERT INTO vocabulary(term,normalized_term,meaning_vi,status) VALUES ('book','book','sách','weak')").run();
    const service=new LearnerContextService(db);
    const first=service.get(id,"1.0.0");const second=service.get(id,"1.0.0");
    expect(first.snapshot.vocabulary.weak).toBe(1);
    expect(second.cacheHit).toBe(true);
    db.prepare("UPDATE users SET profile_revision=profile_revision+1 WHERE id=?").run(id);
    expect(service.get(id,"1.0.0").cacheHit).toBe(false);
    expect(JSON.stringify(first.snapshot)).not.toContain("password_hash");
  });
});
