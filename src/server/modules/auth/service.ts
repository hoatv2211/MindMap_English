import { createHash, randomBytes } from "node:crypto";
import type { AppDatabase } from "../../db/database";
import { withTransaction } from "../../db/database";
import { hashSecret, verifySecret } from "./password";

export interface AuthUser { id: number; username: string; profileRevision: number }
export interface AuthResult { user: AuthUser; sessionToken: string; recoveryCode?: string }

function normalizeUsername(username: string): string { return username.trim().normalize("NFKC").toLowerCase(); }
function tokenHash(token: string): string { return createHash("sha256").update(token).digest("hex"); }
function isoAfter(hours: number): string { return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString(); }
function recoveryCode(): string { return randomBytes(12).toString("hex").toUpperCase().match(/.{1,6}/g)!.join("-"); }

export class AuthError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message); }
}

export class AuthService {
  constructor(private readonly db: AppDatabase, private readonly sessionHours: number, private readonly absoluteSessionHours: number) {}

  async register(input: { username: string; password: string }): Promise<AuthResult> {
    const username = input.username.trim().normalize("NFKC");
    const normalized = normalizeUsername(username);
    if (username.length < 3 || username.length > 40 || !/^[\p{L}\p{N}._-]+$/u.test(username)) throw new AuthError(400, "INVALID_USERNAME", "Tên đăng nhập không hợp lệ");
    if (input.password.length < 12 || input.password.length > 200) throw new AuthError(400, "WEAK_PASSWORD", "Mật khẩu cần ít nhất 12 ký tự");
    if (this.db.prepare("SELECT 1 FROM users WHERE normalized_username=?").get(normalized)) throw new AuthError(409, "USERNAME_TAKEN", "Tên đăng nhập đã được sử dụng");
    const passwordHash = await hashSecret(input.password);
    const code = recoveryCode();
    const codeHash = await hashSecret(code);
    const userId = withTransaction(this.db, () => {
      const id = Number(this.db.prepare("INSERT INTO users(username,normalized_username,password_hash) VALUES (?,?,?)").run(username, normalized, passwordHash).lastInsertRowid);
      this.db.prepare("INSERT INTO password_recovery_codes(user_id,code_hash) VALUES (?,?)").run(id, codeHash);
      return id;
    });
    return { ...this.createSession(userId, username, 1), recoveryCode: code };
  }

  async login(input: { username: string; password: string }): Promise<AuthResult> {
    const row = this.db.prepare("SELECT id,username,password_hash passwordHash,profile_revision profileRevision,status FROM users WHERE normalized_username=?").get(normalizeUsername(input.username)) as { id:number;username:string;passwordHash:string;profileRevision:number;status:string } | undefined;
    if (!row || row.status !== "active" || !(await verifySecret(input.password, row.passwordHash))) throw new AuthError(401, "INVALID_CREDENTIALS", "Tên đăng nhập hoặc mật khẩu không đúng");
    return this.createSession(row.id, row.username, row.profileRevision);
  }

  resolveSession(token: string | undefined): AuthUser | null {
    if (!token) return null;
    const now = new Date().toISOString();
    const row = this.db.prepare(`SELECT s.id sessionId,s.expires_at expiresAt,s.absolute_expires_at absoluteExpiresAt,u.id,u.username,u.profile_revision profileRevision
      FROM auth_sessions s JOIN users u ON u.id=s.user_id
      WHERE s.token_hash=? AND u.status='active'`).get(tokenHash(token)) as {sessionId:number;expiresAt:string;absoluteExpiresAt:string;id:number;username:string;profileRevision:number} | undefined;
    if (!row || row.expiresAt <= now || row.absoluteExpiresAt <= now) {
      if (row) this.db.prepare("DELETE FROM auth_sessions WHERE id=?").run(row.sessionId);
      return null;
    }
    const nextExpiry = isoAfter(this.sessionHours) < row.absoluteExpiresAt ? isoAfter(this.sessionHours) : row.absoluteExpiresAt;
    this.db.prepare("UPDATE auth_sessions SET expires_at=?,last_seen_at=? WHERE id=?").run(nextExpiry, now, row.sessionId);
    return { id: row.id, username: row.username, profileRevision: row.profileRevision };
  }

  logout(token: string | undefined): void { if (token) this.db.prepare("DELETE FROM auth_sessions WHERE token_hash=?").run(tokenHash(token)); }

  async recover(input: { username: string; recoveryCode: string; password: string }): Promise<AuthResult> {
    if (input.password.length < 12 || input.password.length > 200) throw new AuthError(400, "WEAK_PASSWORD", "Mật khẩu cần ít nhất 12 ký tự");
    const user = this.db.prepare("SELECT id,username FROM users WHERE normalized_username=? AND status='active'").get(normalizeUsername(input.username)) as {id:number;username:string} | undefined;
    const invalid = () => new AuthError(400, "INVALID_RECOVERY", "Thông tin khôi phục không hợp lệ");
    if (!user) throw invalid();
    const codes = this.db.prepare("SELECT id,code_hash codeHash FROM password_recovery_codes WHERE user_id=? AND consumed_at IS NULL ORDER BY id DESC").all(user.id) as Array<{id:number;codeHash:string}>;
    let matched: {id:number;codeHash:string} | undefined;
    for (const code of codes) if (await verifySecret(input.recoveryCode.trim().toUpperCase(), code.codeHash)) { matched = code; break; }
    if (!matched) throw invalid();
    const passwordHash = await hashSecret(input.password);
    const nextCode = recoveryCode();
    const nextCodeHash = await hashSecret(nextCode);
    withTransaction(this.db, () => {
      this.db.prepare("UPDATE password_recovery_codes SET consumed_at=CURRENT_TIMESTAMP WHERE id=?").run(matched!.id);
      this.db.prepare("UPDATE users SET password_hash=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(passwordHash, user.id);
      this.db.prepare("DELETE FROM auth_sessions WHERE user_id=?").run(user.id);
      this.db.prepare("INSERT INTO password_recovery_codes(user_id,code_hash) VALUES (?,?)").run(user.id, nextCodeHash);
    });
    return { ...this.createSession(user.id, user.username, 1), recoveryCode: nextCode };
  }

  private createSession(userId: number, username: string, profileRevision: number): AuthResult {
    const token = randomBytes(32).toString("base64url");
    this.db.prepare("INSERT INTO auth_sessions(user_id,token_hash,expires_at,absolute_expires_at) VALUES (?,?,?,?)")
      .run(userId, tokenHash(token), isoAfter(this.sessionHours), isoAfter(this.absoluteSessionHours));
    return { user: { id: userId, username, profileRevision }, sessionToken: token };
  }
}
