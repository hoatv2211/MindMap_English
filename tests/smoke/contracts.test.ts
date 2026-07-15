import { describe, expect, it } from "vitest";
import {
  DictionaryLookupSchema,
  DocumentHighlightSchema,
  ReviewGradeSchema,
  SpeakingAttemptSchema,
  VocabularyEnrichmentDraftSchema,
} from "../../src/shared/contracts";

describe("shared contracts", () => {
  it("accepts supported review grades", () => {
    expect(ReviewGradeSchema.parse("good")).toBe("good");
  });

  it("rejects unsupported review grades", () => {
    expect(() => ReviewGradeSchema.parse("perfect")).toThrow();
  });

  it("validates dictionary lookup results", () => {
    expect(DictionaryLookupSchema.parse({
      term: "Apple",
      normalizedTerm: "apple",
      known: true,
      existingVocabularyId: 1,
      suggestions: ["apples"],
    }).known).toBe(true);
  });

  it("rejects speaking scores outside zero and one", () => {
    expect(SpeakingAttemptSchema.parse({
      id: 1,
      sessionId: 1,
      sentenceId: 1,
      targetText: "Hello",
      transcript: "Hello",
      diff: [{ token: "Hello", status: "match" }],
      contentScore: 1,
      durationMs: 200,
      createdAt: new Date().toISOString(),
    }).contentScore).toBe(1);
    expect(() => SpeakingAttemptSchema.parse({
      id: 1,
      sessionId: 1,
      sentenceId: 1,
      targetText: "Hello",
      transcript: "Hello",
      diff: [],
      contentScore: 1.1,
      durationMs: 200,
      createdAt: new Date().toISOString(),
    })).toThrow();
  });

  it("validates document highlight provenance", () => {
    expect(DocumentHighlightSchema.parse({
      id: 1,
      documentId: 1,
      sectionId: 1,
      vocabularyId: null,
      sentenceId: null,
      selectedText: "useful phrase",
      startOffset: 0,
      endOffset: 13,
      sourceType: "quoted",
      textFingerprint: "abc",
    }).sourceType).toBe("quoted");
  });

  it("normalizes a concise AI mindmap title", () => {
    const draft = VocabularyEnrichmentDraftSchema.parse({
      normalizedTerm: "developer",
      displayTerm: "Developer",
      meaningVi: "lập trình viên",
      ipa: "/dɪˈveləpər/",
      partOfSpeech: "noun",
      cefr: "A2",
      itemType: "word",
      examples: [
        { role: "basic", sentence: "She is a developer.", translationVi: "Cô ấy là lập trình viên.", usageNote: "" },
        { role: "daily_life", sentence: "We need a developer.", translationVi: "Chúng tôi cần một lập trình viên.", usageNote: "" },
        { role: "personalized", sentence: "I work as a developer.", translationVi: "Tôi làm lập trình viên.", usageNote: "" },
      ],
      placement: { mindmapId: null, parentNodeId: null, reason: "Work", newMindmap: "Work and Company" },
    });

    expect(draft.placement.newMindmap).toEqual({ title: "Work and Company", description: "", branchLabel: "Vocabulary" });
  });
  it("normalizes AI mindmap branch aliases", () => {
    const draft = VocabularyEnrichmentDraftSchema.parse({
      normalizedTerm: "developer",
      displayTerm: "developer",
      meaningVi: "lập trình viên",
      cefr: "A2",
      itemType: "word",
      examples: [
        { role: "basic", sentence: "She is a developer.", translationVi: "Cô ấy là lập trình viên." },
        { role: "daily_life", sentence: "The developer fixed the app.", translationVi: "Lập trình viên sửa ứng dụng." },
        { role: "personalized", sentence: "I work as a developer.", translationVi: "Tôi làm lập trình viên." },
      ],
      placement: { mindmapId: null, parentNodeId: null, newMindmap: { title: "Work Essentials", parentTitle: "Jobs", branch: "company roles" } },
    });

    expect(draft.placement.newMindmap).toEqual({ title: "Work Essentials", description: "Jobs", branchLabel: "company roles" });
  });});
