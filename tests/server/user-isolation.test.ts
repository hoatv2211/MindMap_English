import { afterEach,beforeEach,describe,expect,it } from "vitest";
import fs from "node:fs";import os from "node:os";import path from "node:path";
import type { AppDatabase } from "../../src/server/db/database";import {createDatabase} from"../../src/server/db/database";import{migrate}from"../../src/server/db/migrate";import{seedDatabase}from"../../src/server/db/seed";import{ContentRepository}from"../../src/server/modules/content/repository";import{LearningRepository}from"../../src/server/modules/learning/repository";import{SpeakingRepository}from"../../src/server/modules/speaking/repository";import{DocumentRepository}from"../../src/server/modules/documents/repository";
let db:AppDatabase;let root:string;beforeEach(()=>{db=createDatabase(":memory:");migrate(db);db.prepare("INSERT INTO users(username,normalized_username,password_hash) VALUES (?,?,?)").run("one","one","hash");db.prepare("INSERT INTO users(username,normalized_username,password_hash) VALUES (?,?,?)").run("two","two","hash");db.prepare("INSERT INTO user_learning_progress(user_id) VALUES (1),(2)").run();root=fs.mkdtempSync(path.join(os.tmpdir(),"mme-user-"))});afterEach(()=>{db.close();fs.rmSync(root,{recursive:true,force:true})});
const draft={topicId:1,title:"Private map",description:"",source:"user" as const,nodes:[{parentIndex:null,nodeType:"root" as const,label:"Private",meaningVi:"",ipa:"",color:"coral" as const,x:0,y:0,cefr:"A2" as const}]};

describe("user data isolation",()=>{
  it("isolates mindmaps and learning sessions",()=>{db.prepare("INSERT INTO topics(slug,title,title_vi) VALUES ('t','T','T')").run();const content=new ContentRepository(db);const map=content.saveMindmapDraft(draft,1);expect(content.getMindmap(map.id,2)).toBeNull();expect(content.getMindmap(map.id,1)).not.toBeNull();content.approveMindmapDraft(map.id,1);expect(content.listTopics(1)[0].mindmapCount).toBe(1);expect(content.listTopics(2)[0].mindmapCount).toBe(0);db.prepare("INSERT INTO mindmaps(topic_id,title,status,source) VALUES (1,'Seed map','approved','seed')").run();const seedMapId=Number(db.prepare("SELECT id FROM mindmaps WHERE title='Seed map'").pluck().get());const seedNodeId=Number(db.prepare("INSERT INTO mindmap_nodes(mindmap_id,node_type,label,color,sort_order) VALUES (?,'root','Seed','coral',0)").run(seedMapId).lastInsertRowid);expect(content.updateMindmapNode(seedMapId,seedNodeId,{label:'Changed'},1)).toBeNull();const vocabularyId=Number(db.prepare("INSERT INTO vocabulary(term,normalized_term,meaning_vi) VALUES ('private','private','riêng')").run().lastInsertRowid);db.prepare("INSERT INTO review_cards(vocabulary_id) VALUES (?)").run(vocabularyId);db.prepare("INSERT INTO user_vocabulary_state(user_id,vocabulary_id,status) VALUES (1,?,'new'),(2,?,'new')").run(vocabularyId,vocabularyId);const learning=new LearningRepository(db);const session=learning.createSession(10,1) as {id:number};expect(learning.getSession(session.id,2)).toBeNull();expect(learning.getDashboard(false,2).unfinishedSessionId).toBeNull();expect(()=>learning.recordAttempt({sessionId:session.id,vocabularyId,promptType:"meaning",answer:"x",isCorrect:false,responseMs:1,hintsUsed:0,grade:"again",userId:2})).toThrow("Learning session not found");expect(learning.completeSession(session.id,2)).toBeNull();expect(learning.completeSession(session.id,1)?.status).toBe("completed");expect(learning.getDashboard(false,2).weeklyMinutes).toBe(0)});
  it("isolates notebook, speaking sessions, and documents",()=>{const speaking=new SpeakingRepository(db);const note=speaking.addSentence({sentence:"Private sentence",sourceType:"user"},1) as {id:number};const secondNote=speaking.addSentence({sentence:"Private sentence",sourceType:"user"},2) as {id:number};expect(secondNote.id).not.toBe(note.id);expect(speaking.listNotebook(2)).toHaveLength(1);expect(speaking.createSession([note.id],2)).toBeNull();const documents=new DocumentRepository(db,{dataDir:root} as never);const doc=documents.create({title:"Private",originalFilename:"a.txt",format:"txt",mimeType:"text/plain",buffer:Buffer.from("hello")},1) as unknown as {id:number};const secondDoc=documents.create({title:"Private",originalFilename:"a.txt",format:"txt",mimeType:"text/plain",buffer:Buffer.from("hello")},2) as unknown as {id:number};expect(secondDoc.id).not.toBe(doc.id);expect(documents.get(doc.id,2)).toBeNull();const section=(documents.get(doc.id,1) as {sections:Array<{id:number}>}).sections[0];expect(documents.addVocabulary(doc.id,{sectionId:section.id,selectedText:"hello",startOffset:0,endOffset:5,meaningVi:"xin chào"},2)).toBeNull();expect(documents.addHighlight(secondDoc.id,{sectionId:(documents.get(secondDoc.id,2) as {sections:Array<{id:number}>}).sections[0].id,selectedText:"hello",startOffset:0,endOffset:5,sentenceId:note.id},2)).toBeNull()});
});

it("creates one personal copy per user and preserves hierarchy",()=>{
  const db=createDatabase(":memory:");migrate(db);seedDatabase(db);
  db.prepare("INSERT INTO users(username,normalized_username,password_hash) VALUES ('copyuser','copyuser','hash')").run();
  const content=new ContentRepository(db);
  const first=content.createPersonalCopy(1,1);
  const second=content.createPersonalCopy(1,1);
  expect(first?.id).toBe(second?.id);
  expect(first?.source).toBe("user");
  expect(first?.nodes.length).toBe(content.getMindmap(1,1)?.nodes.length);
  expect(first?.nodes.some(node=>node.parentId!==null)).toBe(true);
  const sourceMap=content.getMindmap(1,1)!;
  const sourceWord=sourceMap.nodes.find(node=>node.nodeType==="vocabulary")!;
  const sourceParent=sourceMap.nodes.find(node=>node.id===sourceWord.parentId)!;
  const copiedWordNode=first!.nodes.find(node=>node.label===sourceWord.label)!;
  const copiedParent=first!.nodes.find(node=>node.id===copiedWordNode.parentId)!;
  expect(copiedParent.label).toBe(sourceParent.label);
  expect(content.updateMindmapNode(1,first!.nodes[0].id,{label:"bad"},1)).toBeNull();
  const copiedWord=first!.nodes.find(node=>node.vocabularyId)!;
  const originalTerm=(db.prepare("SELECT term FROM vocabulary WHERE id=?").get(copiedWord.vocabularyId) as {term:string}).term;
  content.updateMindmapNode(first!.id,copiedWord.id,{label:"personal label"},1);
  expect((db.prepare("SELECT term FROM vocabulary WHERE id=?").get(copiedWord.vocabularyId) as {term:string}).term).toBe(originalTerm);
  db.close();
});