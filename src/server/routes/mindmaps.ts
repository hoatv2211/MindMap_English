import { Router } from "express";
import type { ContentRepository } from "../modules/content/repository";
import { SaveDraftSchema, UpdateNodeSchema } from "../modules/content/repository";
import type { VocabularyImageService } from "../modules/content/image-service";
import type { AuthenticatedRequest } from "../modules/auth/middleware";

export function createMindmapRouter(repository: ContentRepository, images?: VocabularyImageService) {
  const router = Router();
  router.get("/:id", (request, response) => {
    const map = repository.getMindmap(Number(request.params.id), (request as AuthenticatedRequest).auth?.id);
    if (!map) return response.status(404).json({ error: "Mindmap not found" });
    return response.json(map);
  });
  router.post("/:id/personal-copy", (request, response) => {
    const userId=(request as AuthenticatedRequest).auth?.id;
    if(!userId)return response.status(401).json({error:"Authentication required"});
    const map=repository.createPersonalCopy(Number(request.params.id),userId);
    if(!map)return response.status(404).json({error:"Seed mindmap not found"});
    return response.status(201).json(map);
  });
  router.post("/drafts", (request, response) => {
    const map = repository.saveMindmapDraft(SaveDraftSchema.parse(request.body), (request as AuthenticatedRequest).auth?.id);
    response.status(201).json(map);
  });
  router.patch("/:id/nodes/:nodeId", (request, response) => {
    const node = repository.updateMindmapNode(Number(request.params.id), Number(request.params.nodeId), UpdateNodeSchema.parse(request.body), (request as AuthenticatedRequest).auth?.id);
    if (!node) return response.status(404).json({ error: "Node not found" });
    return response.json(node);
  });
  router.post("/:id/nodes/:nodeId/image", (request, response) => {
    if (!images) return response.status(503).json({ error: "Image generation unavailable" });
    try { return response.status(202).json(images.start(Number(request.params.id), Number(request.params.nodeId), (request as AuthenticatedRequest).auth?.id)); }
    catch { return response.status(404).json({ error: "Vocabulary node not found" }); }
  });
  router.get("/:id/nodes/:nodeId/image", (request, response) => {
    if (!images) return response.status(503).json({ error: "Image generation unavailable" });
    try { return response.json(images.getStatus(Number(request.params.id), Number(request.params.nodeId), (request as AuthenticatedRequest).auth?.id)); }
    catch { return response.status(404).json({ error: "Vocabulary node not found" }); }
  });
  router.post("/:id/approve", (request, response) => {
    const map = repository.approveMindmapDraft(Number(request.params.id), (request as AuthenticatedRequest).auth?.id);
    if (!map) return response.status(409).json({ error: "Mindmap is not an approvable draft" });
    return response.json(map);
  });
  return router;
}
