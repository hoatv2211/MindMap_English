import { createHash } from "node:crypto";
import type { AppDatabase } from "../../db/database";

const POLICY_VERSION="1";
export function isCacheEligibleQuestion(question:string,priorUserMessages:number):boolean{
  if(priorUserMessages>0)return false;
  const normalized=question.normalize("NFKC").toLocaleLowerCase("vi-VN").replace(/\s+/g," ").trim();
  if(/(tiến độ|của tôi|nên học gì|học tiếp|hôm nay|đang dở|cảm thấy|động lực)/u.test(normalized))return false;
  return /^(giải thích|cách dùng|nghĩa của|phân biệt|what does|how (do|does|to)|difference between)/u.test(normalized);
}
export class AgentResponseCache{
  constructor(private readonly db:AppDatabase){}
  key(input:{userId:number;profileRevision:number;skillVersion:string;model:string;question:string}){const normalized=input.question.normalize("NFKC").toLocaleLowerCase("vi-VN").replace(/\s+/g," ").trim();return createHash("sha256").update(JSON.stringify({...input,question:normalized,policy:POLICY_VERSION})).digest("hex")}
  get(key:string,userId:number){return this.db.prepare("SELECT response_text responseText FROM agent_response_cache WHERE cache_key=? AND user_id=?").get(key,userId) as {responseText:string}|undefined}
  set(key:string,input:{userId:number;profileRevision:number;skillVersion:string;model:string;responseText:string}){this.db.prepare("INSERT OR REPLACE INTO agent_response_cache(cache_key,user_id,profile_revision,skill_version,model,response_text) VALUES (?,?,?,?,?,?)").run(key,input.userId,input.profileRevision,input.skillVersion,input.model,input.responseText)}
}
