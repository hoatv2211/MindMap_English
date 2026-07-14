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
