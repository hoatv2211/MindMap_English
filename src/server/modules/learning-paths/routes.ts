import { Router } from "express";
import type { AuthenticatedRequest } from "../auth/middleware";
import type { LearningPathRepository } from "./repository";

export function createLearningPathRouter(repository:LearningPathRepository){
  const router=Router();
  router.get("/",(request:AuthenticatedRequest,response)=>response.json(repository.list(request.auth?.id)));
  router.get("/modules/:id",(request:AuthenticatedRequest,response)=>{const module=repository.getModule(Number(request.params.id),request.auth?.id);if(!module)return response.status(404).json({error:"Module not found"});return response.json(module)});
  return router;
}
