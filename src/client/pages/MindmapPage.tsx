import { Focus, ListTree, PencilLine } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { Mindmap } from "../../shared/contracts";
import { api } from "../api/client";
import { MindmapCanvas } from "../components/MindmapCanvas";
import { useAppStore } from "../state/app-store";
import { speakEnglish } from "../lib/speech";

export function MindmapPage(){
  const {selectedMindmapId,setFocusMode}=useAppStore(); const [map,setMap]=useState<Mindmap|null>(null); const [listMode,setListMode]=useState(false);
  useEffect(()=>{if(selectedMindmapId)api.mindmap(selectedMindmapId).then(setMap)},[selectedMindmapId]);
  const move=useCallback((nodeId:number,x:number,y:number)=>{if(!map)return;setMap(current=>current?{...current,nodes:current.nodes.map(n=>n.id===nodeId?{...n,x,y}:n)}:current);void api.updateNode(map.id,nodeId,{x,y})},[map]);
  const speak=useCallback((text:string)=>{try{speakEnglish(text)}catch{/* IPA remains visible */}},[]);
  if(!map)return <div className="page-loading"><span className="loader"/>Đang mở mindmap...</div>;
  return <div className="mindmap-page"><header className="mindmap-toolbar"><div><small>{map.source==="seed"?"BỘ KHỞI ĐẦU":"MINDMAP CÁ NHÂN"}</small><h1>{map.title}</h1><p>{map.description}</p></div><div><button onClick={()=>setListMode(!listMode)}><ListTree size={17}/>{listMode?"Sơ đồ":"Danh sách"}</button><button><PencilLine size={17}/>Chỉnh sửa</button><button className="focus-button" onClick={()=>setFocusMode(true)}><Focus size={17}/>Tập trung</button></div></header>
    {listMode?<div className="node-list">{map.nodes.filter(n=>n.nodeType!=="root").map(node=><article key={node.id} className={node.nodeType}><i className={`dot ${node.color}`}/><div><b>{node.label}</b><span>{node.ipa}</span><p>{node.meaningVi}</p></div></article>)}</div>:<MindmapCanvas map={map} onNodeMove={move} onSpeak={speak}/>} 
  </div>
}
