import { Minus, Plus } from "lucide-react";
import { useState, type CSSProperties } from "react";
import type { DocumentDetail } from "../api/client";

export interface ReaderSelection { sectionId: number; selectedText: string; startOffset: number; endOffset: number }

interface DocumentReaderProps {
  document: DocumentDetail;
  onSelect: (selection: ReaderSelection) => void;
  selection: ReaderSelection | null;
  onSaveSentence: () => void;
  onCreateVocabulary: () => void;
  onAddToMindmap: () => void;
  onAskTutor: () => void;
}

const readNumber = (key: string, fallback: number) => {
  const value = Number(localStorage.getItem(key));
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

export function DocumentReader({ document, onSelect, selection, onSaveSentence, onCreateVocabulary, onAddToMindmap, onAskTutor }: DocumentReaderProps) {
  const [fontScale, setFontScale] = useState(() => readNumber("reader-font-scale", 1));
  const [lineHeight, setLineHeight] = useState(() => readNumber("reader-line-height", 1.7));
  const changeFontScale = (next: number) => { const value = Math.min(1.3, Math.max(0.9, Number(next.toFixed(1)))); setFontScale(value); localStorage.setItem("reader-font-scale", String(value)); };
  const changeLineHeight = (next: number) => { const value = Math.min(2.1, Math.max(1.5, Number(next.toFixed(1)))); setLineHeight(value); localStorage.setItem("reader-line-height", String(value)); };

  return <div className="document-reader">
    <aside><p className="eyebrow">MỤC LỤC</p>{document.sections.map((section) => <a key={section.id} href={`#section-${section.id}`}>{section.heading || `Đoạn ${section.sortOrder + 1}`}</a>)}</aside>
    <article style={{ "--reader-font-scale": fontScale, "--reader-line-height": lineHeight } as CSSProperties}>
      <div className="reader-type-controls" aria-label="Điều chỉnh hiển thị bài đọc">
        <span>Cỡ chữ</span><button aria-label="Giảm cỡ chữ" onClick={() => changeFontScale(fontScale - 0.1)}><Minus size={15}/></button><button aria-label="Tăng cỡ chữ" onClick={() => changeFontScale(fontScale + 0.1)}><Plus size={15}/></button>
        <span>Giãn dòng</span><button aria-label="Giảm giãn dòng" onClick={() => changeLineHeight(lineHeight - 0.2)}><Minus size={15}/></button><button aria-label="Tăng giãn dòng" onClick={() => changeLineHeight(lineHeight + 0.2)}><Plus size={15}/></button>
      </div>
      {document.sections.map((section) => <section id={`section-${section.id}`} key={section.id} onMouseUp={() => {
        const selected = window.getSelection();
        const selectedText = selected?.toString().trim() ?? "";
        if (!selectedText) return;
        const startOffset = Math.min(selected?.anchorOffset ?? 0, selected?.focusOffset ?? 0);
        onSelect({ sectionId: section.id, selectedText, startOffset, endOffset: startOffset + selectedText.length });
      }}>
        {section.heading && <h2>{section.heading}</h2>}
        {section.content.split(/\n{2,}/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
      </section>)}
    </article>
    <aside className="reader-notes"><p className="eyebrow">GHI CHÚ HỌC</p>{selection ? <div className="selection-card"><q>{selection.selectedText}</q><button onClick={onCreateVocabulary}>Tạo thẻ từ</button><button onClick={onSaveSentence}>Lưu vào sổ câu</button><button onClick={onAddToMindmap}>Thêm vào mindmap</button><button onClick={onAskTutor}>Hỏi gia sư</button></div> : <p>Chọn một từ hoặc câu trong bài đọc.</p>}</aside>
  </div>;
}
