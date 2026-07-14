import { Router } from "express";
import { z } from "zod";
import type { AppDatabase } from "../db/database";
import type { AppConfig } from "../config";
import type { NineRouterClient } from "../modules/agent/ninerouter-client";

const allowedSettings = new Set(["defaultDuration", "ttsVoice", "chatModel", "imageModel", "sttModel", "ttsModel", "weeklyGoalMinutes"]);
const SettingsInputSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]));

export function createSettingsRouter(db: AppDatabase, config: AppConfig, client: NineRouterClient) {
  const router = Router();
  router.get("/", (_request, response) => {
    const stored = Object.fromEntries((db.prepare("SELECT key,value FROM settings").all() as Array<{key:string;value:string}>).map((row) => [row.key, JSON.parse(row.value)]));
    response.json({ ...stored, nineRouterUrl: config.nineRouter.url, hasNineRouterKey: Boolean(config.nineRouter.key), models: { chat: config.nineRouter.chatModel, image: config.nineRouter.imageModel, stt: config.nineRouter.sttModel, tts: config.nineRouter.ttsModel, voice: config.nineRouter.ttsVoice } });
  });
  router.put("/", (request, response) => {
    const input = SettingsInputSchema.parse(request.body);
    const statement = db.prepare("INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP");
    const save = db.transaction(() => Object.entries(input).forEach(([key, value]) => { if (allowedSettings.has(key)) statement.run(key, JSON.stringify(value)); }));
    save();
    response.json({ saved: Object.keys(input).filter((key) => allowedSettings.has(key)) });
  });
  router.get("/health", async (_request, response) => response.json({ nineRouter: await client.health(), configured: { chat: Boolean(config.nineRouter.chatModel), image: Boolean(config.nineRouter.imageModel), stt: Boolean(config.nineRouter.sttModel), tts: Boolean(config.nineRouter.ttsVoice || config.nineRouter.ttsModel) } }));
  return router;
}
