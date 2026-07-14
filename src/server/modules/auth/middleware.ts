import type { NextFunction, Request, Response } from "express";
import type { AuthService, AuthUser } from "./service";

export const SESSION_COOKIE = "mme_session";
export interface AuthenticatedRequest extends Request { auth?: AuthUser }

export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return undefined;
}

export function optionalAuth(service: AuthService) {
  return (request: AuthenticatedRequest, _response: Response, next: NextFunction) => {
    request.auth = service.resolveSession(readCookie(request, SESSION_COOKIE)) ?? undefined;
    next();
  };
}

export function requireAuth(request: AuthenticatedRequest, response: Response, next: NextFunction) {
  if (!request.auth) return response.status(401).json({ error: "Chưa đăng nhập", code: "AUTH_REQUIRED" });
  next();
}
