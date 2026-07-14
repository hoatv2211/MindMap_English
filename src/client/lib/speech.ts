export interface SpeakEnglishOptions {
  lang?: "en-US" | "en-GB";
  rate?: number;
}

export function speakEnglish(text: string, options: SpeakEnglishOptions = {}): void {
  const value = text.trim();
  if (!value) return;
  if (!globalThis.speechSynthesis || typeof globalThis.SpeechSynthesisUtterance !== "function") {
    throw new Error("Tr\u00ecnh duy\u1ec7t kh\u00f4ng h\u1ed7 tr\u1ee3 ph\u00e1t \u00e2m.");
  }

  const lang = options.lang ?? "en-US";
  const utterance = new SpeechSynthesisUtterance(value);
  utterance.lang = lang;
  utterance.rate = options.rate ?? 0.8;
  utterance.pitch = 1;

  const voices = speechSynthesis.getVoices();
  utterance.voice = voices.find((voice) => voice.lang.toLowerCase() === lang.toLowerCase())
    ?? voices.find((voice) => voice.lang.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()))
    ?? null;

  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
}