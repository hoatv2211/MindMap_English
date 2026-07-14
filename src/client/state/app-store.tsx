import { createContext, useContext, useMemo, useState, type PropsWithChildren } from "react";

export type Page = "today"|"library"|"mindmap"|"create"|"learning"|"progress"|"settings";
interface AppState { page:Page; setPage:(page:Page)=>void; selectedMindmapId:number|null; openMindmap:(id:number)=>void; activeSessionId:number|null; startSession:(id:number)=>void; agentOpen:boolean; setAgentOpen:(open:boolean)=>void; focusMode:boolean;setFocusMode:(focus:boolean)=>void; }
const Context=createContext<AppState|null>(null);
export function AppStoreProvider({children}:PropsWithChildren){
  const [page,setPage]=useState<Page>("today"); const [selectedMindmapId,setSelectedMindmapId]=useState<number|null>(null); const [activeSessionId,setActiveSessionId]=useState<number|null>(null); const [agentOpen,setAgentOpen]=useState(false); const [focusMode,setFocusMode]=useState(false);
  const value=useMemo(()=>({page,setPage,selectedMindmapId,openMindmap:(id:number)=>{setSelectedMindmapId(id);setPage("mindmap")},activeSessionId,startSession:(id:number)=>{setActiveSessionId(id);setPage("learning")},agentOpen,setAgentOpen,focusMode,setFocusMode}),[page,selectedMindmapId,activeSessionId,agentOpen,focusMode]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAppStore(){const value=useContext(Context);if(!value)throw new Error("AppStoreProvider missing");return value}
