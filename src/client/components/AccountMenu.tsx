import { LogOut, UserRound } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../auth/auth-context";

export function AccountMenu(){const auth=useAuth();const[open,setOpen]=useState(false);if(auth.status!=="authenticated")return null;const initial=auth.user.username.slice(0,1).toUpperCase();return <div className="account-menu"><button className="account-trigger" onClick={()=>setOpen(value=>!value)} aria-expanded={open}><span>{initial}</span><small>{auth.user.username}</small></button>{open&&<div className="account-popover"><div><UserRound size={17}/><span><b>{auth.user.username}</b><small>Hồ sơ học tập riêng</small></span></div><button onClick={()=>void auth.logout()}><LogOut size={16}/>Đăng xuất</button></div>}</div>}
