import path from "node:path";
import { Router } from "express";
import { z } from "zod";
import type { AppConfig } from "../../config";
import type { AppDatabase } from "../../db/database";
import { normalizeEnglishTerm, WordIndex } from "./word-index";

export function createDictionaryRouter(db: AppDatabase, config: AppConfig) {
  const router = Router();
  const index = WordIndex.fromDatabase(db, path.join(config.dataDir, "dictionary", "words.txt"));

  router.get("/lookup", (request, response) => {
    const { term } = z.object({ term: z.string().min(1).max(120) }).parse(request.query);
    const normalizedTerm = normalizeEnglishTerm(term);
    const vocabulary = db.prepare("SELECT id FROM vocabulary WHERE normalized_term = ?").get(normalizedTerm) as { id: number } | undefined;
    response.json({
      term,
      normalizedTerm,
      known: index.has(normalizedTerm),
      existingVocabularyId: vocabulary?.id ?? null,
      suggestions: index.suggest(normalizedTerm),
    });
  });

  router.get("/complete", (request, response) => {
    const { prefix } = z.object({ prefix: z.string().min(1).max(120) }).parse(request.query);
    response.json({ items: index.complete(prefix) });
  });

  return router;
}
