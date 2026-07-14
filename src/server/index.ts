import fs from "node:fs";
import path from "node:path";
import express from "express";
import { loadConfig } from "./config";
import { loadProjectEnv } from "./load-env";
import { createDatabase } from "./db/database";
import { migrate } from "./db/migrate";
import { seedDatabase } from "./db/seed";
import { applyPendingRestore } from "./modules/backup/service";
import { createApp } from "./app";

loadProjectEnv();
const config = loadConfig();
if (!new Set(["127.0.0.1", "localhost", "::1"]).has(config.host)) throw new Error("Remote binding is disabled. Use HOST=127.0.0.1.");
fs.mkdirSync(config.dataDir, { recursive: true });
applyPendingRestore(config);
const db = createDatabase(config.databasePath);
migrate(db);
seedDatabase(db);
const app = createApp({ db, config, includeNotFound: false });
const distDir = path.resolve("dist");
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get("/{*path}", (_request, response) => response.sendFile(path.join(distDir, "index.html")));
} else {
  app.get("/", (_request, response) => response.status(503).send("Client build missing. Run npm run build."));
}
const server = app.listen(config.port, config.host, () => console.log(`MindMap English running at http://${config.host}:${config.port}`));
const shutdown = () => {
  server.closeAllConnections();
  server.close(() => { db.close(); process.exit(0); });
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

