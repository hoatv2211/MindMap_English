import type { AppDatabase } from "../../db/database";
import { withTransaction } from "../../db/database";
import type { ReviewGrade } from "../../../shared/contracts";
import { buildSession, type SessionCandidate } from "./session-service";
import { scheduleReview } from "./srs";
import type { LearningPathRepository } from "../learning-paths/repository";

interface CandidateRow { vocabulary_id:number; status:SessionCandidate["status"]; due:number; repetitions:number; lapses:number }
interface ReviewState { stability:number; difficulty:number; interval_days:number; repetitions:number; lapses:number }

export class LearningRepository {
  constructor(private readonly db:AppDatabase,private readonly clock:()=>Date=()=>new Date(),private readonly paths?:LearningPathRepository){}

  createSession(duration:10|20,userId?:number,moduleId?:number){
    return withTransaction(this.db,()=>{
      const now=this.clock().toISOString();
      if(userId!==undefined)this.ensureUserSeedVocabulary(userId);
      const rows=(userId===undefined?this.db.prepare(`SELECT v.id vocabulary_id,v.status,CASE WHEN datetime(r.due_at)<=datetime(?) THEN 1 ELSE 0 END due,r.repetitions,r.lapses FROM vocabulary v JOIN review_cards r ON r.vocabulary_id=v.id ORDER BY CASE v.status WHEN 'weak' THEN 0 WHEN 'learning' THEN 1 WHEN 'new' THEN 2 ELSE 3 END,r.due_at,v.id`).all(now):this.db.prepare(`SELECT v.id vocabulary_id,s.status,CASE WHEN datetime(s.due_at)<=datetime(?) THEN 1 ELSE 0 END due,s.repetitions,s.lapses FROM user_vocabulary_state s JOIN vocabulary v ON v.id=s.vocabulary_id WHERE s.user_id=? ORDER BY CASE s.status WHEN 'weak' THEN 0 WHEN 'learning' THEN 1 WHEN 'new' THEN 2 ELSE 3 END,s.due_at,v.id`).all(now,userId)) as CandidateRow[];
      const moduleIds=moduleId&&this.paths?new Set(this.paths.vocabularyIdsForModule(moduleId,userId)):null;
      const filtered=moduleIds?rows.filter(row=>moduleIds.has(row.vocabulary_id)):rows;
      const candidates:SessionCandidate[]=filtered.map(row=>({vocabularyId:row.vocabulary_id,status:row.status,due:Boolean(row.due),isNew:row.repetitions===0&&row.status==="new",lapses:row.lapses}));
      const plan=buildSession(candidates,duration);
      const sessionId=Number(this.db.prepare("INSERT INTO learning_sessions(duration_minutes,user_id,module_id) VALUES (?,?,?)").run(duration,userId??null,moduleId??null).lastInsertRowid);
      const insert=this.db.prepare("INSERT INTO session_items(session_id,vocabulary_id,activity_type,sort_order,is_new) VALUES (?,?,?,?,?)");
      plan.forEach(item=>insert.run(sessionId,item.vocabularyId,item.activityType,item.sortOrder,item.isNew?1:0));
      return this.getSession(sessionId,userId)!;
    });
  }

  private ensureUserSeedVocabulary(userId:number){
    this.db.prepare(`INSERT OR IGNORE INTO user_vocabulary_state(user_id,vocabulary_id,status)
      SELECT DISTINCT ?,n.vocabulary_id,v.status
      FROM mindmap_nodes n JOIN mindmaps m ON m.id=n.mindmap_id JOIN vocabulary v ON v.id=n.vocabulary_id
      WHERE m.source='seed' AND n.vocabulary_id IS NOT NULL`).run(userId);
  }

  getSession(id:number,userId?:number){
    const session=this.db.prepare(`SELECT * FROM learning_sessions WHERE id=? ${userId===undefined?"":"AND user_id=?"}`).get(...(userId===undefined?[id]:[id,userId])) as Record<string,unknown>|undefined;
    if(!session)return null;
    const items=this.db.prepare(`SELECT si.id,si.vocabulary_id vocabularyId,si.activity_type activityType,si.sort_order sortOrder,si.is_new isNew,v.term,v.meaning_vi meaningVi,v.ipa,v.cefr,COALESCE(s.status,v.status) status,COALESCE((SELECT sentence FROM user_vocabulary_examples ue WHERE ue.vocabulary_id=v.id AND ue.user_id=? ORDER BY ue.id LIMIT 1),(SELECT sentence FROM examples e WHERE e.vocabulary_id=v.id ORDER BY e.id LIMIT 1)) example,COALESCE((SELECT translation_vi FROM user_vocabulary_examples ue WHERE ue.vocabulary_id=v.id AND ue.user_id=? ORDER BY ue.id LIMIT 1),(SELECT translation_vi FROM examples e WHERE e.vocabulary_id=v.id ORDER BY e.id LIMIT 1)) exampleVi FROM session_items si JOIN vocabulary v ON v.id=si.vocabulary_id LEFT JOIN user_vocabulary_state s ON s.vocabulary_id=v.id AND s.user_id=? WHERE si.session_id=? ORDER BY si.sort_order`).all(userId??-1,userId??-1,userId??-1,id);
    return{id:session.id,durationMinutes:session.duration_minutes,status:session.status,startedAt:session.started_at,completedAt:session.completed_at,summary:session.summary,items};
  }

  recordAttempt(input:{sessionId:number;vocabularyId:number;promptType:string;answer:string;isCorrect:boolean;responseMs:number;hintsUsed:number;grade:ReviewGrade;userId?:number}){
    return withTransaction(this.db,()=>{
      if(!this.getSession(input.sessionId,input.userId))throw new Error("Learning session not found");
      if(!this.db.prepare("SELECT 1 FROM session_items WHERE session_id=? AND vocabulary_id=?").get(input.sessionId,input.vocabularyId))throw new Error("Vocabulary not in learning session");
      let card:ReviewState|undefined;
      if(input.userId===undefined)card=this.db.prepare("SELECT stability,difficulty,interval_days,repetitions,lapses FROM review_cards WHERE vocabulary_id=?").get(input.vocabularyId) as ReviewState|undefined;
      else{
        this.db.prepare("INSERT OR IGNORE INTO user_vocabulary_state(user_id,vocabulary_id,status) VALUES (?,?,'new')").run(input.userId,input.vocabularyId);
        card=this.db.prepare("SELECT stability,difficulty,interval_days,repetitions,lapses FROM user_vocabulary_state WHERE user_id=? AND vocabulary_id=?").get(input.userId,input.vocabularyId) as ReviewState|undefined;
      }
      if(!card)throw new Error("Review state not found");
      const schedule=scheduleReview({stability:card.stability,difficulty:card.difficulty,intervalDays:card.interval_days,repetitions:card.repetitions,lapses:card.lapses},input.grade,this.clock());
      this.db.prepare(`INSERT INTO review_attempts(session_id,vocabulary_id,prompt_type,answer,is_correct,response_ms,hints_used,grade,user_id) VALUES (?,?,?,?,?,?,?,?,?)`).run(input.sessionId,input.vocabularyId,input.promptType,input.answer,input.isCorrect?1:0,input.responseMs,input.hintsUsed,input.grade,input.userId??null);
      const nextStatus=input.grade==="again"?"weak":schedule.repetitions>=4?"stable":"learning";
      if(input.userId===undefined){
        this.db.prepare(`UPDATE review_cards SET stability=?,difficulty=?,interval_days=?,repetitions=?,lapses=?,due_at=?,last_reviewed_at=? WHERE vocabulary_id=?`).run(schedule.stability,schedule.difficulty,schedule.intervalDays,schedule.repetitions,schedule.lapses,schedule.dueAt,schedule.reviewedAt,input.vocabularyId);
        this.db.prepare("UPDATE vocabulary SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(nextStatus,input.vocabularyId);
      }else this.db.prepare(`UPDATE user_vocabulary_state SET status=?,stability=?,difficulty=?,interval_days=?,repetitions=?,lapses=?,due_at=?,last_reviewed_at=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND vocabulary_id=?`).run(nextStatus,schedule.stability,schedule.difficulty,schedule.intervalDays,schedule.repetitions,schedule.lapses,schedule.dueAt,schedule.reviewedAt,input.userId,input.vocabularyId);
      return schedule;
    });
  }

  completeSession(id:number,userId?:number){
    if(!this.getSession(id,userId))return null;
    const stats=this.db.prepare(`SELECT COUNT(*) total,SUM(is_correct) correct FROM review_attempts WHERE session_id=? ${userId===undefined?"":"AND user_id=?"}`).get(...(userId===undefined?[id]:[id,userId])) as {total:number;correct:number|null};
    const summary=stats.total?`${stats.correct??0}/${stats.total} câu đúng`:"Đã hoàn thành buổi học";
    const result=this.db.prepare(`UPDATE learning_sessions SET status='completed',completed_at=?,summary=? WHERE id=? AND status='active' ${userId===undefined?"":"AND user_id=?"}`).run(...(userId===undefined?[this.clock().toISOString(),summary,id]:[this.clock().toISOString(),summary,id,userId]));
    if(!result.changes)return null;
    this.updateModuleProgress(id,userId);
    this.updateProgressStreak(userId);
    return this.getSession(id,userId);
  }

  private updateModuleProgress(sessionId:number,userId?:number){
    if(userId===undefined)return;
    const session=this.db.prepare("SELECT module_id moduleId FROM learning_sessions WHERE id=? AND user_id=?").get(sessionId,userId) as {moduleId:number|null}|undefined;
    if(!session?.moduleId)return;
    const stats=this.db.prepare("SELECT COUNT(*) total,SUM(completed) completed FROM (SELECT si.vocabulary_id,MAX(CASE WHEN ra.id IS NOT NULL THEN 1 ELSE 0 END) completed FROM session_items si LEFT JOIN review_attempts ra ON ra.session_id=si.session_id AND ra.vocabulary_id=si.vocabulary_id AND ra.user_id=? WHERE si.session_id=? GROUP BY si.vocabulary_id)").get(userId,sessionId) as {total:number;completed:number|null};
    const total=stats.total||this.paths?.vocabularyIdsForModule(session.moduleId,userId).length||1;
    const completed=stats.completed??0;
    const status=completed>=total&&total>0?"completed":"active";
    this.db.prepare(`INSERT INTO user_module_progress(user_id,module_id,status,completed_items,total_items,updated_at) VALUES (?,?,?,?,?,CURRENT_TIMESTAMP)
      ON CONFLICT(user_id,module_id) DO UPDATE SET status=excluded.status,completed_items=MAX(user_module_progress.completed_items,excluded.completed_items),total_items=MAX(user_module_progress.total_items,excluded.total_items),updated_at=CURRENT_TIMESTAMP`).run(userId,session.moduleId,status,completed,total);
  }

  private updateProgressStreak(userId?:number){
    const today=this.clock().toISOString().slice(0,10);const yesterday=new Date(this.clock().getTime()-86_400_000).toISOString().slice(0,10);
    if(userId===undefined){const progress=this.db.prepare("SELECT streak,last_study_date FROM user_progress WHERE id=1").get() as {streak:number;last_study_date:string|null};if(progress.last_study_date===today)return;this.db.prepare("UPDATE user_progress SET streak=?,last_study_date=?,xp=xp+20,updated_at=CURRENT_TIMESTAMP WHERE id=1").run(progress.last_study_date===yesterday?progress.streak+1:1,today);return}
    this.db.prepare("INSERT OR IGNORE INTO user_learning_progress(user_id) VALUES (?)").run(userId);
    const progress=this.db.prepare("SELECT streak,last_study_date lastStudyDate FROM user_learning_progress WHERE user_id=?").get(userId) as {streak:number;lastStudyDate:string|null};if(progress.lastStudyDate===today)return;
    this.db.prepare("UPDATE user_learning_progress SET streak=?,last_study_date=?,xp=xp+20,updated_at=CURRENT_TIMESTAMP WHERE user_id=?").run(progress.lastStudyDate===yesterday?progress.streak+1:1,today,userId);
  }

  getDashboard(aiOnline=false,userId?:number){
    if(userId===undefined){
      const counts=this.db.prepare(`SELECT SUM(CASE WHEN datetime(r.due_at)<=datetime('now') THEN 1 ELSE 0 END) dueCount,SUM(CASE WHEN v.status='new' THEN 1 ELSE 0 END) newCount,SUM(CASE WHEN v.status='weak' THEN 1 ELSE 0 END) weakCount,SUM(CASE WHEN v.status='stable' THEN 1 ELSE 0 END) stableCount FROM vocabulary v JOIN review_cards r ON r.vocabulary_id=v.id`).get() as Record<string,number|null>;
      const progress=this.db.prepare("SELECT * FROM user_progress WHERE id=1").get() as Record<string,number>;const weekly=this.db.prepare("SELECT COALESCE(SUM(duration_minutes),0) minutes FROM learning_sessions WHERE status='completed' AND datetime(completed_at)>=datetime('now','-7 days')").get() as {minutes:number};const unfinished=this.db.prepare("SELECT id FROM learning_sessions WHERE status='active' ORDER BY id DESC LIMIT 1").get() as {id:number}|undefined;
      return{dueCount:counts.dueCount??0,newCount:counts.newCount??0,weakCount:counts.weakCount??0,stableCount:counts.stableCount??0,streak:progress.streak??0,weeklyMinutes:weekly.minutes,weeklyGoalMinutes:progress.weekly_goal_minutes??100,aiOnline,unfinishedSessionId:unfinished?.id??null};
    }
    const counts=this.db.prepare(`SELECT SUM(CASE WHEN datetime(due_at)<=datetime('now') THEN 1 ELSE 0 END) dueCount,SUM(CASE WHEN status='new' THEN 1 ELSE 0 END) newCount,SUM(CASE WHEN status='weak' THEN 1 ELSE 0 END) weakCount,SUM(CASE WHEN status='stable' THEN 1 ELSE 0 END) stableCount FROM user_vocabulary_state WHERE user_id=?`).get(userId) as Record<string,number|null>;
    const progress=(this.db.prepare("SELECT streak,weekly_goal_minutes weeklyGoalMinutes FROM user_learning_progress WHERE user_id=?").get(userId) as {streak:number;weeklyGoalMinutes:number}|undefined)??{streak:0,weeklyGoalMinutes:100};
    const weekly=this.db.prepare("SELECT COALESCE(SUM(duration_minutes),0) minutes FROM learning_sessions WHERE user_id=? AND status='completed' AND datetime(completed_at)>=datetime('now','-7 days')").get(userId) as {minutes:number};const unfinished=this.db.prepare("SELECT id FROM learning_sessions WHERE user_id=? AND status='active' ORDER BY id DESC LIMIT 1").get(userId) as {id:number}|undefined;
    return{dueCount:counts.dueCount??0,newCount:counts.newCount??0,weakCount:counts.weakCount??0,stableCount:counts.stableCount??0,streak:progress.streak,weeklyMinutes:weekly.minutes,weeklyGoalMinutes:progress.weeklyGoalMinutes,aiOnline,unfinishedSessionId:unfinished?.id??null};
  }

  getProgress(userId?:number){
    const dashboard=this.getDashboard(false,userId);const args=userId===undefined?[]:[userId];
    const attempts=this.db.prepare(`SELECT COUNT(*) total,SUM(is_correct) correct FROM review_attempts WHERE datetime(created_at)>=datetime('now','-30 days') ${userId===undefined?"":"AND user_id=?"}`).get(...args) as {total:number;correct:number|null};
    const speaking=this.db.prepare(`SELECT COUNT(*) count FROM speaking_attempts WHERE datetime(created_at)>=datetime('now','-7 days') ${userId===undefined?"":"AND user_id=?"}`).get(...args) as {count:number};
    const topicCoverage=this.db.prepare(`SELECT COUNT(DISTINCT m.topic_id) count FROM session_items si JOIN learning_sessions ls ON ls.id=si.session_id JOIN mindmap_nodes n ON n.vocabulary_id=si.vocabulary_id JOIN mindmaps m ON m.id=n.mindmap_id WHERE 1=1 ${userId===undefined?"":"AND ls.user_id=?"}`).get(...args) as {count:number};
    return{...dashboard,accuracy30d:attempts.total?Math.round(((attempts.correct??0)/attempts.total)*100):0,speakingAttempts7d:speaking.count,topicCoverage:topicCoverage.count};
  }
}
