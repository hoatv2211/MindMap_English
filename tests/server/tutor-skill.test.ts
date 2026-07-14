import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadTutorSkill } from "../../src/server/modules/agent/skill-loader";

const roots:string[]=[];
afterEach(()=>{for(const root of roots)fs.rmSync(root,{recursive:true,force:true})});
function project(){const root=fs.mkdtempSync(path.join(os.tmpdir(),"mme-skill-"));roots.push(root);return root}

describe("tutor skill loader",()=>{
  it("loads only the project tutor skill and exposes its version",()=>{
    const root=project();const dir=path.join(root,"docs","ai-skills","mindmap-english-tutor");fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,"SKILL.md"),'---\nname: mindmap-english-tutor\nversion: 1.0.0\ndescription: Use when tutoring.\n---\n\n# Tutor\nExplain in Vietnamese.\n\n## Vocabulary capture\nRequire learner approval.');
    const skill=loadTutorSkill(root);
    expect(skill).toMatchObject({name:"mindmap-english-tutor",version:"1.0.0",degraded:false});
    expect(skill.content).toContain("Vocabulary capture");
  });
  it("uses a versioned fallback for missing or oversized files",()=>{
    const root=project();
    expect(loadTutorSkill(root)).toMatchObject({name:"mindmap-english-tutor",degraded:true});
    const dir=path.join(root,"docs","ai-skills","mindmap-english-tutor");fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,"SKILL.md"),"x".repeat(70_000));
    expect(loadTutorSkill(root).degraded).toBe(true);
  });
});
