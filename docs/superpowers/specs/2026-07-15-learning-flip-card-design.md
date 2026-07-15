# Learning Flip Card and Language-Aware Hints Design

**Date:** 2026-07-15  
**Status:** Proposed for implementation  
**Scope:** Prevent answer leakage during review and match hints to the expected answer language

## Goal

Make review prompts test memory instead of displaying the answer beside the question. Replace the left lesson summary with a flip card whose front depends on activity type, and generate hints in the same language the learner must enter.

Success means the learner cannot see both English term and Vietnamese meaning before answering, can intentionally flip the card when needed, and receives a useful hint without revealing content from the wrong language.

## Product Decisions

- Use activity-aware prompts rather than one fixed card face.
- Hide answer content until an explicit flip or answer reveal.
- Keep progress and memory status visible outside answer content.
- Treat flipping as a reveal action and record it as one hint for SRS attempt data.
- Match hint language to expected answer language.
- Preserve existing warm paper visual system and restrained motion.

## Activity Matrix

| Activity | Expected answer | Left card front | Right prompt | Hint language |
| --- | --- | --- | --- | --- |
| `meaning-recall` | English | Vietnamese meaning | “Từ tiếng Anh phù hợp là gì?” | English |
| `context` | Vietnamese explanation or Vietnamese sentence | English context with target term emphasized or blanked | “Giải thích nghĩa hoặc đặt câu bằng tiếng Việt.” | Vietnamese |
| General recall | Vietnamese | English term, IPA hidden initially | “Bạn nhớ nghĩa tiếng Việt của từ này không?” | Vietnamese |
| `speak` | Spoken English | English example or term | Existing speaking instruction | English pronunciation cue |

The server activity type remains authoritative. Client presentation maps each known activity to one matrix row. Unknown activity types fall back to general recall without exposing `meaningVi`.

## Left Flip Card

### Front

- Show topic label, prompt-side content, item number, total item count, and memory status.
- Never show English term and Vietnamese meaning together.
- Do not show IPA when English is the expected typed answer.
- Display a secondary **Lật thẻ** action with a clear card icon.
- Keep progress count readable but visually subordinate to the learning prompt.

### Back

- Show English term, IPA, Vietnamese meaning, and one example pair.
- Include pronunciation action for English content.
- Label the state **Đã xem đáp án** so the learner understands that recall assistance was used.
- Offer **Lật lại** without reducing the recorded hint count.

### Reveal behavior

- Click, keyboard `Enter`, or `Space` flips the focused card.
- First flip increments `hintsUsed` by one; repeated flips do not increment it again.
- Answer submission can still occur after a flip.
- Right-side **Kiểm tra** reveals the answer using the existing answer-reveal flow and does not animate the left card unexpectedly.
- New learning item resets card to front and clears flip state.

## Language-Aware Hints

### English answer expected

Use progressive English cues:

1. Part of speech or item type when available.
2. First letter plus concealed character count, for example `r•••`.
3. Larger prefix only after another hint request.

Do not display Vietnamese text as the hint because Vietnamese is already the prompt.

### Vietnamese answer expected

Use progressive Vietnamese cues derived from `meaningVi`:

1. Meaning category or first Vietnamese word with remaining characters concealed.
2. Larger Vietnamese phrase prefix after another hint request.
3. A short Vietnamese usage cue when available.

Do not reveal the full Vietnamese meaning before answer checking. Preserve Vietnamese diacritics in every hint.

### Context answer expected

- Prompt explicitly says Vietnamese is expected.
- First hint gives a Vietnamese direction such as the semantic category or intended usage.
- Later hint reveals a partial Vietnamese meaning, never the full English answer pair.

### Speaking answer expected

- Hint remains English-oriented: syllable/word segmentation, IPA, or slow pronunciation.
- Vietnamese meaning stays hidden until reveal.

## Right Quiz Card

- Keep the quiz card as the main interaction surface.
- Remove duplicated answer content from its pre-answer state.
- Input placeholder must state expected language:
  - English: `Nhập từ hoặc cụm từ tiếng Anh...`
  - Vietnamese: `Nhập nghĩa hoặc câu tiếng Việt...`
  - Speaking: no text placeholder; use the speaking control.
- Change hint copy from generic **Gợi ý** to a contextual label where space allows: **Gợi ý tiếng Anh** or **Gợi ý tiếng Việt**.
- After checking, show answer, bilingual example, and SRS grading controls as today.

## Visual Direction

Reading: focused individual study screen with an editorial flashcard feel, not a gamified dashboard.

- Design variance: 5/10.
- Motion intensity: 4/10.
- Visual density: 4/10.
- Use subtle physical depth: one border, restrained shadow, and a visible front/back distinction.
- Use a 220–280 ms flip transition with natural easing.
- Avoid glossy 3D effects, gradients, confetti, and exaggerated perspective.
- Honor `prefers-reduced-motion` by replacing rotation with an instant crossfade.
- Maintain card height during flipping to avoid layout shift.
- Keep coral for primary checking; use neutral controls for flipping and hints.

## Component Changes

- `LearningPage`: stops rendering `term` and `meaningVi` together; passes item and flip state into a new card component.
- `LearningPromptCard`: renders activity-aware front/back content and reports first reveal.
- `QuizCard`: uses a shared prompt model for expected language, placeholder, hint label, and hint generation.
- `learning-prompt.ts`: pure helper that maps a learning item into prompt content, expected language, concealed answer, and progressive hints.

Use one shared prompt model so the left card and right quiz cannot disagree about what the learner must answer.

## State and Attempt Recording

- Maintain `flipped`, `flipCounted`, and explicit hint level per current item.
- Reset all three when `item.id` changes.
- Combine first-card-flip hint usage and explicit hint button usage without double counting.
- Submit final `hintsUsed` through the existing attempt API.
- Keep correctness behavior compatible with current activity types; this change does not redesign SRS scheduling.

## Accessibility

- Flip control exposes `aria-pressed` or equivalent expanded state.
- Front and back use one accessible card region; hidden face is removed from the accessibility tree.
- Announce **Đã mở đáp án** through a polite live region.
- Keyboard focus remains on the flip control after state changes.
- Reduced-motion mode avoids 3D transforms.
- Hint text states its language, not color alone.

## Testing

### Prompt helper

- Every known activity maps to one expected language.
- Unknown activity falls back without showing Vietnamese meaning beside English term.
- English hints reveal English characters only.
- Vietnamese hints preserve Vietnamese characters and diacritics.
- Progressive hints never reveal the complete answer before the configured final step.

### Client

- Pre-answer screen never renders both `term` and `meaningVi` visibly for the same item.
- Meaning recall shows Vietnamese on the left and expects English input.
- General recall shows English on the left and expects Vietnamese input.
- First flip counts one hint; repeated flips do not add more.
- Explicit hints use the expected answer language.
- Item change resets the card to its front.
- Reduced-motion mode remains usable.

### End-to-end

1. Start a mixed review session.
2. Confirm first card does not leak its answer.
3. Request a Vietnamese hint for a Vietnamese-answer prompt.
4. Flip the card and verify answer content appears.
5. Grade the item and verify the next card resets.
6. Reach an English-answer prompt and verify the hint switches to English.

## Out of Scope

- New SRS grading algorithms.
- AI-generated hints during each review interaction.
- User-authored flashcard templates.
- Card swipe gestures.
- Images or mnemonic generation on the card.

## Acceptance Criteria

- No pre-answer layout displays English term and Vietnamese meaning together.
- Card front changes according to activity type.
- Learner controls when answer content is revealed.
- First flip contributes exactly one to `hintsUsed`.
- Hints match the expected input language.
- Vietnamese prompts and hints preserve correct diacritics.
- Existing answer checking, pronunciation, grading, session completion, and attempt persistence remain functional.