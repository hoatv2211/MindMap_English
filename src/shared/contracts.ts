import { z } from "zod";
import { BRANCH_COLORS, CEFR_LEVELS, REVIEW_GRADES } from "./constants";

export const ReviewGradeSchema = z.enum(REVIEW_GRADES);
export type ReviewGrade = z.infer<typeof ReviewGradeSchema>;

export const CefrLevelSchema = z.enum(CEFR_LEVELS);
export type CefrLevel = z.infer<typeof CefrLevelSchema>;

export const LearningStatusSchema = z.enum(["new", "learning", "weak", "stable"]);
export type LearningStatus = z.infer<typeof LearningStatusSchema>;

export const VocabularySchema = z.object({
  id: z.number().int().positive(),
  term: z.string().min(1),
  normalizedTerm: z.string().min(1),
  ipa: z.string().default(""),
  partOfSpeech: z.string().default(""),
  meaningVi: z.string().min(1),
  cefr: CefrLevelSchema,
  status: LearningStatusSchema.default("new"),
  imageUrl: z.string().nullable().default(null),
  audioUrl: z.string().nullable().default(null),
});
export type Vocabulary = z.infer<typeof VocabularySchema>;

export const ExampleSchema = z.object({
  id: z.number().int().positive().optional(),
  sentence: z.string().min(1),
  translationVi: z.string().min(1),
  situation: z.string().default("daily life"),
});
export type Example = z.infer<typeof ExampleSchema>;

export const MindmapNodeSchema = z.object({
  id: z.number().int().positive(),
  parentId: z.number().int().positive().nullable(),
  vocabularyId: z.number().int().positive().nullable(),
  nodeType: z.enum(["root", "branch", "vocabulary"]),
  label: z.string().min(1),
  meaningVi: z.string().default(""),
  ipa: z.string().default(""),
  color: z.enum(BRANCH_COLORS),
  x: z.number(),
  y: z.number(),
  status: LearningStatusSchema.default("new"),
});
export type MindmapNode = z.infer<typeof MindmapNodeSchema>;

export const MindmapSchema = z.object({
  id: z.number().int().positive(),
  topicId: z.number().int().positive(),
  title: z.string().min(1),
  description: z.string().default(""),
  status: z.enum(["draft", "approved", "trashed"]),
  source: z.enum(["seed", "ai", "user"]),
  nodes: z.array(MindmapNodeSchema),
});
export type Mindmap = z.infer<typeof MindmapSchema>;

export const DashboardSchema = z.object({
  dueCount: z.number().int().nonnegative(),
  newCount: z.number().int().nonnegative(),
  weakCount: z.number().int().nonnegative(),
  stableCount: z.number().int().nonnegative(),
  streak: z.number().int().nonnegative(),
  weeklyMinutes: z.number().int().nonnegative(),
  weeklyGoalMinutes: z.number().int().positive(),
  aiOnline: z.boolean(),
  unfinishedSessionId: z.number().int().positive().nullable(),
});
export type Dashboard = z.infer<typeof DashboardSchema>;

export const MindmapDraftInputSchema = z.object({
  topic: z.string().min(2).max(100),
  situation: z.string().max(200).default("daily life"),
  cefr: CefrLevelSchema.default("B1"),
});
export type MindmapDraftInput = z.infer<typeof MindmapDraftInputSchema>;

export const DictionaryLookupSchema = z.object({
  term: z.string().min(1),
  normalizedTerm: z.string().min(1),
  known: z.boolean(),
  existingVocabularyId: z.number().int().positive().nullable(),
  suggestions: z.array(z.string().min(1)).max(6),
});
export type DictionaryLookup = z.infer<typeof DictionaryLookupSchema>;

export const SentenceNotebookEntrySchema = z.object({
  id: z.number().int().positive(),
  vocabularyId: z.number().int().positive().nullable(),
  exampleId: z.number().int().positive().nullable(),
  sentence: z.string().min(1),
  translationVi: z.string(),
  sourceType: z.enum(["quoted", "user", "ai"]),
  sourceReference: z.string(),
  fingerprint: z.string().min(1),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});
export type SentenceNotebookEntry = z.infer<typeof SentenceNotebookEntrySchema>;

export const TranscriptTokenSchema = z.object({
  token: z.string(),
  status: z.enum(["match", "missing", "extra", "replacement"]),
});
export type TranscriptToken = z.infer<typeof TranscriptTokenSchema>;

export const SpeakingAttemptSchema = z.object({
  id: z.number().int().positive(),
  sessionId: z.number().int().positive(),
  sentenceId: z.number().int().positive(),
  targetText: z.string().min(1),
  transcript: z.string(),
  diff: z.array(TranscriptTokenSchema),
  contentScore: z.number().min(0).max(1),
  durationMs: z.number().int().nonnegative(),
  createdAt: z.string().min(1),
});
export type SpeakingAttempt = z.infer<typeof SpeakingAttemptSchema>;

export const DocumentSummarySchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1),
  originalFilename: z.string().min(1),
  format: z.enum(["txt", "md", "epub"]),
  mimeType: z.string(),
  checksum: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  sectionCount: z.number().int().nonnegative(),
  createdAt: z.string().min(1),
});
export type DocumentSummary = z.infer<typeof DocumentSummarySchema>;

export const DocumentSectionSchema = z.object({
  id: z.number().int().positive(),
  documentId: z.number().int().positive(),
  heading: z.string(),
  content: z.string(),
  sortOrder: z.number().int().nonnegative(),
  fingerprint: z.string().min(1),
});
export type DocumentSection = z.infer<typeof DocumentSectionSchema>;

export const DocumentHighlightSchema = z.object({
  id: z.number().int().positive(),
  documentId: z.number().int().positive(),
  sectionId: z.number().int().positive(),
  vocabularyId: z.number().int().positive().nullable(),
  sentenceId: z.number().int().positive().nullable(),
  selectedText: z.string().min(1),
  startOffset: z.number().int().nonnegative(),
  endOffset: z.number().int().nonnegative(),
  sourceType: z.enum(["quoted", "user", "ai"]),
  textFingerprint: z.string().min(1),
}).refine((value) => value.endOffset >= value.startOffset, {
  message: "endOffset must be greater than or equal to startOffset",
  path: ["endOffset"],
});
export type DocumentHighlight = z.infer<typeof DocumentHighlightSchema>;

export const VocabularyInboxStatusSchema = z.enum(["queued","processing","ready","failed","approved","dismissed"]);
export const VocabularyInboxSourceSchema = z.enum(["quick_capture","agent_chat","mindmap"]);
export const VocabularyExampleRoleSchema = z.enum(["basic","daily_life","personalized","learner"]);
export const VocabularyExampleDraftSchema = z.object({role:VocabularyExampleRoleSchema,sentence:z.string().min(1).max(300),translationVi:z.string().min(1).max(400),usageNote:z.string().max(200).default("")});
export const VocabularyPlacementDraftSchema = z.object({mindmapId:z.number().int().positive().nullable().default(null),parentNodeId:z.number().int().positive().nullable().default(null),reason:z.string().max(240).default(""),newMindmap:z.object({title:z.string().min(1).max(120),description:z.string().max(500).default(""),branchLabel:z.string().min(1).max(100)}).nullable().default(null)});
export const VocabularyEnrichmentDraftSchema = z.object({normalizedTerm:z.string().min(1).max(160),displayTerm:z.string().min(1).max(160),meaningVi:z.string().min(1).max(500),ipa:z.string().max(120).default(""),partOfSpeech:z.string().max(80).default(""),cefr:CefrLevelSchema,itemType:z.enum(["word","phrase","sentence"]),examples:z.array(VocabularyExampleDraftSchema).length(3),placement:VocabularyPlacementDraftSchema});
export const VocabularyCaptureInputSchema = z.object({rawText:z.string().trim().min(1).max(500),contextText:z.string().trim().max(1000).default(""),sourceType:VocabularyInboxSourceSchema.default("quick_capture"),sourceReference:z.string().max(200).default(""),hintMindmapId:z.number().int().positive().nullable().optional(),hintParentNodeId:z.number().int().positive().nullable().optional()});
export type VocabularyInboxStatus=z.infer<typeof VocabularyInboxStatusSchema>;
export type VocabularyInboxSource=z.infer<typeof VocabularyInboxSourceSchema>;
export type VocabularyExampleDraft=z.infer<typeof VocabularyExampleDraftSchema>;
export type VocabularyPlacementDraft=z.infer<typeof VocabularyPlacementDraftSchema>;
export type VocabularyEnrichmentDraft=z.infer<typeof VocabularyEnrichmentDraftSchema>;
export type VocabularyCaptureInput=z.infer<typeof VocabularyCaptureInputSchema>;
