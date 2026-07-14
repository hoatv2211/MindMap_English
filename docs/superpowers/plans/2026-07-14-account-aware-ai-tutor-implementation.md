# Account-Aware AI Tutor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add secure local-first accounts, strict per-user SQLite ownership, dedicated tutor skill, bounded learner context/cache, persistent multi-thread chat, and responsive auth/chat UX.

**Architecture:** Express middleware resolves opaque cookie sessions to `AuthenticatedUser`; routes pass `userId` explicitly into repositories. One SQLite database stores auth, user-owned learning data, chat history, context snapshots, and selective response cache. React gates app behind auth and renders account controls plus responsive persistent tutor workspace.

**Tech Stack:** TypeScript, Node `crypto.scrypt`, Express 5, better-sqlite3, Zod, React 19, Vitest, Testing Library, Playwright.

---

## File Map

- `src/server/modules/auth/password.ts`: scrypt password/recovery hashing and verification.
- `src/server/modules/auth/service.ts`: registration, login, sessions, recovery, password change.
- `src/server/modules/auth/middleware.ts`: cookie parsing, session resolution, auth guard, origin guard.
- `src/server/modules/auth/routes.ts`: auth HTTP contracts.
- `src/server/modules/auth/rate-limit.ts`: auth attempt limits.
- `src/server/db/migrate.ts`: auth/cache schema and ownership migration.
- `src/server/authenticated-request.ts`: shared authenticated request type.
- Existing repositories/routes: explicit `userId` scoping.
- `.hermes/skills/mindmap-english-tutor/SKILL.md`: runtime tutor policy.
- `src/server/modules/agent/skill-loader.ts`: controlled skill loading and fallback.
- `src/server/modules/agent/learner-context.ts`: bounded learner snapshot and revision cache.
- `src/server/modules/agent/chat-repository.ts`: thread/message persistence and ownership.
- `src/server/modules/agent/response-cache.ts`: deterministic question cache policy.
- `src/server/modules/agent/tool-service.ts`: versioned skill + context + history prompt composition.
- `src/client/auth/auth-context.tsx`: auth bootstrap and actions.
- `src/client/pages/AuthPage.tsx`: login/register/recovery UI.
- `src/client/components/AccountMenu.tsx`: account controls.
- `src/client/components/AgentDrawer.tsx`: persistent multi-thread tutor UX.
- `src/client/styles/auth.css`, `src/client/styles/agent.css`, `src/client/styles/layout.css`: responsive visuals.

### Task 1: Auth primitives and schema

**Files:**
- Create: `src/server/modules/auth/password.ts`
- Create: `src/server/modules/auth/rate-limit.ts`
- Modify: `src/server/db/migrate.ts`
- Test: `tests/server/auth-password.test.ts`
- Test: `tests/server/database.test.ts`

- [ ] Write failing tests proving `hashSecret()` creates different encoded hashes for same input, `verifySecret()` accepts correct input/rejects wrong input, and DB creates `users`, `auth_sessions`, `password_recovery_codes`, `auth_rate_limits`, `learner_context_cache`, `agent_response_cache`.
- [ ] Run `npm test -- tests/server/auth-password.test.ts tests/server/database.test.ts`; expect missing module/tables.
- [ ] Implement versioned `scrypt$v1$N$r$p$salt$hash` encoding with `randomBytes`, `scrypt`, and `timingSafeEqual`; validate encoded parameters before allocation.
- [ ] Add auth/cache tables and indexes. Extend agent tables with ownership/lifecycle/cache metadata using idempotent column migration helpers based on `PRAGMA table_info`.
- [ ] Run targeted tests; expect pass.
- [ ] Commit `feat(auth): add credential and session schema`.

### Task 2: Auth service and routes

**Files:**
- Create: `src/server/modules/auth/service.ts`
- Create: `src/server/modules/auth/middleware.ts`
- Create: `src/server/modules/auth/routes.ts`
- Create: `src/server/authenticated-request.ts`
- Modify: `src/server/app.ts`
- Modify: `src/server/config.ts`
- Test: `tests/server/auth-api.test.ts`

- [ ] Write failing Supertest cases for register, one-time recovery code, `GET /api/auth/me`, logout, login, wrong-password generic error, recovery reset, session revocation, duplicate username, cookie flags, and rate limit.
- [ ] Run `npm test -- tests/server/auth-api.test.ts`; expect 404/missing behavior.
- [ ] Implement `AuthService` transactions. Normalize usernames with trim + Unicode NFKC + lower-case. Generate 32-byte session token and grouped high-entropy recovery code; store hashes only.
- [ ] Implement cookie parser without extra dependency, `optionalAuth`, `requireAuth`, and same-origin guard. Set `HttpOnly`, `SameSite=Lax`, path `/`, `Secure` from config.
- [ ] Mount public auth routes before protected APIs. Keep `/api/health` public. Protect all remaining application APIs.
- [ ] Run auth tests and existing server tests; fix only auth integration regressions.
- [ ] Commit `feat(auth): add account sessions and recovery`.

### Task 3: User ownership migration and repository boundaries

**Files:**
- Modify: `src/server/db/migrate.ts`
- Modify: `src/server/db/seed.ts`
- Modify: `src/server/modules/content/repository.ts`
- Modify: `src/server/modules/learning/repository.ts`
- Modify: `src/server/modules/speaking/repository.ts`
- Modify: `src/server/modules/documents/repository.ts`
- Modify: `src/server/modules/backup/service.ts`
- Modify: `src/server/routes/*.ts`
- Modify: `src/server/modules/*/routes.ts`
- Test: `tests/server/user-isolation.test.ts`
- Test: `tests/server/legacy-claim.test.ts`

- [ ] Write failing tests creating two users and proving guessed IDs cannot cross-read/update/delete mindmaps, sessions, speaking records, documents, settings, generation jobs, agent threads, or backups.
- [ ] Write failing legacy test: first registered account claims unowned rows only when zero users existed; second account receives clean starter state.
- [ ] Run targeted tests; expect unscoped access failures.
- [ ] Add `user_id` ownership to personal tables and explicit shared-vs-personal classification. Pass `userId` into constructors or methods consistently; every SQL mutation and lookup includes ownership predicate.
- [ ] Update route handlers to use `request.auth.userId`; never accept body/query user IDs.
- [ ] Increment `users.profile_revision` in same transaction for tutor-relevant mutations.
- [ ] Run all server tests; update fixtures to register/authenticate test user instead of bypassing ownership.
- [ ] Commit `feat(data): isolate learning records by user`.

### Task 4: Client authentication gate and account UX

**Files:**
- Create: `src/client/auth/auth-context.tsx`
- Create: `src/client/pages/AuthPage.tsx`
- Create: `src/client/components/RecoveryCodePanel.tsx`
- Create: `src/client/components/AccountMenu.tsx`
- Create: `src/client/styles/auth.css`
- Modify: `src/client/api/client.ts`
- Modify: `src/client/main.tsx`
- Modify: `src/client/App.tsx`
- Modify: `src/client/components/AppShell.tsx`
- Modify: `src/client/styles/layout.css`
- Test: `tests/client/auth-flow.test.tsx`

- [ ] Write failing UI tests for bootstrap loading, login, register validation, recovery checkpoint, recovery reset, account menu, logout, and `401` returning to auth screen.
- [ ] Run `npm test -- tests/client/auth-flow.test.tsx`; expect missing components.
- [ ] Add typed auth API methods with `credentials: "same-origin"`; make request layer publish unauthorized event after failed `/api/auth/me` exclusions.
- [ ] Implement auth context state machine: `loading | anonymous | recovery-checkpoint | authenticated`.
- [ ] Build asymmetric paper/ink auth screen and mandatory recovery-code copy/download confirmation.
- [ ] Add sidebar account footer and mobile settings account sheet.
- [ ] Run UI tests and typecheck.
- [ ] Commit `feat(ui): add account entry and controls`.

### Task 5: Dedicated tutor skill loader

**Files:**
- Create: `.hermes/skills/mindmap-english-tutor/SKILL.md`
- Create: `src/server/modules/agent/skill-loader.ts`
- Modify: `src/server/config.ts`
- Test: `tests/server/tutor-skill.test.ts`

- [ ] Write failing tests for controlled project skill loading, parsed version/name, invalid/missing fallback, and rejection of arbitrary configured paths.
- [ ] Run targeted test; expect missing loader.
- [ ] Write skill with Vietnamese teaching policy, CEFR adaptation, correction rules, evidence boundaries, pronunciation caveat, and one-next-action rule.
- [ ] Implement loader limited to resolved project `.hermes/skills/mindmap-english-tutor/SKILL.md`; cap bytes and strip frontmatter into metadata. Embed versioned fallback constant.
- [ ] Run tests.
- [ ] Commit `feat(agent): add dedicated tutor skill`.

### Task 6: Bounded learner context and revision cache

**Files:**
- Create: `src/server/modules/agent/learner-context.ts`
- Modify: `src/server/modules/learning/repository.ts`
- Modify: `src/server/modules/agent/tool-service.ts`
- Test: `tests/server/learner-context.test.ts`

- [ ] Write failing tests proving snapshot includes only current user's progress, limited weak/due words, recent errors/speaking/sentences/documents/unfinished session, no auth fields, and respects count/character budgets.
- [ ] Write failing cache tests proving same revision hits SQLite cache and changed revision rebuilds snapshot.
- [ ] Run targeted tests; expect missing builder.
- [ ] Implement parameterized bounded queries and stable JSON snapshot schema. Cache by `(user_id, profile_revision, skill_version, schema_version)`.
- [ ] Replace generic inline tutor profile with skill text plus compact snapshot.
- [ ] Run tests.
- [ ] Commit `feat(agent): build cached learner context`.

### Task 7: Persistent threads, messages, and selective response cache

**Files:**
- Create: `src/server/modules/agent/chat-repository.ts`
- Create: `src/server/modules/agent/response-cache.ts`
- Modify: `src/server/modules/agent/routes.ts`
- Modify: `src/server/modules/agent/tool-service.ts`
- Modify: `src/shared/contracts.ts`
- Test: `tests/server/agent-chat.test.ts`

- [ ] Write failing tests for create/list/open/rename/archive/delete thread, user isolation, persisted failed messages, retry, bounded history, and title derivation.
- [ ] Write failing cache classification tests: standalone vocabulary/grammar eligible; follow-up, personal progress, current activity, and retry ineligible.
- [ ] Run targeted tests; expect missing APIs.
- [ ] Implement chat repository with ownership predicates and transactional message states.
- [ ] Implement conservative deterministic classifier and cache key containing normalized question, user/profile/skill/model/policy versions.
- [ ] Replace `/api/agent/chat` with thread APIs while retaining temporary compatibility adapter for old client tests until Task 8.
- [ ] Run tests.
- [ ] Commit `feat(agent): persist tutor conversations`.

### Task 8: Persistent tutor workspace UX

**Files:**
- Rewrite: `src/client/components/AgentDrawer.tsx`
- Create: `src/client/components/AgentThreadList.tsx`
- Create: `src/client/components/AgentMessage.tsx`
- Modify: `src/client/api/client.ts`
- Modify: `src/client/styles/agent.css`
- Modify: `src/client/styles/layout.css`
- Test: `tests/client/agent-drawer.test.tsx`
- Test: `tests/client/agent-flow.test.tsx`

- [ ] Write failing UI tests for restore latest thread, **Chat mới**, reopen, rename, archive, delete confirmation, sending, retry, cache marker, skill/profile status, contextual suggestions, and mobile history mode.
- [ ] Run targeted tests; expect old single-thread UI failures.
- [ ] Add typed thread/message API methods.
- [ ] Build two-pane desktop drawer, collapsed medium layout, and full-screen mobile sheet. Keep warm notebook visual system and keyboard-accessible controls.
- [ ] Persist optimistic user message, reconcile server result, show retryable provider errors, and preserve drafts per thread.
- [ ] Remove old `api.tutor` compatibility use from client.
- [ ] Run UI tests and typecheck.
- [ ] Commit `feat(ui): add persistent tutor workspace`.

### Task 9: Backup, status, and security hardening

**Files:**
- Modify: `src/server/modules/backup/service.ts`
- Modify: `src/server/app.ts`
- Modify: `src/server/modules/agent/routes.ts`
- Modify: `docs/vi/tich-hop-9router.md`
- Test: `tests/server/backup.test.ts`
- Test: `tests/server/security.test.ts`

- [ ] Write failing tests proving default export excludes password hashes, recovery hashes, session hashes, and cached raw prompts; restore preserves user ownership.
- [ ] Add tests for cookie flags, origin rejection, oversized skill/context input, generic auth errors, and health response without secret paths.
- [ ] Run targeted tests; expect failures.
- [ ] Implement safe backup manifest and filtered logical export where needed; document full DB file backup sensitivity.
- [ ] Extend health payload with non-sensitive `skillLoaded`, `skillDegraded`, and cache readiness.
- [ ] Update Vietnamese deployment docs for HTTPS, cookie security, data directory permissions, and recovery-code behavior.
- [ ] Run tests.
- [ ] Commit `fix(security): harden account and tutor data` with body explaining migration/security implications.

### Task 10: Full verification and migration audit

**Files:**
- Modify: `tests/e2e/app.spec.ts`
- Modify: `tests/e2e/global-setup.ts`
- Modify: `tests/e2e/global-teardown.ts`
- Modify: `README.md`

- [ ] Add E2E account helpers and two-user isolation scenario.
- [ ] Add desktop and mobile flows: register, save recovery code, learn, open new tutor thread, reload/reopen history, logout/login, verify isolation.
- [ ] Run `npm test`; expect all unit/integration tests pass.
- [ ] Run `npm run typecheck`; expect zero errors.
- [ ] Run `npm run build`; expect Vite build success.
- [ ] Run `npm run test:e2e`; expect all supported projects pass.
- [ ] Run `npm audit`; expect zero known vulnerabilities or document unrelated upstream result.
- [ ] Inspect fresh DB and migrated legacy DB manually with test scripts; confirm ownership and no plaintext secrets.
- [ ] Update README setup/login/recovery/VPS notes.
- [ ] Commit `docs: document accounts and tutor history`.

## Completion Evidence

- Auth API tests prove registration, sessions, recovery, revocation, and rate limiting.
- Isolation suite proves every personal domain rejects cross-user IDs.
- Agent tests prove skill loading, bounded context, cache invalidation, thread persistence, and selective response caching.
- Client tests prove account gate and full chat lifecycle.
- E2E proves two-account isolation across reloads and responsive layouts.
- Full test, typecheck, build, E2E, and audit outputs are recorded before completion claim.

## Verified Completion ? 2026-07-14

- [x] Account credentials, opaque sessions, one-time recovery code, revocation, username/IP rate limits.
- [x] Shared SQLite with strict user ownership for settings, learning, documents, speaking, mindmaps, generation, backups, and tutor chat.
- [x] Dedicated `.hermes/skills/mindmap-english-tutor/SKILL.md`, bounded learner context, profile-revision invalidation, selective response cache.
- [x] Persistent tutor threads with create, reopen, rename, archive, restore, delete confirmation, failed-message reload, and retry.
- [x] Backup archives redact password/session/recovery/cache secrets; restore preserves live credentials.
- [x] Local-first defaults and explicit VPS remote-binding/secure-cookie opt-in documented.
- [x] Unit/integration: `31` files, `98` tests passed.
- [x] Focused migration/security audit: `4` files, `16` tests passed.
- [x] Typecheck passed: `tsc --noEmit`.
- [x] Production build passed: Vite `1965` modules transformed.
- [x] E2E passed: `7` passed, `3` intentional project skips, including two-account tutor-thread isolation.
- [x] Dependency audit passed: `0 vulnerabilities`.
