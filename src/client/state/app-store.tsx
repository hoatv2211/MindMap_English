import { createContext, useContext, useMemo, useState, type PropsWithChildren } from "react";
import type { VocabularyInboxStatus } from "../api/client";

export type Page = "today" | "library" | "mindmap" | "create" | "learning" | "path" | "practice" | "reading" | "progress" | "settings" | "vocabulary-inbox";

interface AppState {
  page: Page;
  setPage: (page: Page) => void;
  selectedMindmapId: number | null;
  openMindmap: (id: number) => void;
  activeSessionId: number | null;
  startSession: (id: number) => void;
  agentOpen: boolean;
  setAgentOpen: (open: boolean) => void;
  agentDraft: string;
  openAgentWithDraft: (draft: string) => void;
  clearAgentDraft: () => void;
  focusMode: boolean;
  setFocusMode: (focus: boolean) => void;
  mindmapDraftTerm: string;
  quickCaptureOpen:boolean;
  vocabularyInboxStatus:VocabularyInboxStatus;
  quickCaptureHints:{mindmapId?:number;parentNodeId?:number}|null;
  openQuickCapture:(hints?:{mindmapId?:number;parentNodeId?:number})=>void;
  closeQuickCapture:()=>void;
  openVocabularyInbox:(status?:VocabularyInboxStatus)=>void;
  startMindmapDraft: (term: string) => void;
  clearMindmapDraftTerm: () => void;
}

const Context = createContext<AppState | null>(null);

export function AppStoreProvider({ children }: PropsWithChildren) {
  const [page, setPage] = useState<Page>("today");
  const [selectedMindmapId, setSelectedMindmapId] = useState<number | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [agentOpen, setAgentOpen] = useState(false);
  const [agentDraft, setAgentDraft] = useState("");
  const [focusMode, setFocusMode] = useState(false);
  const [mindmapDraftTerm, setMindmapDraftTerm] = useState("");
  const [quickCaptureOpen,setQuickCaptureOpen]=useState(false);
  const [vocabularyInboxStatus,setVocabularyInboxStatus]=useState<VocabularyInboxStatus>("ready");
  const [quickCaptureHints,setQuickCaptureHints]=useState<{mindmapId?:number;parentNodeId?:number}|null>(null);
  const value = useMemo(() => ({
    page,
    setPage,
    selectedMindmapId,
    openMindmap: (id: number) => { setSelectedMindmapId(id); setPage("mindmap"); },
    activeSessionId,
    startSession: (id: number) => { setActiveSessionId(id); setPage("learning"); },
    agentOpen,
    setAgentOpen,
    agentDraft,
    openAgentWithDraft: (draft: string) => { setAgentDraft(draft); setAgentOpen(true); },
    clearAgentDraft: () => setAgentDraft(""),
    focusMode,
    setFocusMode,
    mindmapDraftTerm,
    startMindmapDraft: (term: string) => { setMindmapDraftTerm(term); setPage("create"); },
    clearMindmapDraftTerm: () => setMindmapDraftTerm(""),
    quickCaptureOpen,quickCaptureHints,vocabularyInboxStatus,
    openQuickCapture:(hints?:{mindmapId?:number;parentNodeId?:number})=>{setQuickCaptureHints(hints??null);setQuickCaptureOpen(true)},
    closeQuickCapture:()=>setQuickCaptureOpen(false),
    openVocabularyInbox:(status:VocabularyInboxStatus="ready")=>{setVocabularyInboxStatus(status==="queued"?"processing":status);setPage("vocabulary-inbox")},
  }), [page, selectedMindmapId, activeSessionId, agentOpen, agentDraft, focusMode, mindmapDraftTerm, quickCaptureOpen, quickCaptureHints, vocabularyInboxStatus]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAppStore() {
  const value = useContext(Context);
  if (!value) throw new Error("AppStoreProvider missing");
  return value;
}
