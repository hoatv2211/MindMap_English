import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadProjectEnv } from "../../src/server/load-env";
import { loadConfig } from "../../src/server/config";

const tempDirs: string[] = [];
const originalUrl = process.env.PROVIDER_API_URL;

afterEach(() => {
  if (originalUrl === undefined) delete process.env.PROVIDER_API_URL;
  else process.env.PROVIDER_API_URL = originalUrl;
  tempDirs.splice(0).forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
});

describe("loadProjectEnv", () => {
  it("loads project variables from an existing .env file", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mindmap-env-"));
    tempDirs.push(dir);
    const envPath = path.join(dir, ".env");
    fs.writeFileSync(envPath, "PROVIDER_API_URL=http://example.test:20128\n", "utf8");
    delete process.env.PROVIDER_API_URL;

    expect(loadProjectEnv(envPath)).toBe(true);
    expect(process.env.PROVIDER_API_URL).toBe("http://example.test:20128");
  });


  it("normalizes a versioned provider API URL to the gateway base URL", () => {
    const config = loadConfig({ PROVIDER_API_URL: "http://example.test:20128/v1/" });
    expect(config.nineRouter.url).toBe("http://example.test:20128");
  });

  it("keeps legacy NINEROUTER variables as fallback", () => {
    const legacy = loadConfig({ NINEROUTER_URL: "http://legacy.test:20128", NINEROUTER_CHAT_MODEL: "legacy/chat" });
    expect(legacy.nineRouter.url).toBe("http://legacy.test:20128");
    expect(legacy.nineRouter.chatModel).toBe("legacy/chat");
    const preferred = loadConfig({ PROVIDER_API_URL: "http://provider.test:20128", PROVIDER_API_CHAT_MODEL: "provider/chat", NINEROUTER_URL: "http://legacy.test:20128", NINEROUTER_CHAT_MODEL: "legacy/chat" });
    expect(preferred.nineRouter.url).toBe("http://provider.test:20128");
    expect(preferred.nineRouter.chatModel).toBe("provider/chat");
  });
  it("does nothing when .env is missing", () => {
    expect(loadProjectEnv(path.join(os.tmpdir(), "missing-mindmap.env"))).toBe(false);
  });  it("parses explicit boolean security flags", () => {
    expect(loadConfig({AUTH_SECURE_COOKIES:"false",ALLOW_REMOTE_BINDING:"false"}).auth.secureCookies).toBe(false);
    const remote=loadConfig({AUTH_SECURE_COOKIES:"true",ALLOW_REMOTE_BINDING:"true"});
    expect(remote.auth.secureCookies).toBe(true);expect(remote.allowRemoteBinding).toBe(true);
  });
});
