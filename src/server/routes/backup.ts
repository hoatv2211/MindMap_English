import { Router } from "express";
import type { BackupService } from "../modules/backup/service";
import type { AuthenticatedRequest } from "../modules/auth/middleware";

export function createBackupRouter(service: BackupService) {
  const router = Router();
  router.get("/", (request: AuthenticatedRequest, response) => response.json(service.listBackups(request.auth?.id)));
  router.post("/", async (request: AuthenticatedRequest, response, next) => {
    try { response.status(201).json(await service.createBackup(request.auth?.id)); } catch (error) { next(error); }
  });
  router.post("/:id/restore", (request, response, next) => {
    try { response.status(202).json(service.stageRestore(Number(request.params.id), (request as AuthenticatedRequest).auth?.id)); } catch (error) { next(error); }
  });
  router.delete("/:id", (request, response, next) => {
    try { response.json(service.deleteBackup(Number(request.params.id), (request as AuthenticatedRequest).auth?.id)); } catch (error) { next(error); }
  });
  return router;
}
