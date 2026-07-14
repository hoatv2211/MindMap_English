import { createHash } from "node:crypto";
import type { AppDatabase } from "../../db/database";
import { withTransaction } from "../../db/database";
import { compareTranscript } from "./diff";

function fingerprintSentence(sentence: string): string {
  const normalized = sentence.normalize("NFKC").toLocaleLowerCase("en-US").replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();
  return createHash("sha256").update(normalized).digest("hex");
}

export class SpeakingRepository {
  constructor(private readonly db: AppDatabase) {}

  listNotebook(userId?: number) {
    return this.db.prepare(`SELECT id, vocabulary_id vocabularyId, example_id exampleId, sentence, translation_vi translationVi,
      source_type sourceType, source_reference sourceReference, fingerprint, created_at createdAt, updated_at updatedAt
      FROM sentence_notebook ${userId === undefined ? "" : "WHERE user_id=?"} ORDER BY created_at DESC, id DESC`).all(...(userId === undefined ? [] : [userId]));
  }

  addSentence(input: { sentence: string; translationVi?: string; sourceType: "quoted" | "user" | "ai"; sourceReference?: string; vocabularyId?: number | null; exampleId?: number | null }, userId?: number) {
    const fingerprint = fingerprintSentence(userId === undefined ? input.sentence : `${userId}:${input.sentence}`);
    const existing = this.db.prepare(`SELECT id FROM sentence_notebook WHERE fingerprint = ? ${userId === undefined ? "" : "AND user_id=?"}`).get(...(userId === undefined ? [fingerprint] : [fingerprint, userId]));
    if (existing) return null;
    const id = Number(this.db.prepare(`INSERT INTO sentence_notebook(vocabulary_id,example_id,sentence,translation_vi,source_type,source_reference,fingerprint,user_id)
      VALUES (?,?,?,?,?,?,?,?)`).run(input.vocabularyId ?? null, input.exampleId ?? null, input.sentence.trim(), input.translationVi ?? "", input.sourceType, input.sourceReference ?? "", fingerprint, userId ?? null).lastInsertRowid);
    return this.db.prepare(`SELECT id, vocabulary_id vocabularyId, example_id exampleId, sentence, translation_vi translationVi,
      source_type sourceType, source_reference sourceReference, fingerprint, created_at createdAt, updated_at updatedAt
      FROM sentence_notebook WHERE id = ?`).get(id);
  }

  createSession(sentenceIds: number[], userId?: number) {
    if (userId !== undefined) {
      const placeholders=sentenceIds.map(()=>"?").join(",");
      const owned=(this.db.prepare(`SELECT COUNT(*) count FROM sentence_notebook WHERE user_id=? AND id IN (${placeholders})`).get(userId,...sentenceIds) as {count:number}).count;
      if (owned !== sentenceIds.length) return null;
    }
    return withTransaction(this.db, () => {
      const sessionId = Number(this.db.prepare("INSERT INTO speaking_sessions(status,user_id) VALUES ('active',?)").run(userId ?? null).lastInsertRowid);
      const insert = this.db.prepare("INSERT INTO speaking_session_items(session_id,sentence_id,sort_order) VALUES (?,?,?)");
      sentenceIds.forEach((sentenceId, index) => insert.run(sessionId, sentenceId, index));
      return this.getSession(sessionId, userId);
    });
  }

  getSession(id: number, userId?: number) {
    const session = this.db.prepare(`SELECT id,status,started_at startedAt,completed_at completedAt,total_duration_seconds totalDurationSeconds FROM speaking_sessions WHERE id = ? ${userId === undefined ? "" : "AND user_id=?"}`).get(...(userId === undefined ? [id] : [id, userId])) as Record<string, unknown> | undefined;
    if (!session) return null;
    const items = this.db.prepare(`SELECT i.id,i.sentence_id sentenceId,i.sort_order sortOrder,i.completed_at completedAt,n.sentence,n.translation_vi translationVi
      FROM speaking_session_items i JOIN sentence_notebook n ON n.id=i.sentence_id WHERE i.session_id=? ORDER BY i.sort_order`).all(id);
    return { ...session, items };
  }

  addAttempt(sessionId: number, input: { sentenceId: number; transcript: string; durationMs: number }, userId?: number) {
    return withTransaction(this.db, () => {
      if (!this.getSession(sessionId, userId)) return null;
      const sentence = this.db.prepare("SELECT sentence FROM sentence_notebook WHERE id = ?").get(input.sentenceId) as { sentence: string } | undefined;
      if (!sentence) return null;
      const item = this.db.prepare("SELECT id FROM speaking_session_items WHERE session_id = ? AND sentence_id = ?").get(sessionId, input.sentenceId) as { id: number } | undefined;
      if (!item) return null;
      const comparison = compareTranscript(sentence.sentence, input.transcript);
      const id = Number(this.db.prepare(`INSERT INTO speaking_attempts(session_id,session_item_id,sentence_id,target_text,transcript,diff_json,content_score,duration_ms,user_id)
        VALUES (?,?,?,?,?,?,?,?,?)`).run(sessionId, item.id, input.sentenceId, sentence.sentence, input.transcript.trim(), JSON.stringify(comparison.tokens), comparison.score, input.durationMs, userId ?? null).lastInsertRowid);
      this.db.prepare("UPDATE speaking_sessions SET total_duration_seconds=total_duration_seconds+? WHERE id=?").run(Math.floor(input.durationMs / 1000), sessionId);
      this.db.prepare("UPDATE speaking_session_items SET completed_at=COALESCE(completed_at,CURRENT_TIMESTAMP) WHERE id=?").run(item.id);
      const row = this.db.prepare(`SELECT id,session_id sessionId,sentence_id sentenceId,target_text targetText,transcript,diff_json diffJson,
        content_score contentScore,duration_ms durationMs,created_at createdAt FROM speaking_attempts WHERE id=?`).get(id) as Record<string, unknown> & { diffJson: string };
      const { diffJson, ...attempt } = row;
      return { ...attempt, diff: JSON.parse(diffJson) };
    });
  }

  completeSession(id: number, userId?: number) {
    this.db.prepare(`UPDATE speaking_sessions SET status='completed',completed_at=CURRENT_TIMESTAMP WHERE id=? AND status='active' ${userId === undefined ? "" : "AND user_id=?"}`).run(...(userId === undefined ? [id] : [id, userId]));
    return this.getSession(id, userId);
  }

  metrics(userId?: number) {
    return this.db.prepare(`SELECT COUNT(*) attempts7d, COALESCE(SUM(duration_ms)/1000,0) speakingSeconds7d
      FROM speaking_attempts WHERE created_at >= datetime('now','-7 days') ${userId === undefined ? "" : "AND user_id=?"}`).get(...(userId === undefined ? [] : [userId]));
  }
}
