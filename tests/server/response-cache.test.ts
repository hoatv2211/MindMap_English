import { describe,expect,it } from "vitest";
import { isCacheEligibleQuestion } from "../../src/server/modules/agent/response-cache";

describe("agent response cache policy",()=>{
  it("accepts standalone knowledge questions",()=>{expect(isCacheEligibleQuestion("Giải thích present perfect",0)).toBe(true);expect(isCacheEligibleQuestion("Cách dùng từ get along",0)).toBe(true)});
  it("rejects follow-ups and personal learning requests",()=>{expect(isCacheEligibleQuestion("Cho thêm ví dụ",2)).toBe(false);expect(isCacheEligibleQuestion("Tiến độ của tôi tuần này",0)).toBe(false);expect(isCacheEligibleQuestion("Tôi nên học gì tiếp?",0)).toBe(false)});
});
