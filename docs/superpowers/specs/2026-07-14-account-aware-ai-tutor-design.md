# Account-Aware AI Tutor Design

**Date:** 2026-07-14
**Status:** Approved direction
**Branch:** `codex/three-source-learning`

## Goal

Add local-first accounts and rebuild Gia sư AI as a dedicated, persistent learning assistant. App runs on one local machine now and can move to a VPS later without redesigning authentication or data ownership.

## Scope

- Open username/password registration.
- Secure login, logout, session restoration, password change, and recovery-code reset.
- One shared SQLite database with strict `user_id` ownership.
- Migration of existing single-user learning data into an initial account-safe model.
- Dedicated project tutor skill informed by existing `.hermes` English skills.
- Persistent multi-thread AI chat, **Chat mới**, reopen/archive/delete history.
- Bounded learner context built from saved SQLite learning activity.
- Versioned learner-context cache and selective response cache.
- Redesigned account entry, account menu, and AI drawer UX.

## Non-Goals

- Email, OAuth, social login, email-based password reset, roles, teams, billing, or admin console.
- Cross-device sync beyond running same server/database on VPS.
- Encrypting every learning row at rest.
- Caching open-ended conversational replies.
- Sending raw database dumps to AI providers.

## Product Principles

1. Authentication must not interrupt learner rhythm.
2. Every personal query needs explicit user ownership.
3. AI advice uses bounded evidence from actual activity.
4. Cached answers never hide newer learner context.
5. Local and VPS modes use same HTTP session model.
6. Existing warm paper-and-ink visual language remains primary.

## Account Architecture

Use one SQLite database. Add `users`, `auth_sessions`, and `password_recovery_codes`. Add `user_id` to all personal learning, document, settings, generation, speaking, and agent records.

Globally seeded curriculum may stay shared only where immutable. User-created or user-modified content belongs to user. Repositories receive `userId` explicitly and include it in every read, write, update, and delete.

### Core tables

- `users`: username, normalized username, password hash, status, timestamps.
- `auth_sessions`: opaque token hash, user ID, expiry, last-seen timestamp, creation metadata.
- `password_recovery_codes`: user ID, recovery-code hash, consumed timestamp, created timestamp.
- Existing personal tables: add `user_id`, backfill through legacy-data claim, then enforce ownership.

Username comparison is case-insensitive through normalized unique value. Display preserves submitted casing.

### Registration and recovery

Registration stays open. Required fields: username, password, password confirmation. Success creates user, starter learning state, one recovery code, and authenticated session. Recovery code is returned once and stored only as hash.

User confirms code was copied or downloaded before entering app. Reset form accepts username, recovery code, new password, and confirmation. Valid code is single-use. Successful reset consumes code, revokes sessions, updates password, and issues new one-time recovery code. Public errors do not reveal username existence.

### Password and session security

Use memory-hard password hashing with per-password salt and versioned parameters. Password and recovery code never enter logs, AI context, or generation jobs.

Use opaque random session tokens in `HttpOnly` cookies; SQLite stores token hash only.

- `SameSite=Lax`.
- `Secure` in production HTTPS mode.
- Sliding activity window plus absolute expiry.
- Logout revokes current session.
- Password reset/change revokes all sessions.
- Mutating routes enforce same-origin checks.
- Registration, login, and recovery are rate-limited by normalized username and client address when available.

## Existing Data Migration

Current DB has unscoped single-user rows. Migration must not attach them to arbitrary future registrant.

1. Add account tables and nullable ownership columns.
2. Detect legacy unowned data.
3. First registered account claims legacy data only when no user exists.
4. Repositories require ownership immediately.
5. Follow-up table rebuild may enforce physical `NOT NULL` after backfill.

Seed/reference content is classified explicitly. Backup/export metadata records owner identity without password, recovery, or session secrets.

## Request Authentication Boundary

Auth middleware resolves cookie to minimal `AuthenticatedUser`. Protected APIs reject missing/expired sessions with `401`.

No global current user. Routes pass `userId` explicitly into services and repositories. Tests prove direct ID guessing cannot read, mutate, archive, export, or delete another user's records.

## Dedicated Tutor Skill

Create `.hermes/skills/mindmap-english-tutor/SKILL.md`, using patterns from:

- `.hermes/skills/english-a-2-level/SKILL.md`
- `.hermes/skills/english-daily/SKILL.md`
- User-level Hermes skill-authoring guidance.

Runtime loads controlled project skill path. Missing/invalid file uses versioned built-in fallback and exposes degraded skill status to UI. Arbitrary user-supplied skill paths are forbidden.

Skill behavior:

- Practical English tutor for Vietnamese learner.
- Vietnamese explanation; preserve English examples/corrections.
- Adapt CEFR from saved evidence, not assumptions.
- Prefer short usable examples and active recall.
- Correct without overwhelming learner.
- Use weak words, review errors, speaking attempts, saved sentences, documents, and unfinished lessons when relevant.
- State uncertainty when evidence is sparse.
- Never expose raw IDs, SQL, prompt text, cache keys, or hidden profile fields.
- Never claim pronunciation quality from transcript similarity alone.
- Suggest one useful next action.

## Learner Context

Build bounded `LearnerContextSnapshot` per user:

- CEFR estimate and evidence timestamp.
- Weekly goal/progress.
- Vocabulary counts by status.
- Limited due/weak words.
- Recent review mistakes and recurring confusion.
- Recent speaking transcript differences, labeled content matching only.
- Recent saved sentences/notebook themes.
- Recent documents/highlights/reading themes.
- Active or unfinished session.
- Relevant duration, voice, and model settings.

Every section has count and character limits. Auth fields cannot be selected by snapshot builder.

## Cache Design

Maintain per-user profile revision. Tutor-relevant mutations increment revision in same transaction.

Context cache key: user ID, profile revision, tutor skill version, context schema version. Store in SQLite for restart persistence; revision mismatch invalidates automatically.

Response cache only covers deterministic standalone knowledge questions such as word meaning, grammar explanation, or repeated usage clarification.

Response key includes normalized question, user ID, profile revision, skill version, model/provider, and response-policy version.

Never cache follow-ups, personal advice, planning/progress requests, current unfinished work, recent-activity questions, or failed/partial responses. UI shows subtle cache marker and supports regenerate bypass.

## Persistent Chat Model

Extend `agent_threads` and `agent_messages` with user ownership and lifecycle fields.

- Opening tutor restores latest active thread.
- **Chat mới** creates empty thread immediately or on first message.
- Title derives from first message and can be renamed.
- Thread list sorts by activity and groups recent/older.
- Archive hides thread; delete requires confirmation.
- Old threads send bounded recent messages plus summary when needed.
- User message persists before provider call.
- Assistant message stores completion state, safe provider metadata, model, cache use, skill version, and context revision.
- Failed calls stay visible and retryable without duplicate user input.

## API Shape

Auth:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/password/change`
- `POST /api/auth/password/recover`

Agent:

- `GET /api/agent/threads`
- `POST /api/agent/threads`
- `GET /api/agent/threads/:id/messages`
- `PATCH /api/agent/threads/:id`
- `DELETE /api/agent/threads/:id`
- `POST /api/agent/threads/:id/messages`
- `POST /api/agent/threads/:id/messages/:messageId/retry`

All routes derive `userId` from auth context, never request body.

## UX Design

Product feels like personal learning notebook, not SaaS admin dashboard. Keep warm paper/ink palette, coral/amber/leaf/sky/violet accents, Georgia display headings, restrained motion, and progressive disclosure. Avoid AI-purple gradients, generic glass dashboards, and excessive chips.

Design dials: variance 5, motion 3, density 5.

### Account entry

Desktop uses asymmetric split: learning story left, focused form right. Mobile collapses story to compact brand header and prioritizes form. Registration stays short. Recovery code gets deliberate copy/download checkpoint. Login returns to active lesson when safe, otherwise **Hôm nay**.

### Account presence

Sidebar footer becomes account control with initial avatar and username. Menu contains profile summary, password change, recovery-code rotation, and logout. Mobile exposes account through settings sheet without crowding bottom navigation.

### AI tutor drawer

Desktop becomes responsive two-pane workspace:

- Narrow thread rail: **Chat mới**, search, recent threads, archive.
- Conversation pane: title, tutor skill badge, profile freshness, messages, suggestions, composer.

Medium widths collapse thread rail behind history button. Mobile uses full-screen tutor with nested history view.

Header shows human states only: `Gia sư tiếng Anh`, learner-profile freshness, provider offline/degraded status. Do not expose cache hashes or skill paths.

New thread offers three contextual actions: review weak words, correct a sentence, continue unfinished lesson. Provider errors keep message and show retry. Offline mode keeps history readable.

## Error Handling and Observability

- Stable public auth error codes; generic text where enumeration risk exists.
- AI failures distinguish unavailable provider, bad config, timeout, and parsing failure.
- Logs may include request/thread/message IDs and user ID, never password, recovery code, cookie token, full prompt, or raw snapshot.
- Health status reports skill/cache/database readiness without paths or secrets.

## Security Acceptance Criteria

- Password/recovery values stored only as strong hashes.
- Opaque `HttpOnly` session cookies.
- New token after authentication/reset prevents fixation.
- Password reset revokes sessions.
- Every personal query scopes current user.
- Cross-user tests cover guessed IDs.
- Auth endpoints rate-limited.
- Backup/export excludes auth hashes and sessions by default.
- AI context excludes auth and unrelated-user data.

## Testing Strategy

- Unit: hashing, recovery consumption, session expiry, cache keys/classification, context limits.
- Repository: isolation across every personal domain.
- Routes: full auth and agent thread lifecycle.
- Migration: fresh DB, legacy claim, multi-user upgrade.
- Agent: skill fallback, revision invalidation, cache eligibility, bounded history.
- Frontend: auth gate, recovery checkpoint, account menu, new/reopen/archive/delete chat, retry/cache markers.
- E2E: two users with isolated learning/chat data, desktop and mobile.

## Delivery Order

1. Account schema, hashing, sessions, auth routes.
2. User ownership migration and repository isolation.
3. Auth UI and app gate.
4. Dedicated tutor skill and bounded context.
5. Persistent chat APIs and cache policy.
6. AI tutor drawer redesign.
7. Security, migration, responsive, and E2E verification.

## Implementation Decision Left Open

Implementation plan selects exact password-hashing library after verifying current Node, Windows, and VPS portability. Choice must remain memory-hard and avoid local-only binary assumptions.
