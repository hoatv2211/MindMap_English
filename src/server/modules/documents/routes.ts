import path from "node:path";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import type { DocumentRepository } from "./repository";
import type { AgentToolService } from "../agent/tool-service";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
const allowed = new Map([[".txt", { format: "txt" as const, types: new Set(["text/plain"]) }], [".md", { format: "md" as const, types: new Set(["text/markdown", "text/plain"]) }], [".epub", { format: "epub" as const, types: new Set(["application/epub+zip"]) }]]);

export function createDocumentRouter(repository: DocumentRepository, agent: AgentToolService) {
  const router = Router();
  router.get("/", (_request, response) => response.json(repository.list()));
  router.post("/", upload.single("document"), (request, response) => {
    if (!request.file) return response.status(400).json({ error: "Document file required" });
    const extension = path.extname(request.file.originalname).toLocaleLowerCase("en-US");
    const rule = allowed.get(extension);
    if (!rule || !rule.types.has(request.file.mimetype)) return response.status(400).json({ error: "Unsupported document format" });
    const title = z.string().min(1).max(200).parse(request.body.title || path.basename(request.file.originalname, extension));
    const document = repository.create({ title, originalFilename: path.basename(request.file.originalname), format: rule.format, mimeType: request.file.mimetype, buffer: request.file.buffer });
    return document ? response.status(201).json(document) : response.status(409).json({ error: "Document already exists" });
  });
  router.get("/:id", (request, response) => {
    const document = repository.get(Number(request.params.id));
    return document ? response.json(document) : response.status(404).json({ error: "Document not found" });
  });
  router.post("/:id/highlights", (request, response) => {
    const input = z.object({ sectionId: z.number().int().positive(), selectedText: z.string().min(1).max(10000), startOffset: z.number().int().nonnegative(), endOffset: z.number().int().positive(), vocabularyId: z.number().int().positive().nullable().optional(), sentenceId: z.number().int().positive().nullable().optional() }).refine((value) => value.endOffset >= value.startOffset, { path: ["endOffset"], message: "Invalid offsets" }).parse(request.body);
    const highlight = repository.addHighlight(Number(request.params.id), input);
    return highlight ? response.status(201).json(highlight) : response.status(400).json({ error: "Selection does not match document content" });
  });
  router.post("/:id/vocabulary", (request, response) => {
    const input = z.object({ sectionId: z.number().int().positive(), selectedText: z.string().min(1).max(200), startOffset: z.number().int().nonnegative(), endOffset: z.number().int().positive(), meaningVi: z.string().max(200).default("") }).refine((value) => value.endOffset >= value.startOffset, { path: ["endOffset"], message: "Invalid offsets" }).parse(request.body);
    const result = repository.addVocabulary(Number(request.params.id), input);
    return result ? response.status(201).json(result) : response.status(400).json({ error: "Selection does not match document content" });
  });
  router.post("/:id/extraction-drafts", async (request, response, next) => {
    try {
      const { sectionIds } = z.object({ sectionIds: z.array(z.number().int().positive()).min(1).max(20) }).parse(request.body);
      const text = repository.getSectionText(Number(request.params.id), sectionIds);
      if (!text) return response.status(404).json({ error: "Document sections not found" });
      return response.status(201).json(await agent.generateDocumentExtractionDraft(Number(request.params.id), sectionIds, text));
    } catch (error) { next(error); }
  });
  return router;
}
