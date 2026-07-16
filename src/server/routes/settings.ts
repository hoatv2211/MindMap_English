import { Router } from "express";
import { z } from "zod";
import type { AppDatabase } from "../db/database";
import type { AppConfig } from "../config";
import type { NineRouterClient } from "../modules/agent/ninerouter-client";
import type { AuthenticatedRequest } from "../modules/auth/middleware";

const allowedSettings = new Set(["defaultDuration", "ttsVoice", "chatModel", "imageModel", "sttModel", "ttsModel", "weeklyGoalMinutes"]);
const SettingsInputSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]));
const isAdmin = (request: AuthenticatedRequest) => request.auth === undefined || request.auth.isAdmin;

export function createSettingsRouter(db: AppDatabase, config: AppConfig, client: NineRouterClient) {
  const router = Router();
  router.get("/", (request: AuthenticatedRequest, response) => {
    const userId = request.auth?.id;
    const rows = userId === undefined
      ? db.prepare("SELECT key,value FROM settings").all()
      : db.prepare("SELECT key,value FROM user_settings WHERE user_id=?").all(userId);
    const stored = Object.fromEntries((rows as Array<{key:string;value:string}>).map((row) => [row.key, JSON.parse(row.value)]));
    const canManageProviderApi = isAdmin(request);
    response.json({ ...stored, canManageProviderApi, ...(canManageProviderApi ? { nineRouterUrl: config.nineRouter.url, hasNineRouterKey: Boolean(config.nineRouter.key), models: { chat: config.nineRouter.chatModel, image: config.nineRouter.imageModel, stt: config.nineRouter.sttModel, tts: config.nineRouter.ttsModel, voice: config.nineRouter.ttsVoice } } : { hasNineRouterKey: false, models: {} }) });
  });
  router.put("/", (request: AuthenticatedRequest, response) => {
    const input = SettingsInputSchema.parse(request.body);
    const userId = request.auth?.id;
    const statement = userId === undefined
      ? db.prepare("INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP")
      : db.prepare("INSERT INTO user_settings(user_id,key,value) VALUES (?,?,?) ON CONFLICT(user_id,key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP");
    const save = db.transaction(() => Object.entries(input).forEach(([key, value]) => {
      if (!allowedSettings.has(key)) return;
      if (userId === undefined) statement.run(key, JSON.stringify(value));
      else statement.run(userId, key, JSON.stringify(value));
    }));
    save();
    response.json({ saved: Object.keys(input).filter((key) => allowedSettings.has(key)) });
  });
  router.get("/health", async (request: AuthenticatedRequest, response) => {
    if (!isAdmin(request)) return response.status(403).json({ error: "Chỉ admin mới xem cấu hình provider", code: "ADMIN_REQUIRED" });
    return response.json({ nineRouter: await client.health(), configured: { chat: Boolean(config.nineRouter.chatModel), image: Boolean(config.nineRouter.imageModel), stt: Boolean(config.nineRouter.sttModel), tts: Boolean(config.nineRouter.ttsVoice || config.nineRouter.ttsModel) } });
  });
  return router;
}
