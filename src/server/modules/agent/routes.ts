import { Router } from "express";
import { z } from "zod";
import type { AgentToolService } from "./tool-service";
import { GeneratedMindmapSchema } from "./tool-service";

export function createAgentRouter(service: AgentToolService) {
  const router = Router();
  router.post("/chat", async (request, response, next) => {
    try { response.json(await service.tutor(z.object({ message: z.string().min(1).max(2000) }).parse(request.body).message)); } catch (error) { next(error); }
  });
  router.post("/mindmap-drafts", async (request, response, next) => {
    try { response.status(201).json(await service.generateMindmapDraft(request.body)); } catch (error) { next(error); }
  });
  router.post("/mindmap-drafts/save", (request, response) => {
    const input = z.object({ topicId: z.number().int().positive(), draft: GeneratedMindmapSchema }).parse(request.body);
    response.status(201).json(service.saveGeneratedDraft(input.topicId, input.draft));
  });
  return router;
}
