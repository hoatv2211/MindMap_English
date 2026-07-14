import { createContext, useContext, useMemo, useState, type PropsWithChildren } from "react";

export type Page = "today" | "library" | "mindmap" | "create" | "learning" | "practice" | "reading" | "progress" | "settings";

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
  }), [page, selectedMindmapId, activeSessionId, agentOpen, agentDraft, focusMode, mindmapDraftTerm]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAppStore() {
  const value = useContext(Context);
  if (!value) throw new Error("AppStoreProvider missing");
  return value;
}
