import { Router } from "express";
import { z } from "zod";
import type { LearningRepository } from "../modules/learning/repository";
import type { AuthenticatedRequest } from "../modules/auth/middleware";

const AttemptSchema = z.object({
  vocabularyId: z.number().int().positive(), promptType: z.string().min(1), answer: z.string().default(""),
  isCorrect: z.boolean(), responseMs: z.number().int().nonnegative().default(0), hintsUsed: z.number().int().nonnegative().default(0),
  grade: z.enum(["again", "hard", "good", "easy"]),
});

export function createLearningRouter(repository: LearningRepository) {
  const router = Router();
  router.post("/sessions", (request, response) => {
    const duration = request.body.duration === 10 ? 10 : 20;
    response.status(201).json(repository.createSession(duration, (request as AuthenticatedRequest).auth?.id));
  });
  router.get("/sessions/:id", (request, response) => {
    const session = repository.getSession(Number(request.params.id), (request as AuthenticatedRequest).auth?.id);
    if (!session) return response.status(404).json({ error: "Session not found" });
    return response.json(session);
  });
  router.post("/sessions/:id/attempts", (request, response) => {
    const input = AttemptSchema.parse(request.body);
    const schedule = repository.recordAttempt({ ...input, sessionId: Number(request.params.id), userId: (request as AuthenticatedRequest).auth?.id });
    response.status(201).json(schedule);
  });
  router.post("/sessions/:id/complete", (request, response) => {
    const session = repository.completeSession(Number(request.params.id), (request as AuthenticatedRequest).auth?.id);
    if (!session) return response.status(409).json({ error: "Session cannot be completed" });
    return response.json(session);
  });
  router.get("/dashboard", (request, response) => response.json(repository.getDashboard(false, (request as AuthenticatedRequest).auth?.id)));
  router.get("/progress", (request, response) => response.json(repository.getProgress((request as AuthenticatedRequest).auth?.id)));
  return router;
}
