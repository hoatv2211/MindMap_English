// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { speakEnglish } from "../../src/client/lib/speech";

class UtteranceStub {
  text: string;
  lang = "";
  rate = 1;
  pitch = 1;
  voice: SpeechSynthesisVoice | null = null;
  constructor(text: string) { this.text = text; }
}

const originalSpeechSynthesis = globalThis.speechSynthesis;
const originalUtterance = globalThis.SpeechSynthesisUtterance;

afterEach(() => {
  Object.defineProperty(globalThis, "speechSynthesis", { value: originalSpeechSynthesis, configurable: true });
  Object.defineProperty(globalThis, "SpeechSynthesisUtterance", { value: originalUtterance, configurable: true });
});

describe("speakEnglish", () => {
  it("cancels current speech and speaks with practical English defaults", () => {
    const cancel = vi.fn();
    const speak = vi.fn();
    Object.defineProperty(globalThis, "speechSynthesis", { value: { cancel, speak, getVoices: () => [] }, configurable: true });
    Object.defineProperty(globalThis, "SpeechSynthesisUtterance", { value: UtteranceStub, configurable: true });

    speakEnglish("apple");

    expect(cancel).toHaveBeenCalledBefore(speak);
    const utterance = speak.mock.calls[0][0] as UtteranceStub;
    expect(utterance.text).toBe("apple");
    expect(utterance.lang).toBe("en-US");
    expect(utterance.rate).toBe(0.8);
    expect(utterance.pitch).toBe(1);
  });

  it("throws a clear error when speech synthesis is unavailable", () => {
    Object.defineProperty(globalThis, "speechSynthesis", { value: undefined, configurable: true });
    Object.defineProperty(globalThis, "SpeechSynthesisUtterance", { value: undefined, configurable: true });
    expect(() => speakEnglish("apple")).toThrow("Trình duyệt không hỗ trợ phát âm.");
  });
});