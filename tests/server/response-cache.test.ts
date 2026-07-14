import { afterEach,describe,expect,it } from "vitest";
import {createDatabase} from "../../src/server/db/database";
import {migrate} from "../../src/server/db/migrate";
const databases:Array<ReturnType<typeof createDatabase>>=[];afterEach(()=>databases.splice(0).forEach(db=>db.close()));
import { AgentResponseCache, isCacheEligibleQuestion } from "../../src/server/modules/agent/response-cache";

describe("agent response cache policy",()=>{
  it("accepts standalone knowledge questions",()=>{expect(isCacheEligibleQuestion("Giải thích present perfect",0)).toBe(true);expect(isCacheEligibleQuestion("Cách dùng từ get along",0)).toBe(true)});
  it("rejects follow-ups and personal learning requests",()=>{expect(isCacheEligibleQuestion("Cho thêm ví dụ",2)).toBe(false);expect(isCacheEligibleQuestion("Tiến độ của tôi tuần này",0)).toBe(false);expect(isCacheEligibleQuestion("Tôi nên học gì tiếp?",0)).toBe(false)});
  it("includes model version in cache key",()=>{const db=createDatabase(":memory:");databases.push(db);migrate(db);const cache=new AgentResponseCache(db);const base={userId:1,profileRevision:2,skillVersion:"1",question:"Giải thích present perfect"};expect(cache.key({...base,model:"model-a"})).not.toBe(cache.key({...base,model:"model-b"}))});
});
