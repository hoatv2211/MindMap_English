# Web Speech Pronunciation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay TTS server bằng Web Speech API cho các nút nghe trong client.

**Architecture:** Một helper browser-only chịu trách nhiệm tạo utterance và chọn voice. Các page/component chỉ gọi helper và xử lý lỗi theo UI hiện có.

**Tech Stack:** React 19, TypeScript, Web Speech API, Vitest, Testing Library.

---

### Task 1: Speech helper

**Files:**
- Create: `src/client/lib/speech.ts`
- Create: `tests/client/speech.test.ts`

- [ ] Viết test cancel, speak, lang, rate và unsupported.
- [ ] Chạy test để xác nhận fail do thiếu module.
- [ ] Implement `speakEnglish` tối thiểu.
- [ ] Chạy test để xác nhận pass.

### Task 2: Client integration

**Files:**
- Modify: `src/client/pages/MindmapPage.tsx`
- Modify: `src/client/pages/LearningPage.tsx`
- Modify: `src/client/components/SpeakButton.tsx`

- [ ] Thay `api.synthesize` bằng `speakEnglish`.
- [ ] Giữ xử lý lỗi hiện có.
- [ ] Chạy typecheck và component tests.

### Task 3: Verification

- [ ] Chạy `npm.cmd run typecheck`.
- [ ] Chạy `npm.cmd test`.
- [ ] Chạy `npm.cmd run build`.