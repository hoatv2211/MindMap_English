import { BookOpen, ChartNoAxesCombined, Library, Settings, Sparkles, Speech, X } from "lucide-react";
import type { PropsWithChildren } from "react";
import { useAppStore, type Page } from "../state/app-store";

const nav: Array<{ page: Page; label: string; icon: typeof BookOpen }> = [
  { page: "today", label: "Hôm nay", icon: BookOpen },
  { page: "library", label: "Thư viện", icon: Library },
  { page: "practice", label: "Phòng luyện", icon: Speech },
  { page: "progress", label: "Tiến độ", icon: ChartNoAxesCombined },
];

export function AppShell({ children }: PropsWithChildren) {
  const { page, setPage, agentOpen, setAgentOpen, focusMode, setFocusMode } = useAppStore();
  return <div className={`app-shell ${focusMode ? "is-focus" : ""}`}>
    <aside className="sidebar" aria-label="Điều hướng chính">
      <button className="brand" onClick={() => setPage("today")} aria-label="Về trang Hôm nay"><span className="brand-mark"><Sparkles size={19}/></span><span>MindMap<br/><b>English</b></span></button>
      <nav>{nav.map(({ page: target, label, icon: Icon }) => <button key={target} className={page === target ? "active" : ""} onClick={() => setPage(target)}><Icon size={20}/><span>{label}</span></button>)}</nav>
      <button className="settings-link" onClick={() => setPage("settings")}><Settings size={20}/><span>Cài đặt</span></button>
    </aside>
    <main className="main-stage">{children}</main>
    {!focusMode && <button className="agent-fab" onClick={() => setAgentOpen(!agentOpen)} aria-expanded={agentOpen}><Sparkles size={18}/>{agentOpen ? "Đóng gia sư" : "Hỏi gia sư"}</button>}
    {focusMode && <button className="focus-exit" onClick={() => setFocusMode(false)}><X size={18}/>Thoát tập trung</button>}
  </div>;
}
