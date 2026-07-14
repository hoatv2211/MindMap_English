import fs from "node:fs";
import path from "node:path";

const statePath = path.resolve(".tools", "playwright-server.json");

export default async function globalTeardown() {
  if (!fs.existsSync(statePath)) return;
  const { pid } = JSON.parse(fs.readFileSync(statePath, "utf8")) as { pid: number };
  try { process.kill(pid); } catch {}
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try { process.kill(pid, 0); }
    catch { break; }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  fs.rmSync(statePath, { force: true });
}
