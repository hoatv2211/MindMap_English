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

  listNotebook() {
    return this.db.prepare(`SELECT id, vocabulary_id vocabularyId, example_id exampleId, sentence, translation_vi translationVi,
      source_type sourceType, source_reference sourceReference, fingerprint, created_at createdAt, updated_at updatedAt
      FROM sentence_notebook ORDER BY created_at DESC, id DESC`).all();
  }

  addSentence(input: { sentence: string; translationVi?: string; sourceType: "quoted" | "user" | "ai"; sourceReference?: string; vocabularyId?: number | null; exampleId?: number | null }) {
    const fingerprint = fingerprintSentence(input.sentence);
    const existing = this.db.prepare("SELECT id FROM sentence_notebook WHERE fingerprint = ?").get(fingerprint);
    if (existing) return null;
    const id = Number(this.db.prepare(`INSERT INTO sentence_notebook(vocabulary_id,example_id,sentence,translation_vi,source_type,source_reference,fingerprint)
      VALUES (?,?,?,?,?,?,?)`).run(input.vocabularyId ?? null, input.exampleId ?? null, input.sentence.trim(), input.translationVi ?? "", input.sourceType, input.sourceReference ?? "", fingerprint).lastInsertRowid);
    return this.db.prepare(`SELECT id, vocabulary_id vocabularyId, example_id exampleId, sentence, translation_vi translationVi,
      source_type sourceType, source_reference sourceReference, fingerprint, created_at createdAt, updated_at updatedAt
      FROM sentence_notebook WHERE id = ?`).get(id);
  }

  createSession(sentenceIds: number[]) {
    return withTransaction(this.db, () => {
      const sessionId = Number(this.db.prepare("INSERT INTO speaking_sessions(status) VALUES ('active')").run().lastInsertRowid);
      const insert = this.db.prepare("INSERT INTO speaking_session_items(session_id,sentence_id,sort_order) VALUES (?,?,?)");
      sentenceIds.forEach((sentenceId, index) => insert.run(sessionId, sentenceId, index));
      return this.getSession(sessionId);
    });
  }

  getSession(id: number) {
    const session = this.db.prepare(`SELECT id,status,started_at startedAt,completed_at completedAt,total_duration_seconds totalDurationSeconds FROM speaking_sessions WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
    if (!session) return null;
    const items = this.db.prepare(`SELECT i.id,i.sentence_id sentenceId,i.sort_order sortOrder,i.completed_at completedAt,n.sentence,n.translation_vi translationVi
      FROM speaking_session_items i JOIN sentence_notebook n ON n.id=i.sentence_id WHERE i.session_id=? ORDER BY i.sort_order`).all(id);
    return { ...session, items };
  }

  addAttempt(sessionId: number, input: { sentenceId: number; transcript: string; durationMs: number }) {
    return withTransaction(this.db, () => {
      const sentence = this.db.prepare("SELECT sentence FROM sentence_notebook WHERE id = ?").get(input.sentenceId) as { sentence: string } | undefined;
      if (!sentence) return null;
      const item = this.db.prepare("SELECT id FROM speaking_session_items WHERE session_id = ? AND sentence_id = ?").get(sessionId, input.sentenceId) as { id: number } | undefined;
      if (!item) return null;
      const comparison = compareTranscript(sentence.sentence, input.transcript);
      const id = Number(this.db.prepare(`INSERT INTO speaking_attempts(session_id,session_item_id,sentence_id,target_text,transcript,diff_json,content_score,duration_ms)
        VALUES (?,?,?,?,?,?,?,?)`).run(sessionId, item.id, input.sentenceId, sentence.sentence, input.transcript.trim(), JSON.stringify(comparison.tokens), comparison.score, input.durationMs).lastInsertRowid);
      this.db.prepare("UPDATE speaking_sessions SET total_duration_seconds=total_duration_seconds+? WHERE id=?").run(Math.floor(input.durationMs / 1000), sessionId);
      this.db.prepare("UPDATE speaking_session_items SET completed_at=COALESCE(completed_at,CURRENT_TIMESTAMP) WHERE id=?").run(item.id);
      const row = this.db.prepare(`SELECT id,session_id sessionId,sentence_id sentenceId,target_text targetText,transcript,diff_json diffJson,
        content_score contentScore,duration_ms durationMs,created_at createdAt FROM speaking_attempts WHERE id=?`).get(id) as Record<string, unknown> & { diffJson: string };
      const { diffJson, ...attempt } = row;
      return { ...attempt, diff: JSON.parse(diffJson) };
    });
  }

  completeSession(id: number) {
    this.db.prepare("UPDATE speaking_sessions SET status='completed',completed_at=CURRENT_TIMESTAMP WHERE id=? AND status='active'").run(id);
    return this.getSession(id);
  }

  metrics() {
    return this.db.prepare(`SELECT COUNT(*) attempts7d, COALESCE(SUM(duration_ms)/1000,0) speakingSeconds7d
      FROM speaking_attempts WHERE created_at >= datetime('now','-7 days')`).get();
  }
}
