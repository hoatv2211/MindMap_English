import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

export type AppDatabase = Database.Database;

export function createDatabase(filename: string): AppDatabase {
  if (filename !== ":memory:") {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
  }
  const db = new Database(filename);
  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  return db;
}

export function withTransaction<T>(db: AppDatabase, operation: () => T): T {
  return db.transaction(operation)();
}
