import { Router } from "express";
import { z } from "zod";
import { VocabularyCaptureInputSchema, VocabularyEnrichmentDraftSchema, VocabularyInboxStatusSchema } from "../../../shared/contracts";
import { requireAuth, type AuthenticatedRequest } from "../auth/middleware";
import type { VocabularyEnrichmentService } from "./enrichment-service";
import type { VocabularyInboxRepository } from "./repository";

export function createVocabularyInboxRouter(repository:VocabularyInboxRepository,enrichment:VocabularyEnrichmentService){
  const router=Router();router.use(requireAuth);
  router.post("/",async(request:AuthenticatedRequest,response,next)=>{try{const item=repository.capture(request.auth!.id,VocabularyCaptureInputSchema.parse(request.body));try{return response.status(201).json(await enrichment.enrich(request.auth!.id,item.id))}catch{return response.status(201).json(repository.get(request.auth!.id,item.id))}}catch(error){next(error)}});
  router.get("/",(request:AuthenticatedRequest,response)=>{const status=request.query.status?VocabularyInboxStatusSchema.parse(request.query.status):undefined;response.json(repository.list(request.auth!.id,status))});
  router.get("/:id",(request:AuthenticatedRequest,response)=>{const item=repository.get(request.auth!.id,Number(request.params.id));return item?response.json(item):response.status(404).json({error:"Vocabulary inbox item not found"})});
  router.patch("/:id/draft",(request:AuthenticatedRequest,response)=>{const id=Number(request.params.id);const item=repository.get(request.auth!.id,id);if(!item)return response.status(404).json({error:"Vocabulary inbox item not found"});const draft=VocabularyEnrichmentDraftSchema.parse(request.body);return response.json(repository.saveDraft(request.auth!.id,id,draft,{model:"learner-edit",promptVersion:"manual",skillVersion:"manual"},true))});
  router.post("/:id/enrich",async(request:AuthenticatedRequest,response,next)=>{try{const id=Number(request.params.id);if(!repository.get(request.auth!.id,id))return response.status(404).json({error:"Vocabulary inbox item not found"});return response.json(await enrichment.enrich(request.auth!.id,id))}catch(error){next(error)}});
  router.post("/:id/approve",(request:AuthenticatedRequest,response)=>{const id=Number(request.params.id);if(!repository.get(request.auth!.id,id))return response.status(404).json({error:"Vocabulary inbox item not found"});return response.json(repository.approve(request.auth!.id,id,z.object({mindmapId:z.number().int().positive().nullable().optional(),parentNodeId:z.number().int().positive().nullable().optional()}).parse(request.body??{})))});
  router.post("/:id/dismiss",(request:AuthenticatedRequest,response)=>{const id=Number(request.params.id);if(!repository.get(request.auth!.id,id))return response.status(404).json({error:"Vocabulary inbox item not found"});return response.json(repository.dismiss(request.auth!.id,id))});
  return router;
}
