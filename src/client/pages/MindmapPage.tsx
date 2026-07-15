import {Check,Focus,ListTree,PencilLine} from "lucide-react";
import {useCallback,useEffect,useState} from "react";
import type {Mindmap} from "../../shared/contracts";
import {api,type VocabularyInboxItem} from "../api/client";
import {MindmapCanvas} from "../components/MindmapCanvas";
import {MindmapEditorPanel} from "../components/MindmapEditorPanel";
import {useAppStore} from "../state/app-store";
import {speakEnglish} from "../lib/speech";

export function MindmapPage(){
 const {selectedMindmapId,setFocusMode,openQuickCapture,openMindmap}=useAppStore();const [map,setMap]=useState<Mindmap|null>(null);const [listMode,setListMode]=useState(false);const [editing,setEditing]=useState(false);const [selectedNodeId,setSelectedNodeId]=useState<number|null>(null);const [aiItem,setAiItem]=useState<VocabularyInboxItem|null>(null);const [loading,setLoading]=useState(false);const [error,setError]=useState("");
 const load=useCallback(async(id:number)=>{const next=await api.mindmap(id);setMap(next);return next},[]);
 useEffect(()=>{if(selectedMindmapId)void load(selectedMindmapId)},[selectedMindmapId,load]);
 const move=useCallback((nodeId:number,x:number,y:number)=>{if(!map||map.source==="seed")return;setMap(current=>current?{...current,nodes:current.nodes.map(node=>node.id===nodeId?{...node,x,y}:node)}:current);void api.updateNode(map.id,nodeId,{x,y})},[map]);
 const speak=useCallback((text:string)=>{try{speakEnglish(text)}catch{/* IPA remains visible */}},[]);
 const startEditing=async()=>{if(!map)return;setError("");try{if(map.source==="seed"){const copy=await api.personalMindmapCopy(map.id);setMap(copy);openMindmap(copy.id)}setEditing(true)}catch(reason){setError(reason instanceof Error?reason.message:"Không thể mở trình chỉnh sửa")}};
 const saveNode=async(input:Record<string,unknown>)=>{if(!map||!selectedNodeId)return;await api.updateNode(map.id,selectedNodeId,input);await load(map.id)};
 const addWord=async(term:string,contextText:string)=>{if(!map||!selectedNodeId)return;setLoading(true);setError("");try{const item=await api.captureVocabulary({rawText:term,contextText,sourceType:"mindmap",sourceReference:`map:${map.id}`,hintMindmapId:map.id,hintParentNodeId:selectedNodeId});setAiItem(item);if(item.status==="failed")setError(item.errorMessage??"AI chưa tạo được nháp") }catch(reason){setError(reason instanceof Error?reason.message:"AI chưa tạo được nháp")}finally{setLoading(false)}};
 const approve=async()=>{if(!map||!selectedNodeId||!aiItem)return;await api.approveVocabulary(aiItem.id,{mindmapId:map.id,parentNodeId:selectedNodeId});setAiItem(null);await load(map.id)};
 if(!map)return <div className="page-loading"><span className="loader"/>Đang mở mindmap...</div>;
 const selectedNode=map.nodes.find(node=>node.id===selectedNodeId)??null;
 return <div className={`mindmap-page ${editing?"is-editing":""}`}><header className="mindmap-toolbar"><div><small>{map.source==="seed"?"BỘ KHỞI ĐẦU":"MINDMAP CÁ NHÂN"}</small><h1>{map.title}</h1><p>{map.description}</p></div><div><button onClick={()=>setListMode(!listMode)}><ListTree size={17}/>{listMode?"Sơ đồ":"Danh sách"}</button><button className={editing?"editing-button":""} onClick={()=>editing?setEditing(false):void startEditing()}>{editing?<Check size={17}/>:<PencilLine size={17}/>} {editing?"Xong":"Chỉnh sửa"}</button><button className="focus-button" onClick={()=>setFocusMode(true)}><Focus size={17}/>Tập trung</button></div></header>{error&&<div className="notice error">{error}</div>}
  <div className="mindmap-workspace">{listMode?<div className="node-list">{map.nodes.filter(node=>node.nodeType!=="root").map(node=><article key={node.id} className={node.nodeType} onClick={()=>editing&&setSelectedNodeId(node.id)}><i className={`dot ${node.color}`}/><div><b>{node.label}</b><span>{node.ipa}</span><p>{node.meaningVi}</p></div></article>)}</div>:<MindmapCanvas map={map} onNodeMove={move} onSpeak={speak} onSelectNode={editing?setSelectedNodeId:undefined} onAddNote={!editing&&map.source!=="seed"?(nodeId)=>openQuickCapture({mindmapId:map.id,parentNodeId:nodeId}):undefined}/>} {editing&&<MindmapEditorPanel node={selectedNode} onSave={saveNode} onAddWord={addWord} onApprove={approve} onClose={()=>setEditing(false)} aiItem={aiItem} loading={loading} error={error}/>}</div>
 </div>
}