# Three-Source Learning Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add offline dictionary assistance, sentence shadowing, and personal document reading while preserving one canonical vocabulary/SRS model and local-first operation.

**Architecture:** Extend the modular Express/SQLite backend with focused `dictionary`, `speaking`, and `documents` modules. Add Zod contracts and typed client calls before UI work. Deliver each subsystem as a vertical slice with repository/service, API, React page/components, tests, and accessibility checks.

**Tech Stack:** React 19, TypeScript strict, Express 5, better-sqlite3, Zod 4, Vitest, Testing Library, Supertest, Playwright, existing 9Router speech client.

---

## File Structure

Create:

- `src/server/modules/dictionary/word-index.ts`: read-only word lookup, prefix suggestions, bounded edit-distance suggestions.
- `src/server/modules/dictionary/routes.ts`: dictionary HTTP endpoints.
- `src/server/modules/speaking/repository.ts`: sentence notebook, sessions, attempts, metrics SQL.
- `src/server/modules/speaking/diff.ts`: deterministic token diff and content-match score.
- `src/server/modules/speaking/routes.ts`: notebook and speaking session APIs.
- `src/server/modules/documents/parser.ts`: TXT/Markdown normalization and section extraction.
- `src/server/modules/documents/repository.ts`: document metadata, sections, highlights, provenance.
- `src/server/modules/documents/routes.ts`: upload, list, read, highlight, extraction draft APIs.
- `src/client/components/DictionaryInput.tsx`: autocomplete and correction UI.
- `src/client/components/TranscriptDiff.tsx`: accessible transcript comparison.
- `src/client/components/DocumentReader.tsx`: reader and selection actions.
- `src/client/pages/PracticePage.tsx`: sentence notebook and shadowing workspace.
- `src/client/pages/ReadingPage.tsx`: document library and reader workspace.
- `src/client/styles/practice.css`: focused speaking layout.
- `src/client/styles/reader.css`: editorial library/reader layout.
- `tests/server/dictionary.test.ts`
- `tests/server/speaking.test.ts`
- `tests/server/documents.test.ts`
- `tests/client/dictionary-input.test.tsx`
- `tests/client/practice-page.test.tsx`
- `tests/client/reading-page.test.tsx`

Modify:

- `src/server/db/migrate.ts`: add sentence, speaking, document, and highlight tables.
- `src/server/app.ts`: mount three routers.
- `src/shared/contracts.ts`: add dictionary, speaking, document schemas.
- `src/client/api/client.ts`: typed API methods.
- `src/client/state/app-store.tsx`: add `practice` and `reading` pages plus selected document state.
- `src/client/App.tsx`: mount new pages.
- `src/client/components/AppShell.tsx`: navigation becomes Today, Library, Practice, Progress.
- `src/client/pages/LibraryPage.tsx`: add document entry point and move create-mindmap action into Library.
- `src/client/pages/CreateMindmapPage.tsx`: use dictionary assistance for generated/edited terms.
- `src/client/styles/global.css`, `layout.css`, `tokens.css`: import styles and fix current responsive defects.
- `tests/server/database.test.ts`, `tests/e2e/app.spec.ts`: schema and end-to-end coverage.
- `README.md`, `docs/vi/huong-dan-su-dung.md`, `docs/vi/kien-truc-va-phat-trien.md`: update only after implementation passes.

## Task 1: Schema and Shared Contracts

**Files:** `src/server/db/migrate.ts`, `src/shared/contracts.ts`, `tests/server/database.test.ts`

- [x] Add failing migration assertions for `sentence_notebook`, `speaking_sessions`, `speaking_session_items`, `speaking_attempts`, `document_sources`, `document_sections`, and `document_highlights`.
- [x] Run `npm test -- tests/server/database.test.ts`; expect failure listing missing tables.
- [x] Add tables with foreign keys to canonical `vocabulary`, optional `examples`, and document provenance. Use checks for speaking status (`active`, `completed`, `abandoned`) and source type (`quoted`, `user`, `ai`).
- [x] Add Zod schemas `DictionaryLookupSchema`, `SentenceNotebookEntrySchema`, `SpeakingAttemptSchema`, `DocumentSummarySchema`, `DocumentSectionSchema`, and `DocumentHighlightSchema`.
- [x] Run database test and `npm run typecheck`; expect pass.
- [x] Commit: `feat(db): add speaking and document schema` (`142fa99`).

## Task 2: Offline Dictionary Core

**Files:** `src/server/modules/dictionary/word-index.ts`, `src/server/modules/dictionary/routes.ts`, `src/server/app.ts`, `tests/server/dictionary.test.ts`

- [x] Write tests for exact lookup, six-result prefix cap, typo suggestion, unknown-term override response, and no AI dependency.
- [x] Run `npm test -- tests/server/dictionary.test.ts`; expect module-not-found failure.
- [x] Implement `WordIndex` with `has(term)`, `complete(prefix, limit = 6)`, and `suggest(term, limit = 3)`. Normalize with `trim().toLocaleLowerCase(en-US).normalize(NFKC)`.
- [x] Load words from configurable local text file when present; fall back to canonical vocabulary terms plus a small seed list so app still starts without downloaded data.
- [x] Add `GET /api/dictionary/lookup?term=` and `GET /api/dictionary/complete?prefix=`. Return `{term, normalizedTerm, known, existingVocabularyId, suggestions}`.
- [x] Mount router in `createApp` without NineRouter dependency.
- [x] Run dictionary tests and full server tests; expect pass.
- [x] Consolidated implementation commit: `feat(learning): add three-source workflows` (`f4d182c`).

## Task 3: Dictionary UI Assistance

**Files:** `src/client/components/DictionaryInput.tsx`, `src/client/api/client.ts`, `src/client/pages/CreateMindmapPage.tsx`, `tests/client/dictionary-input.test.tsx`

- [x] Write component tests for keyboard selection, six-result limit, correction action, existing-vocabulary state, and explicit unknown-word acceptance.
- [x] Run `npm test -- tests/client/dictionary-input.test.tsx`; expect component-not-found failure.
- [x] Add typed `dictionaryLookup` and `dictionaryComplete` client methods.
- [x] Implement debounced input with `combobox`, `listbox`, `option`, `aria-activedescendant`, Escape close, Arrow navigation, and Enter selection.
- [x] Integrate into mindmap draft/editor term entry. Do not block save for unknown terms; require visible confirmation.
- [x] Run component tests, typecheck, and build; expect pass.
- [x] Consolidated implementation commit: `feat(learning): add three-source workflows` (`f4d182c`).

## Task 4: Sentence Notebook and Transcript Diff

**Files:** `src/server/modules/speaking/repository.ts`, `src/server/modules/speaking/diff.ts`, `src/server/modules/speaking/routes.ts`, `src/server/app.ts`, `tests/server/speaking.test.ts`

- [x] Write tests for adding/listing notebook sentences, duplicate fingerprint rejection, starting session, recording attempt, completing session, and weekly metrics.
- [x] Add unit cases for punctuation-insensitive tokenization, missing words, extra words, replacements, and deterministic score.
- [x] Run `npm test -- tests/server/speaking.test.ts`; expect failure.
- [x] Implement normalized sentence fingerprint using Unicode NFKC, lowercase, punctuation stripping, and collapsed spaces.
- [x] Implement token-level longest-common-subsequence diff returning ordered `{token, status}` entries where status is `match`, `missing`, `extra`, or `replacement`.
- [x] Implement repository transactions for sessions and attempts. Store target sentence, transcript, diff JSON, content score, duration, and timestamps.
- [x] Add notebook and speaking endpoints under `/api/speaking`.
- [x] Run speaking tests and typecheck; expect pass.
- [x] Consolidated implementation commit: `feat(learning): add three-source workflows` (`f4d182c`).

## Task 5: Speaking Practice UI

**Files:** `src/client/pages/PracticePage.tsx`, `src/client/components/TranscriptDiff.tsx`, `src/client/api/client.ts`, `src/client/state/app-store.tsx`, `src/client/App.tsx`, `src/client/components/AppShell.tsx`, `src/client/styles/practice.css`, `tests/client/practice-page.test.tsx`

- [x] Write tests for sentence selection, TTS action, recording states, transcript feedback, retry, next sentence, offline-provider message, and session completion.
- [x] Run `npm test -- tests/client/practice-page.test.tsx`; expect failure.
- [x] Add typed notebook/session/attempt API methods.
- [x] Add `practice` page state and mount `PracticePage`.
- [x] Build desktop two-panel workspace and mobile single-task flow. Use labels `Giữ để nói`, `Đang nghe…`, `Đang phân tích…`, `Nói lại`.
- [x] Reuse existing `api.transcribe` and `api.synthesize`; submit transcript to speaking API for deterministic diff.
- [x] Render transcript status with text plus color. Limit coaching to three items. Never label result pronunciation score.
- [x] Add Practice navigation and preserve focus-mode exit.
- [x] Run component tests, typecheck, and build; expect pass.
- [x] Consolidated implementation commit: `feat(learning): add three-source workflows` (`f4d182c`).

## Task 6: TXT and Markdown Documents

**Files:** `src/server/modules/documents/parser.ts`, `src/server/modules/documents/repository.ts`, `src/server/modules/documents/routes.ts`, `src/server/app.ts`, `tests/server/documents.test.ts`

- [x] Write tests for TXT upload, Markdown heading sections, MIME/extension rejection, size limit, checksum deduplication, list/read, highlight provenance, and path traversal rejection.
- [x] Run `npm test -- tests/server/documents.test.ts`; expect failure.
- [x] Implement parser returning ordered sections with stable text fingerprints.
- [x] Store original files under `data/documents/<checksum>/source.<ext>` and DB metadata in one transaction after safe file write.
- [x] Allow only `.txt` and `.md` in first slice, UTF-8 text, maximum 5 MB. Sanitize displayed filename and never use it as storage path.
- [x] Add upload/list/detail/highlight routes under `/api/documents` using Multer memory storage.
- [x] Add selection actions that create or link canonical vocabulary, notebook sentences, and mindmap draft inputs; preserve document/section offsets.
- [x] Run document tests and full server tests; expect pass.
- [x] Consolidated implementation commit: `feat(learning): add three-source workflows` (`f4d182c`).

## Task 7: Editorial Reading UI

**Files:** `src/client/pages/ReadingPage.tsx`, `src/client/components/DocumentReader.tsx`, `src/client/api/client.ts`, `src/client/state/app-store.tsx`, `src/client/App.tsx`, `src/client/pages/LibraryPage.tsx`, `src/client/styles/reader.css`, `tests/client/reading-page.test.tsx`

- [x] Write tests for upload, feature-card selection, section navigation, highlight action toolbar, save sentence, create vocabulary, and mobile drawer behavior.
- [x] Run `npm test -- tests/client/reading-page.test.tsx`; expect failure.
- [x] Add typed document API methods and selected-document state.
- [x] Add `reading` page reachable from Library, not primary navigation.
- [x] Build editorial library composition and desktop three-region reader. Mobile uses full-width text with table-of-contents and notes sheets.
- [x] Implement selection toolbar with `Tạo thẻ từ`, `Lưu câu`, `Thêm vào mindmap`, `Hỏi gia sư`.
- [x] Add reader font-size and line-height controls persisted in localStorage.
- [x] Run component tests, typecheck, and build; expect pass.
- [x] Consolidated implementation commit: `feat(learning): add three-source workflows` (`f4d182c`).

## Task 8: EPUB and AI Extraction Drafts

**Files:** `package.json`, `src/server/modules/documents/parser.ts`, `src/server/modules/documents/routes.ts`, `src/server/modules/agent/tool-service.ts`, `src/shared/contracts.ts`, `tests/server/documents.test.ts`

- [x] Add failing fixture tests for EPUB chapter extraction, unsafe archive paths, oversized expanded content, and extraction draft validation.
- [x] Reuse the existing maintained `adm-zip` dependency after confirming current project compatibility; avoid adding a redundant EPUB dependency.
- [x] Parse EPUB in memory with archive traversal and decompression-size limits. Convert chapters to normalized text sections.
- [x] Add AI extraction request for selected sections. Validate vocabulary/collocation/example/quiz/mindmap candidates with Zod and save only as draft.
- [x] Categorize candidates as `recommended`, `optional`, or `skip`, each with a short reason.
- [x] Run document/agent tests, audit, typecheck, and build; expect pass.
- [x] Consolidated implementation commit: `feat(learning): add three-source workflows` (`f4d182c`).

## Task 9: Navigation, Responsive Fixes, and E2E

**Files:** `src/client/components/AppShell.tsx`, `src/client/styles/layout.css`, `src/client/styles/global.css`, `tests/e2e/app.spec.ts`

- [x] Update E2E tests for Today, Library, Practice, Progress navigation; document import; save sentence; shadowing happy path with mocked speech; mobile bottom navigation.
- [x] Make `Tạo mindmap` a Library action and replace primary nav slot with `Phòng luyện`.
- [x] Reduce Today hero height on mobile, remove headline chromatic ghosting, reduce desktop hero type scale, and move Agent FAB above bottom navigation without covering cards.
- [x] Add reduced-motion rules for new recording and sheet transitions.
- [x] Run Playwright desktop and mobile projects; expect pass.
- [x] Consolidated implementation commit: `feat(learning): add three-source workflows` (`f4d182c`).

## Task 10: Verification and Documentation

**Files:** `README.md`, `docs/vi/huong-dan-su-dung.md`, `docs/vi/kien-truc-va-phat-trien.md`, `docs/vi/tich-hop-9router.md`

- [x] Run `npm test`; expect all unit, integration, and component tests pass.
- [x] Run `npm run typecheck`; expect zero TypeScript errors.
- [x] Run `npm run build`; expect production bundle succeeds.
- [x] Run `npm run test:e2e`; desktop/mobile scenarios pass and Playwright exits cleanly.
- [x] Run `npm audit --audit-level=moderate`; expect zero unresolved moderate-or-higher vulnerabilities.
- [x] Update README features, commands, data directories, privacy, roadmap, and test counts from verified output.
- [x] Update Vietnamese usage guide with dictionary assistance, sentence notebook, shadowing, document import, selection actions, and offline limitations.
- [x] Update architecture doc with modules, routes, tables, storage, provenance, backup impact, and AI draft boundary.
- [x] Update 9Router doc with speaking/extraction capability degradation behavior.
- [x] Run placeholder scan and `git diff --check`.
- [x] Commit documentation and completed checklist: `docs: document learning expansion`.
