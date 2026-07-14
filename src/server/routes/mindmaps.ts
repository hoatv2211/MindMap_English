import { Router } from "express";
import type { ContentRepository } from "../modules/content/repository";
import { SaveDraftSchema, UpdateNodeSchema } from "../modules/content/repository";

export function createMindmapRouter(repository: ContentRepository) {
  const router = Router();
  router.get("/:id", (request, response) => {
    const map = repository.getMindmap(Number(request.params.id));
    if (!map) return response.status(404).json({ error: "Mindmap not found" });
    return response.json(map);
  });
  router.post("/drafts", (request, response) => {
    const map = repository.saveMindmapDraft(SaveDraftSchema.parse(request.body));
    response.status(201).json(map);
  });
  router.patch("/:id/nodes/:nodeId", (request, response) => {
    const node = repository.updateMindmapNode(Number(request.params.id), Number(request.params.nodeId), UpdateNodeSchema.parse(request.body));
    if (!node) return response.status(404).json({ error: "Node not found" });
    return response.json(node);
  });
  router.post("/:id/approve", (request, response) => {
    const map = repository.approveMindmapDraft(Number(request.params.id));
    if (!map) return response.status(409).json({ error: "Mindmap is not an approvable draft" });
    return response.json(map);
  });
  return router;
}
