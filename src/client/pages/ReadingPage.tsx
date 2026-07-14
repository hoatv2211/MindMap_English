import { ArrowLeft, FileUp } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type DocumentDetail, type DocumentExtractionResult, type DocumentSummaryResult } from "../api/client";
import { DocumentReader, type ReaderSelection } from "../components/DocumentReader";
import { useAppStore } from "../state/app-store";

export function ReadingPage() {
  const { startMindmapDraft, openAgentWithDraft } = useAppStore();
  const [documents, setDocuments] = useState<DocumentSummaryResult[]>([]);
  const [active, setActive] = useState<DocumentDetail | null>(null);
  const [selection, setSelection] = useState<ReaderSelection | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [extraction, setExtraction] = useState<DocumentExtractionResult | null>(null);

  const refresh = () => api.documents().then(setDocuments);
  useEffect(() => { void refresh(); }, []);

  const open = async (id: number) => { setActive(await api.document(id)); setSelection(null); setMessage(""); setExtraction(null); };
  const upload = async () => {
    if (!file) return;
    await api.uploadDocument(file);
    setMessage(`Đã nhập ${file.name}`);
    setFile(null);
    await refresh();
  };
  const saveSentence = async () => {
    if (!active || !selection) return;
    const notebook = await api.addNotebookSentence({ sentence: selection.selectedText, translationVi: "", sourceType: "quoted", sourceReference: `document:${active.id}:section:${selection.sectionId}` });
    await api.addDocumentHighlight(active.id, { ...selection, sentenceId: notebook.id });
    setMessage("Đã lưu vào sổ câu.");
  };
  const createVocabulary = async () => {
    if (!active || !selection) return;
    await api.createDocumentVocabulary(active.id, { ...selection, meaningVi: "" });
    setMessage("Đã tạo thẻ từ.");
  };
  const extract = async () => {
    if (!active) return;
    setMessage("Đang phân tích nội dung…");
    try { setExtraction(await api.extractDocumentDraft(active.id, active.sections.map((section) => section.id))); setMessage("Bản nháp đã sẵn sàng để duyệt."); }
    catch (error) { setMessage((error as Error).message); }
  };

  if (active) return <div className="reading-workspace"><header><button onClick={() => setActive(null)}><ArrowLeft size={17}/>Thư viện</button><div><p className="eyebrow">ĐANG ĐỌC</p><h1>{active.title}</h1></div><button className="quiet-action dark" onClick={() => void extract()}>Phân tích chương</button></header><DocumentReader document={active} selection={selection} onSelect={setSelection} onSaveSentence={() => void saveSentence()} onCreateVocabulary={() => void createVocabulary()} onAddToMindmap={() => selection && startMindmapDraft(selection.selectedText)} onAskTutor={() => selection && openAgentWithDraft(`Giải thích cách dùng cụm "${selection.selectedText}" trong ngữ cảnh tự nhiên.`)}/>{extraction && <aside className="extraction-draft"><p className="eyebrow">BẢN NHÁP · CHƯA LƯU</p>{(["recommended", "optional", "skip"] as const).map((category) => <section key={category}><h2>{category === "recommended" ? "Nên học" : category === "optional" ? "Có thể biết" : "Bỏ qua"}</h2>{extraction.draft.vocabulary.filter((item) => item.category === category).map((item) => <article key={item.term}><b>{item.term}</b><span>{item.meaningVi}</span><small>{item.reason}</small></article>)}</section>)}</aside>}{message && <div className="reader-toast">{message}</div>}</div>;

  return <div className="page reading-page">
    <header className="page-header compact"><div><p className="eyebrow">BÀN ĐỌC CÁ NHÂN</p><h1>Đọc chậm,<br/><em>giữ lại điều hữu ích.</em></h1></div><div className="document-upload"><label>Chọn tài liệu<input aria-label="Chọn tài liệu" type="file" accept=".txt,.md,.epub,text/plain,text/markdown,application/epub+zip" onChange={(event) => setFile(event.target.files?.[0] ?? null)}/></label><button className="primary-action" disabled={!file} onClick={() => void upload()}><FileUp size={17}/>Nhập tài liệu</button></div></header>
    {message && <div className="notice">{message}</div>}
    {documents.length === 0 ? <div className="empty-state">Chưa có tài liệu. Nhập TXT, Markdown hoặc EPUB để bắt đầu.</div> : <section className="document-gallery">{documents.map((document, index) => <button key={document.id} className={index === 0 ? "feature-document" : "document-row"} onClick={() => void open(document.id)} aria-label={`Mở ${document.title}`}><small>{document.format.toUpperCase()} · {document.sectionCount} phần</small><h2>{document.title}</h2><p>{document.originalFilename}</p></button>)}</section>}
  </div>;
}
