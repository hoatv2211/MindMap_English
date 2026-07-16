import path from "node:path";
import { z } from "zod";

const BooleanValue=z.preprocess(value=>typeof value==="string"?["1","true","yes","on"].includes(value.toLowerCase()):value,z.boolean());
const OptionalUrl=z.preprocess(value=>value===""?undefined:value,z.string().url().optional());
const CookieSameSite=z.preprocess(value=>typeof value==="string"?value.toLowerCase():value,z.enum(["lax","none"]));

const EnvSchema = z.object({
  HOST: z.string().default("127.0.0.1"),
  PORT: z.coerce.number().int().positive().default(8787),
  DATA_DIR: z.string().default("./data"),
  APP_ORIGIN: OptionalUrl,
  PROVIDER_API_URL: OptionalUrl,
  PROVIDER_API_KEY: z.string().optional(),
  PROVIDER_API_CHAT_MODEL: z.string().optional(),
  PROVIDER_API_IMAGE_MODEL: z.string().optional(),
  PROVIDER_API_STT_MODEL: z.string().optional(),
  PROVIDER_API_TTS_MODEL: z.string().optional(),
  PROVIDER_API_TTS_VOICE: z.string().optional(),
  NINEROUTER_URL: OptionalUrl,
  NINEROUTER_KEY: z.string().optional(),
  NINEROUTER_CHAT_MODEL: z.string().optional(),
  NINEROUTER_IMAGE_MODEL: z.string().optional(),
  NINEROUTER_STT_MODEL: z.string().optional(),
  NINEROUTER_TTS_MODEL: z.string().optional(),
  NINEROUTER_TTS_VOICE: z.string().optional(),
  ALLOW_REMOTE_BINDING: BooleanValue.default(false),
  AUTH_SECURE_COOKIES: BooleanValue.default(false),
  AUTH_COOKIE_SAME_SITE: CookieSameSite.default("lax"),
  AUTH_SESSION_HOURS: z.coerce.number().positive().default(24),
  AUTH_ABSOLUTE_SESSION_HOURS: z.coerce.number().positive().default(168),
});

export type AppConfig = ReturnType<typeof loadConfig>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const parsed = EnvSchema.parse(env);
  const dataDir = path.resolve(parsed.DATA_DIR);
  return {
    host: parsed.HOST,
    allowRemoteBinding: parsed.ALLOW_REMOTE_BINDING,
    port: parsed.PORT,
    appOrigin: parsed.APP_ORIGIN ? new URL(parsed.APP_ORIGIN).origin : undefined,
    dataDir,
    databasePath: path.join(dataDir, "mindmap-english.db"),
    mediaDir: path.join(dataDir, "media"),
    backupDir: path.join(dataDir, "backups"),
    auth: { secureCookies: parsed.AUTH_SECURE_COOKIES, cookieSameSite: parsed.AUTH_COOKIE_SAME_SITE, sessionHours: parsed.AUTH_SESSION_HOURS, absoluteSessionHours: parsed.AUTH_ABSOLUTE_SESSION_HOURS },
    nineRouter: {
      url: (parsed.PROVIDER_API_URL ?? parsed.NINEROUTER_URL ?? "http://localhost:20128").replace(/\/v1\/?$/, "").replace(/\/$/, ""),
      key: parsed.PROVIDER_API_KEY ?? parsed.NINEROUTER_KEY ?? "",
      chatModel: parsed.PROVIDER_API_CHAT_MODEL ?? parsed.NINEROUTER_CHAT_MODEL ?? "",
      imageModel: parsed.PROVIDER_API_IMAGE_MODEL ?? parsed.NINEROUTER_IMAGE_MODEL ?? "",
      sttModel: parsed.PROVIDER_API_STT_MODEL ?? parsed.NINEROUTER_STT_MODEL ?? "",
      ttsModel: parsed.PROVIDER_API_TTS_MODEL ?? parsed.NINEROUTER_TTS_MODEL ?? "",
      ttsVoice: parsed.PROVIDER_API_TTS_VOICE ?? parsed.NINEROUTER_TTS_VOICE ?? "",
    },
  };
}
