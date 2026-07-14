import { BookOpen, ChartNoAxesCombined, Library, Settings, Sparkles, Speech, X } from "lucide-react";
import type { PropsWithChildren } from "react";
import { useAppStore, type Page } from "../state/app-store";
import { AccountMenu } from "./AccountMenu";

const nav: Array<{ page: Page; label: string; icon: typeof BookOpen }> = [
  { page: "today", label: "HÃ´m nay", icon: BookOpen },
  { page: "library", label: "ThÆ° viá»‡n", icon: Library },
  { page: "practice", label: "PhÃ²ng luyá»‡n", icon: Speech },
  { page: "progress", label: "Tiáº¿n Ä‘á»™", icon: ChartNoAxesCombined },
];

export function AppShell({ children }: PropsWithChildren) {
  const { page, setPage, agentOpen, setAgentOpen, focusMode, setFocusMode } = useAppStore();
  return <div className={`app-shell ${focusMode ? "is-focus" : ""}`}>
    <aside className="sidebar" aria-label="Äiá»u hÆ°á»›ng chÃ­nh">
      <button className="brand" onClick={() => setPage("today")} aria-label="Vá» trang HÃ´m nay"><span className="brand-mark"><Sparkles size={19}/></span><span>MindMap<br/><b>English</b></span></button>
      <nav>{nav.map(({ page: target, label, icon: Icon }) => <button key={target} className={page === target ? "active" : ""} onClick={() => setPage(target)}><Icon size={20}/><span>{label}</span></button>)}</nav>
      <div className="sidebar-footer"><button className="settings-link" onClick={() => setPage("settings")}><Settings size={20}/><span>Cài đặt</span></button><AccountMenu/></div></aside>
    <main className="main-stage">{children}</main>
    {!focusMode && <button className="agent-fab" onClick={() => setAgentOpen(!agentOpen)} aria-expanded={agentOpen}><Sparkles size={18}/>{agentOpen ? "ÄÃ³ng gia sÆ°" : "Há»i gia sÆ°"}</button>}
    {focusMode && <button className="focus-exit" onClick={() => setFocusMode(false)}><X size={18}/>ThoÃ¡t táº­p trung</button>}
  </div>;
}

