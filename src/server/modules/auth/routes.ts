import { Router } from "express";
import { z } from "zod";
import type { AuthService } from "./service";
import { AuthError } from "./service";
import { readCookie, requireAuth, SESSION_COOKIE, type AuthenticatedRequest } from "./middleware";

const Credentials = z.object({ username: z.string(), password: z.string() });
const Register = Credentials.extend({ passwordConfirmation: z.string() }).refine((value) => value.password === value.passwordConfirmation, { message: "Mật khẩu xác nhận không khớp", path: ["passwordConfirmation"] });
const Recover = Register.extend({ recoveryCode: z.string() });
const ChangePassword = z.object({ currentPassword:z.string(),password:z.string(),passwordConfirmation:z.string() }).refine(value=>value.password===value.passwordConfirmation,{message:"Mật khẩu xác nhận không khớp",path:["passwordConfirmation"]});

export function createAuthRouter(service: AuthService, secureCookies: boolean) {
  const router = Router();
  const cookie = (response: import("express").Response, token: string) => response.cookie(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: secureCookies, path: "/", maxAge: 24 * 60 * 60 * 1000 });
  const handle = (error: unknown, response: import("express").Response) => {
    if (error instanceof AuthError) return response.status(error.status).json({ error: error.message, code: error.code });
    throw error;
  };

  router.post("/register", async (request, response) => { try { const value=Register.parse(request.body); const result=await service.register(value); cookie(response,result.sessionToken); return response.status(201).json({user:result.user,recoveryCode:result.recoveryCode}); } catch(error) { return handle(error,response); } });
  router.post("/login", async (request, response) => { try { const result=await service.login(Credentials.parse(request.body)); cookie(response,result.sessionToken); return response.json({user:result.user}); } catch(error) { return handle(error,response); } });
  router.post("/logout", (request, response) => { service.logout(readCookie(request,SESSION_COOKIE)); response.clearCookie(SESSION_COOKIE,{httpOnly:true,sameSite:"lax",secure:secureCookies,path:"/"}); return response.status(204).send(); });
  router.get("/me", requireAuth, (request: AuthenticatedRequest, response) => response.json({user:request.auth}));
  router.post("/password/change", requireAuth, async (request:AuthenticatedRequest,response)=>{try{const value=ChangePassword.parse(request.body);const result=await service.changePassword(request.auth!.id,value.currentPassword,value.password);cookie(response,result.sessionToken);return response.json({user:result.user})}catch(error){return handle(error,response)}});
  router.post("/password/recover", async (request,response) => { try { const value=Recover.parse(request.body); const result=await service.recover(value); cookie(response,result.sessionToken); return response.json({user:result.user,recoveryCode:result.recoveryCode}); } catch(error) { return handle(error,response); } });
  return router;
}
