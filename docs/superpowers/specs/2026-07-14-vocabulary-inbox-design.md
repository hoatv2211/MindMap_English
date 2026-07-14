# Vocabulary Inbox Design

**Date:** 2026-07-14
**Status:** Ready for implementation planning
**Scope:** Account-owned vocabulary capture, AI enrichment, mindmap placement, and SRS admission.

## Goal

Let each learner capture a new word, phrase, or useful sentence from anywhere in the app. AI prepares an editable draft with practical learning data and proposes where it belongs. Nothing enters the durable vocabulary library, mindmaps, or review queue until the learner approves it.

## Product Principles

- Capture takes seconds; review can happen later.
- AI proposes; learner approves.
- One canonical inbox receives entries from every surface.
- Existing vocabulary remains canonical and duplicate-free.
- Every approved item becomes reviewable immediately.
- Examples teach usage, not dictionary trivia.
- All records remain strictly scoped to the authenticated account.

## Entry Points

### Global Quick Capture

A persistent **Ghi nhanh** control appears in the app header. Keyboard shortcut `N` opens a compact drawer unless focus is inside an editable field.

Fields:

- Required raw input: word, phrase, or sentence.
- Optional context: where the learner saw it or what they want to express.
- Optional target mindmap when capture begins from a known learning context.

Submitting creates an inbox item immediately and starts AI enrichment. The drawer confirms capture without blocking navigation.

### AI Tutor Chat

Tutor chat gains an explicit save tool. Natural requests such as ?l?u t? negotiate? or ?ghi l?i c?m n?y? create the same inbox item used by quick capture. Chat reports the created draft and offers an action to open it. Chat never bypasses approval.

### Mindmap

Each editable learner-owned mindmap branch exposes **Th?m t?**. Capture carries `mindmapId` and `parentNodeId` as placement hints. AI may keep that placement or warn when another branch fits better. Seed mindmaps remain immutable.

## Core Workflow

1. Learner submits raw text.
2. Server creates account-owned inbox item with status `queued`.
3. AI enrichment changes status to `processing`.
4. AI returns structured draft; status becomes `ready`.
5. Learner reviews and may edit every proposed field.
6. Learner selects an existing map/branch or accepts a proposed new map draft.
7. Approval transaction creates or reuses canonical vocabulary, saves examples, places mindmap node, creates per-user SRS state `new`, then marks inbox item `approved`.
8. Failed enrichment remains retryable. Learner may also complete fields manually.

## Data Model

### `vocabulary_inbox_items`

- `id`
- `user_id`
- `raw_text`
- `context_text`
- `source_type`: `quick_capture | agent_chat | mindmap`
- `source_reference`: nullable thread/message/map reference
- `hint_mindmap_id`: nullable
- `hint_parent_node_id`: nullable
- `status`: `queued | processing | ready | failed | approved | dismissed`
- `error_message`: nullable, sanitized provider failure
- `created_at`, `updated_at`, `approved_at`

All reads and mutations require `user_id`. Source references must also belong to that user.

### `vocabulary_inbox_drafts`

One current draft per inbox item:

- `inbox_item_id`
- `normalized_term`
- `display_term`
- `meaning_vi`
- `ipa`
- `part_of_speech`
- `cefr`
- `item_type`: `word | phrase | sentence`
- `examples_json`
- `placement_json`
- `model`, `prompt_version`, `skill_version`
- `created_at`, `updated_at`

Draft JSON is validated with Zod before storage. User edits update the validated draft, not canonical learning tables.

### Approved Data

Approval reuses existing tables:

- `vocabulary` for canonical term data.
- `user_vocabulary_examples` for account-owned approved examples. Seed examples remain in `examples`.
- `mindmap_nodes` for placement.
- `user_vocabulary_state` for account-specific SRS state.

An approval link records resulting `vocabulary_id` on the inbox item for traceability.

### `user_vocabulary_examples`

- `id`
- `user_id`
- `vocabulary_id`
- `sentence`
- `translation_vi`
- `example_role`: `basic | daily_life | personalized | learner`
- `usage_note`: nullable
- `fingerprint`
- `source_inbox_item_id`: nullable
- `created_at`, `updated_at`

Unique constraint on `(user_id, fingerprint)` prevents duplicates without exposing personal examples across accounts. Learning queries merge seed `examples` with the current user account examples.

## AI Enrichment Contract

AI returns strict JSON:

- normalized and display term
- concise Vietnamese meaning
- IPA
- part of speech
- CEFR level
- item type
- exactly three examples
- placement suggestions

Example roles:

1. **Basic:** short, literal, easy grammar.
2. **Daily life:** natural practical use.
3. **Personalized:** uses bounded learner context when useful.

Each example includes English text, Vietnamese translation, role, and optional usage note. Examples must be distinct, short, culturally neutral, and suitable for the learner level.

Placement contract:

- Rank matching learner-owned mindmaps and branches.
- Explain the best match in one short Vietnamese sentence.
- If confidence is low, propose a new mindmap draft with title, description, and branch name.
- Never modify or create a map before approval.

The dedicated tutor skill gains a vocabulary-capture section. Prompt includes only bounded learner context, candidate map titles/branches, and the submitted text.

## Duplicate Handling

Before enrichment, server checks normalized text against canonical vocabulary and pending inbox items for that user.

- Existing pending item: return existing inbox item.
- Existing canonical term: create a review draft marked `existing`.
- Approval of an existing term adds missing examples and optional mindmap placement; it does not create duplicate vocabulary.
- Identical examples are rejected using normalized fingerprints.

Global canonical vocabulary may be shared internally. Personalized examples live in `user_vocabulary_examples`; placements, inbox records, and SRS state remain account-owned. No personalized example is written to the shared `examples` table.

## Review UX

### Inbox Page

Add **T? m?i** to primary navigation or Library actions. Page uses an editorial queue, not a dense admin table.

Tabs:

- **Ch? duy?t**
- **?ang x? l?**
- **?? l?u**
- **B? qua**

Each card shows source, term, short meaning, processing state, and proposed destination. Batch approval is excluded from first version because every AI result needs conscious review.

### Review Sheet

Desktop uses a wide side sheet; mobile uses a full-screen page.

Sections:

1. Original note and source.
2. Term details.
3. Three example cards.
4. Mindmap destination.
5. Review admission summary.

Primary action: **Duy?t v? ??a v?o ?n t?p**.
Secondary actions: **L?u ch?nh s?a**, **Th? AI l?i**, **B? qua**.

The interface uses current warm notebook visual language. Avoid generic dashboard cards, purple AI gradients, heavy glass, and decorative motion. Use restrained status color, clear hierarchy, and visible AI-versus-user-edited labels.

Design dials: variance 5, motion 3, density 4.

## API Surface

- `POST /api/vocabulary-inbox` ? capture raw item.
- `GET /api/vocabulary-inbox?status=...` ? list account items.
- `GET /api/vocabulary-inbox/:id` ? load item and draft.
- `PATCH /api/vocabulary-inbox/:id/draft` ? save learner edits.
- `POST /api/vocabulary-inbox/:id/enrich` ? initial enrichment or retry.
- `POST /api/vocabulary-inbox/:id/approve` ? transactional approval.
- `POST /api/vocabulary-inbox/:id/dismiss` ? dismiss item.

Agent tool `save_vocabulary_note` calls capture service, not HTTP. Routes and tool always pass authenticated `userId`.

## Approval Transaction

Approval must be atomic:

1. Verify inbox ownership and `ready` state.
2. Validate final edited draft and destination ownership.
3. Find or create canonical vocabulary.
4. Upsert account vocabulary state as `new` without resetting existing progress.
5. Insert only missing account-owned examples into `user_vocabulary_examples`.
6. Add node to selected learner-owned map, or create learner-owned mindmap draft and branch.
7. Mark inbox item approved and store `vocabulary_id`.
8. Let existing profile-revision triggers invalidate learner context/cache.

Any failure rolls back all mutations.

## Review Behavior

Approved new vocabulary enters the next generated learning session as `new`. Approval never resets a term already in `learning`, `weak`, or `stable`. The dashboard shows a small count of newly approved terms available for review.

## Failure and Offline States

- AI unavailable: item remains saved; user can retry or fill manually.
- Invalid AI JSON: mark failed with generic message; retain raw provider details only in safe server logs.
- Deleted destination map: require destination reselection at approval.
- Cross-account source or destination ID: return 404.
- Network loss after capture: UI reconciles from server list on reload.
- Duplicate approval request: idempotently return prior approved result.

## Security and Privacy

- Every inbox, draft, destination, and result query includes `user_id`.
- AI receives only submitted text, optional context, bounded learner profile, and minimum map metadata.
- Backup export includes learner notes but excludes response caches and auth secrets under existing policy.
- Raw note text is treated as private learner data.
- Rate limits cover enrichment and retry separately from chat.
- Input lengths are bounded before DB or AI calls.

## Testing

### Server

- Schema migration and legacy DB compatibility.
- Capture from all three sources.
- Two-user isolation for list, read, edit, enrich, approve, and destination IDs.
- AI schema validation and failed retry.
- Existing-term and pending-item duplicate behavior.
- Atomic approval and idempotency.
- Three examples with distinct roles and fingerprints.
- Existing SRS progress never resets.
- Profile revision increments after approval.

### Client

- Quick capture and keyboard shortcut.
- Processing, ready, failed, empty, and dismissed states.
- Editing term details and examples.
- Existing map selection and new-map proposal.
- Approval confirmation and new-review count.
- AI Chat action opens created inbox item.
- Mobile review page and accessible keyboard flow.

### E2E

- Account A captures, AI enriches, approves, reloads, and sees term in review.
- Account B cannot see item, map node, examples, or SRS state.
- Duplicate capture adds examples without duplicate vocabulary.
- Provider failure persists and succeeds after retry.

## Out of Scope

- Automatic approval without learner review.
- Bulk import and batch approval.
- Browser extension or mobile share sheet.
- Image/OCR vocabulary capture.
- Public sharing of personal vocabulary notes.
- AI pronunciation scoring.

## Success Criteria

- Capture requires one short input and one submit action.
- No AI-generated term enters learning data before approval.
- Every newly approved term has three usable bilingual examples.
- Mindmap placement is explicit and reversible before approval.
- Approved new terms appear in SRS without damaging prior progress.
- Reload preserves every capture, draft, failure, and approval state.
- Cross-account access consistently returns no private data.
