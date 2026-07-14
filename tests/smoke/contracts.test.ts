import { describe, expect, it } from "vitest";
import {
  DictionaryLookupSchema,
  DocumentHighlightSchema,
  ReviewGradeSchema,
  SpeakingAttemptSchema,
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
});
