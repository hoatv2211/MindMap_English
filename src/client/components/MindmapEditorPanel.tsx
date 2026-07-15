import {ChevronLeft,ChevronRight,Sparkles,X} from "lucide-react";
import {useEffect,useState,type PointerEvent as ReactPointerEvent} from "react";
import type {MindmapNode} from "../../shared/contracts";
import type {VocabularyInboxItem} from "../api/client";

export function MindmapEditorPanel({node,onSave,onAddWord,onApprove,onClose,aiItem,loading=false,error=""}:{node:MindmapNode|null;onSave:(input:Record<string,unknown>)=>void|Promise<void>;onAddWord:(term:string,context:string)=>void|Promise<void>;onApprove?:()=>void|Promise<void>;onClose:()=>void;aiItem?:VocabularyInboxItem|null;loading?:boolean;error?:string}){
 const [width,setWidth]=useState(400);const [collapsed,setCollapsed]=useState(false);const [label,setLabel]=useState(node?.label??"");const [meaning,setMeaning]=useState(node?.meaningVi??"");const [ipa,setIpa]=useState(node?.ipa??"");const [adding,setAdding]=useState(false);const [term,setTerm]=useState("");const [context,setContext]=useState("");
 useEffect(()=>{setLabel(node?.label??"");setMeaning(node?.meaningVi??"");setIpa(node?.ipa??"");setAdding(false)},[node?.id]);
 const startResize=(event:ReactPointerEvent)=>{if(window.matchMedia("(max-width: 900px)").matches)return;const startX=event.clientX;const startWidth=width;const move=(next:PointerEvent)=>setWidth(Math.max(360,Math.min(520,startWidth+(startX-next.clientX))));const stop=()=>{window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",stop)};window.addEventListener("pointermove",move);window.addEventListener("pointerup",stop)};
 return <aside className={`mindmap-editor ${collapsed?"is-collapsed":""}`} style={{width:collapsed?56:width}} aria-label="Chỉnh sửa mindmap">
  <div className="editor-resize-handle" role="separator" aria-label="Đổi độ rộng trình chỉnh sửa" tabIndex={0} onPointerDown={startResize} onKeyDown={event=>{if(event.key==="ArrowLeft")setWidth(value=>Math.min(520,value+16));if(event.key==="ArrowRight")setWidth(value=>Math.max(360,value-16))}}/>
  <button className="editor-collapse" onClick={()=>setCollapsed(value=>!value)} aria-label={collapsed?"Mở rộng trình chỉnh sửa":"Thu gọn trình chỉnh sửa"}><ChevronLeft size={17}/></button>
  {!collapsed&&<><header><div><small>TRÌNH CHỈNH SỬA</small><strong>{node?node.nodeType==="branch"?"Nhánh":"Từ vựng":"Chọn một node"}</strong></div><button onClick={onClose} aria-label="Đóng trình chỉnh sửa"><X size={18}/></button></header>
  {!node?<div className="editor-empty">Chọn một node để sửa. Chọn nhánh để thêm từ bằng AI.</div>:<>
   <label>Tên node<input aria-label="Tên node" value={label} onChange={event=>setLabel(event.target.value)}/></label>
   <label>Nghĩa / mô tả tiếng Việt<textarea aria-label="Nghĩa hoặc mô tả tiếng Việt" value={meaning} onChange={event=>setMeaning(event.target.value)}/></label>
   {node.nodeType==="vocabulary"&&<label>IPA<input aria-label="IPA" value={ipa} onChange={event=>setIpa(event.target.value)}/></label>}
   <div className="editor-actions"><button onClick={()=>{setLabel(node.label);setMeaning(node.meaningVi);setIpa(node.ipa)}}>Hoàn tác</button><button className="primary-action" onClick={()=>onSave({label,meaningVi:meaning,ipa})}>Lưu thay đổi</button></div>
   {node.nodeType==="branch"&&<section className="editor-ai"><button className="ai-add-toggle" onClick={()=>setAdding(value=>!value)}><Sparkles size={17}/>Thêm từ với AI<ChevronRight size={16}/></button>{adding&&<div className="ai-add-form"><label>Từ hoặc cụm từ<input aria-label="Từ hoặc cụm từ" value={term} onChange={event=>setTerm(event.target.value)}/></label><label>Ngữ cảnh cá nhân<textarea aria-label="Ngữ cảnh cá nhân" value={context} onChange={event=>setContext(event.target.value)}/></label><button className="primary-action" disabled={!term.trim()||loading} onClick={()=>onAddWord(term,context)}>{loading?"AI đang tạo...":"Tạo nháp AI"}</button></div>}
   {error&&<p className="inline-error">{error}</p>}{aiItem?.draft&&<div className="ai-draft-preview"><small>NHÁP AI · CẦN DUYỆT</small><strong>{aiItem.draft.displayTerm} <i>{aiItem.draft.ipa}</i></strong><p>{aiItem.draft.meaningVi}</p>{aiItem.draft.examples.map(example=><blockquote key={example.role}>{example.sentence}<small>{example.translationVi}</small></blockquote>)}<button className="primary-action" onClick={onApprove}>Duyệt & thêm</button></div>}</section>}
  </>}</>}
 </aside>
}