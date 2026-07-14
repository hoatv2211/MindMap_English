import type { Dashboard, Mindmap } from "../../shared/contracts";

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) { super(message); }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, headers: { ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }), ...init?.headers } });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new ApiError(body.error ?? "Yêu cầu thất bại", response.status, body.code);
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) return response.json() as Promise<T>;
  return response.blob() as Promise<T>;
}

export const api = {
  health: () => request<{ ok: boolean; aiOnline: boolean }>("/api/health"),
  dashboard: () => request<Dashboard>("/api/learning/dashboard"),
  topics: () => request<Array<{id:number;slug:string;title:string;titleVi:string;icon:string;color:string;mindmapCount:number}>>("/api/topics"),
  mindmaps: (status="approved") => request<Array<{id:number;topicId:number;title:string;description:string;status:string;source:string;topicTitleVi:string;nodeCount:number}>>(`/api/mindmaps?status=${status}`),
  mindmap: (id: number) => request<Mindmap>(`/api/mindmaps/${id}`),
  updateNode: (mapId:number,nodeId:number,input:Record<string,unknown>) => request(`/api/mindmaps/${mapId}/nodes/${nodeId}`,{method:"PATCH",body:JSON.stringify(input)}),
  createSession: (duration:10|20) => request<LearningSession>("/api/learning/sessions",{method:"POST",body:JSON.stringify({duration})}),
  session: (id:number) => request<LearningSession>(`/api/learning/sessions/${id}`),
  attempt: (sessionId:number,input:Record<string,unknown>) => request(`/api/learning/sessions/${sessionId}/attempts`,{method:"POST",body:JSON.stringify(input)}),
  completeSession: (id:number) => request<LearningSession>(`/api/learning/sessions/${id}/complete`,{method:"POST"}),
  progress: () => request<Progress>("/api/learning/progress"),
  tutor: (message:string) => request<{reply:string;suggestions:string[]}>("/api/agent/chat",{method:"POST",body:JSON.stringify({message})}),
  generateMindmap: (input:Record<string,unknown>) => request<GeneratedResult>("/api/agent/mindmap-drafts",{method:"POST",body:JSON.stringify(input)}),
  saveGeneratedMindmap: (topicId:number,draft:unknown) => request<Mindmap>("/api/agent/mindmap-drafts/save",{method:"POST",body:JSON.stringify({topicId,draft})}),
  approveMindmap: (id:number) => request<Mindmap>(`/api/mindmaps/${id}/approve`,{method:"POST"}),
  transcribe: (form:FormData) => request<{text:string}>("/api/speech/transcribe",{method:"POST",body:form}),
  synthesize: (text:string) => request<Blob>("/api/speech/synthesize",{method:"POST",body:JSON.stringify({text})}),
  settings: () => request<Settings>("/api/settings"),
  saveSettings: (input:Record<string,unknown>) => request<{saved:string[]}>("/api/settings",{method:"PUT",body:JSON.stringify(input)}),
  settingsHealth: () => request<{nineRouter:boolean;configured:Record<string,boolean>}>("/api/settings/health"),
  backups: () => request<Array<{id:number;filename:string;sizeBytes:number;createdAt:string}>>("/api/backups"),
  createBackup: () => request("/api/backups",{method:"POST"}),
  restoreBackup: (id:number) => request(`/api/backups/${id}/restore`,{method:"POST"}),
};

export interface LearningItem { id:number;vocabularyId:number;activityType:string;sortOrder:number;isNew:number;term:string;meaningVi:string;ipa:string;cefr:string;status:string;example:string;exampleVi:string; }
export interface LearningSession { id:number;durationMinutes:10|20;status:"active"|"completed";startedAt:string;completedAt:string|null;summary:string;items:LearningItem[]; }
export interface Progress extends Dashboard { accuracy30d:number;speakingAttempts7d:number;topicCoverage:number; }
export interface GeneratedWord {term:string;meaningVi:string;ipa:string;cefr:string;example:string;exampleVi:string}
export interface GeneratedBranch {label:string;meaningVi:string;color:"coral"|"amber"|"leaf"|"sky"|"violet";words:GeneratedWord[]}
export interface GeneratedResult {jobId:number;draft:{title:string;description:string;branches:GeneratedBranch[]};duplicates:Array<{term:string;meaningVi:string}>}
export interface Settings {nineRouterUrl:string;hasNineRouterKey:boolean;models:Record<string,string>;defaultDuration?:number;ttsVoice?:string;}
