import type { AppDatabase } from "../../db/database";

type ModuleStatus="locked"|"active"|"completed";
interface PathRow {id:number;slug:string;title:string;level:"A1"|"A2"|"B1"|"B2";description:string;sortOrder:number}
interface ModuleRow {id:number;pathId:number;slug:string;title:string;goalVi:string;cefr:"A1"|"A2"|"B1"|"B2";topicSlug:string;sortOrder:number;mindmapId:number|null;mindmapTitle:string|null;totalWords:number;stableWords:number;learningWords:number;progressStatus?:ModuleStatus;completedItems?:number;totalItems?:number}
interface ModuleView {id:number;slug:string;title:string;goalVi:string;cefr:"A1"|"A2"|"B1"|"B2";sortOrder:number;status:ModuleStatus;progressPercent:number;mindmapTitle:string|null;totalWords:number;stableWords:number;learningWords:number}

export class LearningPathRepository{
  constructor(private readonly db:AppDatabase){}

  list(userId?:number){
    const paths=this.db.prepare("SELECT id,slug,title,level,description,sort_order sortOrder FROM learning_paths ORDER BY sort_order").all() as PathRow[];
    const modules=this.moduleRows(userId);
    return paths.map(path=>({
      ...path,
      modules:this.unlockModules(modules.filter(module=>module.pathId===path.id).map((module,index)=>this.toModule(module,index))),
    }));
  }

  getModule(id:number,userId?:number){
    const row=this.moduleRows(userId,"m.id=?",[id])[0];
    if(!row)return null;
    return{...this.toModule(row,row.sortOrder-1),level:row.cefr,pathId:row.pathId,topicSlug:row.topicSlug,mindmap:row.mindmapId?{id:row.mindmapId,title:row.mindmapTitle}:null};
  }

  vocabularyIdsForModule(moduleId:number,userId?:number){
    const module=this.getModule(moduleId,userId);if(!module?.mindmap)return [];
    return (this.db.prepare("SELECT DISTINCT vocabulary_id id FROM mindmap_nodes WHERE mindmap_id=? AND vocabulary_id IS NOT NULL ORDER BY id").all(module.mindmap.id) as Array<{id:number}>).map(row=>row.id);
  }

  private moduleRows(userId?:number,where="1=1",args:unknown[]=[]){
    const sql=`SELECT m.id,m.path_id pathId,m.slug,m.title,m.goal_vi goalVi,m.cefr,m.topic_slug topicSlug,m.sort_order sortOrder,map.id mindmapId,map.title mindmapTitle,
      COUNT(DISTINCT n.vocabulary_id) totalWords,
      SUM(CASE WHEN COALESCE(uvs.status,v.status)='stable' THEN 1 ELSE 0 END) stableWords,
      SUM(CASE WHEN COALESCE(uvs.status,v.status) IN ('learning','stable') THEN 1 ELSE 0 END) learningWords,
      ump.status progressStatus,ump.completed_items completedItems,ump.total_items totalItems
      FROM learning_modules m
      LEFT JOIN topics t ON t.slug=m.topic_slug
      LEFT JOIN mindmaps map ON map.topic_id=t.id AND map.status='approved' AND map.source='seed'
      LEFT JOIN mindmap_nodes n ON n.mindmap_id=map.id AND n.vocabulary_id IS NOT NULL
      LEFT JOIN vocabulary v ON v.id=n.vocabulary_id
      LEFT JOIN user_vocabulary_state uvs ON uvs.vocabulary_id=v.id AND uvs.user_id=?
      LEFT JOIN user_module_progress ump ON ump.module_id=m.id AND ump.user_id=?
      WHERE ${where}
      GROUP BY m.id
      ORDER BY m.path_id,m.sort_order`;
    return this.db.prepare(sql).all(userId??-1,userId??-1,...args) as ModuleRow[];
  }

  private toModule(module:ModuleRow,index:number){
    const total=module.totalItems||module.totalWords||1;
    const completed=module.completedItems||module.stableWords||0;
    const progressPercent=Math.min(100,Math.round((completed/total)*100));
    const status:ModuleStatus=module.progressStatus??(index===0?"active":progressPercent>=80?"completed":"locked");
    return{id:module.id,slug:module.slug,title:module.title,goalVi:module.goalVi,cefr:module.cefr,sortOrder:module.sortOrder,status,progressPercent,mindmapTitle:module.mindmapTitle,totalWords:module.totalWords,stableWords:module.stableWords,learningWords:module.learningWords};
  }

  private unlockModules(modules:ModuleView[]){
    return modules.map((module,index)=>{
      if(module.status!=="locked"||index===0)return module;
      const previous=modules[index-1];
      return previous?.status==="completed"?{...module,status:"active" as const}:module;
    });
  }
}
