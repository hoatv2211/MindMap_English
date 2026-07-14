import { ArrowRight, BookOpenText, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { useAppStore } from "../state/app-store";

export function LibraryPage() {
  const { openMindmap, setPage } = useAppStore();
  const [topics, setTopics] = useState<Awaited<ReturnType<typeof api.topics>>>([]);
  const [maps, setMaps] = useState<Awaited<ReturnType<typeof api.mindmaps>>>([]);
  const [query, setQuery] = useState("");
  useEffect(() => { void Promise.all([api.topics(), api.mindmaps()]).then(([topicList, mapList]) => { setTopics(topicList); setMaps(mapList); }); }, []);
  const filtered = useMemo(() => maps.filter((map) => `${map.title} ${map.topicTitleVi}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())), [maps, query]);
  return <div className="page library-page"><header className="page-header compact"><div><p className="eyebrow">THƯ VIỆN CÁ NHÂN</p><h1>Chọn một chủ đề,<br/><em>mở rộng liên tưởng.</em></h1></div><label className="search-box"><Search size={18}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm chủ đề hoặc mindmap"/></label></header>
    <div className="library-actions"><button onClick={() => setPage("reading")}><BookOpenText size={20}/><span><b>Tài liệu đang đọc</b><small>Nhập TXT, Markdown và lưu câu hữu ích</small></span><ArrowRight size={17}/></button><button onClick={() => setPage("create")}><Plus size={20}/><span><b>Tạo mindmap</b><small>Tạo bản nháp bằng AI rồi duyệt</small></span><ArrowRight size={17}/></button></div>
    <div className="topic-chips">{topics.map((topic) => <button key={topic.id} onClick={() => setQuery(topic.titleVi)}><span className={`dot ${topic.color}`}/>{topic.titleVi}<small>{topic.mindmapCount}</small></button>)}</div>
    <section className="map-gallery">{filtered.map((map, index) => <button className={`map-card tone-${index % 4}`} key={map.id} onClick={() => openMindmap(map.id)}><div className="mini-map" aria-hidden="true"><span/><i/><i/><i/><i/></div><div><small>{map.topicTitleVi} · {map.nodeCount} node</small><h2>{map.title}</h2><p>{map.description}</p><b>Mở mindmap <ArrowRight size={16}/></b></div></button>)}</section>
    {!filtered.length && <div className="empty-state">Chưa có mindmap phù hợp. Thử từ khóa khác hoặc tạo bằng AI.</div>}
  </div>;
}
