# Tích hợp Provider API

Ứng dụng dùng một provider API kiểu OpenAI-compatible cho AI tutor, draft vocabulary/mindmap, STT và TTS. Tên class nội bộ vẫn là `NineRouterClient` để giữ tương thích code cũ, nhưng cấu hình user-facing nên dùng `PROVIDER_API_*`.

## 1. Biến môi trường

Sao chép `.env.example` thành `.env`:

```dotenv
PROVIDER_API_URL=http://localhost:20128
PROVIDER_API_KEY=
PROVIDER_API_CHAT_MODEL=
PROVIDER_API_IMAGE_MODEL=
PROVIDER_API_STT_MODEL=
PROVIDER_API_TTS_MODEL=
PROVIDER_API_TTS_VOICE=
```

- Để key trống nếu provider API tắt authentication.
- Không đưa `.env` vào Git.
- Model ID phải lấy từ provider API đang chạy, không đoán tên.
- Biến cũ `NINEROUTER_*` vẫn được đọc để không phá cấu hình hiện có. Nếu cả hai cùng tồn tại, `PROVIDER_API_*` được ưu tiên.

## 2. Kiểm tra provider API

```powershell
curl.exe http://localhost:20128/api/health
curl.exe http://localhost:20128/v1/models
curl.exe http://localhost:20128/v1/models/image
curl.exe http://localhost:20128/v1/models/stt
curl.exe http://localhost:20128/v1/models/tts
```

Ứng dụng dùng:

- `/v1/chat/completions`
- `/v1/images/generations`
- `/v1/audio/transcriptions`
- `/v1/audio/speech`

## 3. Chat model

Chat tạo JSON mindmap, draft hộp từ mới, phân tích tài liệu và phản hồi gia sư. Nên chọn model:

- Hỗ trợ structured JSON ổn định.
- Tiếng Việt tốt.
- Độ trễ phù hợp local learning.
- Có fallback nếu provider chính hết quota.

## 4. Image model

Image generation đã có adapter nhưng UI hiện ưu tiên node màu và nội dung. Ảnh có thể bổ sung theo từng từ sau. Ảnh nên dùng cùng phong cách minh họa, nền sạch, không chữ.

## 5. STT

Client gửi `multipart/form-data` với:

- `model`
- `file`
- `language=en`
- `response_format=json`

Giới hạn upload của app: 12 MB. MIME hỗ trợ: WebM, WAV, MP3, MP4/M4A, OGG, FLAC.

## 6. TTS

TTS nhận text tối đa 1000 ký tự. `PROVIDER_API_TTS_VOICE` được ưu tiên hơn `PROVIDER_API_TTS_MODEL` để hỗ trợ voice ID trực tiếp.

## 7. Lỗi thường gặp

### 401

Key thiếu hoặc hết hạn. Cập nhật `PROVIDER_API_KEY`.

### 400 Invalid model format

Model ID không tồn tại trong endpoint discover tương ứng.

### 503 All accounts unavailable

Provider hết tài khoản/quota. Chờ `retry-after` hoặc thêm provider/fallback.

### AI offline nhưng provider API đang chạy

- Kiểm tra URL có đúng protocol/port.
- Restart app sau khi đổi `.env`.
- Kiểm tra firewall local.
- Mở **Cài đặt → Kiểm tra kết nối**.

## 8. Shadowing và extraction draft

- **TTS online:** đọc câu mục tiêu trong Phòng luyện. Khi provider lỗi, người dùng vẫn đọc câu trên màn hình và nhập transcript thủ công.
- **STT online:** nhận audio WebM từ thao tác ghi âm chủ động. Khi provider lỗi, session, notebook và deterministic transcript diff vẫn hoạt động.
- **Document extraction:** gửi nội dung các section được chọn tới chat model. Output phải qua Zod và chỉ trở thành draft `recommended|optional|skip`.
- Dictionary lookup, document import/read/highlight, notebook, session và content diff không phụ thuộc provider API.

Không gửi toàn bộ thư viện mặc định. Chỉ gửi audio hoặc section khi người dùng chủ động yêu cầu.

## 9. Quyền riêng tư

- API key chỉ ở backend.
- Audio chỉ gửi khi người dùng bấm ghi âm.
- Image chỉ gửi khi người dùng yêu cầu tạo.
- Log không ghi API key hoặc raw audio.
- Mindmap/quiz/SRS hoạt động khi AI offline.

## 10. AI tutor theo account

- Policy runtime nằm tại `docs/ai-skills/mindmap-english-tutor/SKILL.md`; loader chỉ đọc path cố định trong project và có fallback khi file lỗi.
- Mỗi request tutor nhận learner snapshot giới hạn theo `user_id`, `profile_revision`, skill version và schema version.
- Chat lưu nhiều thread trong SQLite. User có thể tạo mới, đổi tên, lưu trữ, khôi phục, xóa và retry message lỗi.
- Câu hỏi kiến thức độc lập có thể dùng response cache. Follow-up, tiến độ cá nhân và retry luôn gọi provider.
- Không gửi password, recovery code, session token, raw SQL hoặc toàn bộ database tới provider API.

## 11. Hộp từ mới

- Ba điểm Ghi nhanh, AI Chat và mindmap cùng tạo `vocabulary_inbox_items` theo `user_id`.
- Chat model trả draft strict JSON: nghĩa, IPA, POS, CEFR, đúng ba role `basic`, `daily_life`, `personalized`, bản dịch Việt và placement.
- Draft chỉ ghi vào vocabulary, personal examples, mindmap và SRS sau thao tác duyệt. Approval atomic, idempotent và không reset tiến độ SRS cũ.
- Provider lỗi: item chuyển `failed`, giữ raw note, hiện thông báo đã sanitize, cho phép retry hoặc dismiss.
- Learner context, candidate mindmap, inbox và example cá nhân luôn giới hạn theo account. Không gửi dữ liệu user khác tới provider.

## 12. VPS

```dotenv
HOST=0.0.0.0
ALLOW_REMOTE_BINDING=true
AUTH_SECURE_COOKIES=true
```

Chỉ bật remote binding sau HTTPS reverse proxy. Proxy phải giữ `Host` gốc để same-origin guard so khớp `Origin`. Không serve `DATA_DIR`, SQLite, media hoặc backup dưới static root.
