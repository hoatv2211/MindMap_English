import { Router } from "express";
import type { ContentRepository } from "../modules/content/repository";
import type { AuthenticatedRequest } from "../modules/auth/middleware";

export function createLibraryRouter(repository: ContentRepository) {
  const router = Router();
  router.get("/topics", (request: AuthenticatedRequest, response) => response.json(repository.listTopics(request.auth?.id)));
  router.get("/mindmaps", (request, response) => {
    const status = request.query.status === "draft" || request.query.status === "all" ? request.query.status : "approved";
    response.json(repository.listMindmaps(status, (request as AuthenticatedRequest).auth?.id));
  });
  return router;
}
