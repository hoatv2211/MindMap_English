import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import type { NineRouterClient } from "../agent/ninerouter-client";

const allowedTypes = new Set(["audio/webm", "audio/wav", "audio/mpeg", "audio/mp4", "audio/ogg", "audio/flac"]);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024, files: 1 } });

export function createSpeechRouter(client: NineRouterClient) {
  const router = Router();
  router.post("/transcribe", upload.single("audio"), async (request, response, next) => {
    try {
      if (!request.file || !allowedTypes.has(request.file.mimetype)) return response.status(400).json({ error: "Unsupported or missing audio" });
      const text = await client.transcribe(request.file.buffer, request.file.originalname || "speech.webm", request.file.mimetype);
      return response.json({ text });
    } catch (error) { next(error); }
  });
  router.post("/synthesize", async (request, response, next) => {
    try {
      const { text } = z.object({ text: z.string().min(1).max(1000) }).parse(request.body);
      const audio = await client.synthesizeSpeech(text);
      response.type(audio.mimeType).send(audio.buffer);
    } catch (error) { next(error); }
  });
  return router;
}
