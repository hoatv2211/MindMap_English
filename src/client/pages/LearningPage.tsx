import { useCallback, useEffect, useState } from "react";
import { api, type LearningSession } from "../api/client";
import { QuizCard } from "../components/QuizCard";
import { SessionBar } from "../components/SessionBar";
import { SpeakButton } from "../components/SpeakButton";
import { useAppStore } from "../state/app-store";
import { speakEnglish } from "../lib/speech";

export function LearningPage(){const {activeSessionId,setPage}=useAppStore();const [session,setSession]=useState<LearningSession|null>(null);const [index,setIndex]=useState(0);const [finished,setFinished]=useState(false);const [error,setError]=useState("");
useEffect(()=>{if(activeSessionId)api.session(activeSessionId).then(setSession).catch(e=>setError(e.message))},[activeSessionId]);
const complete=useCallback(async()=>{if(!session)return;try{const result=await api.completeSession(session.id);setSession(result);setFinished(true)}catch(e){setError((e as Error).message)}},[session]);
const grade=async(input:{answer:string;isCorrect:boolean;hintsUsed:number;grade:"again"|"hard"|"good"|"easy"})=>{if(!session)return;const item=session.items[index];await api.attempt(session.id,{vocabularyId:item.vocabularyId,promptType:item.activityType,responseMs:1200,...input});if(index>=session.items.length-1)await complete();else setIndex(v=>v+1)};
const speak=(text:string)=>{try{speakEnglish(text)}catch(e){setError((e as Error).message)}};
if(!activeSessionId)return <div className="page-loading">Chưa có buổi học đang mở.</div>;if(!session)return <div className="page-loading"><span className="loader"/>Đang xếp bài học...</div>;if(finished)return <div className="session-summary"><span>HOÀN THÀNH</span><h1>Một buổi học<br/><em>đã được giữ lại.</em></h1><p>{session.summary}</p><button className="primary-action" onClick={()=>setPage("today")}>Về Hôm nay</button></div>;
const item=session.items[index];return <div className="learning-page"><SessionBar durationMinutes={session.durationMinutes} current={index+1} total={session.items.length} onFinish={()=>void complete()} onExit={()=>setPage("today")}/>{error&&<div className="notice error">{error}</div>}<div className="lesson-stage"><div className="lesson-context"><small>CHỦ ĐỀ · EATING</small><h1>{item.term}</h1><p>{item.meaningVi}</p><div className={`memory-orb status-${item.status}`}><span>{index+1}</span><small>trên {session.items.length}</small></div></div><div>{item.activityType==="speak"?<><QuizCard key={item.id} item={item} onGrade={grade} onSpeak={speak}/><SpeakButton targetText={item.example||item.term}/></>:<QuizCard key={item.id} item={item} onGrade={grade} onSpeak={speak}/>}</div></div></div>}
