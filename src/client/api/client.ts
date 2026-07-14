import type { Dashboard, DictionaryLookup, Mindmap } from "../../shared/contracts";

export interface AuthUser { id:number; username:string; profileRevision:number }
export interface AuthResult { user:AuthUser; recoveryCode:string }

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
  authMe: () => request<{user:AuthUser}>("/api/auth/me"),
  register: (input:{username:string;password:string;passwordConfirmation:string}) => request<AuthResult>("/api/auth/register",{method:"POST",body:JSON.stringify(input)}),
  login: (input:{username:string;password:string}) => request<{user:AuthUser}>("/api/auth/login",{method:"POST",body:JSON.stringify(input)}),
  logout: () => request<void>("/api/auth/logout",{method:"POST"}),
  recoverPassword: (input:{username:string;recoveryCode:string;password:string;passwordConfirmation:string}) => request<AuthResult>("/api/auth/password/recover",{method:"POST",body:JSON.stringify(input)}),
  changePassword: (input:{currentPassword:string;password:string;passwordConfirmation:string}) => request<{user:AuthUser}>("/api/auth/password/change",{method:"POST",body:JSON.stringify(input)}),
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
  tutor: (message:string) => request<{reply:string;suggestions:string[];threadId:number}>("/api/agent/chat",{method:"POST",body:JSON.stringify({message})}),
  agentStatus: () => request<{skill:string;skillVersion:string;degraded:boolean}>("/api/agent/status"),
  agentThreads: () => request<AgentThread[]>("/api/agent/threads"),
  createAgentThread: (title?:string) => request<AgentThread>("/api/agent/threads",{method:"POST",body:JSON.stringify({title})}),
  agentMessages: (threadId:number) => request<AgentMessage[]>(`/api/agent/threads/${threadId}/messages`),
  sendAgentMessage: (threadId:number,message:string) => request<{reply:string;message:AgentMessage;suggestions:string[];responseCacheHit:boolean;skill:{degraded:boolean}}>(`/api/agent/threads/${threadId}/messages`,{method:"POST",body:JSON.stringify({message})}),
  archiveAgentThread: (threadId:number) => request<void>(`/api/agent/threads/${threadId}`,{method:"PATCH",body:JSON.stringify({archived:true})}),
  deleteAgentThread: (threadId:number) => request<void>(`/api/agent/threads/${threadId}`,{method:"DELETE"}),
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
  dictionaryLookup: (term:string) => request<DictionaryLookup>(`/api/dictionary/lookup?term=${encodeURIComponent(term)}`),
  dictionaryComplete: (prefix:string) => request<{items:string[]}>(`/api/dictionary/complete?prefix=${encodeURIComponent(prefix)}`),
  speakingNotebook: () => request<NotebookEntry[]>("/api/speaking/notebook"),
  addNotebookSentence: (input:Record<string,unknown>) => request<NotebookEntry>("/api/speaking/notebook",{method:"POST",body:JSON.stringify(input)}),
  createSpeakingSession: (sentenceIds:number[]) => request<SpeakingSessionResult>("/api/speaking/sessions",{method:"POST",body:JSON.stringify({sentenceIds})}),
  speakingAttempt: (sessionId:number,input:{sentenceId:number;transcript:string;durationMs:number}) => request<SpeakingAttemptResult>(`/api/speaking/sessions/${sessionId}/attempts`,{method:"POST",body:JSON.stringify(input)}),
  completeSpeakingSession: (sessionId:number) => request<SpeakingSessionResult>(`/api/speaking/sessions/${sessionId}/complete`,{method:"POST"}),
  speakingMetrics: () => request<{attempts7d:number;speakingSeconds7d:number}>("/api/speaking/metrics"),
  documents: () => request<DocumentSummaryResult[]>("/api/documents"),
  document: (id:number) => request<DocumentDetail>(`/api/documents/${id}`),
  uploadDocument: (file:File,title?:string) => {const form=new FormData();form.append("document",file);if(title)form.append("title",title);return request<DocumentDetail>("/api/documents",{method:"POST",body:form});},
  addDocumentHighlight: (documentId:number,input:{sectionId:number;selectedText:string;startOffset:number;endOffset:number;vocabularyId?:number|null;sentenceId?:number|null}) => request(`/api/documents/${documentId}/highlights`,{method:"POST",body:JSON.stringify(input)}),
  createDocumentVocabulary: (documentId:number,input:{sectionId:number;selectedText:string;startOffset:number;endOffset:number;meaningVi:string}) => request<{vocabulary:{id:number;term:string};highlight:{id:number;vocabularyId:number}}>(`/api/documents/${documentId}/vocabulary`,{method:"POST",body:JSON.stringify(input)}),
  extractDocumentDraft: (documentId:number,sectionIds:number[]) => request<DocumentExtractionResult>(`/api/documents/${documentId}/extraction-drafts`,{method:"POST",body:JSON.stringify({sectionIds})}),
};

export interface LearningItem { id:number;vocabularyId:number;activityType:string;sortOrder:number;isNew:number;term:string;meaningVi:string;ipa:string;cefr:string;status:string;example:string;exampleVi:string; }
export interface LearningSession { id:number;durationMinutes:10|20;status:"active"|"completed";startedAt:string;completedAt:string|null;summary:string;items:LearningItem[]; }
export interface Progress extends Dashboard { accuracy30d:number;speakingAttempts7d:number;topicCoverage:number; }
export interface GeneratedWord {term:string;meaningVi:string;ipa:string;cefr:string;example:string;exampleVi:string}
export interface GeneratedBranch {label:string;meaningVi:string;color:"coral"|"amber"|"leaf"|"sky"|"violet";words:GeneratedWord[]}
export interface GeneratedResult {jobId:number;draft:{title:string;description:string;branches:GeneratedBranch[]};duplicates:Array<{term:string;meaningVi:string}>}
export interface Settings {nineRouterUrl:string;hasNineRouterKey:boolean;models:Record<string,string>;defaultDuration?:number;ttsVoice?:string;}
export interface NotebookEntry {id:number;vocabularyId:number|null;exampleId:number|null;sentence:string;translationVi:string;sourceType:"quoted"|"user"|"ai";sourceReference:string;fingerprint:string;createdAt:string;updatedAt:string}
export interface SpeakingSessionItem {id:number;sentenceId:number;sortOrder:number;completedAt:string|null;sentence:string;translationVi:string}
export interface SpeakingSessionResult {id:number;status:"active"|"completed"|"abandoned";startedAt:string;completedAt:string|null;totalDurationSeconds:number;items:SpeakingSessionItem[]}
export interface SpeakingAttemptResult {id:number;sessionId:number;sentenceId:number;targetText:string;transcript:string;diff:import("../../shared/contracts").TranscriptToken[];contentScore:number;durationMs:number;createdAt:string}
export interface DocumentSummaryResult {id:number;title:string;originalFilename:string;format:"txt"|"md"|"epub";mimeType:string;checksum:string;sizeBytes:number;sectionCount:number;createdAt:string}
export interface DocumentSectionResult {id:number;documentId:number;heading:string;content:string;sortOrder:number;fingerprint:string}
export interface DocumentDetail extends DocumentSummaryResult {storagePath:string;sections:DocumentSectionResult[]}
export interface ExtractionCandidate {category:"recommended"|"optional"|"skip";reason:string}
export interface DocumentExtractionResult {jobId:number;draft:{vocabulary:Array<ExtractionCandidate&{term:string;meaningVi:string}>;sentences:Array<ExtractionCandidate&{sentence:string}>}}


export interface AgentThread {id:number;title:string;preview?:string;updatedAt:string;archivedAt?:string|null}
export interface AgentMessage {id:number;threadId:number;role:"user"|"assistant"|"tool";content:string;status:string;cacheHit:number;createdAt?:string}

