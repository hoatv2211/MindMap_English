import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { AppConfig } from "../../config";
import type { AppDatabase } from "../../db/database";
import { withTransaction } from "../../db/database";
import { parseDocument, parseEpub } from "./parser";

export class DocumentRepository {
  constructor(private readonly db: AppDatabase, private readonly config: AppConfig) {}

  create(input: { title: string; originalFilename: string; format: "txt" | "md" | "epub"; mimeType: string; buffer: Buffer }, userId?: number) {
    const contentChecksum = createHash("sha256").update(input.buffer).digest("hex");
    const checksum = userId === undefined ? contentChecksum : createHash("sha256").update(`${userId}:${contentChecksum}`).digest("hex");
    if (this.db.prepare(`SELECT id FROM document_sources WHERE checksum=? ${userId === undefined ? "" : "AND user_id=?"}`).get(...(userId === undefined ? [checksum] : [checksum, userId]))) return null;
    const sections = input.format === "epub" ? parseEpub(input.buffer) : parseDocument(input.format, input.buffer.toString("utf8"));
    const relativePath = path.join("documents", checksum, `source.${input.format}`);
    const absolutePath = path.join(this.config.dataDir, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, input.buffer, { flag: "wx" });
    try {
      return withTransaction(this.db, () => {
        const id = Number(this.db.prepare(`INSERT INTO document_sources(title,original_filename,storage_path,format,mime_type,checksum,size_bytes,user_id)
          VALUES (?,?,?,?,?,?,?,?)`).run(input.title, input.originalFilename, relativePath, input.format, input.mimeType, checksum, input.buffer.length, userId ?? null).lastInsertRowid);
        const insertSection = this.db.prepare("INSERT INTO document_sections(document_id,heading,content,sort_order,fingerprint) VALUES (?,?,?,?,?)");
        sections.forEach((section) => insertSection.run(id, section.heading, section.content, section.sortOrder, section.fingerprint));
        return this.get(id, userId);
      });
    } catch (error) {
      fs.rmSync(path.dirname(absolutePath), { recursive: true, force: true });
      throw error;
    }
  }

  list(userId?: number) {
    return this.db.prepare(`SELECT d.id,d.title,d.original_filename originalFilename,d.format,d.mime_type mimeType,d.checksum,d.size_bytes sizeBytes,
      COUNT(s.id) sectionCount,d.created_at createdAt FROM document_sources d LEFT JOIN document_sections s ON s.document_id=d.id
      WHERE ${userId === undefined ? "1=1" : "d.user_id=?"} GROUP BY d.id ORDER BY d.updated_at DESC,d.id DESC`).all(...(userId === undefined ? [] : [userId]));
  }

  get(id: number, userId?: number) {
    const document = this.db.prepare(`SELECT id,title,original_filename originalFilename,storage_path storagePath,format,mime_type mimeType,checksum,size_bytes sizeBytes,created_at createdAt
      FROM document_sources WHERE id=? ${userId === undefined ? "" : "AND user_id=?"}`).get(...(userId === undefined ? [id] : [id, userId])) as Record<string, unknown> | undefined;
    if (!document) return null;
    const sections = this.db.prepare(`SELECT id,document_id documentId,heading,content,sort_order sortOrder,fingerprint FROM document_sections WHERE document_id=? ORDER BY sort_order`).all(id);
    return { ...document, sectionCount: sections.length, sections };
  }

  addHighlight(documentId: number, input: { sectionId: number; selectedText: string; startOffset: number; endOffset: number; vocabularyId?: number | null; sentenceId?: number | null }, userId?: number) {
    if (!this.get(documentId, userId)) return null;
    const section = this.db.prepare("SELECT id,content,fingerprint FROM document_sections WHERE id=? AND document_id=?").get(input.sectionId, documentId) as { id: number; content: string; fingerprint: string } | undefined;
    if (!section || section.content.slice(input.startOffset, input.endOffset) !== input.selectedText) return null;
    if (input.vocabularyId && !this.db.prepare("SELECT id FROM vocabulary WHERE id=?").get(input.vocabularyId)) return null;
    if (input.sentenceId && !(userId === undefined ? this.db.prepare("SELECT id FROM sentence_notebook WHERE id=?").get(input.sentenceId) : this.db.prepare("SELECT id FROM sentence_notebook WHERE id=? AND user_id=?").get(input.sentenceId,userId))) return null;
    const textFingerprint = createHash("sha256").update(`${section.fingerprint}:${input.startOffset}:${input.endOffset}:${input.selectedText}`).digest("hex");
    const id = Number(this.db.prepare(`INSERT INTO document_highlights(document_id,section_id,vocabulary_id,sentence_id,selected_text,start_offset,end_offset,source_type,text_fingerprint,user_id)
      VALUES (?,?,?,?,?,?,?,'quoted',?,?)`).run(documentId, section.id, input.vocabularyId ?? null, input.sentenceId ?? null, input.selectedText, input.startOffset, input.endOffset, textFingerprint, userId ?? null).lastInsertRowid);
    return this.db.prepare(`SELECT id,document_id documentId,section_id sectionId,vocabulary_id vocabularyId,sentence_id sentenceId,selected_text selectedText,
      start_offset startOffset,end_offset endOffset,source_type sourceType,text_fingerprint textFingerprint FROM document_highlights WHERE id=?`).get(id);
  }

  addVocabulary(documentId: number, input: { sectionId: number; selectedText: string; startOffset: number; endOffset: number; meaningVi: string }, userId?: number) {
    if (!this.get(documentId, userId)) return null;
    const section = this.db.prepare("SELECT content FROM document_sections WHERE id=? AND document_id=?").get(input.sectionId, documentId) as { content: string } | undefined;
    if (!section || section.content.slice(input.startOffset, input.endOffset) !== input.selectedText) return null;
    const term = input.selectedText.trim();
    const normalizedTerm = term.toLocaleLowerCase("en-US").normalize("NFKC");
    return withTransaction(this.db, () => {
      this.db.prepare(`INSERT OR IGNORE INTO vocabulary(term,normalized_term,meaning_vi,ipa,part_of_speech,cefr) VALUES (?,?,?,?,?,?)`)
        .run(term, normalizedTerm, input.meaningVi.trim(), "", term.includes(" ") ? "phrase" : "word", "B1");
      const vocabulary = this.db.prepare(`SELECT id,term,normalized_term normalizedTerm,ipa,part_of_speech partOfSpeech,meaning_vi meaningVi,cefr,status,image_url imageUrl,audio_url audioUrl FROM vocabulary WHERE normalized_term=?`).get(normalizedTerm) as { id: number } & Record<string, unknown>;
      if (input.meaningVi.trim()) this.db.prepare("UPDATE vocabulary SET meaning_vi=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(input.meaningVi.trim(), vocabulary.id);
      this.db.prepare("INSERT OR IGNORE INTO review_cards(vocabulary_id) VALUES (?)").run(vocabulary.id);
      if (userId !== undefined) this.db.prepare("INSERT OR IGNORE INTO user_vocabulary_state(user_id,vocabulary_id,status) VALUES (?,?,'new')").run(userId,vocabulary.id);
      const highlight = this.addHighlight(documentId, { ...input, vocabularyId: vocabulary.id }, userId);
      return { vocabulary: this.db.prepare(`SELECT id,term,normalized_term normalizedTerm,ipa,part_of_speech partOfSpeech,meaning_vi meaningVi,cefr,status,image_url imageUrl,audio_url audioUrl FROM vocabulary WHERE id=?`).get(vocabulary.id), highlight };
    });
  }

  getSectionText(documentId: number, sectionIds: number[], userId?: number): string | null {
    if (!this.get(documentId, userId)) return null;
    if (!sectionIds.length) return null;
    const placeholders = sectionIds.map(() => "?").join(",");
    const sections = this.db.prepare(`SELECT heading,content FROM document_sections WHERE document_id=? AND id IN (${placeholders}) ORDER BY sort_order`).all(documentId, ...sectionIds) as Array<{ heading: string; content: string }>;
    if (sections.length !== sectionIds.length) return null;
    return sections.map((section) => `${section.heading ? `${section.heading}\n` : ""}${section.content}`).join("\n\n");
  }
}
