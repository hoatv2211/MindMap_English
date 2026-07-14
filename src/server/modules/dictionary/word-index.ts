import fs from "node:fs";
import type { AppDatabase } from "../../db/database";

export function normalizeEnglishTerm(term: string): string {
  return term.trim().toLocaleLowerCase("en-US").normalize("NFKC").replace(/\s+/g, " ");
}

function editDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitution = previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1);
      current[rightIndex] = Math.min(previous[rightIndex] + 1, current[rightIndex - 1] + 1, substitution);
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length];
}

export class WordIndex {
  private readonly words: string[];
  private readonly wordSet: Set<string>;

  constructor(words: Iterable<string>) {
    this.words = [...new Set([...words].map(normalizeEnglishTerm).filter(Boolean))].sort();
    this.wordSet = new Set(this.words);
  }

  static fromDatabase(db: AppDatabase, filename?: string): WordIndex {
    const databaseWords = (db.prepare("SELECT term FROM vocabulary ORDER BY normalized_term").all() as Array<{ term: string }>).map((row) => row.term);
    const fileWords = filename && fs.existsSync(filename)
      ? fs.readFileSync(filename, "utf8").split(/\r?\n/)
      : [];
    return new WordIndex([...databaseWords, ...fileWords]);
  }

  has(term: string): boolean {
    return this.wordSet.has(normalizeEnglishTerm(term));
  }

  complete(prefix: string, limit = 6): string[] {
    const normalized = normalizeEnglishTerm(prefix);
    if (!normalized) return [];
    return this.words.filter((word) => word.startsWith(normalized)).slice(0, Math.max(0, limit));
  }

  suggest(term: string, limit = 3): string[] {
    const normalized = normalizeEnglishTerm(term);
    if (!normalized || this.wordSet.has(normalized)) return [];
    const threshold = normalized.length <= 4 ? 1 : 2;
    return this.words
      .map((word) => ({ word, distance: editDistance(normalized, word) }))
      .filter((candidate) => candidate.distance <= threshold)
      .sort((left, right) => left.distance - right.distance || left.word.localeCompare(right.word))
      .slice(0, Math.max(0, limit))
      .map((candidate) => candidate.word);
  }
}
