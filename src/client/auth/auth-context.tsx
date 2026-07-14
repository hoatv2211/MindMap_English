import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { api, type AuthUser } from "../api/client";

type AuthState = {status:"loading"}|{status:"anonymous"}|{status:"recovery-checkpoint";user:AuthUser;recoveryCode:string}|{status:"authenticated";user:AuthUser};
type AuthContextValue = AuthState & {
  login: (input:{username:string;password:string}) => Promise<void>;
  register: (input:{username:string;password:string;passwordConfirmation:string}) => Promise<void>;
  recover: (input:{username:string;recoveryCode:string;password:string;passwordConfirmation:string}) => Promise<void>;
  confirmRecoverySaved: () => void;
  logout: () => Promise<void>;
}
const Context=createContext<AuthContextValue|null>(null);
export function AuthProvider({children}:PropsWithChildren){
  const [state,setState]=useState<AuthState>({status:"loading"});
  useEffect(()=>{let active=true;api.authMe().then(({user})=>active&&setState({status:"authenticated",user})).catch(()=>active&&setState({status:"anonymous"}));return()=>{active=false}},[]);
  const value=useMemo<AuthContextValue>(()=>({...state,
    login:async(input)=>{const result=await api.login(input);setState({status:"authenticated",user:result.user})},
    register:async(input)=>{const result=await api.register(input);setState({status:"recovery-checkpoint",user:result.user,recoveryCode:result.recoveryCode})},
    recover:async(input)=>{const result=await api.recoverPassword(input);setState({status:"recovery-checkpoint",user:result.user,recoveryCode:result.recoveryCode})},
    confirmRecoverySaved:()=>setState((current)=>current.status==="recovery-checkpoint"?{status:"authenticated",user:current.user}:current),
    logout:async()=>{await api.logout();setState({status:"anonymous"})},
  }),[state]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAuth(){const value=useContext(Context);if(!value)throw new Error("AuthProvider missing");return value}

