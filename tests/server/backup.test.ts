import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createDatabase } from "../../src/server/db/database";
import { migrate } from "../../src/server/db/migrate";
import { seedDatabase } from "../../src/server/db/seed";
import { BackupService, applyPendingRestore } from "../../src/server/modules/backup/service";
import { loadConfig } from "../../src/server/config";
import AdmZip from "adm-zip";

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
  it("scopes backup metadata and removes authentication secrets", async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "mindmap-backup-secure-")); dirs.push(dataDir);
    const config = loadConfig({ DATA_DIR: dataDir });
    const db = createDatabase(config.databasePath); migrate(db);
    db.prepare("INSERT INTO users(username,normalized_username,password_hash) VALUES (?,?,?)").run("one","one","secret-hash-one");
    db.prepare("INSERT INTO users(username,normalized_username,password_hash) VALUES (?,?,?)").run("two","two","secret-hash-two");
    db.prepare("INSERT INTO auth_sessions(user_id,token_hash,expires_at,absolute_expires_at) VALUES (1,?,?,?)").run("session-secret",new Date(Date.now()+60000).toISOString(),new Date(Date.now()+120000).toISOString());
    db.prepare("INSERT INTO password_recovery_codes(user_id,code_hash) VALUES (1,?)").run("recovery-secret");
    db.prepare("INSERT INTO learner_context_cache(user_id,profile_revision,skill_version,schema_version,snapshot_json) VALUES (1,1,'v1','v1','prompt-secret')").run();
    const service = new BackupService(db, config);
    const first = await service.createBackup(1);
    await service.createBackup(2);
    expect(service.listBackups(1).map(item=>item.id)).toEqual([first.id]);
    expect(() => service.stageRestore(first.id,2)).toThrow("Backup not found");
    const zip = new AdmZip(path.join(config.backupDir, first.filename));
    const archivedDb = path.join(dataDir,"archived.db");
    fs.writeFileSync(archivedDb,zip.getEntry("database.db")!.getData());
    const snapshot=createDatabase(archivedDb);
    expect((snapshot.prepare("SELECT group_concat(password_hash) value FROM users").get() as {value:string}).value).not.toContain("secret-hash");
    expect((snapshot.prepare("SELECT COUNT(*) count FROM auth_sessions").get() as {count:number}).count).toBe(0);
    expect((snapshot.prepare("SELECT COUNT(*) count FROM password_recovery_codes").get() as {count:number}).count).toBe(0);
    expect((snapshot.prepare("SELECT COUNT(*) count FROM learner_context_cache").get() as {count:number}).count).toBe(0);
    snapshot.close();
    db.close();
  });

  it("restores learning data while preserving current credentials", async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "mindmap-backup-auth-")); dirs.push(dataDir);
    const config = loadConfig({ DATA_DIR: dataDir });
    const db = createDatabase(config.databasePath); migrate(db);
    db.prepare("INSERT INTO users(username,normalized_username,password_hash) VALUES ('owner','owner','current-secret')").run();
    db.prepare("INSERT INTO topics(slug,title,title_vi) VALUES ('before','Before','Before')").run();
    const service = new BackupService(db,config);
    const backup=await service.createBackup(1);
    db.prepare("UPDATE users SET password_hash='new-current-secret' WHERE id=1").run();
    service.stageRestore(backup.id,1);
    db.close();
    expect(applyPendingRestore(config)).toBe(true);
    const restored=createDatabase(config.databasePath);
    expect((restored.prepare("SELECT password_hash passwordHash FROM users WHERE id=1").get() as {passwordHash:string}).passwordHash).toBe("new-current-secret");
    expect((restored.prepare("SELECT COUNT(*) count FROM topics WHERE slug='before'").get() as {count:number}).count).toBe(1);
    restored.close();
  });

});
