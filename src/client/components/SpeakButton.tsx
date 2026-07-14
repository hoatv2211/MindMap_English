import { Mic, Square, Volume2 } from "lucide-react";
import { useRef, useState } from "react";
import { api } from "../api/client";
import { speakEnglish } from "../lib/speech";

export function SpeakButton({targetText}:{targetText:string}){const [recording,setRecording]=useState(false);const [transcript,setTranscript]=useState("");const [error,setError]=useState("");const recorder=useRef<MediaRecorder|null>(null);const chunks=useRef<Blob[]>([]);
const start=async()=>{setError("");try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});const media=new MediaRecorder(stream);chunks.current=[];media.ondataavailable=e=>chunks.current.push(e.data);media.onstop=async()=>{stream.getTracks().forEach(track=>track.stop());const blob=new Blob(chunks.current,{type:media.mimeType||"audio/webm"});const form=new FormData();form.append("audio",blob,"speech.webm");try{setTranscript((await api.transcribe(form)).text)}catch(e){setError((e as Error).message)}};media.start();recorder.current=media;setRecording(true)}catch{setError("Không mở được microphone. Bạn có thể luyện bằng text.")}};
const stop=()=>{recorder.current?.stop();setRecording(false)};const play=()=>{try{speakEnglish(targetText)}catch(e){setError((e as Error).message)}};
return <div className="speak-practice"><div><b>Nói một câu với từ này</b><p>{targetText}</p></div><div className="speak-actions"><button onClick={recording?stop:start} className={recording?"recording":""}>{recording?<Square size={17}/>:<Mic size={17}/>} {recording?"Dừng":"Giữ ý, bấm để nói"}</button><button onClick={()=>void play()}><Volume2 size={17}/>Nghe mẫu</button></div>{transcript&&<div className="transcript"><small>AI nghe được</small><p>{transcript}</p></div>}{error&&<p className="inline-error">{error}</p>}</div>}
