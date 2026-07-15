# Vocabulary Inbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add an account-owned vocabulary inbox that accepts notes from global capture, tutor chat, and mindmaps; enriches them with AI-generated learning data; requires learner approval; then saves examples, mindmap placement, and SRS state.

**Architecture:** A focused `VocabularyInboxRepository` owns capture, drafts, duplicate checks, and atomic approval. `VocabularyEnrichmentService` composes the committed tutor skill, bounded learner context, and candidate mindmap metadata into strict JSON. Express routes and agent tools pass authenticated `userId`; React exposes one inbox state through quick capture, chat, mindmap, and a dedicated review page.

**Tech Stack:** TypeScript, Express 5, better-sqlite3, Zod, React 19, Vitest, Testing Library, Playwright, existing 9Router client.

---

## File Map

- Create: `docs/ai-skills/mindmap-english-tutor/SKILL.md` ? committed runtime tutor policy.
- Modify: `src/server/modules/agent/skill-loader.ts` ? load skill from committed docs path.
- Modify: `src/server/db/migrate.ts` ? inbox, draft, personal example schema and profile triggers.
- Modify: `src/shared/contracts.ts` ? shared inbox/enrichment schemas.
- Create: `src/server/modules/vocabulary-inbox/repository.ts` ? account-owned persistence and atomic approval.
- Create: `src/server/modules/vocabulary-inbox/enrichment-service.ts` ? strict AI enrichment and placement candidates.
- Create: `src/server/modules/vocabulary-inbox/routes.ts` ? authenticated HTTP API.
- Modify: `src/server/app.ts` ? construct and mount inbox module.
- Modify: `src/server/modules/agent/tool-service.ts` ? expose tutor note-capture tool behavior.
- Modify: `src/server/modules/agent/routes.ts` ? route explicit save-note requests.
- Modify: `src/server/modules/learning/repository.ts` ? merge personal examples into learning items.
- Modify: `src/client/api/client.ts` ? typed inbox API.
- Modify: `src/client/state/app-store.tsx` ? inbox page and quick-capture state.
- Modify: `src/client/components/AppShell.tsx` ? global capture control and shortcut host.
- Create: `src/client/components/QuickCaptureDrawer.tsx` ? low-friction capture form.
- Create: `src/client/pages/VocabularyInboxPage.tsx` ? queue and review workflow.
- Modify: `src/client/App.tsx` ? page routing.
- Modify: `src/client/pages/MindmapPage.tsx` ? branch-aware capture entry.
- Modify: `src/client/components/AgentDrawer.tsx` ? save-note action and inbox deep link.
- Create: `src/client/styles/vocabulary-inbox.css` ? warm notebook responsive UX.
- Modify: `src/client/main.tsx` ? load inbox styles.
- Test: `tests/server/vocabulary-inbox.test.ts`, `tests/server/vocabulary-inbox-api.test.ts`, `tests/server/tutor-skill.test.ts`, `tests/server/user-isolation.test.ts`.
- Test: `tests/client/quick-capture.test.tsx`, `tests/client/vocabulary-inbox.test.tsx`, `tests/e2e/app.spec.ts`.

### Task 1: Commit Runtime Tutor Skill

**Files:**
- Create: `docs/ai-skills/mindmap-english-tutor/SKILL.md`
- Modify: `src/server/modules/agent/skill-loader.ts`
- Test: `tests/server/tutor-skill.test.ts`

- [x] Copy current `.hermes/skills/mindmap-english-tutor/SKILL.md` into the committed docs path and add a `Vocabulary capture` policy requiring strict structured output, three example roles, learner approval, minimal context, and no direct canonical writes.
- [x] Change loader root to `docs/ai-skills/mindmap-english-tutor`; keep size, frontmatter, name, version, and traversal checks.
- [x] Update skill tests to create/read the docs path and assert the vocabulary-capture policy is loaded without fallback.
- [x] Run `npx vitest run tests/server/tutor-skill.test.ts`; expect all tests pass.
- [x] Commit `feat(agent): commit tutor runtime skill`.

### Task 2: Add Inbox Schema and Contracts

**Files:**
- Modify: `src/server/db/migrate.ts`
- Modify: `src/shared/contracts.ts`
- Test: `tests/server/database.test.ts`

- [x] Write failing migration assertions for `vocabulary_inbox_items`, `vocabulary_inbox_drafts`, and `user_vocabulary_examples`, including ownership indexes, unique draft item, unique `(user_id,fingerprint)`, and approved vocabulary reference.
- [x] Add idempotent SQLite schema with status/source/item/example-role checks and foreign keys to users, vocabulary, mindmaps, mindmap nodes, and inbox items.
- [x] Add profile-revision triggers for approved inbox changes and personal example insert/update/delete.
- [x] Define Zod schemas and inferred types: `VocabularyInboxStatus`, `VocabularyInboxSource`, `VocabularyExampleDraft`, `VocabularyPlacementDraft`, `VocabularyEnrichmentDraft`, `VocabularyInboxItem`, and capture/update/approve inputs.
- [x] Run `npx vitest run tests/server/database.test.ts`; expect pass.
- [x] Commit `feat(data): add vocabulary inbox schema`.

### Task 3: Build Account-Owned Repository

**Files:**
- Create: `src/server/modules/vocabulary-inbox/repository.ts`
- Test: `tests/server/vocabulary-inbox.test.ts`
- Modify: `tests/server/user-isolation.test.ts`

- [x] Write failing tests for capture, list by status, read, save validated draft, mark processing/failed/ready, dismiss, duplicate pending capture, and cross-user 404 behavior.
- [x] Implement normalized capture with bounded `rawText` and `contextText`; validate source map/thread references against the same user.
- [x] Implement duplicate lookup: return existing pending item for the user; otherwise attach existing canonical `vocabulary_id` without creating duplicate vocabulary.
- [x] Write failing atomic-approval tests covering new term, existing term, three personal examples, example fingerprint dedupe, existing map branch, proposed new map draft, idempotent repeat, and rollback on invalid destination.
- [x] Implement `approve(userId,itemId,input)` in one transaction. Upsert `user_vocabulary_state` only when absent, never reset existing SRS fields, insert personal examples, place a node or create a user-owned draft map, and store approved result.
- [x] Add two-user tests for every item, draft, example, destination, and approval ID.
- [x] Run `npx vitest run tests/server/vocabulary-inbox.test.ts tests/server/user-isolation.test.ts`; expect pass.
- [ ] Commit `feat(vocabulary): add account-owned inbox`.

### Task 4: Add AI Enrichment and Placement

**Files:**
- Create: `src/server/modules/vocabulary-inbox/enrichment-service.ts`
- Modify: `src/server/modules/agent/tool-service.ts`
- Test: `tests/server/vocabulary-inbox.test.ts`
- Test: `tests/server/agent-tools.test.ts`

- [x] Write failing tests proving enrichment sends only raw note, optional context, bounded learner snapshot, and account-owned candidate map titles/branches.
- [x] Define strict 9Router output schema with normalized/display term, meaning, IPA, part of speech, CEFR, item type, exactly three distinct roles, translations, optional usage notes, and ranked placement/new-map proposal.
- [x] Implement state transitions `queued -> processing -> ready` and `processing -> failed`; sanitize persisted provider errors and allow retry.
- [x] Add repository candidate query capped to relevant account-owned maps plus seed map metadata; never send private nodes from another user.
- [x] Add `captureVocabularyNote(userId,input)` and `enrichVocabularyNote(userId,itemId)` methods to agent service for HTTP/chat reuse.
- [x] Run targeted enrichment and agent tests; expect pass.
- [ ] Commit `feat(agent): enrich vocabulary notes`.

### Task 5: Expose Authenticated API

**Files:**
- Create: `src/server/modules/vocabulary-inbox/routes.ts`
- Modify: `src/server/app.ts`
- Modify: `src/server/modules/agent/routes.ts`
- Test: `tests/server/vocabulary-inbox-api.test.ts`

- [x] Write failing Supertest cases for capture, list/filter, detail, draft edit, retry enrichment, approve, dismiss, validation errors, session requirement, and cross-user IDs.
- [x] Implement routes: `POST /api/vocabulary-inbox`, `GET /api/vocabulary-inbox`, `GET /api/vocabulary-inbox/:id`, `PATCH /api/vocabulary-inbox/:id/draft`, `POST /api/vocabulary-inbox/:id/enrich`, `POST /api/vocabulary-inbox/:id/approve`, and `POST /api/vocabulary-inbox/:id/dismiss`.
- [x] Mount router behind existing auth/origin middleware and use 404 for foreign IDs.
- [x] Add explicit `POST /api/agent/vocabulary-notes` adapter so tutor UI can save a note without parsing arbitrary chat text server-side.
- [x] Run `npx vitest run tests/server/vocabulary-inbox-api.test.ts tests/server/auth-api.test.ts`; expect pass.
- [ ] Commit `feat(api): expose vocabulary inbox`.

### Task 6: Add Quick Capture and Review UX

**Files:**
- Modify: `src/client/api/client.ts`
- Modify: `src/client/state/app-store.tsx`
- Modify: `src/client/components/AppShell.tsx`
- Create: `src/client/components/QuickCaptureDrawer.tsx`
- Create: `src/client/pages/VocabularyInboxPage.tsx`
- Modify: `src/client/App.tsx`
- Create: `src/client/styles/vocabulary-inbox.css`
- Modify: `src/client/main.tsx`
- Test: `tests/client/quick-capture.test.tsx`
- Test: `tests/client/vocabulary-inbox.test.tsx`

- [x] Add typed API methods for all inbox endpoints and preserve unauthorized-event behavior.
- [x] Write failing quick-capture tests for header control, `N` shortcut outside editable elements, raw/context submission, pending feedback, close/reopen, and API failure.
- [x] Implement global **Ghi nhanh** control and responsive drawer using existing warm notebook tokens; no gradients/glass; support focus trap, Escape, labels, and reduced motion.
- [x] Extend app page union/routing with `vocabulary-inbox`; add **Tu moi** navigation badge sourced from ready/failed counts.
- [x] Write failing page tests for queued/processing/ready/failed/approved/dismissed tabs, empty states, editable details, exactly three example cards, destination selector, retry, dismiss, and approval.
- [x] Implement desktop editorial queue + review side sheet and mobile full-page review. Mark AI-generated vs learner-edited fields and require explicit approval.
- [x] Run `npx vitest run tests/client/quick-capture.test.tsx tests/client/vocabulary-inbox.test.tsx`; expect pass.
- [ ] Commit `feat(ui): add vocabulary inbox workflow`.

### Task 7: Connect Mindmap, Tutor Chat, and Learning

**Files:**
- Modify: `src/client/pages/MindmapPage.tsx`
- Modify: `src/client/components/MindmapCanvas.tsx`
- Modify: `src/client/components/AgentDrawer.tsx`
- Modify: `src/server/modules/learning/repository.ts`
- Test: `tests/client/agent-drawer.test.tsx`
- Test: `tests/server/vocabulary-inbox.test.ts`
- Test: `tests/server/session-service.test.ts`

- [x] Add a branch action that opens quick capture with `mindmapId` and `parentNodeId`; hide it for seed maps and non-branch nodes.
- [x] Add tutor message action **Luu vao hop tu moi** and an explicit compact save form; call agent vocabulary-note API and deep-link to created item. Do not infer saves from every message.
- [x] Update learning item example query to prefer current user personal examples, then seed examples, without exposing another user examples.
- [x] Add tests proving approved items appear as `new` in next session, existing progress is unchanged, and personal examples are selected only for owner.
- [x] Run targeted client/learning tests; expect pass.
- [ ] Commit `feat(learning): connect saved vocabulary`.

### Task 8: Backup, Docs, E2E, and Full Verification

**Files:**
- Modify: `src/server/modules/backup/service.ts`
- Modify: `README.md`
- Modify: `docs/vi/tich-hop-9router.md`
- Modify: `tests/server/backup.test.ts`
- Modify: `tests/e2e/app.spec.ts`

- [x] Add backup assertions proving inbox items, approved links, and personal examples are retained while auth secrets and AI caches stay redacted.
- [x] Document committed runtime skill path, capture/review workflow, AI failure behavior, account privacy, and VPS backup sensitivity.
- [x] Add E2E: account A quick-captures, receives mocked enrichment, edits, approves, reloads, sees review-ready term; account B sees no inbox item/example/node/SRS state.
- [x] Add E2E duplicate capture and failed-enrichment retry coverage using deterministic test provider behavior.
- [x] Run `npm test`; expect all unit/integration tests pass.
- [x] Run `npm run typecheck`; expect zero errors.
- [x] Run `npm run build`; expect Vite success.
- [x] Run `npm run test:e2e`; expect supported projects pass with only intentional project skips.
- [x] Run `npm audit --audit-level=high`; expect zero vulnerabilities.
- [x] Run `git diff --check`; expect no whitespace errors.
- [ ] Commit `docs: document vocabulary inbox`.

## Completion Audit

- [x] Runtime AI skill exists under `docs/`, is tracked by Git, and loader no longer depends on ignored `.hermes`.
- [x] All three entry points create the same account-owned inbox entity.
- [x] AI creates exactly three bilingual example roles and proposes existing or new mindmap placement.
- [x] No AI content reaches canonical vocabulary, examples, mindmaps, or SRS before learner approval.
- [x] Approval is atomic, idempotent, duplicate-safe, and never resets prior SRS progress.
- [x] Personal examples remain private and are used only in owner learning sessions.
- [x] Inbox history, failures, edits, and approvals survive reload.
- [x] Two-account tests prove isolation across inbox, examples, maps, and review state.
- [x] Full test, typecheck, build, E2E, audit, and diff checks pass with fresh evidence.
