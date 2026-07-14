import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import AdmZip from "adm-zip";
import type { AppConfig } from "../../config";
import { createDatabase, type AppDatabase } from "../../db/database";

interface BackupManifest { version: 1; createdAt: string; app: "mindmap-english-local-ai"; databaseFile: string; }

export class BackupService {
  constructor(private readonly db: AppDatabase, private readonly config: AppConfig) {
    fs.mkdirSync(config.backupDir, { recursive: true });
    fs.mkdirSync(config.mediaDir, { recursive: true });
  }

  async createBackup(userId?: number) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const id = `backup-${timestamp}-${crypto.randomBytes(3).toString("hex")}`;
    const tempDb = path.join(this.config.backupDir, `${id}.db`);
    const zipPath = path.join(this.config.backupDir, `${id}.zip`);
    await this.db.backup(tempDb);
    sanitizeBackupDatabase(tempDb);
    const manifest: BackupManifest = { version: 1, createdAt: new Date().toISOString(), app: "mindmap-english-local-ai", databaseFile: "database.db" };
    const zip = new AdmZip();
    zip.addLocalFile(tempDb, "", "database.db");
    zip.addFile("manifest.json", Buffer.from(JSON.stringify(manifest, null, 2), "utf8"));
    if (fs.existsSync(this.config.mediaDir)) zip.addLocalFolder(this.config.mediaDir, "media");
    zip.writeZip(zipPath);
    fs.rmSync(tempDb, { force: true });
    const size = fs.statSync(zipPath).size;
    const rowId = Number(this.db.prepare("INSERT INTO backups(filename,size_bytes,user_id) VALUES (?,?,?)").run(path.basename(zipPath), size, userId ?? null).lastInsertRowid);
    return { id: rowId, filename: path.basename(zipPath), sizeBytes: size, createdAt: manifest.createdAt };
  }

  listBackups(userId?: number) {
    const rows = userId === undefined
      ? this.db.prepare("SELECT id,filename,size_bytes sizeBytes,created_at createdAt FROM backups ORDER BY id DESC").all()
      : this.db.prepare("SELECT id,filename,size_bytes sizeBytes,created_at createdAt FROM backups WHERE user_id=? ORDER BY id DESC").all(userId);
    return (rows as Array<{id:number;filename:string;sizeBytes:number;createdAt:string}>).filter((item) => fs.existsSync(path.join(this.config.backupDir, item.filename)));
  }

  stageRestore(id: number, userId?: number) {
    const row = (userId === undefined
      ? this.db.prepare("SELECT filename FROM backups WHERE id=?").get(id)
      : this.db.prepare("SELECT filename FROM backups WHERE id=? AND user_id=?").get(id, userId)) as { filename: string } | undefined;
    if (!row) throw new Error("Backup not found");
    const backupRoot = path.resolve(this.config.backupDir);
    const zipPath = path.resolve(backupRoot, row.filename);
    if (!zipPath.startsWith(backupRoot + path.sep)) throw new Error("Unsafe backup path");
    const zip = new AdmZip(zipPath);
    const manifestEntry = zip.getEntry("manifest.json");
    const databaseEntry = zip.getEntry("database.db");
    if (!manifestEntry || !databaseEntry) throw new Error("Invalid backup archive");
    const manifest = JSON.parse(manifestEntry.getData().toString("utf8")) as BackupManifest;
    if (manifest.app !== "mindmap-english-local-ai" || manifest.version !== 1) throw new Error("Unsupported backup schema");

    fs.writeFileSync(`${this.config.databasePath}.restore`, databaseEntry.getData());
    const pendingMedia = `${this.config.mediaDir}.restore`;
    fs.rmSync(pendingMedia, { recursive: true, force: true });
    fs.mkdirSync(pendingMedia, { recursive: true });
    const pendingMediaRoot = path.resolve(pendingMedia);
    for (const entry of zip.getEntries().filter((item) => !item.isDirectory && item.entryName.startsWith("media/"))) {
      const relative = entry.entryName.slice("media/".length).replace(/\\/g, "/");
      if (!relative || relative.includes("..") || path.isAbsolute(relative)) throw new Error("Unsafe media path in backup");
      const destination = path.resolve(pendingMediaRoot, relative);
      if (!destination.startsWith(pendingMediaRoot + path.sep)) throw new Error("Unsafe media destination");
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, entry.getData());
    }
    fs.writeFileSync(`${this.config.databasePath}.restore.json`, JSON.stringify({ source: row.filename, stagedAt: new Date().toISOString() }));
    return { staged: true, restartRequired: true };
  }
}

function sanitizeBackupDatabase(filename: string): void {
  const snapshot = createDatabase(filename);
  try {
    snapshot.transaction(() => {
      snapshot.prepare("UPDATE users SET password_hash='redacted',status='disabled'").run();
      for (const table of ["auth_sessions", "password_recovery_codes", "auth_rate_limits", "learner_context_cache", "agent_response_cache"]) snapshot.prepare(`DELETE FROM ${table}`).run();
    })();
    snapshot.pragma("wal_checkpoint(TRUNCATE)");
  } finally { snapshot.close(); }
}

function preserveCurrentCredentials(currentFilename: string, restoredFilename: string): void {
  if (!fs.existsSync(currentFilename)) return;
  const current = createDatabase(currentFilename);
  const restored = createDatabase(restoredFilename);
  try {
    const users = current.prepare("SELECT id,username,normalized_username normalizedUsername,password_hash passwordHash,status,profile_revision profileRevision,created_at createdAt,updated_at updatedAt FROM users").all() as Array<{id:number;username:string;normalizedUsername:string;passwordHash:string;status:string;profileRevision:number;createdAt:string;updatedAt:string}>;
    const sessions = current.prepare("SELECT id,user_id userId,token_hash tokenHash,expires_at expiresAt,absolute_expires_at absoluteExpiresAt,last_seen_at lastSeenAt,created_at createdAt FROM auth_sessions").all() as Array<Record<string, unknown>>;
    const recovery = current.prepare("SELECT id,user_id userId,code_hash codeHash,consumed_at consumedAt,created_at createdAt FROM password_recovery_codes").all() as Array<Record<string, unknown>>;
    restored.pragma("foreign_keys = OFF");
    restored.transaction(() => {
      restored.prepare("DELETE FROM auth_sessions").run();
      restored.prepare("DELETE FROM password_recovery_codes").run();
      restored.prepare("DELETE FROM auth_rate_limits").run();
      restored.prepare("UPDATE users SET password_hash='redacted',status='disabled'").run();
      const upsertUser = restored.prepare("INSERT INTO users(id,username,normalized_username,password_hash,status,profile_revision,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET username=excluded.username,normalized_username=excluded.normalized_username,password_hash=excluded.password_hash,status=excluded.status,profile_revision=excluded.profile_revision,created_at=excluded.created_at,updated_at=excluded.updated_at");
      for (const user of users) upsertUser.run(user.id,user.username,user.normalizedUsername,user.passwordHash,user.status,user.profileRevision,user.createdAt,user.updatedAt);
      const insertSession = restored.prepare("INSERT INTO auth_sessions(id,user_id,token_hash,expires_at,absolute_expires_at,last_seen_at,created_at) VALUES (?,?,?,?,?,?,?)");
      for (const row of sessions) insertSession.run(row.id,row.userId,row.tokenHash,row.expiresAt,row.absoluteExpiresAt,row.lastSeenAt,row.createdAt);
      const insertRecovery = restored.prepare("INSERT INTO password_recovery_codes(id,user_id,code_hash,consumed_at,created_at) VALUES (?,?,?,?,?)");
      for (const row of recovery) insertRecovery.run(row.id,row.userId,row.codeHash,row.consumedAt,row.createdAt);
    })();
    restored.pragma("foreign_keys = ON");
    restored.pragma("wal_checkpoint(TRUNCATE)");
  } finally { restored.close(); current.close(); }
}

export function applyPendingRestore(config: AppConfig): boolean {
  const pendingDb = `${config.databasePath}.restore`;
  const marker = `${config.databasePath}.restore.json`;
  if (!fs.existsSync(pendingDb) || !fs.existsSync(marker)) return false;
  fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });
  preserveCurrentCredentials(config.databasePath, pendingDb);
  if (fs.existsSync(config.databasePath)) fs.copyFileSync(config.databasePath, `${config.databasePath}.before-restore`);
  fs.rmSync(config.databasePath, { force: true });
  fs.renameSync(pendingDb, config.databasePath);

  const pendingMedia = `${config.mediaDir}.restore`;
  if (fs.existsSync(pendingMedia)) {
    if (fs.existsSync(config.mediaDir)) fs.renameSync(config.mediaDir, `${config.mediaDir}.before-restore-${Date.now()}`);
    fs.renameSync(pendingMedia, config.mediaDir);
  }
  fs.rmSync(marker, { force: true });
  return true;
}
