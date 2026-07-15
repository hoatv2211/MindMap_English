import { ArrowRight, BookOpenCheck, Clock3, Flame, RefreshCw, Sparkles, Target } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Dashboard } from "../../shared/contracts";
import { useAppStore } from "../state/app-store";

export function TodayPage(){
  const {startSession,setPage,openAgentWithDraft}=useAppStore(); const [data,setData]=useState<Dashboard|null>(null); const [error,setError]=useState(""); const [loading,setLoading]=useState(true);
  useEffect(()=>{Promise.all([api.dashboard(),api.health()]).then(([dashboard,health])=>setData({...dashboard,aiOnline:health.aiOnline})).catch((e:Error)=>setError(e.message)).finally(()=>setLoading(false))},[]);
  const begin=async(duration:10|20)=>{setLoading(true);try{const session=await api.createSession(duration);startSession(session.id)}catch(e){setError((e as Error).message);setLoading(false)}};
  const askRoadmap=()=>openAgentWithDraft(`Dựa trên dữ liệu tài khoản của tôi, hãy lập lộ trình học 7 ngày thật cụ thể. Tính cả: ${data?.dueCount??0} từ đến hạn, ${data?.weakCount??0} từ yếu, ${data?.newCount??0} từ mới, streak ${data?.streak??0} ngày, ${data?.weeklyMinutes??0}/${data?.weeklyGoalMinutes??100} phút tuần này. Hãy đề xuất mỗi ngày: mục tiêu, module/mindmap nên học, số phút, bài luyện nói, và tiêu chí hoàn thành.`);
  const hero=data?.unfinishedSessionId?{title:"Tiếp tục nhịp cũ,",em:"không mất đà.",text:"Bạn còn một buổi học đang mở. Hoàn thành nó trước rồi hãy mở bài mới."}:data?.dueCount?{title:"Ôn đúng hạn,",em:"nhớ lâu hơn.",text:`${data.dueCount} từ đang cần ôn hôm nay. Ưu tiên từ yếu, sau đó thêm một phần lộ trình ngắn.`}:{title:"Mở bài mới,",em:"đi theo lộ trình.",text:"Không có nhiều từ đến hạn. Hôm nay phù hợp để học module CEFR tiếp theo hoặc tạo mindmap mới."};
  if(loading&&!data)return <PageLoading label="Đang chuẩn bị buổi học..."/>;
  return <div className="page today-page">
    <header className="page-header"><div><p className="eyebrow">MONDAY · NHỊP HỌC CỦA BẠN</p><h1>Hôm nay mình<br/><em>nói được gì?</em></h1></div><div className={`ai-pill ${data?.aiOnline?"online":"offline"}`}><span/>{data?.aiOnline?"AI sẵn sàng":"Học offline"}</div></header>
    {error&&<div className="notice error">{error}</div>}
    <section className="today-grid">
      <article className="study-hero">
        <div className="study-copy"><span className="section-kicker"><BookOpenCheck size={17}/> BUỔI HỌC ĐỀ XUẤT</span><h2>{hero.title}<br/>{hero.em}</h2><p>{hero.text}</p>
          <div className="study-actions"><button className="primary-action" onClick={()=>begin(20)} disabled={loading}>Học 20 phút <ArrowRight size={18}/></button><button className="quiet-action" onClick={()=>begin(10)} disabled={loading}><Clock3 size={17}/> Bản nhanh 10 phút</button></div>
        </div>
        <div className="orbit-visual" aria-hidden="true"><span className="orbit-center">eating<small>ăn uống</small></span><span className="orbit-node n1">fruit</span><span className="orbit-node n2">seafood</span><span className="orbit-node n3">snacks</span><span className="orbit-node n4">dessert</span></div>
      </article>
      <aside className="today-side">
        <div className="streak-panel"><div><span className="metric-icon coral"><Flame size={19}/></span><small>CHUỖI HỌC</small><strong>{data?.streak??0} ngày</strong></div><p>Mỗi ngày ngắn thôi.<br/>Quan trọng là quay lại.</p></div>
        <div className="due-panel"><span className="metric-icon sky"><RefreshCw size={18}/></span><div><small>CẦN ÔN HÔM NAY</small><strong>{data?.dueCount??0} từ</strong></div><button onClick={()=>begin(10)} aria-label="Ôn nhanh"><ArrowRight size={18}/></button></div>
      </aside>
    </section>
    <section className="study-plan-grid">
      <button onClick={()=>begin(10)} disabled={loading}><RefreshCw size={18}/><span><b>Ôn {data?.dueCount??0} từ đến hạn</b><small>Ưu tiên weak/new theo SRS cá nhân</small></span><ArrowRight size={16}/></button>
      <button onClick={()=>setPage("path")}><BookOpenCheck size={18}/><span><b>Đi tiếp lộ trình CEFR</b><small>Chọn module A1-A2-B1-B2 theo mục tiêu</small></span><ArrowRight size={16}/></button>
      <button onClick={askRoadmap}><Sparkles size={18}/><span><b>AI lập lộ trình riêng</b><small>Dùng dữ liệu tài khoản + tiến độ thật của bạn</small></span><ArrowRight size={16}/></button>
    </section>
    <section className="week-strip"><div><Target size={20}/><span><b>{data?.weeklyMinutes??0}/{data?.weeklyGoalMinutes??100} phút</b><small>Mục tiêu tuần</small></span><div className="progress-track"><i style={{width:`${Math.min(100,((data?.weeklyMinutes??0)/(data?.weeklyGoalMinutes??100))*100)}%`}}/></div></div><button onClick={()=>setPage("progress")}>Xem tiến độ <ArrowRight size={16}/></button></section>
    <section className="quick-links"><button onClick={()=>setPage("library")}><BookOpenCheck/><span><b>Khám phá thư viện</b><small>17 chủ đề đời sống</small></span></button><button onClick={()=>setPage("create")}><Sparkles/><span><b>Tạo mindmap với AI</b><small>Từ chủ đề của riêng bạn</small></span></button></section>
  </div>
}
function PageLoading({label}:{label:string}){return <div className="page-loading"><span className="loader"/>{label}</div>}
