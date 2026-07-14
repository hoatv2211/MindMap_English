import type { AppDatabase } from "../../db/database";
import { withTransaction } from "../../db/database";
import type { ReviewGrade } from "../../../shared/contracts";
import { buildSession, type SessionCandidate } from "./session-service";
import { scheduleReview } from "./srs";

interface CandidateRow { vocabulary_id: number; status: SessionCandidate["status"]; due: number; repetitions: number; lapses: number; }

export class LearningRepository {
  constructor(private readonly db: AppDatabase, private readonly clock: () => Date = () => new Date()) {}

  createSession(duration: 10 | 20, userId?: number) {
    return withTransaction(this.db, () => {
      const now = this.clock();
      const rows = this.db.prepare(`
        SELECT v.id vocabulary_id, v.status,
          CASE WHEN datetime(r.due_at) <= datetime(?) THEN 1 ELSE 0 END due,
          r.repetitions, r.lapses
        FROM vocabulary v JOIN review_cards r ON r.vocabulary_id=v.id
        ORDER BY CASE v.status WHEN 'weak' THEN 0 WHEN 'learning' THEN 1 WHEN 'new' THEN 2 ELSE 3 END, r.due_at, v.id
      `).all(now.toISOString()) as CandidateRow[];
      const candidates: SessionCandidate[] = rows.map((row) => ({
        vocabularyId: row.vocabulary_id, status: row.status, due: Boolean(row.due),
        isNew: row.repetitions === 0 && row.status === "new", lapses: row.lapses,
      }));
      const plan = buildSession(candidates, duration);
      const sessionId = Number(this.db.prepare("INSERT INTO learning_sessions(duration_minutes,user_id) VALUES (?,?)").run(duration, userId ?? null).lastInsertRowid);
      const insert = this.db.prepare("INSERT INTO session_items(session_id,vocabulary_id,activity_type,sort_order,is_new) VALUES (?,?,?,?,?)");
      plan.forEach((item) => insert.run(sessionId, item.vocabularyId, item.activityType, item.sortOrder, item.isNew ? 1 : 0));
      return this.getSession(sessionId, userId)!;
    });
  }

  getSession(id: number, userId?: number) {
    const session = this.db.prepare(`SELECT * FROM learning_sessions WHERE id=? ${userId === undefined ? "" : "AND user_id=?"}`).get(...(userId === undefined ? [id] : [id, userId])) as Record<string, unknown> | undefined;
    if (!session) return null;
    const items = this.db.prepare(`
      SELECT si.id, si.vocabulary_id vocabularyId, si.activity_type activityType, si.sort_order sortOrder, si.is_new isNew,
        v.term, v.meaning_vi meaningVi, v.ipa, v.cefr, v.status,
        (SELECT sentence FROM examples e WHERE e.vocabulary_id=v.id ORDER BY e.id LIMIT 1) example,
        (SELECT translation_vi FROM examples e WHERE e.vocabulary_id=v.id ORDER BY e.id LIMIT 1) exampleVi
      FROM session_items si JOIN vocabulary v ON v.id=si.vocabulary_id
      WHERE si.session_id=? ORDER BY si.sort_order
    `).all(id);
    return {
      id: session.id, durationMinutes: session.duration_minutes, status: session.status,
      startedAt: session.started_at, completedAt: session.completed_at, summary: session.summary, items,
    };
  }

  recordAttempt(input: { sessionId: number; vocabularyId: number; promptType: string; answer: string; isCorrect: boolean; responseMs: number; hintsUsed: number; grade: ReviewGrade; userId?: number }) {
    return withTransaction(this.db, () => {
      const card = this.db.prepare("SELECT * FROM review_cards WHERE vocabulary_id=?").get(input.vocabularyId) as {
        stability: number; difficulty: number; interval_days: number; repetitions: number; lapses: number;
      } | undefined;
      if (!card) throw new Error("Review card not found");
      const now = this.clock();
      const schedule = scheduleReview({ stability: card.stability, difficulty: card.difficulty, intervalDays: card.interval_days, repetitions: card.repetitions, lapses: card.lapses }, input.grade, now);
      this.db.prepare(`INSERT INTO review_attempts(session_id,vocabulary_id,prompt_type,answer,is_correct,response_ms,hints_used,grade,user_id) VALUES (?,?,?,?,?,?,?,?,?)`)
        .run(input.sessionId, input.vocabularyId, input.promptType, input.answer, input.isCorrect ? 1 : 0, input.responseMs, input.hintsUsed, input.grade, input.userId ?? null);
      this.db.prepare(`UPDATE review_cards SET stability=?,difficulty=?,interval_days=?,repetitions=?,lapses=?,due_at=?,last_reviewed_at=? WHERE vocabulary_id=?`)
        .run(schedule.stability, schedule.difficulty, schedule.intervalDays, schedule.repetitions, schedule.lapses, schedule.dueAt, schedule.reviewedAt, input.vocabularyId);
      const nextStatus = input.grade === "again" ? "weak" : schedule.repetitions >= 4 ? "stable" : "learning";
      this.db.prepare("UPDATE vocabulary SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(nextStatus, input.vocabularyId);
      if (input.userId !== undefined) {
        this.db.prepare("INSERT INTO user_vocabulary_state(user_id,vocabulary_id,status) VALUES (?,?,?) ON CONFLICT(user_id,vocabulary_id) DO UPDATE SET status=excluded.status,updated_at=CURRENT_TIMESTAMP").run(input.userId,input.vocabularyId,nextStatus);
        this.db.prepare("UPDATE users SET profile_revision=profile_revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(input.userId);
      }
      return schedule;
    });
  }

  completeSession(id: number) {
    const stats = this.db.prepare(`SELECT COUNT(*) total, SUM(is_correct) correct FROM review_attempts WHERE session_id=?`).get(id) as { total: number; correct: number | null };
    const summary = stats.total ? `${stats.correct ?? 0}/${stats.total} câu đúng` : "Đã hoàn thành buổi học";
    const result = this.db.prepare("UPDATE learning_sessions SET status='completed',completed_at=?,summary=? WHERE id=? AND status='active'").run(this.clock().toISOString(), summary, id);
    if (!result.changes) return null;
    this.updateProgressStreak();
    return this.getSession(id);
  }

  private updateProgressStreak() {
    const today = this.clock().toISOString().slice(0, 10);
    const progress = this.db.prepare("SELECT streak,last_study_date FROM user_progress WHERE id=1").get() as { streak: number; last_study_date: string | null };
    if (progress.last_study_date === today) return;
    const yesterday = new Date(this.clock().getTime() - 86_400_000).toISOString().slice(0, 10);
    const streak = progress.last_study_date === yesterday ? progress.streak + 1 : 1;
    this.db.prepare("UPDATE user_progress SET streak=?,last_study_date=?,xp=xp+20,updated_at=CURRENT_TIMESTAMP WHERE id=1").run(streak, today);
  }

  getDashboard(aiOnline = false) {
    const counts = this.db.prepare(`SELECT
      SUM(CASE WHEN datetime(r.due_at)<=datetime('now') THEN 1 ELSE 0 END) dueCount,
      SUM(CASE WHEN v.status='new' THEN 1 ELSE 0 END) newCount,
      SUM(CASE WHEN v.status='weak' THEN 1 ELSE 0 END) weakCount,
      SUM(CASE WHEN v.status='stable' THEN 1 ELSE 0 END) stableCount
      FROM vocabulary v JOIN review_cards r ON r.vocabulary_id=v.id`).get() as Record<string, number | null>;
    const progress = this.db.prepare("SELECT * FROM user_progress WHERE id=1").get() as Record<string, number>;
    const weekly = this.db.prepare("SELECT COALESCE(SUM(duration_minutes),0) minutes FROM learning_sessions WHERE status='completed' AND datetime(completed_at)>=datetime('now','-7 days')").get() as { minutes: number };
    const unfinished = this.db.prepare("SELECT id FROM learning_sessions WHERE status='active' ORDER BY id DESC LIMIT 1").get() as { id: number } | undefined;
    return {
      dueCount: counts.dueCount ?? 0, newCount: counts.newCount ?? 0, weakCount: counts.weakCount ?? 0, stableCount: counts.stableCount ?? 0,
      streak: progress.streak ?? 0, weeklyMinutes: weekly.minutes, weeklyGoalMinutes: progress.weekly_goal_minutes ?? 100,
      aiOnline, unfinishedSessionId: unfinished?.id ?? null,
    };
  }

  getProgress() {
    const dashboard = this.getDashboard(false);
    const attempts = this.db.prepare(`SELECT COUNT(*) total, SUM(is_correct) correct FROM review_attempts WHERE datetime(created_at)>=datetime('now','-30 days')`).get() as { total: number; correct: number | null };
    const speaking = this.db.prepare("SELECT COUNT(*) count FROM speech_attempts WHERE datetime(created_at)>=datetime('now','-7 days')").get() as { count: number };
    const topicCoverage = this.db.prepare(`SELECT COUNT(DISTINCT m.topic_id) count FROM session_items si JOIN mindmap_nodes n ON n.vocabulary_id=si.vocabulary_id JOIN mindmaps m ON m.id=n.mindmap_id`).get() as { count: number };
    return { ...dashboard, accuracy30d: attempts.total ? Math.round(((attempts.correct ?? 0) / attempts.total) * 100) : 0, speakingAttempts7d: speaking.count, topicCoverage: topicCoverage.count };
  }
}
