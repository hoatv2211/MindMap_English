import {ArrowRight,Eye,Lightbulb,Volume2} from "lucide-react";
import {useState} from "react";
import type {LearningItem} from "../api/client";
import {createLearningPrompt,getLearningHint,isLearningAnswerCorrect} from "../lib/learning-prompt";

export function QuizCard({item,onGrade,onSpeak,externalHints=0}:{item:LearningItem;onGrade:(input:{answer:string;isCorrect:boolean;hintsUsed:number;grade:"again"|"hard"|"good"|"easy"})=>void;onSpeak:(text:string)=>void;externalHints?:number}){
  const [answer,setAnswer]=useState("");
  const [revealed,setRevealed]=useState(false);
  const [hints,setHints]=useState(0);
  const model=createLearningPrompt(item);
  const correct=isLearningAnswerCorrect(model,answer);
  const totalHints=hints+externalHints;
  return <article className="quiz-card">
    <div className="quiz-meta"><span>{labelFor(item.activityType)}</span><small>{item.cefr} · {item.status}</small></div>
    <button className="speak-word" onClick={()=>onSpeak(item.term)}><Volume2 size={17}/>Nghe từ</button>
    <h2>{model.question}</h2>
    {!revealed?<>
      <label className="answer-field"><span>Câu trả lời của bạn</span><input autoFocus value={answer} onChange={event=>setAnswer(event.target.value)} onKeyDown={event=>{if(event.key==="Enter")setRevealed(true)}} placeholder={model.placeholder}/></label>
      <div className="quiz-actions"><button className="hint-button" onClick={()=>setHints(value=>value+1)}><Lightbulb size={17}/>{model.hintLabel} {hints?`(${hints})`:""}</button><button className="primary-action" onClick={()=>setRevealed(true)}>Kiểm tra <ArrowRight size={17}/></button></div>
      {hints>0&&<p className="hint-text">{getLearningHint(model,hints)}</p>}
    </>:<div className="answer-reveal">
      <span className="reveal-label"><Eye size={16}/>ĐÁP ÁN GỢI Ý</span>
      <strong>{item.term} <small>{item.ipa}</small></strong>
      <p>{item.meaningVi}</p>
      {answer.trim()&&<p className={`answer-feedback ${correct?"is-correct":"needs-review"}`}>{correct?"Đúng rồi — hệ thống đã chấp nhận cách viết này.":"Chưa khớp. Xem đáp án, tự nói lại, rồi chọn Quên hoặc Khó."}</p>}
      {item.example&&<blockquote>{item.example}<small>{item.exampleVi}</small></blockquote>}
      <div className="grade-row"><button onClick={()=>onGrade({answer,isCorrect:correct,hintsUsed:totalHints,grade:"again"})}><b>Quên</b><small>10 phút</small></button><button onClick={()=>onGrade({answer,isCorrect:correct,hintsUsed:totalHints,grade:"hard"})}><b>Khó</b><small>1 ngày</small></button><button onClick={()=>onGrade({answer,isCorrect:true,hintsUsed:totalHints,grade:"good"})}><b>Tốt</b><small>vài ngày</small></button><button onClick={()=>onGrade({answer,isCorrect:true,hintsUsed:totalHints,grade:"easy"})}><b>Dễ</b><small>lâu hơn</small></button></div>
    </div>}
  </article>
}

function labelFor(type:string){return type==="meaning-recall"?"NHỚ TỪ":type==="context"?"NGỮ CẢNH":type==="speak"?"PHÁT ÂM":"NHỚ NGHĨA"}
