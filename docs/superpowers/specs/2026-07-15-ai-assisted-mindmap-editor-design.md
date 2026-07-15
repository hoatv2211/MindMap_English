# AI-Assisted Mindmap Editor Design

**Date:** 2026-07-15  
**Status:** Proposed for implementation  
**Scope:** Edit and extend mindmaps with reviewed AI assistance

## Goal

Let a signed-in learner edit a personal mindmap, add vocabulary with AI-generated learning details, and safely customize a seed mindmap without changing shared seed data.

Success means a learner can open `Work and Study Essentials`, press **Chỉnh sửa**, receive a personal copy, select or add a node, review AI output, save changes, and reopen the same result later from SQLite.

## Product Decisions

- Use a resizable right-side editor panel on desktop.
- Use a full-height bottom sheet on narrow screens.
- Treat every seed mindmap as immutable shared content.
- Create a personal copy when editing a seed mindmap.
- Generate AI content automatically after the learner enters a new word or phrase.
- Never persist AI-generated vocabulary until the learner explicitly approves it.
- Reuse the existing Vocabulary Inbox enrichment, retry, approval, vocabulary, example, mindmap placement, and SRS pipeline.
- Preserve current warm paper canvas, branch colors, typography, and dark primary actions.

## User Flow

### Enter edit mode

1. Learner opens a mindmap and presses **Chỉnh sửa**.
2. For a personal mindmap, the page enters edit mode immediately.
3. For a seed mindmap, the server creates a personal copy in one transaction.
4. The client replaces the current map ID with the new personal map ID and enters edit mode.
5. Repeated edit requests for the same seed map reuse the learner's existing personal copy instead of creating duplicates.

### Edit an existing node

1. Learner selects a branch or vocabulary node.
2. The right panel opens with fields appropriate to that node type.
3. Changes remain local and visibly marked as unsaved.
4. **Lưu thay đổi** validates and persists the node.
5. **Hoàn tác** restores the last server-backed value.

### Add vocabulary with AI

1. Learner selects a branch and presses **+ Thêm từ**.
2. Learner enters a word, phrase, or sentence and optional personal context.
3. AI enrichment starts automatically after explicit submit, not on every keystroke.
4. The panel shows a loading skeleton while keeping the mindmap usable.
5. AI returns a draft containing display term, normalized term, Vietnamese meaning, IPA, part of speech, CEFR, item type, and exactly three bilingual examples.
6. Learner edits any generated field.
7. **Duyệt & thêm** atomically creates or reuses vocabulary, saves examples, attaches the vocabulary node to the selected branch, and creates learner review state.
8. The new node appears selected on the canvas.

### AI failure

- Keep the entered word and context.
- Show a concise inline error in the panel.
- Offer **Thử lại** and **Nhập thủ công**.
- Do not create vocabulary, examples, nodes, or review cards before approval.

## Desktop Layout

- Keep the existing toolbar and full canvas as the primary surface.
- When edit mode starts, open a right panel with a default width of 400 px.
- Allow resizing from 360 px to 520 px with a visible drag handle.
- Refit the React Flow viewport when the panel opens, closes, or finishes resizing.
- Allow panel collapse without leaving edit mode.
- Keep zoom controls and minimap clear of the panel and floating action dock.
- Change toolbar action from **Chỉnh sửa** to a clear active state containing **Đang chỉnh sửa** and **Xong**.

## Mobile Layout

- Open editing as a bottom sheet above bottom navigation.
- Use compact peek height for selected-node summary and full height for forms.
- Keep a persistent close control and safe-area padding.
- Do not support free dragging of the editor because it conflicts with canvas pan and page scroll.
- Preserve at least one visible canvas area while the sheet is collapsed.

## Panel States

### No selection

- Explain: “Chọn một node để sửa, hoặc chọn nhánh để thêm từ.”
- Provide a small node-type legend.
- Disable destructive actions.

### Branch selected

- Editable fields: branch name, short Vietnamese description, branch color.
- Primary action: **+ Thêm từ**.
- Secondary actions: duplicate branch, delete branch.
- Deleting a non-empty branch requires confirmation and explains child impact.

### Vocabulary selected

- Editable fields: term, Vietnamese meaning, IPA, part of speech, CEFR, three examples.
- Utility actions: play pronunciation, ask tutor, move to another branch, duplicate, delete.
- Editing shared seed-derived vocabulary triggers learner-owned copy-on-write; duplicate detection appears before save and never silently merges records.

### New vocabulary draft

- Step 1: term and optional context.
- Step 2: AI loading state.
- Step 3: editable enriched draft.
- Final action: **Duyệt & thêm**.
- Canceling discards the unapproved draft after confirmation when generated content exists.

## Visual Direction

Reading: focused learning workspace for individual learners, using a calm editorial tool language rather than a dashboard aesthetic.

- Design variance: 5/10.
- Motion intensity: 3/10.
- Visual density: 5/10.
- Panel background uses the existing warm neutral surface with a stronger left divider.
- Dark buttons remain reserved for primary commit actions.
- Coral marks creation and AI draft states, not every AI-related control.
- Branch colors continue to communicate hierarchy.
- Avoid gradients, glass effects, oversized cards, and decorative AI sparkle fields.
- Use 160–220 ms transitions and honor `prefers-reduced-motion`.
- All controls need visible focus, keyboard labels, and at least 44 px mobile targets.

## Data Model

Add source lineage to personal copies:

- `mindmaps.copied_from_mindmap_id`: nullable foreign key to the seed mindmap.
- Unique partial index on `(user_id, copied_from_mindmap_id)` for active personal copies.

Copy operation duplicates:

- Mindmap title, description, topic, and approved status.
- Every node with preserved parent relationships, vocabulary references, colors, positions, and sort order.

Copy operation does not duplicate global vocabulary records or examples. Personal node edits remain attached to the personal mindmap only.

Existing Vocabulary Inbox tables remain the source of truth for pending AI drafts. A new draft uses:

- `source_type = "mindmap"`
- `source_reference = "map:<personalMapId>"`
- `hint_mindmap_id = <personalMapId>`
- `hint_parent_node_id = <selectedBranchId>`

## Server API

### Personal copy

`POST /api/mindmaps/:id/personal-copy`

- Requires authentication.
- Returns existing personal copy when one already exists.
- Rejects copying another user's private mindmap.
- Runs map and node copy in one transaction.

### Node editing

Extend current node update support for editable fields required by branch and vocabulary forms. Validate ownership for all writes. Seed maps remain unwritable through update endpoints.

Add focused endpoints only where current repository behavior cannot express the action cleanly:

- `POST /api/mindmaps/:id/nodes/branch`
- `POST /api/mindmaps/:id/nodes/:nodeId/duplicate`
- `POST /api/mindmaps/:id/nodes/:nodeId/move`
- `DELETE /api/mindmaps/:id/nodes/:nodeId`

Vocabulary creation continues through Vocabulary Inbox capture and approval APIs rather than a second enrichment path.

## Client Components

- `MindmapPage`: owns edit mode, personal-copy transition, selected node, dirty state, and refresh.
- `MindmapCanvas`: emits node selection and supports fit-view when editor geometry changes.
- `MindmapEditorPanel`: responsive shell, resize/collapse behavior, navigation guard.
- `BranchEditor`: branch fields and branch actions.
- `VocabularyEditor`: existing vocabulary fields and actions.
- `AiVocabularyDraftEditor`: capture, enrichment status, editable AI draft, retry, manual fallback, approval.

Keep API calls in the existing client API module and shared validation in contracts. Avoid placing server-specific payload shaping inside visual components.

## State and Persistence

- Server remains authoritative after each successful save.
- Existing node edits use explicit save, not per-keystroke persistence.
- Node position dragging may keep current immediate persistence behavior.
- Unsaved form state belongs to the editor panel and resets only after save, undo, confirmed selection change, or confirmed close.
- After copy creation, update global selected mindmap ID so refresh and navigation reopen the personal map.
- AI drafts survive panel close and page reload through Vocabulary Inbox persistence until approved, dismissed, or explicitly discarded.

## Error and Safety Rules

- Never write to a seed mindmap.
- Never trust client-provided user IDs or ownership.
- Never persist partial map copies.
- Never approve an AI draft without schema validation.
- Confirm deletion of branches with children and vocabulary nodes with learner examples.
- Detect stale updates using the latest server result; initial implementation may reject conflicts and request reload rather than merge silently.
- Preserve user-entered form values after recoverable API or AI errors.

## Accessibility and Keyboard

- `Enter` selects a focused node; `Escape` closes or collapses the active editor state after dirty-state handling.
- `Ctrl+S` saves the active existing-node form.
- Panel resize handle supports arrow-key resizing and exposes separator semantics.
- Loading and save results use polite live regions.
- Error messages connect to their fields with `aria-describedby`.
- Canvas selection must have an equivalent list-mode path for keyboard-only users.

## Testing

### Server

- Seed copy is transactional and preserves node hierarchy.
- Repeated copy requests are idempotent per user and seed map.
- Users cannot read or mutate another user's personal copy.
- Seed update, delete, duplicate, and move requests fail safely.
- Branch CRUD preserves ownership and child rules.
- Editing seed-derived vocabulary creates a learner-owned copy and leaves all original references unchanged.
- Vocabulary Inbox approval attaches a vocabulary node to the selected personal branch.

### Client

- Edit button copies seed map and opens editor.
- Personal map enters edit mode without copying.
- Selecting branch and vocabulary nodes shows correct forms.
- Dirty-state guard prevents accidental loss.
- AI loading, success, failure, retry, manual fallback, and approval states work.
- Approved vocabulary appears on the canvas and remains after reload.
- Resizable panel does not cover essential controls.
- Mobile bottom sheet stays above navigation and floating actions.

### End-to-end

1. Sign in.
2. Open `Work and Study Essentials`.
3. Edit seed map and verify personal copy.
4. Select `communication`.
5. Add a new term with AI enrichment.
6. Edit one generated example and approve.
7. Reload and verify the personalized map and vocabulary remain.

## Out of Scope

- Collaborative multi-user editing.
- Freeform AI chat embedded inside the editor panel.
- Automatic saving of unapproved AI output.
- Full map version history.
- Arbitrary drag-and-drop restructuring across multiple mindmaps.
- Editing shared seed vocabulary globally.

## Delivery Slices

1. Personal-copy schema, repository, API, and ownership tests.
2. Edit mode, node selection, responsive panel shell, and dirty-state guard.
3. Branch and existing vocabulary editing actions.
4. Vocabulary Inbox integration inside the editor panel.
5. Responsive polish, accessibility, and end-to-end coverage.

## Acceptance Criteria

- Editing a seed map always occurs on one stable personal copy owned by the signed-in learner.
- Learner can edit existing branch and vocabulary information from the right panel.
- Learner can add a word under a selected branch with automatic AI enrichment.
- No AI-generated vocabulary enters permanent learning data before explicit approval.
- Saved edits and approved additions survive logout, login, restart, and reload through SQLite.
- Desktop panel is resizable and collapsible without covering essential mindmap controls.
- Mobile editor remains usable above navigation and safe areas.
- Existing quick capture, AI chat, Vocabulary Inbox, list mode, focus mode, and pronunciation remain functional.