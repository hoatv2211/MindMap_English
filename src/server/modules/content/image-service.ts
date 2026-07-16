import fs from "node:fs";
import path from "node:path";
import type { AppConfig } from "../../config";
import type { AppDatabase } from "../../db/database";
import type { NineRouterClient } from "../agent/ninerouter-client";

export interface VocabularyImageJobStatus { jobId:number|null; status:"idle"|"running"|"failed"|"completed"; imageUrl:string|null; error:string|null }

interface VocabularyImageTarget { nodeId:number; vocabularyId:number; term:string; meaningVi:string; mapTitle:string; imageUrl:string|null }

export class VocabularyImageService {
  private readonly activeJobs = new Set<number>();
  constructor(private readonly db: AppDatabase, private readonly config: AppConfig, private readonly client: NineRouterClient) {
    fs.mkdirSync(path.join(config.mediaDir, "vocabulary"), { recursive: true });
  }

  getStatus(mapId:number,nodeId:number,userId?:number):VocabularyImageJobStatus {
    const target=this.getTarget(mapId,nodeId,userId);
    if(!target)throw new Error("Vocabulary node not found");
    const job=this.latestJob(nodeId,userId);
    if(job?.status==="failed")return{jobId:job.id,status:"failed",imageUrl:target.imageUrl,error:job.error??"Image generation failed"};
    if(job?.status==="running"||job?.status==="queued")return{jobId:job.id,status:"running",imageUrl:target.imageUrl,error:null};
    if(target.imageUrl)return{jobId:job?.id??null,status:"completed",imageUrl:target.imageUrl,error:null};
    return{jobId:job?.id??null,status:"idle",imageUrl:null,error:null};
  }

  start(mapId:number,nodeId:number,userId?:number):VocabularyImageJobStatus {
    const target=this.getTarget(mapId,nodeId,userId);
    if(!target)throw new Error("Vocabulary node not found");
    const current=this.getStatus(mapId,nodeId,userId);
    if(current.status==="running"||current.status==="completed")return current;
    const request={mapId,nodeId,vocabularyId:target.vocabularyId,term:target.term,meaningVi:target.meaningVi};
    const jobId=Number(this.db.prepare("INSERT INTO generation_jobs(job_type,status,request_json,user_id) VALUES ('vocabulary-image','running',?,?)").run(JSON.stringify(request),userId??null).lastInsertRowid);
    this.activeJobs.add(jobId);
    void this.run(jobId,target);
    return{jobId,status:"running",imageUrl:target.imageUrl,error:null};
  }

  private async run(jobId:number,target:VocabularyImageTarget):Promise<void>{
    try{
      const prompt=`Create a simple educational illustration for an English vocabulary card. Term: "${target.term}". Vietnamese meaning: "${target.meaningVi}". Mindmap context: "${target.mapTitle}". Use one clear object or daily-life scene, warm cream background, friendly flat style, no text, no letters, no watermark.`;
      const image=await this.client.generateImage(prompt);
      const ext=image.mimeType.includes("jpeg")||image.mimeType.includes("jpg")?"jpg":"png";
      const filename=`vocab-${target.vocabularyId}-${jobId}.${ext}`;
      const relativePath=path.join("vocabulary",filename);
      const absolutePath=path.join(this.config.mediaDir,relativePath);
      fs.mkdirSync(path.dirname(absolutePath),{recursive:true});
      fs.writeFileSync(absolutePath,image.buffer);
      const imageUrl=`/media/vocabulary/${filename}`;
      this.db.prepare("INSERT INTO media(vocabulary_id,media_type,path,source,mime_type) VALUES (?,?,?,?,?)").run(target.vocabularyId,"image",relativePath,"ai",image.mimeType);
      this.db.prepare("UPDATE vocabulary SET image_url=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(imageUrl,target.vocabularyId);
      this.db.prepare("UPDATE generation_jobs SET status='completed',result_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(JSON.stringify({imageUrl,path:relativePath}),jobId);
    }catch(error){
      this.db.prepare("UPDATE generation_jobs SET status='failed',error=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(error instanceof Error?error.message:"Image generation failed",jobId);
    }finally{this.activeJobs.delete(jobId)}
  }

  private getTarget(mapId:number,nodeId:number,userId?:number):VocabularyImageTarget|null{
    return (this.db.prepare(`
      SELECT n.id nodeId,n.vocabulary_id vocabularyId,n.label term,n.meaning_vi meaningVi,m.title mapTitle,v.image_url imageUrl
      FROM mindmap_nodes n JOIN mindmaps m ON m.id=n.mindmap_id JOIN vocabulary v ON v.id=n.vocabulary_id
      WHERE m.id=? AND n.id=? AND n.node_type='vocabulary' ${userId===undefined?"":"AND (m.source='seed' OR m.user_id=?)"}
    `).get(...(userId===undefined?[mapId,nodeId]:[mapId,nodeId,userId])) as VocabularyImageTarget|undefined)??null;
  }

  private latestJob(nodeId:number,userId?:number):{id:number;status:"queued"|"running"|"failed"|"completed";error:string|null}|null{
    const rows=this.db.prepare(`SELECT id,status,error,request_json requestJson FROM generation_jobs WHERE job_type='vocabulary-image' ${userId===undefined?"":"AND user_id=?"} ORDER BY id DESC LIMIT 30`).all(...(userId===undefined?[]:[userId])) as Array<{id:number;status:"queued"|"running"|"failed"|"completed";error:string|null;requestJson:string}>;
    return rows.find(row=>{try{return JSON.parse(row.requestJson).nodeId===nodeId}catch{return false}})??null;
  }
}
