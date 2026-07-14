import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import AdmZip from "adm-zip";
import type { AppConfig } from "../../config";
import type { AppDatabase } from "../../db/database";

interface BackupManifest { version: 1; createdAt: string; app: "mindmap-english-local-ai"; databaseFile: string; }

export class BackupService {
  constructor(private readonly db: AppDatabase, private readonly config: AppConfig) {
    fs.mkdirSync(config.backupDir, { recursive: true });
    fs.mkdirSync(config.mediaDir, { recursive: true });
  }

  async createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const id = `backup-${timestamp}-${crypto.randomBytes(3).toString("hex")}`;
    const tempDb = path.join(this.config.backupDir, `${id}.db`);
    const zipPath = path.join(this.config.backupDir, `${id}.zip`);
    await this.db.backup(tempDb);
    const manifest: BackupManifest = { version: 1, createdAt: new Date().toISOString(), app: "mindmap-english-local-ai", databaseFile: "database.db" };
    const zip = new AdmZip();
    zip.addLocalFile(tempDb, "", "database.db");
    zip.addFile("manifest.json", Buffer.from(JSON.stringify(manifest, null, 2), "utf8"));
    if (fs.existsSync(this.config.mediaDir)) zip.addLocalFolder(this.config.mediaDir, "media");
    zip.writeZip(zipPath);
    fs.rmSync(tempDb, { force: true });
    const size = fs.statSync(zipPath).size;
    this.db.prepare("INSERT INTO backups(filename,size_bytes) VALUES (?,?)").run(path.basename(zipPath), size);
    return { id, filename: path.basename(zipPath), sizeBytes: size, createdAt: manifest.createdAt };
  }

  listBackups() {
    return (this.db.prepare("SELECT id,filename,size_bytes sizeBytes,created_at createdAt FROM backups ORDER BY id DESC").all() as Array<{id:number;filename:string;sizeBytes:number;createdAt:string}>).filter((item) => fs.existsSync(path.join(this.config.backupDir, item.filename)));
  }

  stageRestore(id: number) {
    const row = this.db.prepare("SELECT filename FROM backups WHERE id=?").get(id) as { filename: string } | undefined;
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

export function applyPendingRestore(config: AppConfig): boolean {
  const pendingDb = `${config.databasePath}.restore`;
  const marker = `${config.databasePath}.restore.json`;
  if (!fs.existsSync(pendingDb) || !fs.existsSync(marker)) return false;
  fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });
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
