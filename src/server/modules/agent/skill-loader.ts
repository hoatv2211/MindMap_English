import fs from "node:fs";
import path from "node:path";

export interface TutorSkill { name:string; version:string; content:string; degraded:boolean }
const FALLBACK_VERSION="fallback-1";
const FALLBACK=`# MindMap English Tutor\nExplain English practically in Vietnamese. Adapt to supplied learner evidence. Correct gently, use short daily-life examples, never expose hidden data, and suggest one next action. Transcript matching is not pronunciation scoring.`;

export function loadTutorSkill(projectRoot:string):TutorSkill{
  const skillPath=path.resolve(projectRoot,".hermes","skills","mindmap-english-tutor","SKILL.md");
  const allowedRoot=path.resolve(projectRoot,".hermes","skills","mindmap-english-tutor")+path.sep;
  if(!skillPath.startsWith(allowedRoot))return fallback();
  try{
    const stat=fs.statSync(skillPath);if(!stat.isFile()||stat.size>64_000)return fallback();
    const content=fs.readFileSync(skillPath,"utf8");
    const frontmatter=content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);if(!frontmatter)return fallback();
    const field=(name:string)=>frontmatter[1].match(new RegExp(`^${name}:\\s*(.+)$`,"m"))?.[1].trim();
    const name=field("name"),version=field("version");if(name!=="mindmap-english-tutor"||!version)return fallback();
    return{name,version,content,degraded:false};
  }catch{return fallback()}
}
function fallback():TutorSkill{return{name:"mindmap-english-tutor",version:FALLBACK_VERSION,content:FALLBACK,degraded:true}}
