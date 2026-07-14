import { Router } from "express";
import { z } from "zod";
import type { LearningRepository } from "../modules/learning/repository";

const AttemptSchema = z.object({
  vocabularyId: z.number().int().positive(), promptType: z.string().min(1), answer: z.string().default(""),
  isCorrect: z.boolean(), responseMs: z.number().int().nonnegative().default(0), hintsUsed: z.number().int().nonnegative().default(0),
  grade: z.enum(["again", "hard", "good", "easy"]),
});

export function createLearningRouter(repository: LearningRepository) {
  const router = Router();
  router.post("/sessions", (request, response) => {
    const duration = request.body.duration === 10 ? 10 : 20;
    response.status(201).json(repository.createSession(duration));
  });
  router.get("/sessions/:id", (request, response) => {
    const session = repository.getSession(Number(request.params.id));
    if (!session) return response.status(404).json({ error: "Session not found" });
    return response.json(session);
  });
  router.post("/sessions/:id/attempts", (request, response) => {
    const input = AttemptSchema.parse(request.body);
    const schedule = repository.recordAttempt({ ...input, sessionId: Number(request.params.id) });
    response.status(201).json(schedule);
  });
  router.post("/sessions/:id/complete", (request, response) => {
    const session = repository.completeSession(Number(request.params.id));
    if (!session) return response.status(409).json({ error: "Session cannot be completed" });
    return response.json(session);
  });
  router.get("/dashboard", (_request, response) => response.json(repository.getDashboard(false)));
  router.get("/progress", (_request, response) => response.json(repository.getProgress()));
  return router;
}
