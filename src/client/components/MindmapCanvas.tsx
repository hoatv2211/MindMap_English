import "@xyflow/react/dist/style.css";
import {Background,BackgroundVariant,Controls,MiniMap,ReactFlow,type Edge,type Node} from "@xyflow/react";
import {useMemo} from "react";
import type {Mindmap} from "../../shared/contracts";
import {VocabularyNode,type VocabularyNodeData} from "./VocabularyNode";

export function MindmapCanvas({map,onNodeMove,onSpeak,onAddNote,onSelectNode}:{map:Mindmap;onNodeMove:(nodeId:number,x:number,y:number)=>void;onSpeak:(text:string)=>void;onAddNote?:(nodeId:number)=>void;onSelectNode?:(nodeId:number)=>void}){
 const nodes=useMemo<Node<VocabularyNodeData>[]>(()=>map.nodes.map(node=>({id:String(node.id),type:"vocabulary",position:{x:node.x,y:node.y},data:{nodeId:node.id,label:node.label,meaningVi:node.meaningVi,ipa:node.ipa,nodeType:node.nodeType,color:node.color,status:node.status,onSpeak,onAddNote}})),[map,onSpeak,onAddNote]);
 const edges=useMemo<Edge[]>(()=>map.nodes.filter(node=>node.parentId).map(node=>({id:`e-${node.parentId}-${node.id}`,source:String(node.parentId),target:String(node.id),type:"smoothstep",animated:false,style:{stroke:`var(--branch-${node.color})`,strokeWidth:2}})),[map]);
 return <div className="mindmap-canvas"><ReactFlow nodes={nodes} edges={edges} nodeTypes={{vocabulary:VocabularyNode}} fitView fitViewOptions={{padding:.24}} minZoom={.3} maxZoom={1.6} onNodeClick={(_,node)=>onSelectNode?.(Number(node.id))} onNodeDragStop={(_,node)=>onNodeMove(Number(node.id),node.position.x,node.position.y)}><Background variant={BackgroundVariant.Dots} gap={22} size={1}/><Controls showInteractive={false}/><MiniMap pannable zoomable nodeColor={node=>`var(--branch-${String((node.data as VocabularyNodeData).color)})`}/></ReactFlow></div>
}