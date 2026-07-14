import type { TranscriptToken } from "../../../shared/contracts";

function tokenize(text: string): string[] {
  return text.normalize("NFKC").match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? [];
}

function sameToken(left: string, right: string): boolean {
  return left.toLocaleLowerCase("en-US") === right.toLocaleLowerCase("en-US");
}

export function compareTranscript(targetText: string, transcript: string): { tokens: TranscriptToken[]; score: number } {
  const target = tokenize(targetText);
  const spoken = tokenize(transcript);
  const lcs = Array.from({ length: target.length + 1 }, () => Array<number>(spoken.length + 1).fill(0));
  for (let targetIndex = target.length - 1; targetIndex >= 0; targetIndex -= 1) {
    for (let spokenIndex = spoken.length - 1; spokenIndex >= 0; spokenIndex -= 1) {
      lcs[targetIndex][spokenIndex] = sameToken(target[targetIndex], spoken[spokenIndex])
        ? lcs[targetIndex + 1][spokenIndex + 1] + 1
        : Math.max(lcs[targetIndex + 1][spokenIndex], lcs[targetIndex][spokenIndex + 1]);
    }
  }

  const tokens: TranscriptToken[] = [];
  const pendingTarget: string[] = [];
  const pendingSpoken: string[] = [];
  const flushPending = () => {
    const replacementCount = Math.min(pendingTarget.length, pendingSpoken.length);
    for (let index = 0; index < replacementCount; index += 1) {
      tokens.push({ token: pendingTarget[index], status: "replacement" });
      tokens.push({ token: pendingSpoken[index], status: "replacement" });
    }
    for (let index = replacementCount; index < pendingTarget.length; index += 1) tokens.push({ token: pendingTarget[index], status: "missing" });
    for (let index = replacementCount; index < pendingSpoken.length; index += 1) tokens.push({ token: pendingSpoken[index], status: "extra" });
    pendingTarget.length = 0;
    pendingSpoken.length = 0;
  };

  let targetIndex = 0;
  let spokenIndex = 0;
  let matches = 0;
  while (targetIndex < target.length || spokenIndex < spoken.length) {
    if (targetIndex < target.length && spokenIndex < spoken.length && sameToken(target[targetIndex], spoken[spokenIndex])) {
      flushPending();
      tokens.push({ token: target[targetIndex], status: "match" });
      matches += 1;
      targetIndex += 1;
      spokenIndex += 1;
    } else if (targetIndex < target.length && (spokenIndex >= spoken.length || lcs[targetIndex + 1][spokenIndex] >= lcs[targetIndex][spokenIndex + 1])) {
      pendingTarget.push(target[targetIndex]);
      targetIndex += 1;
    } else {
      pendingSpoken.push(spoken[spokenIndex]);
      spokenIndex += 1;
    }
  }
  flushPending();
  return { tokens, score: target.length === 0 ? 0 : matches / target.length };
}
