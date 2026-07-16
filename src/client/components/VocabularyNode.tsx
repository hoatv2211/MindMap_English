import { Image, Plus, Volume2 } from "lucide-react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";

export interface VocabularyNodeData extends Record<string,unknown>{label:string;meaningVi:string;ipa:string;nodeType:"root"|"branch"|"vocabulary";color:string;status:string;imageUrl?:string|null;onSpeak?:(text:string)=>void;onAddNote?:(nodeId:number)=>void;nodeId:number}
type VocabularyFlowNode=Node<VocabularyNodeData,"vocabulary">;
export function VocabularyNode({data,selected}:NodeProps<VocabularyFlowNode>){
  const isRoot=data.nodeType==="root"; const isBranch=data.nodeType==="branch";
  return <div className={`vocab-node ${data.color} ${data.nodeType} ${selected?"selected":""}`} tabIndex={0}>
    <Handle type="target" position={Position.Left}/>{data.imageUrl&&<img className="node-image" src={data.imageUrl} alt=""/>}<div className="node-copy"><strong>{data.label}</strong>{data.ipa&&<small>{data.ipa}</small>}{data.meaningVi&&<span>{data.meaningVi}</span>}</div>
    {isBranch&&data.onAddNote&&<button className="node-add-note" onClick={(event)=>{event.stopPropagation();data.onAddNote?.(data.nodeId)}} aria-label={`Add word to ${data.label}`}><Plus size={13}/></button>}
    {!isRoot&&!isBranch&&<button className="node-audio" onClick={(event)=>{event.stopPropagation();data.onSpeak?.(data.label)}} aria-label={`Nghe ${data.label}`}><Volume2 size={14}/></button>}
    {!isRoot&&!isBranch&&!data.imageUrl&&<i className="node-image-placeholder" title="Chưa có ảnh"><Image size={13}/></i>}{!isRoot&&!isBranch&&<i className={`status-mark ${data.status}`} title={data.status}/>}<Handle type="source" position={Position.Right}/>
  </div>
}
