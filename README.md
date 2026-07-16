# MindMap English Local AI

Ứng dụng học tiếng Anh local-first cho người Việt bằng **mindmap tương tác, lộ trình CEFR, SRS, quiz, AI gia sư, hộp từ mới, bàn đọc cá nhân và luyện nói từng câu**. Mục tiêu: học thực dụng, dễ tìm lại từ, tiến từ A1 đến B2 theo module rõ ràng.

![Dashboard desktop](docs/vi/images/dashboard-desktop.png)

## Tính năng

- Dashboard **Học hôm nay** với buổi 10 hoặc 20 phút.
- Lộ trình CEFR A1-B2 theo module tình huống, có progress và unlock tuần tự.
- 17 chủ đề đời sống, seed mindmap và thư viện vocabulary local.
- Mindmap React Flow: zoom, pan, kéo node, Focus Mode, list fallback và editor panel.
- Một lịch SRS trung tâm cho mỗi từ; progress tách theo account.
- Quiz nhớ nghĩa, ngữ cảnh, collocation, nghe và nói.
- Hộp từ mới nhận ghi chú từ Quick Capture, AI Chat và mindmap; AI chỉ tạo draft, user duyệt mới ghi dữ liệu.
- Từ điển offline gợi ý, sửa lỗi gõ và phát hiện từ trùng.
- Bàn đọc cá nhân cho TXT, Markdown, EPUB; chọn đoạn để tạo thẻ từ, lưu sổ câu hoặc hỏi gia sư.
- Phòng luyện shadowing: nghe TTS, ghi âm STT hoặc nhập transcript thủ công, xem diff nội dung.
- AI Agent qua provider API OpenAI-compatible; core learning vẫn chạy offline.
- SQLite local, backup ZIP, restore staging an toàn.
- Responsive desktop/mobile, keyboard focus, reduced motion.

## Stack

- React 19 + Vite 8 + TypeScript strict.
- Express 5 modular monolith.
- SQLite qua better-sqlite3.
- Zod contracts.
- React Flow.
- Vitest, Testing Library, Supertest, Playwright.

## Yêu cầu

- Node.js 22 trở lên.
- npm 10 trở lên.
- Provider API tùy chọn cho AI, STT, TTS và image generation.

## Cài đặt nhanh

```powershell
git clone <repository-url>
cd MindMap_English
npm install
Copy-Item .env.example .env
npm run build
npm start
```

Mở `http://127.0.0.1:8787`.

Không cấu hình provider API vẫn dùng được thư viện, mindmap, quiz, SRS, lộ trình, tiến độ, tài liệu đọc và backup.

## Chạy frontend trên GitHub Pages + backend VPS Docker

Luồng deploy tách đôi:

- GitHub Pages chỉ host static frontend tại `https://hoatv2211.github.io/MindMap_English/`.
- VPS Docker chạy backend/API + SQLite tại domain HTTPS riêng, ví dụ `https://api.your-domain.com`.
- Frontend gọi backend qua `VITE_API_BASE_URL`.
- `VITE_API_BASE_URL` là biến public của Vite; chỉ đặt URL backend public, không đặt `PROVIDER_API_KEY` hoặc provider secret.

Trong GitHub repo, vào **Settings → Secrets and variables → Actions → Variables**, thêm:

```text
VITE_API_BASE_URL=https://api.your-domain.com
```

Workflow `.github/workflows/pages.yml` build với:

```text
VITE_BASE_PATH=/MindMap_English/
VITE_API_BASE_URL=${{ vars.VITE_API_BASE_URL }}
```

Trong **Settings → Pages**, chọn source **GitHub Actions**. Sau khi push lên branch workflow đang theo dõi, Pages sẽ deploy ra URL trên.

Backend Docker trên VPS cần cho phép origin GitHub Pages và cookie cross-site:

```bash
docker run -d --name mindmap-english --restart unless-stopped \
  -p 8787:8787 \
  -e HOST=0.0.0.0 \
  -e DATA_DIR=/data \
  -e ALLOW_REMOTE_BINDING=true \
  -e APP_ORIGIN=https://hoatv2211.github.io \
  -e AUTH_SECURE_COOKIES=true \
  -e AUTH_COOKIE_SAME_SITE=none \
  -v mindmap_english_data:/data \
  ghcr.io/hoatv2211/mindmap_english:latest
```

Yêu cầu quan trọng:

- Backend phải chạy sau HTTPS reverse proxy. Cookie `SameSite=None` bắt buộc `Secure`, nên HTTP/IP trần sẽ không login ổn trên browser hiện đại.
- Reverse proxy map public domain HTTPS tới `127.0.0.1:8787` hoặc container port `8787`.
- `APP_ORIGIN` là origin, không gồm path `/MindMap_English`.
- Nếu Pages dùng `https://hoatv2211.github.io`, backend CORS chỉ cho origin này và gửi cookie bằng `credentials: include`.
- `PROVIDER_API_*` và provider secret chỉ nằm trong `.env`/environment của backend Docker trên VPS, không đưa vào GitHub Pages variables.

## Cài bằng Docker

Build và chạy local:

```powershell
docker build -t mindmap-english:local .
docker volume create mindmap_english_data
docker run --rm -p 8787:8787 --name mindmap-english -v mindmap_english_data:/data mindmap-english:local
```

Hoặc dùng image/compose có sẵn:

```powershell
docker compose up -d
```

Nếu máy không có Docker Compose plugin, dùng lệnh tương đương:

```powershell
docker run -d --name mindmap-english --restart unless-stopped -p 8787:8787 -e HOST=0.0.0.0 -e DATA_DIR=/data -e ALLOW_REMOTE_BINDING=true -v mindmap_english_data:/data ghcr.io/hoatv2211/mindmap_english:latest
```

Mở `http://127.0.0.1:8787`. Dữ liệu nằm trong volume `mindmap_english_data` tại `/data` trong container.

Khi container cần gọi provider API trên host, đặt URL host-reachable, ví dụ:

```powershell
docker run -d --name mindmap-english --restart unless-stopped -p 8787:8787 -e HOST=0.0.0.0 -e DATA_DIR=/data -e ALLOW_REMOTE_BINDING=true -e PROVIDER_API_URL=http://host.docker.internal:20128 -e PROVIDER_API_KEY=<your-key> -e PROVIDER_API_CHAT_MODEL=<chat-model> -v mindmap_english_data:/data ghcr.io/hoatv2211/mindmap_english:latest
```

Trên Linux VPS, nếu provider API cũng chạy trên host, dùng IP gateway Docker hoặc chạy provider trong cùng Docker network thay cho `host.docker.internal`.

## Cấu hình `.env`

| Biến | Mặc định | Mục đích |
|---|---|---|
| `HOST` | `127.0.0.1` | Chỉ bind local |
| `ALLOW_REMOTE_BINDING` | `false` | Cho phép bind ngoài localhost khi deploy sau reverse proxy |
| `AUTH_SECURE_COOKIES` | `false` | Bật secure cookie khi dùng HTTPS |
| `AUTH_COOKIE_SAME_SITE` | `lax` | Đặt `none` khi frontend ở GitHub Pages gọi backend domain khác |
| `AUTH_SESSION_HOURS` | `24` | Thời hạn session trượt |
| `AUTH_ABSOLUTE_SESSION_HOURS` | `168` | Thời hạn session tối đa |
| `PORT` | `8787` | Cổng API và production UI |
| `DATA_DIR` | `./data` | SQLite, media, documents, backup |
| `APP_ORIGIN` | trống | Origin frontend được phép CORS, ví dụ `https://hoatv2211.github.io` |
| `PROVIDER_API_URL` | `http://localhost:20128` | Provider API OpenAI-compatible |
| `PROVIDER_API_KEY` | trống | Key nếu provider bật auth |
| `PROVIDER_API_CHAT_MODEL` | trống | Tutor, mindmap, hộp từ mới, document extraction |
| `PROVIDER_API_IMAGE_MODEL` | trống | Minh họa AI |
| `PROVIDER_API_STT_MODEL` | trống | Speech-to-text |
| `PROVIDER_API_TTS_MODEL` | trống | Text-to-speech model |
| `PROVIDER_API_TTS_VOICE` | trống | Voice ID ưu tiên |

Biến cũ `NINEROUTER_*` vẫn được đọc để giữ tương thích cấu hình hiện có. Nếu cả `PROVIDER_API_*` và `NINEROUTER_*` cùng tồn tại, `PROVIDER_API_*` được ưu tiên.

## Lệnh

```powershell
npm run dev          # client + server development
npm run build        # production client build
npm start            # local production server
npm test             # unit/integration/component tests
npm run test:e2e     # Playwright desktop/mobile
npm run typecheck    # TypeScript strict
npm audit --audit-level=moderate
```

## Dữ liệu

```text
data/
├── dictionary/words.txt   # tùy chọn
├── documents/<checksum>/  # tài liệu nhập local
├── mindmap-english.db
├── media/
└── backups/
```

`data/`, `.env`, PDF/DOCX nguồn, audio cá nhân và API key đều bị loại khỏi Git.

## Tài liệu tiếng Việt

- [Hướng dẫn sử dụng](docs/vi/huong-dan-su-dung.md)
- [Kiến trúc và phát triển](docs/vi/kien-truc-va-phat-trien.md)
- [Tích hợp Provider API](docs/vi/tich-hop-9router.md)
- [Deploy GitHub Pages + VPS Docker](docs/vi/vps-github-pages-deploy.md)
- [Design specification](docs/superpowers/specs/2026-07-13-mindmap-english-local-ai-design.md)
- [Implementation plan](docs/superpowers/plans/2026-07-13-mindmap-english-local-ai-implementation.md)

## Kiểm thử hiện tại

- `npm test`: 40 file test, 141 tests pass.
- `npm run typecheck`: pass.
- `npm run build`: pass.
- `npm audit --audit-level=moderate`: 0 vulnerabilities.

## Quyền riêng tư

- Server bind localhost mặc định.
- Provider API key chỉ ở backend, không gửi ra browser.
- Audio chỉ gửi khi người dùng chủ động ghi âm.
- Tài liệu/đoạn đọc chỉ gửi khi người dùng yêu cầu AI phân tích hoặc hỏi gia sư.
- AI output validate bằng Zod và lưu draft trước.
- Không log API key, session token, recovery code hoặc raw audio.

## Tài khoản và AI tutor

- Đăng ký bằng `username + password`; mỗi tài khoản có dữ liệu học, tài liệu và hội thoại riêng trong SQLite.
- Recovery code chỉ hiển thị khi đăng ký hoặc khôi phục mật khẩu. User phải tự lưu; code cũ bị vô hiệu sau khi dùng.
- AI tutor dùng skill `docs/ai-skills/mindmap-english-tutor/SKILL.md`, learner context giới hạn từ SQLite và lịch sử chat nhiều thread.
- Cache chỉ áp dụng cho learner context và câu hỏi kiến thức độc lập; hội thoại nối tiếp luôn gọi provider.
- Mutation API kiểm tra same-origin mặc định; khi cấu hình `APP_ORIGIN`, chỉ origin đó được CORS. Session cookie dùng `HttpOnly`, local mặc định `SameSite=Lax`, GitHub Pages cần `SameSite=None; Secure`.

## Đóng gói lên VPS

- Chạy sau reverse proxy HTTPS. Đặt `HOST=0.0.0.0`, `ALLOW_REMOTE_BINDING=true`, `AUTH_SECURE_COOKIES=true`.
- Nếu frontend nằm ở GitHub Pages, đặt `APP_ORIGIN=https://hoatv2211.github.io`, `AUTH_COOKIE_SAME_SITE=none`, và build Pages với `VITE_API_BASE_URL=https://api.your-domain.com`.
- Không public trực tiếp SQLite, `DATA_DIR`, thư mục media, documents hoặc backup.
- Giữ `PROVIDER_API_KEY` trong biến môi trường phía server; không đưa vào bundle frontend.
- Backup ZIP loại password hash, recovery hash, session token hash và AI cache. Khi restore, credential/session hiện tại được giữ từ DB đang chạy.
- Backup vẫn chứa dữ liệu học của SQLite chung; bảo vệ thư mục backup như `DATA_DIR`, không public qua web server.

## Roadmap

- Cache audio và ảnh theo từ.
- Image generation có style guide thống nhất.
- Hội thoại voice realtime.
- PWA offline cache có versioning.
- Đồng bộ nhiều thiết bị tùy chọn.

## License

Xem [LICENSE](LICENSE).
