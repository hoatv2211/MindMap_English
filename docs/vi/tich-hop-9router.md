# Tích hợp 9Router

## 1. Biến môi trường

Sao chép `.env.example` thành `.env`:

```dotenv
NINEROUTER_URL=http://localhost:20128
NINEROUTER_KEY=
NINEROUTER_CHAT_MODEL=
NINEROUTER_IMAGE_MODEL=
NINEROUTER_STT_MODEL=
NINEROUTER_TTS_MODEL=
NINEROUTER_TTS_VOICE=
```

- Để key trống nếu 9Router tắt authentication.
- Không đưa `.env` vào Git.
- Model ID phải lấy từ 9Router đang chạy, không đoán tên.

## 2. Kiểm tra gateway

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

Chat tạo JSON mindmap và phản hồi gia sư. Nên chọn model:

- Hỗ trợ structured JSON ổn định.
- Tiếng Việt tốt.
- Độ trễ phù hợp local learning.
- Có fallback combo nếu provider chính hết quota.

## 4. Image model

Image generation đã có adapter nhưng UI MVP ưu tiên node màu và nội dung; ảnh có thể bổ sung theo từng từ sau. Ảnh nên dùng cùng phong cách minh họa, nền sạch, không chữ.

## 5. STT

Client gửi `multipart/form-data` với:

- `model`
- `file`
- `language=en`
- `response_format=json`

Giới hạn upload của app: 12 MB. MIME hỗ trợ: WebM, WAV, MP3, MP4/M4A, OGG, FLAC.

## 6. TTS

TTS nhận text tối đa 1000 ký tự. `NINEROUTER_TTS_VOICE` được ưu tiên hơn `NINEROUTER_TTS_MODEL` để hỗ trợ voice ID trực tiếp.

## 7. Lỗi thường gặp

### 401

Key thiếu hoặc hết hạn. Cập nhật `NINEROUTER_KEY`.

### 400 Invalid model format

Model ID không tồn tại trong endpoint discover tương ứng.

### 503 All accounts unavailable

Provider hết tài khoản/quota. Chờ `retry-after` hoặc thêm provider/fallback combo.

### AI offline nhưng 9Router đang chạy

- Kiểm tra URL có đúng protocol/port.
- Restart app sau khi đổi `.env`.
- Kiểm tra firewall local.
- Mở **Cài đặt → Kiểm tra kết nối**.

## 8. Shadowing và extraction draft

- **TTS online:** đọc câu mục tiêu trong Phòng luyện. Khi provider lỗi, người dùng vẫn đọc câu trên màn hình và nhập transcript thủ công.
- **STT online:** nhận audio WebM từ thao tác ghi âm chủ động. Khi provider lỗi, session, notebook và deterministic transcript diff vẫn hoạt động.
- **Document extraction:** gửi nội dung các section được chọn tới chat model. Output phải qua Zod và chỉ trở thành draft `recommended|optional|skip`.
- Dictionary lookup, document import/read/highlight, notebook, session và content diff không phụ thuộc 9Router.

Không gửi toàn bộ thư viện mặc định. Chỉ gửi audio hoặc section khi người dùng chủ động yêu cầu.

## 9. Quyền riêng tư

- API key chỉ ở backend.
- Audio chỉ gửi khi người dùng bấm ghi âm.
- Image chỉ gửi khi người dùng yêu cầu tạo.
- Log không ghi API key hoặc raw audio.
- Mindmap/quiz/SRS hoạt động khi AI offline.
