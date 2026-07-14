import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadProjectEnv } from "../../src/server/load-env";
import { loadConfig } from "../../src/server/config";

const tempDirs: string[] = [];
const originalUrl = process.env.NINEROUTER_URL;

afterEach(() => {
  if (originalUrl === undefined) delete process.env.NINEROUTER_URL;
  else process.env.NINEROUTER_URL = originalUrl;
  tempDirs.splice(0).forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
});

describe("loadProjectEnv", () => {
  it("loads project variables from an existing .env file", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mindmap-env-"));
    tempDirs.push(dir);
    const envPath = path.join(dir, ".env");
    fs.writeFileSync(envPath, "NINEROUTER_URL=http://example.test:20128\n", "utf8");
    delete process.env.NINEROUTER_URL;

    expect(loadProjectEnv(envPath)).toBe(true);
    expect(process.env.NINEROUTER_URL).toBe("http://example.test:20128");
  });


  it("normalizes a versioned 9Router URL to the gateway base URL", () => {
    const config = loadConfig({ NINEROUTER_URL: "http://example.test:20128/v1/" });
    expect(config.nineRouter.url).toBe("http://example.test:20128");
  });
  it("does nothing when .env is missing", () => {
    expect(loadProjectEnv(path.join(os.tmpdir(), "missing-mindmap.env"))).toBe(false);
  });
});