import { Router } from "express";
import { z } from "zod";
import type { AgentToolService } from "./tool-service";
import { GeneratedMindmapSchema } from "./tool-service";
import { requireAuth, type AuthenticatedRequest } from "../auth/middleware";

export function createAgentRouter(service: AgentToolService) {
  const router = Router();
  router.use(requireAuth);
  router.get("/status", (_request,response)=>response.json(service.getTutorStatus()));
  router.get("/threads", (request:AuthenticatedRequest,response)=>response.json(service.getChatRepository().listThreads(request.auth!.id,request.query.archived==="true")));
  router.post("/threads", (request:AuthenticatedRequest,response)=>response.status(201).json(service.getChatRepository().createThread(request.auth!.id,z.object({title:z.string().max(80).optional()}).parse(request.body).title)));
  router.get("/threads/:id/messages", (request:AuthenticatedRequest,response)=>{const result=service.getChatRepository().listMessages(request.auth!.id,Number(request.params.id));return result?response.json(result):response.status(404).json({error:"Không tìm thấy cuộc trò chuyện"})});
  router.patch("/threads/:id", (request:AuthenticatedRequest,response)=>{const input=z.object({title:z.string().min(1).max(80).optional(),archived:z.boolean().optional()}).parse(request.body);const repo=service.getChatRepository();const ok=input.title?repo.renameThread(request.auth!.id,Number(request.params.id),input.title):input.archived===true?repo.archiveThread(request.auth!.id,Number(request.params.id)):input.archived===false?repo.restoreThread(request.auth!.id,Number(request.params.id)):false;return ok?response.status(204).send():response.status(404).json({error:"Không tìm thấy cuộc trò chuyện"})});
  router.delete("/threads/:id", (request:AuthenticatedRequest,response)=>service.getChatRepository().deleteThread(request.auth!.id,Number(request.params.id))?response.status(204).send():response.status(404).json({error:"Không tìm thấy cuộc trò chuyện"}));
  router.post("/threads/:id/messages/:messageId/retry", async (request:AuthenticatedRequest,response,next)=>{try{const result=await service.retryTutorMessage(request.auth!.id,Number(request.params.id),Number(request.params.messageId));return result?response.status(200).json(result):response.status(404).json({error:"Không tìm thấy tin nhắn lỗi"})}catch(error){next(error)}});
  router.post("/threads/:id/messages", async (request:AuthenticatedRequest,response,next)=>{try{const message=z.object({message:z.string().min(1).max(4000)}).parse(request.body).message;const result=await service.sendTutorMessage(request.auth!.id,Number(request.params.id),message);return result?response.status(201).json(result):response.status(404).json({error:"Không tìm thấy cuộc trò chuyện"})}catch(error){next(error)}});
  router.post("/chat", async (request:AuthenticatedRequest,response,next) => { try { const repo=service.getChatRepository();const thread=repo.createThread(request.auth!.id);const result=await service.sendTutorMessage(request.auth!.id,thread.id,z.object({ message: z.string().min(1).max(2000) }).parse(request.body).message); response.json({reply:result!.reply,suggestions:result!.suggestions,threadId:thread.id}); } catch (error) { next(error); } });
  router.post("/mindmap-drafts", async (request:AuthenticatedRequest, response, next) => { try { response.status(201).json(await service.generateMindmapDraft(request.body, request.auth!.id)); } catch (error) { next(error); } });
  router.post("/mindmap-drafts/save", (request:AuthenticatedRequest, response) => { const input = z.object({ topicId: z.number().int().positive(), draft: GeneratedMindmapSchema }).parse(request.body); response.status(201).json(service.saveGeneratedDraft(input.topicId, input.draft, request.auth!.id)); });
  return router;
}
