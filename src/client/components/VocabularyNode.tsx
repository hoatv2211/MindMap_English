import { Headphones, Volume2 } from "lucide-react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";

export interface VocabularyNodeData extends Record<string,unknown>{label:string;meaningVi:string;ipa:string;nodeType:"root"|"branch"|"vocabulary";color:string;status:string;onSpeak?:(text:string)=>void}
type VocabularyFlowNode=Node<VocabularyNodeData,"vocabulary">;
export function VocabularyNode({data,selected}:NodeProps<VocabularyFlowNode>){
  const isRoot=data.nodeType==="root"; const isBranch=data.nodeType==="branch";
  return <div className={`vocab-node ${data.color} ${data.nodeType} ${selected?"selected":""}`} tabIndex={0}>
    <Handle type="target" position={Position.Left}/><div className="node-copy"><strong>{data.label}</strong>{data.ipa&&<small>{data.ipa}</small>}{data.meaningVi&&<span>{data.meaningVi}</span>}</div>
    {!isRoot&&!isBranch&&<button className="node-audio" onClick={(event)=>{event.stopPropagation();data.onSpeak?.(data.label)}} aria-label={`Nghe ${data.label}`}><Volume2 size={14}/></button>}
    {!isRoot&&!isBranch&&<i className={`status-mark ${data.status}`} title={data.status}/>}<Handle type="source" position={Position.Right}/>
  </div>
}
