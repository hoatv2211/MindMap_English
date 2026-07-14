import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const statePath = path.resolve(".tools", "playwright-server.json");

export default async function globalSetup() {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  const child = spawn(process.execPath, ["--import", "tsx", "src/server/index.ts"], {
    cwd: process.cwd(),
    detached: true,
    stdio: "ignore",
    env: { ...process.env, PORT: "8790" },
    windowsHide: true,
  });
  if (!child.pid) throw new Error("Unable to start Playwright server");
  child.unref();
  fs.writeFileSync(statePath, JSON.stringify({ pid: child.pid }));
  try {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      try {
        const response = await fetch("http://127.0.0.1:8790/api/health");
        if (response.ok) return;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error("Playwright server health check timed out");
  } catch (error) {
    try { process.kill(child.pid); } catch {}
    fs.rmSync(statePath, { force: true });
    throw error;
  }
}
