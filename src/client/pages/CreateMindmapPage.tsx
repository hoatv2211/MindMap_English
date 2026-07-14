import { AlertTriangle, ArrowRight, Check, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type GeneratedResult } from "../api/client";
import { DictionaryInput } from "../components/DictionaryInput";
import { useAppStore } from "../state/app-store";

export function CreateMindmapPage() {
  const { openMindmap, mindmapDraftTerm, clearMindmapDraftTerm } = useAppStore();
  const [topics, setTopics] = useState<Awaited<ReturnType<typeof api.topics>>>([]);
  const [topic, setTopic] = useState("");
  const [situation, setSituation] = useState("");
  const [topicId, setTopicId] = useState(1);
  const [result, setResult] = useState<GeneratedResult | null>(null);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [unconfirmedWords, setUnconfirmedWords] = useState<Set<string>>(() => new Set());

  useEffect(() => { void api.topics().then(setTopics); }, []);
  useEffect(() => {
    if (!mindmapDraftTerm) return;
    setTopic(mindmapDraftTerm);
    setSituation(`Mở rộng cách dùng "${mindmapDraftTerm}" từ tài liệu đang đọc.`);
    clearMindmapDraftTerm();
  }, [mindmapDraftTerm, clearMindmapDraftTerm]);

  const generate = async () => {
    if (topic.trim().length < 2) { setError("Nhập chủ đề ít nhất 2 ký tự."); return; }
    setLoading(true);
    setError("");
    try { setResult(await api.generateMindmap({ topic: topic.trim(), situation: situation.trim(), cefr: "B1" })); }
    catch (caught) { setError((caught as Error).message); }
    finally { setLoading(false); }
  };

  const updateWordTerm = (branchIndex: number, wordIndex: number, term: string) => {
    setResult((current) => current ? {
      ...current,
      draft: {
        ...current.draft,
        branches: current.draft.branches.map((branch, currentBranch) => currentBranch === branchIndex ? {
          ...branch,
          words: branch.words.map((word, currentWord) => currentWord === wordIndex ? { ...word, term } : word),
        } : branch),
      },
    } : current);
  };

  const save = async () => {
    if (!result) return;
    if (unconfirmedWords.size) { setError("Xác nhận các từ cần kiểm tra trước khi lưu bản nháp."); return; }
    const map = await api.saveGeneratedMindmap(topicId, result.draft);
    setSavedId(map.id);
  };

  const approve = async () => {
    if (!savedId) return;
    const map = await api.approveMindmap(savedId);
    openMindmap(map.id);
  };

  return <div className="page create-page">
    <header className="page-header compact"><div><p className="eyebrow">AI CREATION STUDIO</p><h1>Tạo mindmap<br/><em>từ tình huống thật.</em></h1></div></header>
    <section className="creator-layout">
      <div className="creator-form">
        <label>Chủ đề bạn muốn học<input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Ví dụ: phỏng vấn xin việc"/></label>
        <label>Tình huống thực tế<textarea value={situation} onChange={(event) => setSituation(event.target.value)} placeholder="Tôi muốn giới thiệu bản thân và trả lời câu hỏi về kinh nghiệm."/></label>
        <label>Nhóm thư viện<select value={topicId} onChange={(event) => setTopicId(Number(event.target.value))}>{topics.map((item) => <option value={item.id} key={item.id}>{item.titleVi}</option>)}</select></label>
        <div className="creator-note"><Sparkles size={18}/><p>AI tạo bản nháp B1 thực dụng. Nội dung chỉ lưu sau khi bạn duyệt.</p></div>
        <button className="primary-action" disabled={loading} onClick={() => void generate()}>{loading ? "Đang tạo..." : "Tạo bản nháp"}<ArrowRight size={18}/></button>
        {error && <div className="notice error">{error}</div>}
      </div>
      <div className="draft-preview">
        {!result ? <div className="draft-empty"><Sparkles/><h2>Bản nháp sẽ xuất hiện ở đây</h2><p>Nhánh, từ, nghĩa và câu mẫu đều sửa được trước khi lưu.</p></div> : <>
          <header><div><small>BẢN NHÁP · CHƯA LƯU</small><h2>{result.draft.title}</h2><p>{result.draft.description}</p></div>{result.duplicates.length > 0 && <span className="duplicate-warning"><AlertTriangle size={15}/>{result.duplicates.length} từ đã có</span>}</header>
          <div className="branch-preview">{result.draft.branches.map((branch, branchIndex) => <article className={branch.color} key={branch.label}>
            <h3>{branch.label}<small>{branch.meaningVi}</small></h3>
            {branch.words.map((word, wordIndex) => <div key={`${branch.label}-${wordIndex}`}>
              <DictionaryInput value={word.term} onChange={(term) => updateWordTerm(branchIndex, wordIndex, term)} onUnknownChange={(unconfirmed) => setUnconfirmedWords((current) => { const next = new Set(current); const key = `${branchIndex}:${wordIndex}`; if (unconfirmed) next.add(key); else next.delete(key); return next; })} ariaLabel={`Từ tiếng Anh ${wordIndex + 1}`}/>
              <span>{word.ipa}</span><p>{word.meaningVi}</p><blockquote>{word.example}</blockquote>
            </div>)}
          </article>)}</div>
          <div className="approval-actions">{!savedId ? <button onClick={() => void save()} className="quiet-action dark">Lưu bản nháp</button> : <button onClick={() => void approve()} className="primary-action"><Check size={17}/>Duyệt và mở mindmap</button>}</div>
        </>}
      </div>
    </section>
  </div>;
}
