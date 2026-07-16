import { BookOpen, ChartNoAxesCombined, Library, ListChecks, NotebookPen, Plus, Settings, Sparkles, Speech, X } from "lucide-react";
import { useEffect, useState, type PropsWithChildren } from "react";
import { api } from "../api/client";
import { useAppStore, type Page } from "../state/app-store";
import { AccountMenu } from "./AccountMenu";
import { QuickCaptureDrawer } from "./QuickCaptureDrawer";

const nav: Array<{ page: Page; label: string; icon: typeof BookOpen }> = [
  { page: "today", label: "Hôm nay", icon: BookOpen },
  { page: "library", label: "Thư viện", icon: Library },
  { page: "path", label: "Lộ trình", icon: ListChecks },
  { page: "vocabulary-inbox", label: "Hộp từ mới", icon: NotebookPen },
  { page: "practice", label: "Phòng luyện", icon: Speech },
  { page: "progress", label: "Tiến độ", icon: ChartNoAxesCombined },
];

export function AppShell({ children }: PropsWithChildren) {
  const { page, setPage, agentOpen, setAgentOpen, focusMode, setFocusMode, quickCaptureOpen, quickCaptureHints, openQuickCapture, closeQuickCapture, openVocabularyInbox } = useAppStore();
  const [pendingVocabularyCount,setPendingVocabularyCount]=useState(0);
  const refreshPendingVocabulary=()=>api.vocabularyInbox("ready").then(items=>setPendingVocabularyCount(items.length)).catch(()=>setPendingVocabularyCount(0));
  useEffect(()=>{void refreshPendingVocabulary()},[page]);
  useEffect(()=>{const handler=(event:KeyboardEvent)=>{const target=event.target as HTMLElement|null;if(event.key.toLowerCase()==="n"&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&target?.tagName!=="INPUT"&&target?.tagName!=="TEXTAREA"&&target?.getAttribute("contenteditable")!=="true")openQuickCapture()};window.addEventListener("keydown",handler);return()=>window.removeEventListener("keydown",handler)},[openQuickCapture]);
  return <div className={`app-shell ${focusMode ? "is-focus" : ""}`}>
    <aside className="sidebar" aria-label="Điều hướng chính">
      <button className="brand" onClick={() => setPage("today")} aria-label="Về trang Hôm nay"><img className="brand-mark" src={`${import.meta.env.BASE_URL}icon.svg`} alt=""/><span>MindMap<br/><b>English</b></span></button>
      <nav>{nav.map(({ page: target, label, icon: Icon }) => <button key={target} className={page === target ? "active" : ""} onClick={() => setPage(target)}><Icon size={20}/><span>{label}</span>{target==="vocabulary-inbox"&&pendingVocabularyCount>0&&<b className="nav-badge" aria-label={`${pendingVocabularyCount} từ chờ duyệt`}>{pendingVocabularyCount}</b>}</button>)}</nav>
      <div className="sidebar-footer"><button className="settings-link" onClick={() => setPage("settings")}><Settings size={20}/><span>Cài đặt</span></button><AccountMenu/></div></aside>
    <main className="main-stage">{children}</main>
    {!focusMode && <div className="floating-actions" role="group" aria-label="Hành động nhanh">
      <button className="quick-capture-fab" onClick={()=>openQuickCapture()}><Plus size={18}/>Ghi nhanh</button>
      <button className="agent-fab" onClick={() => setAgentOpen(!agentOpen)} aria-expanded={agentOpen}><Sparkles size={18}/>{agentOpen ? "Đóng gia sư" : "Hỏi gia sư"}</button>
    </div>}
    <QuickCaptureDrawer open={quickCaptureOpen} hints={quickCaptureHints} onClose={closeQuickCapture} onCreated={item=>{openVocabularyInbox(item.status);void refreshPendingVocabulary()}}/>
    {focusMode && <button className="focus-exit" onClick={() => setFocusMode(false)}><X size={18}/>Thoát tập trung</button>}
  </div>;
}
