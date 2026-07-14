import express, { type ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import type { AppDatabase } from "./db/database";
import { loadConfig, type AppConfig } from "./config";
import { ContentRepository } from "./modules/content/repository";
import { LearningRepository } from "./modules/learning/repository";
import { NineRouterClient, NineRouterError } from "./modules/agent/ninerouter-client";
import { AgentToolService } from "./modules/agent/tool-service";
import { BackupService } from "./modules/backup/service";
import { createLibraryRouter } from "./routes/library";
import { createMindmapRouter } from "./routes/mindmaps";
import { createLearningRouter } from "./routes/learning";
import { createAgentRouter } from "./modules/agent/routes";
import { createSpeechRouter } from "./modules/speech/routes";
import { createBackupRouter } from "./routes/backup";
import { createSettingsRouter } from "./routes/settings";
import { createDictionaryRouter } from "./modules/dictionary/routes";
import { SpeakingRepository } from "./modules/speaking/repository";
import { createSpeakingRouter } from "./modules/speaking/routes";
import { DocumentRepository } from "./modules/documents/repository";
import { createDocumentRouter } from "./modules/documents/routes";
import { AuthService } from "./modules/auth/service";
import { createAuthRouter } from "./modules/auth/routes";
import { optionalAuth, requireAuth, requireSameOrigin } from "./modules/auth/middleware";

export interface AppDependencies {
  db: AppDatabase;
  config?: AppConfig;
  nineRouter?: NineRouterClient;
  includeNotFound?: boolean;
  protectApi?: boolean;
}

export function createApp({ db, config = loadConfig(), nineRouter, includeNotFound = true, protectApi = process.env.NODE_ENV !== "test" }: AppDependencies) {
  const app = express();
  const content = new ContentRepository(db);
  const learning = new LearningRepository(db);
  const client = nineRouter ?? new NineRouterClient(config.nineRouter);
  const agent = new AgentToolService(db, content, learning, client);
  const backups = new BackupService(db, config);
  const speaking = new SpeakingRepository(db);
  const documents = new DocumentRepository(db, config);
  const auth = new AuthService(db, config.auth.sessionHours, config.auth.absoluteSessionHours);

  app.disable("x-powered-by");
  app.set("trust proxy", "loopback");
  app.use(express.json({ limit: "1mb" }));
  app.use(optionalAuth(auth));
  app.use("/api", requireSameOrigin);
  app.use("/api/auth", createAuthRouter(auth, config.auth.secureCookies, config.auth.absoluteSessionHours));
  app.get("/api/health", async (_request, response) => response.json({ ok: true, aiOnline: await client.health(), ...agent.getTutorStatus() }));
  if (protectApi) app.use("/api", requireAuth);
  app.use("/api", createLibraryRouter(content));
  app.use("/api/mindmaps", createMindmapRouter(content));
  app.use("/api/learning", createLearningRouter(learning));
  app.use("/api/agent", createAgentRouter(agent));
  app.use("/api/speech", createSpeechRouter(client));
  app.use("/api/backups", createBackupRouter(backups));
  app.use("/api/settings", createSettingsRouter(db, config, client));
  app.use("/api/dictionary", createDictionaryRouter(db, config));
  app.use("/api/speaking", createSpeakingRouter(speaking));
  app.use("/api/documents", createDocumentRouter(documents, agent));
  if (includeNotFound) app.use((_request, response) => response.status(404).json({ error: "Route not found" }));

  const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
    if (error instanceof ZodError) return response.status(400).json({ error: "Invalid request", issues: error.issues });
    if (error instanceof NineRouterError) return response.status(error.status).json({ error: error.message, code: error.code });
    console.error("Request failed", error instanceof Error ? error.message : error);
    return response.status(500).json({ error: "Internal server error" });
  };
  app.use(errorHandler);
  return app;
}
