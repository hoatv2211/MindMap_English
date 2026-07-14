import { Router } from "express";
import { z } from "zod";
import type { SpeakingRepository } from "./repository";
import type { AuthenticatedRequest } from "../auth/middleware";

export function createSpeakingRouter(repository: SpeakingRepository) {
  const router = Router();
  router.get("/notebook", (request, response) => response.json(repository.listNotebook((request as AuthenticatedRequest).auth?.id)));
  router.post("/notebook", (request, response) => {
    const input = z.object({
      sentence: z.string().min(1).max(1000), translationVi: z.string().max(1000).optional(),
      sourceType: z.enum(["quoted", "user", "ai"]), sourceReference: z.string().max(500).optional(),
      vocabularyId: z.number().int().positive().nullable().optional(), exampleId: z.number().int().positive().nullable().optional(),
    }).parse(request.body);
    const sentence = repository.addSentence(input, (request as AuthenticatedRequest).auth?.id);
    if (!sentence) return response.status(409).json({ error: "Sentence already exists" });
    return response.status(201).json(sentence);
  });
  router.post("/sessions", (request, response) => {
    const { sentenceIds } = z.object({ sentenceIds: z.array(z.number().int().positive()).min(1).max(50) }).parse(request.body);
    return response.status(201).json(repository.createSession(sentenceIds, (request as AuthenticatedRequest).auth?.id));
  });
  router.get("/sessions/:id", (request, response) => {
    const session = repository.getSession(Number(request.params.id), (request as AuthenticatedRequest).auth?.id);
    return session ? response.json(session) : response.status(404).json({ error: "Speaking session not found" });
  });
  router.post("/sessions/:id/attempts", (request, response) => {
    const input = z.object({ sentenceId: z.number().int().positive(), transcript: z.string().max(2000), durationMs: z.number().int().nonnegative().max(600000) }).parse(request.body);
    const attempt = repository.addAttempt(Number(request.params.id), input, (request as AuthenticatedRequest).auth?.id);
    return attempt ? response.status(201).json(attempt) : response.status(404).json({ error: "Sentence or session item not found" });
  });
  router.post("/sessions/:id/complete", (request, response) => {
    const session = repository.completeSession(Number(request.params.id), (request as AuthenticatedRequest).auth?.id);
    return session ? response.json(session) : response.status(404).json({ error: "Speaking session not found" });
  });
  router.get("/metrics", (request, response) => response.json(repository.metrics((request as AuthenticatedRequest).auth?.id)));
  return router;
}
