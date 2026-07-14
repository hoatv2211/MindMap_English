export type ActivityType = "explore" | "image-choice" | "meaning-recall" | "collocation" | "context" | "speak";

export interface SessionCandidate {
  vocabularyId: number;
  status: "new" | "learning" | "weak" | "stable";
  due: boolean;
  isNew: boolean;
  lapses: number;
}

export interface SessionPlanItem extends SessionCandidate { activityType: ActivityType; sortOrder: number; }

const activityCycle: ActivityType[] = ["explore", "meaning-recall", "context", "collocation", "speak", "image-choice"];

export function buildSession(candidates: SessionCandidate[], duration: 10 | 20): SessionPlanItem[] {
  const capacity = duration === 10 ? 8 : 14;
  const newTarget = Math.max(2, Math.round(capacity * 0.4));
  const reviewTarget = capacity - newTarget;
  const unique = [...new Map(candidates.map((item) => [item.vocabularyId, item])).values()];
  const reviews = unique.filter((item) => !item.isNew && item.due).sort((a, b) => {
    const score = (item: SessionCandidate) => (item.status === "weak" ? 100 : item.status === "learning" ? 50 : 0) + item.lapses;
    return score(b) - score(a);
  });
  const newItems = unique.filter((item) => item.isNew).slice(0, newTarget);
  const selected = [...reviews.slice(0, reviewTarget), ...newItems];
  if (selected.length < capacity) {
    const selectedIds = new Set(selected.map((item) => item.vocabularyId));
    selected.push(...unique.filter((item) => !selectedIds.has(item.vocabularyId)).slice(0, capacity - selected.length));
  }
  return selected.slice(0, capacity).map((item, index) => ({ ...item, activityType: activityCycle[index % activityCycle.length], sortOrder: index }));
}
