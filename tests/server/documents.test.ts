import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { AppDatabase } from "../../src/server/db/database";
import { createDatabase } from "../../src/server/db/database";
import { migrate } from "../../src/server/db/migrate";
import { createApp } from "../../src/server/app";
import { loadConfig } from "../../src/server/config";
import { parseDocument } from "../../src/server/modules/documents/parser";
import { parseEpub } from "../../src/server/modules/documents/parser";
import AdmZip from "adm-zip";

let db: AppDatabase;
let dataDir: string;

beforeEach(() => {
  db = createDatabase(":memory:");
  migrate(db);
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "mindmap-documents-"));
});

afterEach(() => { db.close(); fs.rmSync(dataDir, { recursive: true, force: true }); });

describe("parseDocument", () => {
  it("creates one section for text and ordered sections for markdown", () => {
    expect(parseDocument("txt", "First paragraph\n\nSecond paragraph")).toHaveLength(1);
    const sections = parseDocument("md", "# Opening\nHello\n## Details\nMore text");
    expect(sections.map((section) => section.heading)).toEqual(["Opening", "Details"]);
    expect(sections[1].content).toContain("More text");
  });

  it("extracts EPUB chapters in spine order and rejects unsafe entries", () => {
    const zip = new AdmZip();
    zip.addFile("META-INF/container.xml", Buffer.from(`<container><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>`));
    zip.addFile("OEBPS/content.opf", Buffer.from(`<package><manifest><item id="one" href="one.xhtml" media-type="application/xhtml+xml"/><item id="two" href="two.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="two"/><itemref idref="one"/></spine></package>`));
    zip.addFile("OEBPS/one.xhtml", Buffer.from(`<html><body><h1>One</h1><p>First chapter.</p></body></html>`));
    zip.addFile("OEBPS/two.xhtml", Buffer.from(`<html><body><h1>Two</h1><p>Second chapter.</p></body></html>`));
    expect(parseEpub(zip.toBuffer()).map((section) => section.heading)).toEqual(["Two", "One"]);

    const unsafe = new AdmZip();
    unsafe.addFile("META-INF/container.xml", Buffer.from(`<container><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>`));
    unsafe.addFile("OEBPS/content.opf", Buffer.from(`<package><manifest><item id="bad" href="../../outside.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="bad"/></spine></package>`));
    expect(() => parseEpub(unsafe.toBuffer())).toThrow(/unsafe/i);
  });
});

describe("documents API", () => {
  const app = () => createApp({
    db,
    config: loadConfig({ DATA_DIR: dataDir }),
    nineRouter: { health: vi.fn(async () => false) } as never,
  });

  it("uploads, lists, reads, and deduplicates a text document", async () => {
    const first = await request(app()).post("/api/documents").field("title", "My Notes").attach("document", Buffer.from("Useful phrase here."), { filename: "notes.txt", contentType: "text/plain" }).expect(201);
    expect(first.body).toMatchObject({ title: "My Notes", format: "txt", sectionCount: 1 });
    await request(app()).post("/api/documents").attach("document", Buffer.from("Useful phrase here."), { filename: "copy.txt", contentType: "text/plain" }).expect(409);
    const list = await request(app()).get("/api/documents").expect(200);
    expect(list.body).toHaveLength(1);
    const detail = await request(app()).get(`/api/documents/${first.body.id}`).expect(200);
    expect(detail.body.sections[0].content).toBe("Useful phrase here.");
    expect(fs.existsSync(path.join(dataDir, detail.body.storagePath))).toBe(true);
  });

  it("stores highlight provenance and validates offsets", async () => {
    const document = await request(app()).post("/api/documents").attach("document", Buffer.from("Useful phrase here."), { filename: "notes.md", contentType: "text/markdown" }).expect(201);
    const detail = await request(app()).get(`/api/documents/${document.body.id}`).expect(200);
    const highlight = await request(app()).post(`/api/documents/${document.body.id}/highlights`).send({ sectionId: detail.body.sections[0].id, selectedText: "Useful phrase", startOffset: 0, endOffset: 13 }).expect(201);
    expect(highlight.body).toMatchObject({ sourceType: "quoted", textFingerprint: expect.any(String) });
    await request(app()).post(`/api/documents/${document.body.id}/highlights`).send({ sectionId: detail.body.sections[0].id, selectedText: "wrong", startOffset: 0, endOffset: 5 }).expect(400);
  });

  it("rejects unsupported files", async () => {
    await request(app()).post("/api/documents").attach("document", Buffer.from("binary"), { filename: "payload.exe", contentType: "application/octet-stream" }).expect(400);
  });

  it("creates a validated AI extraction draft without canonical writes", async () => {
    const chatJson = vi.fn(async () => ({ vocabulary: [{ term: "useful phrase", meaningVi: "cụm hữu ích", category: "recommended", reason: "Common in conversation" }], sentences: [{ sentence: "Useful phrase here.", category: "recommended", reason: "Short daily example" }] }));
    const configuredApp = createApp({ db, config: loadConfig({ DATA_DIR: dataDir, NINEROUTER_CHAT_MODEL: "test" }), nineRouter: { health: vi.fn(async () => true), chatJson } as never });
    const document = await request(configuredApp).post("/api/documents").attach("document", Buffer.from("Useful phrase here."), { filename: "notes.txt", contentType: "text/plain" }).expect(201);
    const detail = await request(configuredApp).get(`/api/documents/${document.body.id}`).expect(200);
    const draft = await request(configuredApp).post(`/api/documents/${document.body.id}/extraction-drafts`).send({ sectionIds: [detail.body.sections[0].id] }).expect(201);
    expect(draft.body.draft.vocabulary[0]).toMatchObject({ category: "recommended", reason: expect.any(String) });
    expect((db.prepare("SELECT COUNT(*) count FROM vocabulary").get() as { count: number }).count).toBe(0);
  });

  it("creates canonical vocabulary and links document provenance", async () => {
    const app = createApp({ db, config: loadConfig({ DATA_DIR: dataDir }) });
    const document = await request(app).post("/api/documents").attach("document", Buffer.from("Useful phrase here."), { filename: "notes.txt", contentType: "text/plain" }).expect(201);
    const detail = await request(app).get(`/api/documents/${document.body.id}`).expect(200);
    const sectionId = detail.body.sections[0].id;

    const created = await request(app).post(`/api/documents/${document.body.id}/vocabulary`).send({
      sectionId,
      selectedText: "Useful phrase",
      startOffset: 0,
      endOffset: 13,
      meaningVi: "cụm hữu ích",
    }).expect(201);

    expect(created.body.vocabulary).toMatchObject({ term: "Useful phrase", meaningVi: "cụm hữu ích" });
    expect(created.body.highlight).toMatchObject({ sectionId, vocabularyId: created.body.vocabulary.id, selectedText: "Useful phrase" });
    expect((db.prepare("SELECT COUNT(*) count FROM review_cards WHERE vocabulary_id=?").get(created.body.vocabulary.id) as { count: number }).count).toBe(1);
  });

  it("links a notebook sentence when saving a highlight", async () => {
    const app = createApp({ db, config: loadConfig({ DATA_DIR: dataDir }) });
    const document = await request(app).post("/api/documents").attach("document", Buffer.from("Useful phrase here."), { filename: "notes.txt", contentType: "text/plain" }).expect(201);
    const detail = await request(app).get(`/api/documents/${document.body.id}`).expect(200);
    const notebook = await request(app).post("/api/speaking/notebook").send({ sentence: "Useful phrase", sourceType: "quoted", sourceReference: `document:${document.body.id}:section:${detail.body.sections[0].id}` }).expect(201);
    const highlight = await request(app).post(`/api/documents/${document.body.id}/highlights`).send({ sectionId: detail.body.sections[0].id, selectedText: "Useful phrase", startOffset: 0, endOffset: 13, sentenceId: notebook.body.id }).expect(201);
    expect(highlight.body.sentenceId).toBe(notebook.body.id);
  });
});
