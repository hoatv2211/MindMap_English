import fs from "node:fs";
import path from "node:path";
import express from "express";
import { createApp } from "../../src/server/app";
import { loadConfig } from "../../src/server/config";
import { createDatabase } from "../../src/server/db/database";
import { migrate } from "../../src/server/db/migrate";
import { seedDatabase } from "../../src/server/db/seed";

const config=loadConfig(process.env);
const db=createDatabase(config.databasePath);migrate(db);seedDatabase(db);
const enrichment={normalizedTerm:"negotiate",displayTerm:"negotiate",meaningVi:"thuong luong",ipa:"",partOfSpeech:"verb",cefr:"B1",itemType:"word",examples:[{role:"basic",sentence:"We need to negotiate.",translationVi:"Chung ta can dam phan.",usageNote:""},{role:"daily_life",sentence:"Can we negotiate the price?",translationVi:"Ta co the thuong luong gia khong?",usageNote:""},{role:"personalized",sentence:"I negotiate project deadlines.",translationVi:"Toi dam phan thoi han du an.",usageNote:""}],placement:{mindmapId:null,parentNodeId:null,reason:"Create a focused map",newMindmap:{title:"Negotiation",description:"Practical negotiation language",branchLabel:"Core verbs"}}};
const failedOnce=new Set<string>();
const nineRouter={health:async()=>true,getChatModel:()=>"e2e-model",chatJson:async(_schema:unknown,messages:Array<{content:string}>)=>{const prompt=messages.map(message=>message.content).join("\n");if(prompt.includes("retry-once")&&!failedOnce.has("retry-once")){failedOnce.add("retry-once");throw new Error("deterministic e2e failure")}return enrichment},chatText:async()=>"E2E tutor reply",synthesizeSpeech:async()=>({buffer:Buffer.from(""),mimeType:"audio/mpeg"}),transcribe:async()=>""};
const app=createApp({db,config,nineRouter:nineRouter as never,includeNotFound:false});
const distDir=path.resolve("dist");app.use(express.static(distDir));app.get("/{*path}",(_request,response)=>response.sendFile(path.join(distDir,"index.html")));
const server=app.listen(config.port,config.host);
const close=()=>server.close(()=>{db.close();process.exit(0)});process.on("SIGTERM",close);process.on("SIGINT",close);
