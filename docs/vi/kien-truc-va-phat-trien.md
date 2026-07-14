# Kiến trúc và hướng dẫn phát triển

## 1. Tổng quan

Ứng dụng dùng modular monolith TypeScript:

```text
React/Vite UI
    ↓ /api
Express local API
    ├── content
    ├── learning + SRS
    ├── agent + 9Router
    ├── speech
    ├── settings
    └── backup
         ↓
       SQLite + media files
```

Backend chỉ bind `127.0.0.1` mặc định. Browser không nhận API key.

## 2. Cấu trúc nguồn

```text
src/
├── client/
│   ├── api/          # Typed fetch client
│   ├── components/   # Shell, mindmap, quiz, Agent, voice
│   ├── pages/        # Today, Library, Learning, Progress...
│   ├── state/        # App state nhỏ, không framework thừa
│   └── styles/       # Token, layout, mindmap, learning, Agent
├── server/
│   ├── db/           # Connection, migration, seed
│   ├── modules/
│   │   ├── agent/
│   │   ├── backup/
│   │   ├── content/
│   │   ├── learning/
│   │   └── speech/
│   ├── routes/
│   ├── app.ts
│   └── index.ts
└── shared/           # Zod contracts và constants
```

## 3. Nguyên tắc module

- Route chỉ parse HTTP và gọi service/repository.
- Repository sở hữu SQL.
- SRS là hàm thuần, nhận clock từ ngoài.
- Contract dùng chung qua Zod.
- AI output luôn validate trước khi lưu.
- Draft AI tách khỏi dữ liệu approved.
- Core learning không phụ thuộc trạng thái AI.

## 4. SQLite

Các nhóm bảng:

### Nội dung

- `topics`
- `mindmaps`
- `mindmap_nodes`
- `vocabulary`
- `examples`
- `collocations`
- `media`

### Học tập

- `review_cards`
- `learning_sessions`
- `session_items`
- `review_attempts`
- `speech_attempts`
- `user_progress`

### Agent và vận hành

- `agent_threads`
- `agent_messages`
- `generation_jobs`
- `draft_revisions`
- `settings`
- `backups`

`vocabulary.normalized_term` là unique. Node chỉ tham chiếu từ; lịch SRS không nhân bản theo mindmap.

## 5. Migration và seed

`src/server/db/migrate.ts` tạo schema idempotent. `seedDatabase` thêm 17 chủ đề và mindmap Eating mẫu.

Khi thay schema:

1. Tăng version trong `schema_migrations`.
2. Viết migration có thể chạy một lần.
3. Thêm test in-memory.
4. Không xóa cột/dữ liệu mà chưa có backup/migration rõ ràng.

## 6. SRS

`scheduleReview(card, grade, now)` là hàm thuần. Bốn grade thay đổi:

- Stability.
- Difficulty.
- Interval.
- Repetitions.
- Lapses.
- Due date.

Session composer ưu tiên từ yếu và đến hạn, sau đó thêm khoảng 40% từ mới. Buổi 10 phút có tối đa 8 mục; buổi 20 phút có tối đa 14 mục.

## 7. Agent tools

`AgentToolService` hiện có:

- Đọc learning profile.
- Tạo mindmap JSON có cấu trúc.
- Phát hiện từ trùng.
- Lưu dưới trạng thái draft.
- Tutor chat dựa trên tiến độ.

Không đưa chain-of-thought hoặc raw provider payload ra UI.

## 8. Backup

`BackupService` dùng snapshot SQLite, thêm media và manifest vào ZIP. Restore theo hai bước:

1. Validate và staging `mindmap-english.db.restore`.
2. Lần khởi động sau gọi `applyPendingRestore`.

Cách này tránh thay database đang mở.

## 9. Kiểm thử

```powershell
npm test
npm run test:e2e
npm run typecheck
npm run build
npm audit --audit-level=moderate
```

- Unit: Zod, SRS, session composition.
- Integration: SQLite, API, Agent, backup, speech.
- Component: dashboard, quiz, AI draft.
- E2E: dashboard, library, mindmap, learning, mobile navigation.

## 10. Quy ước code

- TypeScript strict.
- Không dùng `any` để che lỗi type.
- Hàm nhỏ, một trách nhiệm.
- SQL nằm trong repository/service phù hợp.
- Mọi mutation nhiều bảng dùng transaction.
- Error gửi ra client không chứa secret hoặc stack trace.
- UI state local trước; chỉ thêm state library khi có nhu cầu thật.

## 11. Mở rộng

Điểm mở rộng an toàn:

- Thêm thuật toán SRS mới sau interface hiện tại.
- Thêm provider qua `NineRouterClient` hoặc adapter khác.
- Thêm loại quiz bằng `activityType`.
- Thêm topic seed mà không đổi schema.
- Thêm PWA service worker sau khi có chiến lược cache API rõ ràng.
