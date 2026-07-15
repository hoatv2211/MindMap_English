# Mindmap Editor and Learning Flip Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add safe personal mindmap editing with AI-assisted vocabulary approval, plus answer-safe flip cards and language-aware hints during review.

**Architecture:** Extend SQLite and `ContentRepository` with idempotent seed-map copy-on-write and owned node operations. Build a responsive editor panel around existing React Flow and Vocabulary Inbox APIs. Separately centralize learning prompt logic in a pure helper shared by `LearningPromptCard` and `QuizCard`.

**Tech Stack:** TypeScript, React 19, Express 5, SQLite/better-sqlite3, Zod, React Flow, Vitest, Testing Library, Playwright.

---

### Task 1: Personal mindmap copy schema

**Files:**
- Modify: `src/server/db/migrate.ts`
- Modify: `tests/server/database.test.ts`

- [ ] Add failing migration assertions for `mindmaps.copied_from_mindmap_id` and its unique owner/source index.
- [ ] Run `npm test -- tests/server/database.test.ts`; expect missing column/index failure.
- [ ] Add nullable self-reference column with `ensureColumn`, then create unique partial index for non-null `(user_id,copied_from_mindmap_id)`.
- [ ] Run database test; expect pass.

### Task 2: Personal copy repository and API

**Files:**
- Modify: `src/server/modules/content/repository.ts`
- Modify: `src/server/routes/mindmaps.ts`
- Modify: `tests/server/content-api.test.ts`
- Modify: `tests/server/user-isolation.test.ts`

- [ ] Add failing authenticated tests: seed copy preserves hierarchy, repeated requests return same map, private maps cannot be copied, seed nodes remain immutable.
- [ ] Run focused server tests; expect `POST /api/mindmaps/:id/personal-copy` 404.
- [ ] Add `createPersonalCopy(mapId,userId)` transaction and route.
- [ ] Run focused tests; expect pass.

### Task 3: Owned branch and node operations

**Files:**
- Modify: `src/server/modules/content/repository.ts`
- Modify: `src/server/routes/mindmaps.ts`
- Modify: `src/client/api/client.ts`
- Test: `tests/server/content-api.test.ts`

- [ ] Add failing tests for branch creation, move, duplicate, delete, ownership, and seed rejection.
- [ ] Run focused tests; verify expected missing-route failures.
- [ ] Add Zod schemas, repository transactions, routes, and typed client methods.
- [ ] Run focused tests; expect pass.

### Task 4: Vocabulary copy-on-write editing

**Files:**
- Modify: `src/server/db/migrate.ts`
- Modify: `src/server/modules/content/repository.ts`
- Modify: `src/server/routes/mindmaps.ts`
- Modify: `src/shared/contracts.ts`
- Modify: `src/client/api/client.ts`
- Test: `tests/server/content-api.test.ts`

- [ ] Add failing test that editing a seed-derived vocabulary node creates learner-owned vocabulary/examples and leaves seed references unchanged.
- [ ] Add nullable `vocabulary.user_id`, update schema and endpoint payload for part of speech, CEFR, and exactly three examples.
- [ ] Implement transactional vocabulary copy-on-write and node repointing.
- [ ] Run focused tests; expect pass.

### Task 5: Mindmap editor shell

**Files:**
- Modify: `src/client/pages/MindmapPage.tsx`
- Modify: `src/client/components/MindmapCanvas.tsx`
- Modify: `src/client/components/VocabularyNode.tsx`
- Create: `src/client/components/MindmapEditorPanel.tsx`
- Modify: `src/client/state/app-store.tsx`
- Modify: `src/client/styles/mindmap.css`
- Create: `tests/client/mindmap-editor.test.tsx`

- [ ] Add failing client tests for seed-copy edit entry, personal-map direct edit, node selection, dirty guard, collapse, and mobile-friendly panel semantics.
- [ ] Implement selected-node callbacks and global map replacement.
- [ ] Build resizable 360–520 px desktop panel and responsive bottom sheet.
- [ ] Run client tests; expect pass.

### Task 6: Branch and vocabulary forms

**Files:**
- Create: `src/client/components/BranchEditor.tsx`
- Create: `src/client/components/VocabularyEditor.tsx`
- Modify: `src/client/components/MindmapEditorPanel.tsx`
- Modify: `tests/client/mindmap-editor.test.tsx`

- [ ] Add failing form tests for save, undo, branch add/delete, vocabulary update, and preserved form values after API error.
- [ ] Implement explicit-save forms and destructive confirmations.
- [ ] Refresh selected map/node from server after every successful mutation.
- [ ] Run client tests; expect pass.

### Task 7: AI vocabulary draft inside editor

**Files:**
- Create: `src/client/components/AiVocabularyDraftEditor.tsx`
- Modify: `src/client/components/MindmapEditorPanel.tsx`
- Modify: `src/client/api/client.ts`
- Modify: `tests/client/mindmap-editor.test.tsx`

- [ ] Add failing tests for automatic submit enrichment, loading, editable draft, failure, retry, manual fallback, and approval.
- [ ] Reuse `captureVocabulary`, Vocabulary Inbox draft update/retry/approve APIs with selected map and branch hints.
- [ ] After approval, reload map and select new node.
- [ ] Run client tests; expect pass.

### Task 8: Shared learning prompt model

**Files:**
- Create: `src/client/lib/learning-prompt.ts`
- Create: `tests/client/learning-prompt.test.ts`

- [ ] Add failing table tests for `meaning-recall`, `context`, `speak`, general recall, unknown fallback, Vietnamese diacritics, and progressive concealment.
- [ ] Implement pure `createLearningPrompt(item)` and `getLearningHint(model,level)` helpers.
- [ ] Run prompt tests; expect pass.

### Task 9: Flip card and quiz integration

**Files:**
- Create: `src/client/components/LearningPromptCard.tsx`
- Modify: `src/client/components/QuizCard.tsx`
- Modify: `src/client/pages/LearningPage.tsx`
- Modify: `src/client/styles/learning.css`
- Modify: `tests/client/learning-flow.test.tsx`

- [ ] Add failing tests proving no pre-answer answer pair, activity-aware front, first flip counts once, hint language matches answer language, and item change resets state.
- [ ] Build accessible flip card with reduced-motion fallback.
- [ ] Lift combined hint count into `LearningPage`/quiz flow and preserve existing grading.
- [ ] Run learning tests; expect pass.

### Task 10: Integration and regression verification

**Files:**
- Modify: `tests/e2e/app.spec.ts`
- Modify: `README.md`

- [ ] Add E2E coverage for seed copy, editor AI approval, reload persistence, flip reveal, and bilingual hint direction.
- [ ] Run targeted tests for both features.
- [ ] Run `npm test`, `npm run typecheck`, `npm run build`, and `npm run test:e2e`.
- [ ] Run `git diff --check` and inspect rendered desktop/mobile UI in local browser.
- [ ] Commit only after all evidence passes; preserve unrelated workspace changes.