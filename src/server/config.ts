import path from "node:path";
import { z } from "zod";

const EnvSchema = z.object({
  HOST: z.string().default("127.0.0.1"),
  PORT: z.coerce.number().int().positive().default(8787),
  DATA_DIR: z.string().default("./data"),
  NINEROUTER_URL: z.string().url().default("http://localhost:20128"),
  NINEROUTER_KEY: z.string().default(""),
  NINEROUTER_CHAT_MODEL: z.string().default(""),
  NINEROUTER_IMAGE_MODEL: z.string().default(""),
  NINEROUTER_STT_MODEL: z.string().default(""),
  NINEROUTER_TTS_MODEL: z.string().default(""),
  NINEROUTER_TTS_VOICE: z.string().default(""),
  AUTH_SECURE_COOKIES: z.coerce.boolean().default(false),
  AUTH_SESSION_HOURS: z.coerce.number().positive().default(24),
  AUTH_ABSOLUTE_SESSION_HOURS: z.coerce.number().positive().default(168),
});

export type AppConfig = ReturnType<typeof loadConfig>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const parsed = EnvSchema.parse(env);
  const dataDir = path.resolve(parsed.DATA_DIR);
  return {
    host: parsed.HOST,
    port: parsed.PORT,
    dataDir,
    databasePath: path.join(dataDir, "mindmap-english.db"),
    mediaDir: path.join(dataDir, "media"),
    backupDir: path.join(dataDir, "backups"),
    auth: { secureCookies: parsed.AUTH_SECURE_COOKIES, sessionHours: parsed.AUTH_SESSION_HOURS, absoluteSessionHours: parsed.AUTH_ABSOLUTE_SESSION_HOURS },
    nineRouter: {
      url: parsed.NINEROUTER_URL.replace(/\/v1\/?$/, "").replace(/\/$/, ""),
      key: parsed.NINEROUTER_KEY,
      chatModel: parsed.NINEROUTER_CHAT_MODEL,
      imageModel: parsed.NINEROUTER_IMAGE_MODEL,
      sttModel: parsed.NINEROUTER_STT_MODEL,
      ttsModel: parsed.NINEROUTER_TTS_MODEL,
      ttsVoice: parsed.NINEROUTER_TTS_VOICE,
    },
  };
}

