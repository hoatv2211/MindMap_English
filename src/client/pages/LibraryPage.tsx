import { ArrowRight, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { useAppStore } from "../state/app-store";

export function LibraryPage(){
  const {openMindmap}=useAppStore(); const [topics,setTopics]=useState<Awaited<ReturnType<typeof api.topics>>>([]); const [maps,setMaps]=useState<Awaited<ReturnType<typeof api.mindmaps>>>([]); const [query,setQuery]=useState("");
  useEffect(()=>{Promise.all([api.topics(),api.mindmaps()]).then(([t,m])=>{setTopics(t);setMaps(m)})},[]);
  const filtered=useMemo(()=>maps.filter((map)=>`${map.title} ${map.topicTitleVi}`.toLowerCase().includes(query.toLowerCase())),[maps,query]);
  return <div className="page library-page"><header className="page-header compact"><div><p className="eyebrow">THƯ VIỆN CÁ NHÂN</p><h1>Chọn một chủ đề,<br/><em>mở rộng liên tưởng.</em></h1></div><label className="search-box"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tìm chủ đề hoặc mindmap"/></label></header>
    <div className="topic-chips">{topics.map(topic=><button key={topic.id} onClick={()=>setQuery(topic.titleVi)}><span className={`dot ${topic.color}`}/>{topic.titleVi}<small>{topic.mindmapCount}</small></button>)}</div>
    <section className="map-gallery">{filtered.map((map,index)=><button className={`map-card tone-${index%4}`} key={map.id} onClick={()=>openMindmap(map.id)}><div className="mini-map" aria-hidden="true"><span/><i/><i/><i/><i/></div><div><small>{map.topicTitleVi} · {map.nodeCount} node</small><h2>{map.title}</h2><p>{map.description}</p><b>Mở mindmap <ArrowRight size={16}/></b></div></button>)}</section>
    {!filtered.length&&<div className="empty-state">Chưa có mindmap phù hợp. Thử từ khóa khác hoặc tạo bằng AI.</div>}
  </div>
}
