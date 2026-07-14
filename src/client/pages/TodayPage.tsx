import { ArrowRight, BookOpenCheck, Clock3, Flame, RefreshCw, Sparkles, Target } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Dashboard } from "../../shared/contracts";
import { useAppStore } from "../state/app-store";

export function TodayPage(){
  const {startSession,setPage}=useAppStore(); const [data,setData]=useState<Dashboard|null>(null); const [error,setError]=useState(""); const [loading,setLoading]=useState(true);
  useEffect(()=>{Promise.all([api.dashboard(),api.health()]).then(([dashboard,health])=>setData({...dashboard,aiOnline:health.aiOnline})).catch((e:Error)=>setError(e.message)).finally(()=>setLoading(false))},[]);
  const begin=async(duration:10|20)=>{setLoading(true);try{const session=await api.createSession(duration);startSession(session.id)}catch(e){setError((e as Error).message);setLoading(false)}};
  if(loading&&!data)return <PageLoading label="Đang chuẩn bị buổi học..."/>;
  return <div className="page today-page">
    <header className="page-header"><div><p className="eyebrow">MONDAY · NHỊP HỌC CỦA BẠN</p><h1>Hôm nay mình<br/><em>nói được gì?</em></h1></div><div className={`ai-pill ${data?.aiOnline?"online":"offline"}`}><span/>{data?.aiOnline?"AI sẵn sàng":"Học offline"}</div></header>
    {error&&<div className="notice error">{error}</div>}
    <section className="today-grid">
      <article className="study-hero">
        <div className="study-copy"><span className="section-kicker"><BookOpenCheck size={17}/> BUỔI HỌC ĐỀ XUẤT</span><h2>Ăn uống tự nhiên,<br/>không dịch trong đầu.</h2><p>Ôn từ đến hạn, mở rộng mindmap Eating và luyện một đoạn gọi món ngắn.</p>
          <div className="study-actions"><button className="primary-action" onClick={()=>begin(20)} disabled={loading}>Học 20 phút <ArrowRight size={18}/></button><button className="quiet-action" onClick={()=>begin(10)} disabled={loading}><Clock3 size={17}/> Bản nhanh 10 phút</button></div>
        </div>
        <div className="orbit-visual" aria-hidden="true"><span className="orbit-center">eating<small>ăn uống</small></span><span className="orbit-node n1">fruit</span><span className="orbit-node n2">seafood</span><span className="orbit-node n3">snacks</span><span className="orbit-node n4">dessert</span></div>
      </article>
      <aside className="today-side">
        <div className="streak-panel"><div><span className="metric-icon coral"><Flame size={19}/></span><small>CHUỖI HỌC</small><strong>{data?.streak??0} ngày</strong></div><p>Mỗi ngày ngắn thôi.<br/>Quan trọng là quay lại.</p></div>
        <div className="due-panel"><span className="metric-icon sky"><RefreshCw size={18}/></span><div><small>CẦN ÔN HÔM NAY</small><strong>{data?.dueCount??0} từ</strong></div><button onClick={()=>begin(10)} aria-label="Ôn nhanh"><ArrowRight size={18}/></button></div>
      </aside>
    </section>
    <section className="week-strip"><div><Target size={20}/><span><b>{data?.weeklyMinutes??0}/{data?.weeklyGoalMinutes??100} phút</b><small>Mục tiêu tuần</small></span><div className="progress-track"><i style={{width:`${Math.min(100,((data?.weeklyMinutes??0)/(data?.weeklyGoalMinutes??100))*100)}%`}}/></div></div><button onClick={()=>setPage("progress")}>Xem tiến độ <ArrowRight size={16}/></button></section>
    <section className="quick-links"><button onClick={()=>setPage("library")}><BookOpenCheck/><span><b>Khám phá thư viện</b><small>17 chủ đề đời sống</small></span></button><button onClick={()=>setPage("create")}><Sparkles/><span><b>Tạo mindmap với AI</b><small>Từ chủ đề của riêng bạn</small></span></button></section>
  </div>
}
function PageLoading({label}:{label:string}){return <div className="page-loading"><span className="loader"/>{label}</div>}
