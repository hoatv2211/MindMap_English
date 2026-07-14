import type { AppDatabase } from "../../db/database";
const SCHEMA_VERSION="1";
export interface LearnerSnapshot{profileRevision:number;progress:{xp:number;streak:number;weeklyGoalMinutes:number};vocabulary:{total:number;weak:number;due:number;items:Array<{term:string;meaningVi:string;status:string}>};recentMistakes:Array<{term:string;answer:string}>;unfinishedSession:{id:number;durationMinutes:number}|null;recentSentences:string[];recentDocuments:string[]}
export class LearnerContextService{
  constructor(private readonly db:AppDatabase){}
  get(userId:number,skillVersion:string):{snapshot:LearnerSnapshot;cacheHit:boolean}{
    const user=this.db.prepare("SELECT profile_revision profileRevision FROM users WHERE id=?").get(userId) as {profileRevision:number}|undefined;if(!user)throw new Error("User not found");
    const cached=this.db.prepare("SELECT snapshot_json snapshotJson FROM learner_context_cache WHERE user_id=? AND profile_revision=? AND skill_version=? AND schema_version=?").get(userId,user.profileRevision,skillVersion,SCHEMA_VERSION) as {snapshotJson:string}|undefined;
    if(cached)return{snapshot:JSON.parse(cached.snapshotJson),cacheHit:true};
    const progress=(this.db.prepare("SELECT xp,streak,weekly_goal_minutes weeklyGoalMinutes FROM user_progress WHERE id=1").get() as {xp:number;streak:number;weeklyGoalMinutes:number}|undefined)??{xp:0,streak:0,weeklyGoalMinutes:100};
    const counts=this.db.prepare(`SELECT COUNT(*) total,SUM(CASE WHEN status='weak' THEN 1 ELSE 0 END) weak FROM vocabulary`).get() as {total:number;weak:number|null};
    const due=(this.db.prepare("SELECT COUNT(*) count FROM review_cards WHERE datetime(due_at)<=datetime('now')").get() as {count:number}).count;
    const items=this.db.prepare(`SELECT term,meaning_vi meaningVi,status FROM vocabulary WHERE status IN ('weak','learning') ORDER BY CASE status WHEN 'weak' THEN 0 ELSE 1 END,updated_at DESC LIMIT 8`).all() as Array<{term:string;meaningVi:string;status:string}>;
    const recentMistakes=this.db.prepare(`SELECT v.term,a.answer FROM review_attempts a JOIN vocabulary v ON v.id=a.vocabulary_id WHERE a.is_correct=0 ORDER BY a.id DESC LIMIT 6`).all() as Array<{term:string;answer:string}>;
    const unfinished=this.db.prepare("SELECT id,duration_minutes durationMinutes FROM learning_sessions WHERE status='active' ORDER BY id DESC LIMIT 1").get() as {id:number;durationMinutes:number}|undefined;
    const recentSentences=(this.db.prepare("SELECT sentence FROM sentence_notebook ORDER BY id DESC LIMIT 5").all() as Array<{sentence:string}>).map(row=>row.sentence.slice(0,240));
    const recentDocuments=(this.db.prepare("SELECT title FROM document_sources ORDER BY id DESC LIMIT 4").all() as Array<{title:string}>).map(row=>row.title.slice(0,120));
    const snapshot:LearnerSnapshot={profileRevision:user.profileRevision,progress,vocabulary:{total:counts.total,weak:counts.weak??0,due,items},recentMistakes,unfinishedSession:unfinished??null,recentSentences,recentDocuments};
    this.db.prepare("INSERT OR REPLACE INTO learner_context_cache(user_id,profile_revision,skill_version,schema_version,snapshot_json) VALUES (?,?,?,?,?)").run(userId,user.profileRevision,skillVersion,SCHEMA_VERSION,JSON.stringify(snapshot));
    return{snapshot,cacheHit:false};
  }
}
