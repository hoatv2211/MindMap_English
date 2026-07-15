import { ArrowRight, CheckCircle2, Lock, Map } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type LearningPath, type LearningPathModule } from "../api/client";
import { useAppStore } from "../state/app-store";

export function LearningPathPage(){
  const {startSession}=useAppStore();const [paths,setPaths]=useState<LearningPath[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState("");
  useEffect(()=>{api.learningPaths().then(setPaths).catch((reason:Error)=>setError(reason.message)).finally(()=>setLoading(false))},[]);
  const active=paths.flatMap(path=>path.modules).find(module=>module.status==="active")??paths[0]?.modules[0];
  const begin=async(duration:10|20,module?:LearningPathModule)=>{if(!module)return;setLoading(true);setError("");try{const session=await api.createSession(duration,module.id);if(session.items.length===0){setError("Bài học này chưa có từ để luyện.");setLoading(false);return}startSession(session.id)}catch(reason){setError((reason as Error).message);setLoading(false)}};
  if(loading&&!paths.length)return <div className="page-loading"><span className="loader"/>Đang tải lộ trình...</div>;
  return <div className="page learning-path-page"><header className="page-header"><div><p className="eyebrow">LỘ TRÌNH CEFR</p><h1>Học theo đường đi,<br/><em>không học rời rạc.</em></h1><p>Đi từ A1 đến B2 bằng module tình huống, mindmap và SRS hiện có.</p></div>{active&&<button className="primary-action" onClick={()=>void begin(20,active)}>Học tiếp 20 phút <ArrowRight size={18}/></button>}</header>{error&&<div className="notice error">{error}</div>}<section className="path-grid">{paths.map(path=><article className="path-card" key={path.id}><header><small>{path.level}</small><h2>{path.title}</h2><p>{path.description}</p></header><div className="module-stack">{path.modules.map(module=><button key={module.id} className={`module-row ${module.status}`} disabled={module.status==="locked"} onClick={()=>void begin(20,module)}><span>{iconFor(module.status)}</span><b>{module.title}</b><small>{module.goalVi}</small><i>{module.progressPercent}% · {module.mindmapTitle??"Chưa gắn mindmap"}</i></button>)}</div></article>)}</section></div>
}
function iconFor(status:string){return status==="completed"?<CheckCircle2 size={18}/>:status==="locked"?<Lock size={18}/>:<Map size={18}/>}
