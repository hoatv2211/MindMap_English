import { Router } from "express";
import type { BackupService } from "../modules/backup/service";

export function createBackupRouter(service: BackupService) {
  const router = Router();
  router.get("/", (_request, response) => response.json(service.listBackups()));
  router.post("/", async (_request, response, next) => {
    try { response.status(201).json(await service.createBackup()); } catch (error) { next(error); }
  });
  router.post("/:id/restore", (request, response, next) => {
    try { response.status(202).json(service.stageRestore(Number(request.params.id))); } catch (error) { next(error); }
  });
  return router;
}
