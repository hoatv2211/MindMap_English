import { Mic, Play, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, type NotebookEntry, type SpeakingAttemptResult, type SpeakingSessionResult } from "../api/client";
import { TranscriptDiff } from "../components/TranscriptDiff";

export function PracticePage() {
  const [notebook, setNotebook] = useState<NotebookEntry[]>([]);
  const [session, setSession] = useState<SpeakingSessionResult | null>(null);
  const [index, setIndex] = useState(0);
  const [attempt, setAttempt] = useState<SpeakingAttemptResult | null>(null);
  const [manualTranscript, setManualTranscript] = useState("");
  const [recordingState, setRecordingState] = useState<"idle" | "recording" | "processing">("idle");
  const [speechError, setSpeechError] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);

  useEffect(() => { void api.speakingNotebook().then(setNotebook); }, []);
  const item = session?.items[index];

  const startSession = async () => {
    const created = await api.createSpeakingSession(notebook.map((entry) => entry.id));
    setSession(created);
    setIndex(0);
    setAttempt(null);
  };

  const analyze = async (transcript: string, durationMs = 0) => {
    if (!session || !item) return;
    setRecordingState("processing");
    try { setAttempt(await api.speakingAttempt(session.id, { sentenceId: item.sentenceId, transcript, durationMs })); }
    finally { setRecordingState("idle"); }
  };

  const startRecording = async () => {
    if (!item || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { setSpeechError("Speech provider chưa sẵn sàng. Bạn vẫn có thể nhập transcript thủ công."); return; }
    setSpeechError("");
    let stream: MediaStream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch { setSpeechError("Speech provider chưa sẵn sàng. Bạn vẫn có thể nhập transcript thủ công."); return; }
    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];
    startedAtRef.current = performance.now();
    recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
      const form = new FormData();
      form.append("audio", blob, "shadowing.webm");
      void api.transcribe(form).then((result) => analyze(result.text, Math.round(performance.now() - startedAtRef.current))).catch(() => setSpeechError("Speech provider chưa sẵn sàng. Bạn vẫn có thể nhập transcript thủ công.")).finally(() => stream.getTracks().forEach((track) => track.stop()));
    };
    recorderRef.current = recorder;
    recorder.start();
    setRecordingState("recording");
  };

  const stopRecording = () => { if (recorderRef.current?.state === "recording") recorderRef.current.stop(); };
  const speak = async () => {
    if (!item) return;
    setSpeechError("");
    try {
      const blob = await api.synthesize(item.sentence);
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
    } catch { setSpeechError("Speech provider chưa sẵn sàng. Bạn vẫn có thể nhập transcript thủ công."); }
  };

  const finishSession = async () => {
    if (!session) return;
    setSession(await api.completeSpeakingSession(session.id));
  };

  if (notebook.length === 0) return <div className="page practice-page"><header className="page-header"><div><p className="eyebrow">PHÒNG LUYỆN</p><h1>Nói từng câu,<br/><em>tiến từng chút.</em></h1></div></header><div className="empty-state">Lưu câu đầu tiên để bắt đầu shadowing.</div></div>;

  if (session?.status === "completed") return <div className="practice-complete"><p className="eyebrow">SHADOWING</p><h1>Buổi luyện đã hoàn tất.</h1><p>Bạn đã đi hết {session.items.length} câu trong buổi này.</p><button className="primary-action" onClick={() => setSession(null)}>Về phòng luyện</button></div>;

  if (!session || !item) return <div className="page practice-page"><header className="page-header"><div><p className="eyebrow">PHÒNG LUYỆN</p><h1>Nói từng câu,<br/><em>tiến từng chút.</em></h1></div></header><section className="practice-intro"><div><b>{notebook.length} câu trong sổ</b><p>Nghe mẫu, nói lại, xem phần khác biệt rồi thử lần nữa.</p></div><button className="primary-action" onClick={() => void startSession()}>Bắt đầu luyện</button>{notebook.map((entry) => <article key={entry.id}><strong>{entry.sentence}</strong><span>{entry.translationVi}</span></article>)}</section></div>;

  return <div className="practice-focus">
    <header><span>SHADOWING</span><b>Câu {index + 1} / {session.items.length}</b></header>
    <main>
      <section className="practice-prompt"><p className="eyebrow">CÂU MỤC TIÊU</p><h1>{item.sentence}</h1><p>{item.translationVi}</p><button className="quiet-action" onClick={() => void speak()}><Play size={17}/>Nghe mẫu</button><button className={`record-action ${recordingState}`} onPointerDown={() => void startRecording()} onPointerUp={stopRecording} onPointerCancel={stopRecording}><Mic size={24}/>{recordingState === "recording" ? "Đang nghe…" : recordingState === "processing" ? "Đang phân tích…" : "Giữ để nói"}</button></section>
      <section className="practice-feedback"><p className="eyebrow">BẢN THỬ CỦA BẠN</p>{attempt ? <><p className="content-score">{Math.round(attempt.contentScore * 100)}% khớp nội dung</p><TranscriptDiff tokens={attempt.diff}/><button className="quiet-action" onClick={() => setAttempt(null)}><RotateCcw size={16}/>Nói lại</button></> : <p>Transcript và ba điểm cần sửa sẽ xuất hiện ở đây.</p>}{speechError && <p className="inline-error">{speechError}</p>}<label className="manual-transcript">Transcript thử nghiệm<textarea value={manualTranscript} onChange={(event) => setManualTranscript(event.target.value)}/></label><button className="quiet-action dark" disabled={!manualTranscript.trim()} onClick={() => void analyze(manualTranscript.trim())}>Phân tích transcript</button>{attempt && (index < session.items.length - 1 ? <button className="primary-action" onClick={() => { setIndex((current) => current + 1); setAttempt(null); setManualTranscript(""); }}>Câu tiếp</button> : <button className="primary-action" onClick={() => void finishSession()}>Hoàn tất buổi luyện</button>)}</section>
    </main>
  </div>;
}
