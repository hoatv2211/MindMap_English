import fs from "node:fs";
import path from "node:path";
import { loadEnvFile } from "node:process";

export function loadProjectEnv(envPath = path.resolve(".env")): boolean {
  if (!fs.existsSync(envPath)) return false;
  loadEnvFile(envPath);
  return true;
}