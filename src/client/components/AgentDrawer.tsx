import { Send, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAppStore } from "../state/app-store";

export function AgentDrawer() {
  const { setAgentOpen, agentDraft, clearAgentDraft } = useAppStore();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([{ role: "assistant", content: "Bạn muốn luyện từ, sửa câu hay chuẩn bị một tình huống giao tiếp?" }]);
  const [loading, setLoading] = useState(false);
  useEffect(() => { if (agentDraft) { setMessage(agentDraft); clearAgentDraft(); } }, [agentDraft, clearAgentDraft]);
  const send = async () => {
    const text = message.trim();
    if (!text || loading) return;
    setMessages((items) => [...items, { role: "user", content: text }]);
    setMessage("");
    setLoading(true);
    try { const result = await api.tutor(text); setMessages((items) => [...items, { role: "assistant", content: result.reply }]); }
    catch (error) { setMessages((items) => [...items, { role: "assistant", content: error instanceof Error ? error.message : "Không thể gọi AI. Vui lòng thử lại." }]); }
    finally { setLoading(false); }
  };
  return <aside className="agent-drawer" aria-label="AI gia sư"><header><span><Sparkles size={18}/> Gia sư AI</span><button onClick={() => setAgentOpen(false)} aria-label="Đóng"><X size={18}/></button></header><div className="agent-messages">{messages.map((item, index) => <div key={index} className={`message ${item.role}`}>{item.content}</div>)}{loading && <div className="message assistant typing">Đang suy nghĩ…</div>}</div><div className="agent-input"><textarea value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder="Hỏi cách dùng một từ..."/><button onClick={() => void send()} aria-label="Gửi"><Send size={18}/></button></div></aside>;
}
