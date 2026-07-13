# MindMap English Local AI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a clean, tested, local-first English learning web application with interactive mindmaps, SQLite SRS, 9Router Agent tools, push-to-talk practice, backup, Vietnamese documentation, and an updated README.

**Architecture:** Use a TypeScript modular monolith. Vite serves the React client in development, Express exposes a localhost API, and better-sqlite3 owns persistence behind repositories. Shared Zod schemas define API and AI contracts; 9Router access stays behind capability adapters so core learning remains offline-capable.

**Tech Stack:** React 19.2, Vite 8.1, TypeScript 7, Express 5.2, better-sqlite3 12.11, Zod 4.4, @xyflow/react 12.11, Vitest 4.1, Supertest 7.2, Lucide React 1.24.

---

## File Map

### Root

- `package.json`: scripts and dependencies.
- `tsconfig.json`: shared TypeScript configuration.
- `vite.config.ts`: client build and API proxy.
- `vitest.config.ts`: unit/integration test setup.
- `.env.example`: 9Router and local server variables.
- `README.md`: Vietnamese-first project overview and commands.

### Shared Contracts

- `src/shared/contracts.ts`: Zod schemas and inferred API types.
- `src/shared/constants.ts`: CEFR levels, review grades, topic colors.

### Server

- `src/server/index.ts`: process bootstrap and localhost binding.
- `src/server/app.ts`: Express composition and route mounting.
- `src/server/config.ts`: environment parsing.
- `src/server/db/database.ts`: SQLite connection and transaction helper.
- `src/server/db/migrate.ts`: schema migrations.
- `src/server/db/seed.ts`: practical starter topics and Eating map.
- `src/server/modules/content/repository.ts`: topics, vocabulary, mindmaps.
- `src/server/modules/learning/srs.ts`: deterministic review scheduling.
- `src/server/modules/learning/session-service.ts`: 10/20-minute session composition.
- `src/server/modules/learning/repository.ts`: sessions, attempts, progress.
- `src/server/modules/agent/ninerouter-client.ts`: OpenAI-compatible capability calls.
- `src/server/modules/agent/tool-service.ts`: learning-aware Agent tools.
- `src/server/modules/agent/routes.ts`: tutor and generation endpoints.
- `src/server/modules/speech/routes.ts`: STT/TTS proxy endpoints.
- `src/server/modules/backup/service.ts`: SQLite/media export and restore validation.
- `src/server/routes/*.ts`: dashboard, library, mindmap, learning, progress, settings, backup APIs.

### Client

- `src/client/main.tsx`: React entry.
- `src/client/App.tsx`: application shell and route state.
- `src/client/api/client.ts`: typed fetch wrapper.
- `src/client/state/app-store.tsx`: lightweight context state.
- `src/client/components/AppShell.tsx`: compact navigation and responsive shell.
- `src/client/components/AgentDrawer.tsx`: tutor drawer.
- `src/client/components/MindmapCanvas.tsx`: React Flow canvas.
- `src/client/components/VocabularyNode.tsx`: custom vocabulary node.
- `src/client/components/SessionBar.tsx`: study timing and progress.
- `src/client/components/SpeakButton.tsx`: push-to-talk interaction.
- `src/client/pages/TodayPage.tsx`: dashboard.
- `src/client/pages/LibraryPage.tsx`: topic/mindmap library.
- `src/client/pages/MindmapPage.tsx`: explore/edit map.
- `src/client/pages/CreateMindmapPage.tsx`: AI draft generation and approval.
- `src/client/pages/LearningPage.tsx`: active lesson and quizzes.
- `src/client/pages/ProgressPage.tsx`: retention and weekly metrics.
- `src/client/pages/SettingsPage.tsx`: 9Router and backup configuration.
- `src/client/styles/*.css`: tokens, layout, components, responsive behavior.

### Tests and Docs

- `tests/server/*.test.ts`: SRS, sessions, repositories, routes, Agent contracts, backup.
- `tests/client/*.test.tsx`: dashboard, mindmap, Agent drawer, study flow.
- `docs/vi/huong-dan-su-dung.md`: Vietnamese user guide.
- `docs/vi/kien-truc-va-phat-trien.md`: Vietnamese architecture/developer guide.
- `docs/vi/tich-hop-9router.md`: Vietnamese 9Router setup and troubleshooting.

---

### Task 1: Project Foundation

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `index.html`
- Create: `.env.example`
- Modify: `.gitignore`
- Test: `tests/smoke/contracts.test.ts`

- [ ] **Step 1: Write failing contract smoke test**

```ts
import { describe, expect, it } from "vitest";
import { ReviewGradeSchema } from "../../src/shared/contracts";

describe("shared contracts", () => {
  it("accepts supported review grades", () => {
    expect(ReviewGradeSchema.parse("good")).toBe("good");
  });
});
```

- [ ] **Step 2: Run test and verify module-not-found failure**

Run: `npm test -- tests/smoke/contracts.test.ts`
Expected: FAIL because project and contract module do not exist.

- [ ] **Step 3: Add package scripts and dependencies**

Scripts must include `dev`, `dev:server`, `dev:client`, `build`, `start`, `test`, `test:watch`, `typecheck`, and `lint`-equivalent validation through TypeScript.

- [ ] **Step 4: Add shared grade schema**

```ts
export const ReviewGradeSchema = z.enum(["again", "hard", "good", "easy"]);
export type ReviewGrade = z.infer<typeof ReviewGradeSchema>;
```

- [ ] **Step 5: Run smoke test and typecheck**

Run: `npm test -- tests/smoke/contracts.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts vitest.config.ts index.html .env.example .gitignore src/shared tests/smoke
git commit -m "build: initialize TypeScript app"
```

### Task 2: SQLite Schema and Seed Content

**Files:**
- Create: `src/server/config.ts`
- Create: `src/server/db/database.ts`
- Create: `src/server/db/migrate.ts`
- Create: `src/server/db/seed.ts`
- Test: `tests/server/database.test.ts`

- [ ] **Step 1: Write failing migration test**

Test an in-memory database and assert tables `topics`, `mindmaps`, `mindmap_nodes`, `vocabulary`, `review_cards`, `learning_sessions`, `generation_jobs`, and `settings` exist with foreign keys enabled.

- [ ] **Step 2: Run migration test**

Run: `npm test -- tests/server/database.test.ts`
Expected: FAIL because database helpers do not exist.

- [ ] **Step 3: Implement database wrapper and migrations**

Use `Database.Database` from `better-sqlite3`; expose `createDatabase(path)`, `migrate(db)`, and transaction-safe helpers. Migration creates every table specified by design with indexes on review due dates, normalized vocabulary, node map IDs, and job status.

- [ ] **Step 4: Implement deterministic starter seed**

Seed 17 topic names and one interactive Eating mindmap containing practical vocabulary groups such as fruit, vegetables, meat, seafood, dessert, snacks, and useful B1 examples.

- [ ] **Step 5: Verify migration and seed tests**

Run: `npm test -- tests/server/database.test.ts`
Expected: PASS with repeatable seed behavior.

- [ ] **Step 6: Commit**

```bash
git add src/server/config.ts src/server/db tests/server/database.test.ts
git commit -m "feat(db): add SQLite schema and seed"
```

### Task 3: Content Repositories and API

**Files:**
- Create: `src/server/modules/content/repository.ts`
- Create: `src/server/routes/library.ts`
- Create: `src/server/routes/mindmaps.ts`
- Create: `src/server/app.ts`
- Test: `tests/server/content-api.test.ts`

- [ ] **Step 1: Write failing repository and API tests**

Verify topic listing, map detail loading, node updates, vocabulary reuse across maps, draft rejection, and explicit approval transition.

- [ ] **Step 2: Run focused tests**

Run: `npm test -- tests/server/content-api.test.ts`
Expected: FAIL because repositories/routes do not exist.

- [ ] **Step 3: Implement content repository**

Expose `listTopics`, `listMindmaps`, `getMindmap`, `saveMindmapDraft`, `updateMindmapNode`, and `approveMindmapDraft`. All multi-record writes use transactions and validate shared Zod contracts.

- [ ] **Step 4: Implement Express routes**

Routes:

- `GET /api/topics`
- `GET /api/mindmaps`
- `GET /api/mindmaps/:id`
- `POST /api/mindmaps/drafts`
- `PATCH /api/mindmaps/:id/nodes/:nodeId`
- `POST /api/mindmaps/:id/approve`

- [ ] **Step 5: Run tests**

Run: `npm test -- tests/server/content-api.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/server/modules/content src/server/routes src/server/app.ts tests/server/content-api.test.ts
git commit -m "feat(content): add mindmap API"
```

### Task 4: SRS and Session Composition

**Files:**
- Create: `src/server/modules/learning/srs.ts`
- Create: `src/server/modules/learning/session-service.ts`
- Create: `src/server/modules/learning/repository.ts`
- Create: `src/server/routes/learning.ts`
- Test: `tests/server/srs.test.ts`
- Test: `tests/server/session-service.test.ts`

- [ ] **Step 1: Write failing SRS tests**

Cover `again`, `hard`, `good`, and `easy`; verify increasing intervals, lapse reset, due-date calculation, and deterministic clock injection.

- [ ] **Step 2: Implement minimal SRS state transition**

```ts
export function scheduleReview(card: ReviewCardState, grade: ReviewGrade, now: Date): ReviewSchedule
```

Use a compact stability/ease model suitable for MVP. Never use wall-clock time directly inside the function.

- [ ] **Step 3: Write failing session tests**

Verify 10/20-minute templates, approximate 60/40 review-new ratio, weak-item priority, no duplicate vocabulary, and offline-safe activities.

- [ ] **Step 4: Implement session composer and persistence**

Expose `buildSession(profile, candidates, duration)` and API routes:

- `POST /api/learning/sessions`
- `GET /api/learning/sessions/:id`
- `POST /api/learning/sessions/:id/attempts`
- `POST /api/learning/sessions/:id/complete`

- [ ] **Step 5: Run focused tests**

Run: `npm test -- tests/server/srs.test.ts tests/server/session-service.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/server/modules/learning src/server/routes/learning.ts tests/server/srs.test.ts tests/server/session-service.test.ts
git commit -m "feat(learning): add SRS study sessions"
```

### Task 5: 9Router Client and Agent Tools

**Files:**
- Create: `src/server/modules/agent/ninerouter-client.ts`
- Create: `src/server/modules/agent/tool-service.ts`
- Create: `src/server/modules/agent/routes.ts`
- Test: `tests/server/ninerouter-client.test.ts`
- Test: `tests/server/agent-tools.test.ts`

- [ ] **Step 1: Write failing client contract tests**

Mock `fetch` and verify OpenAI-compatible `/v1/chat/completions`, `/v1/images/generations`, `/v1/audio/transcriptions`, and `/v1/audio/speech` requests, auth omission when key is blank, timeout handling, and typed errors.

- [ ] **Step 2: Implement capability client**

Expose `chatJson`, `generateImage`, `transcribe`, and `synthesizeSpeech`. Read URL/key/model names only from server config.

- [ ] **Step 3: Write failing Agent tool tests**

Verify tools read due reviews and learning profile; generated maps are drafts; save requires approval token/state; offline errors do not mutate learning data.

- [ ] **Step 4: Implement Agent tool service and routes**

Routes:

- `POST /api/agent/chat`
- `POST /api/agent/mindmap-drafts`
- `POST /api/agent/examples`

Agent system context must constrain output to practical B1-B2 learning and return structured contracts.

- [ ] **Step 5: Run tests**

Run: `npm test -- tests/server/ninerouter-client.test.ts tests/server/agent-tools.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/server/modules/agent tests/server/ninerouter-client.test.ts tests/server/agent-tools.test.ts
git commit -m "feat(agent): integrate 9Router tools"
```

### Task 6: Speech and Backup APIs

**Files:**
- Create: `src/server/modules/speech/routes.ts`
- Create: `src/server/modules/backup/service.ts`
- Create: `src/server/routes/backup.ts`
- Test: `tests/server/speech-api.test.ts`
- Test: `tests/server/backup.test.ts`

- [ ] **Step 1: Write failing speech tests**

Verify multipart audio validation, STT fallback error shape, TTS MIME response, and no raw audio logging.

- [ ] **Step 2: Implement speech endpoints**

- `POST /api/speech/transcribe`
- `POST /api/speech/synthesize`

Use in-memory upload limits and reject unsupported media types.

- [ ] **Step 3: Write failing backup tests**

Verify manifest generation, database inclusion, media path safety, schema validation, and mandatory pre-import backup.

- [ ] **Step 4: Implement backup service and routes**

- `POST /api/backups`
- `GET /api/backups`
- `POST /api/backups/:id/restore`

Backups remain under the configured local data directory.

- [ ] **Step 5: Run tests**

Run: `npm test -- tests/server/speech-api.test.ts tests/server/backup.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/server/modules/speech src/server/modules/backup src/server/routes/backup.ts tests/server/speech-api.test.ts tests/server/backup.test.ts
git commit -m "feat(local): add speech and backup APIs"
```

### Task 7: Client Shell and Today Dashboard

**Files:**
- Create: `src/client/main.tsx`
- Create: `src/client/App.tsx`
- Create: `src/client/api/client.ts`
- Create: `src/client/state/app-store.tsx`
- Create: `src/client/components/AppShell.tsx`
- Create: `src/client/pages/TodayPage.tsx`
- Create: `src/client/styles/tokens.css`
- Create: `src/client/styles/global.css`
- Create: `src/client/styles/layout.css`
- Test: `tests/client/today-page.test.tsx`

- [ ] **Step 1: Write failing dashboard test**

Render mocked dashboard data and assert `Học hôm nay`, 10/20-minute actions, due count, streak, and offline AI state.

- [ ] **Step 2: Implement typed API client and app state**

Fetch errors become typed user-facing states; Agent failure never blocks local data rendering.

- [ ] **Step 3: Implement anti-slop shell**

Use compact asymmetric navigation, one dominant study action, no equal-card grid, warm neutral tokens, visible focus, and responsive drawer behavior.

- [ ] **Step 4: Run client test and build**

Run: `npm test -- tests/client/today-page.test.tsx && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/client tests/client/today-page.test.tsx
git commit -m "feat(ui): add learning dashboard"
```

### Task 8: Library and Interactive Mindmap

**Files:**
- Create: `src/client/pages/LibraryPage.tsx`
- Create: `src/client/pages/MindmapPage.tsx`
- Create: `src/client/components/MindmapCanvas.tsx`
- Create: `src/client/components/VocabularyNode.tsx`
- Create: `src/client/styles/mindmap.css`
- Test: `tests/client/mindmap.test.tsx`

- [ ] **Step 1: Write failing mindmap tests**

Assert topic filtering, map opening, custom node content, audio action, node expansion, status labels, and editable node persistence callback.

- [ ] **Step 2: Implement library and React Flow canvas**

Map server nodes/edges into React Flow. Use stable custom-node components and fit-view controls. Store layout changes through debounced API updates.

- [ ] **Step 3: Implement focus and accessibility behavior**

Provide list fallback, keyboard node selection, non-color statuses, reduced motion, and Focus Mode.

- [ ] **Step 4: Run tests and build**

Run: `npm test -- tests/client/mindmap.test.tsx && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/client/pages/LibraryPage.tsx src/client/pages/MindmapPage.tsx src/client/components/MindmapCanvas.tsx src/client/components/VocabularyNode.tsx src/client/styles/mindmap.css tests/client/mindmap.test.tsx
git commit -m "feat(mindmap): add interactive canvas"
```

### Task 9: Learning, Quiz, and Progress UI

**Files:**
- Create: `src/client/pages/LearningPage.tsx`
- Create: `src/client/pages/ProgressPage.tsx`
- Create: `src/client/components/SessionBar.tsx`
- Create: `src/client/components/QuizCard.tsx`
- Create: `src/client/styles/learning.css`
- Test: `tests/client/learning-flow.test.tsx`

- [ ] **Step 1: Write failing learning flow test**

Start a 10-minute session, answer a quiz, submit a grade, move to next item, complete the session, and render summary/progress.

- [ ] **Step 2: Implement session UI**

Support explore, recognition, recall, collocation, context, and summary phases. Save progress after every attempt.

- [ ] **Step 3: Implement progress view**

Show due/new/weak/stable counts, weekly goals, retention summaries, speaking activity, and topic coverage without turning the page into a dense analytics dashboard.

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/client/learning-flow.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/client/pages/LearningPage.tsx src/client/pages/ProgressPage.tsx src/client/components/SessionBar.tsx src/client/components/QuizCard.tsx src/client/styles/learning.css tests/client/learning-flow.test.tsx
git commit -m "feat(study): add quiz and progress flows"
```

### Task 10: Agent Drawer, Mindmap Creation, and Voice UI

**Files:**
- Create: `src/client/components/AgentDrawer.tsx`
- Create: `src/client/components/SpeakButton.tsx`
- Create: `src/client/pages/CreateMindmapPage.tsx`
- Create: `src/client/styles/agent.css`
- Test: `tests/client/agent-flow.test.tsx`

- [ ] **Step 1: Write failing Agent flow tests**

Verify drawer open/close, offline state, draft generation, editable preview, approval requirement, microphone permission handling, transcript feedback, and TTS retry.

- [ ] **Step 2: Implement Agent drawer**

Agent responses show tool status and actionable learning suggestions. Do not render hidden chain-of-thought or raw provider payloads.

- [ ] **Step 3: Implement draft creation page**

Display structured branch preview, duplicate warnings, inline editing, validation errors, and explicit `Duyệt và lưu` action.

- [ ] **Step 4: Implement push-to-talk**

Use `MediaRecorder`; record one sentence; send audio to STT; display transcript/correction; request TTS audio; release media tracks after use.

- [ ] **Step 5: Run tests and build**

Run: `npm test -- tests/client/agent-flow.test.tsx && npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/client/components/AgentDrawer.tsx src/client/components/SpeakButton.tsx src/client/pages/CreateMindmapPage.tsx src/client/styles/agent.css tests/client/agent-flow.test.tsx
git commit -m "feat(agent-ui): add tutor and voice flows"
```

### Task 11: Settings, PWA Baseline, and Runtime Bootstrap

**Files:**
- Create: `src/client/pages/SettingsPage.tsx`
- Create: `src/server/routes/settings.ts`
- Create: `src/server/index.ts`
- Create: `public/manifest.webmanifest`
- Create: `public/icon.svg`
- Modify: `src/client/App.tsx`
- Test: `tests/server/settings-api.test.ts`

- [ ] **Step 1: Write failing settings tests**

Verify secrets are never returned, model identifiers persist, health checks report per-capability status, and server rejects non-loopback binding unless explicitly configured.

- [ ] **Step 2: Implement settings routes and UI**

Expose safe fields only. Add health test action, backup controls, default-duration setting, TTS voice setting, and environment-key instructions.

- [ ] **Step 3: Add runtime bootstrap and manifest**

Production server serves Vite output and API from localhost. Manifest provides installable metadata without adding offline service-worker caching that could hide stale API data.

- [ ] **Step 4: Run tests and production build**

Run: `npm test -- tests/server/settings-api.test.ts && npm run build`
Expected: PASS and generated `dist` assets.

- [ ] **Step 5: Commit**

```bash
git add src/client/pages/SettingsPage.tsx src/server/routes/settings.ts src/server/index.ts public src/client/App.tsx tests/server/settings-api.test.ts
git commit -m "feat(settings): add local runtime controls"
```

### Task 12: Documentation, Full Verification, and README

**Files:**
- Create: `docs/vi/huong-dan-su-dung.md`
- Create: `docs/vi/kien-truc-va-phat-trien.md`
- Create: `docs/vi/tich-hop-9router.md`
- Modify: `README.md`

- [ ] **Step 1: Write Vietnamese user guide**

Document installation, `npm install`, `.env`, starting the app, 10/20-minute sessions, mindmap editing, AI draft approval, speaking practice, backup, and restore.

- [ ] **Step 2: Write Vietnamese architecture guide**

Document module boundaries, SQLite tables, migration/seed flow, Agent tools, offline behavior, test commands, and extension points.

- [ ] **Step 3: Write Vietnamese 9Router guide**

Document `NINEROUTER_URL`, `NINEROUTER_KEY`, capability models, health check, common 401/400/503 errors, privacy behavior, and fallback usage.

- [ ] **Step 4: Replace README**

README must contain product screenshots or UI description, feature list, prerequisites, quick start, environment table, commands, data location, tests, docs links, privacy notes, and roadmap.

- [ ] **Step 5: Run complete verification**

Run:

```bash
npm run typecheck
npm test
npm run build
npm start
```

Verify API health and rendered dashboard in browser. Expected: all tests pass, production build succeeds, server binds localhost, dashboard and mindmap render without console errors.

- [ ] **Step 6: Review repository cleanliness**

Run: `git status --short`

Ensure generated DB, media, backups, `node_modules`, `dist`, `.tools`, `.superpowers`, source PDF/DOCX, and local secrets are not staged.

- [ ] **Step 7: Commit documentation**

```bash
git add README.md docs/vi
git commit -m "docs: add Vietnamese project guides"
```
