import { Check, Clock3, Pause, X } from "lucide-react";
import { useEffect, useState } from "react";

export function SessionBar({durationMinutes,current,total,onFinish,onExit}:{durationMinutes:number;current:number;total:number;onFinish:()=>void;onExit:()=>void}){
  const [seconds,setSeconds]=useState(durationMinutes*60);const [paused,setPaused]=useState(false);
  useEffect(()=>{if(paused||seconds<=0)return;const id=setInterval(()=>setSeconds(v=>Math.max(0,v-1)),1000);return()=>clearInterval(id)},[paused,seconds]);
  const minutes=Math.floor(seconds/60).toString().padStart(2,"0");const secs=(seconds%60).toString().padStart(2,"0");
  return <div className="session-bar"><button onClick={onExit} aria-label="Thoát buổi học"><X size={18}/></button><div className="session-time"><Clock3 size={17}/><b>{minutes}:{secs}</b></div><div className="session-progress"><span><i style={{width:`${total?current/total*100:0}%`}}/></span><small>{current}/{total} từ</small></div><button onClick={()=>setPaused(!paused)}><Pause size={17}/>{paused?"Tiếp tục":"Tạm dừng"}</button><button className="finish-session" onClick={onFinish}><Check size={17}/>Kết thúc</button></div>
}
