import { Router } from "express";
import type { ContentRepository } from "../modules/content/repository";

export function createLibraryRouter(repository: ContentRepository) {
  const router = Router();
  router.get("/topics", (_request, response) => response.json(repository.listTopics()));
  router.get("/mindmaps", (request, response) => {
    const status = request.query.status === "draft" || request.query.status === "all" ? request.query.status : "approved";
    response.json(repository.listMindmaps(status));
  });
  return router;
}
