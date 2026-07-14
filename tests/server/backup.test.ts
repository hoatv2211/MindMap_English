import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createDatabase } from "../../src/server/db/database";
import { migrate } from "../../src/server/db/migrate";
import { seedDatabase } from "../../src/server/db/seed";
import { BackupService, applyPendingRestore } from "../../src/server/modules/backup/service";
import { loadConfig } from "../../src/server/config";

const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));

describe("BackupService", () => {
  it("creates, validates, and stages a local restore", async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "mindmap-backup-")); dirs.push(dataDir);
    const config = loadConfig({ DATA_DIR: dataDir });
    const db = createDatabase(config.databasePath); migrate(db); seedDatabase(db);
    const service = new BackupService(db, config);
    fs.writeFileSync(path.join(config.mediaDir, "sample.txt"), "original media");
    await service.createBackup();
    const listed = service.listBackups();
    expect(listed).toHaveLength(1);
    expect(fs.existsSync(path.join(config.backupDir, listed[0].filename))).toBe(true);
    fs.writeFileSync(path.join(config.mediaDir, "sample.txt"), "changed media");
    expect(service.stageRestore(listed[0].id)).toEqual({ staged: true, restartRequired: true });
    db.close();
    expect(applyPendingRestore(config)).toBe(true);
    const restored = createDatabase(config.databasePath);
    expect((restored.prepare("SELECT COUNT(*) count FROM topics").get() as {count:number}).count).toBe(17);
    expect(fs.readFileSync(path.join(config.mediaDir, "sample.txt"), "utf8")).toBe("original media");
    restored.close();
  });
});

