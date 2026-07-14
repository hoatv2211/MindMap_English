# Hướng dẫn sử dụng MindMap English Local AI

## 1. Mục tiêu

MindMap English giúp người học trình độ cơ bản tiến tới B1-B2 bằng từ vựng thực dụng, mindmap, SRS, nghe và nói từng câu. Ứng dụng chạy trên máy cá nhân; dữ liệu học nằm trong SQLite local.

## 2. Khởi động

```powershell
npm install
Copy-Item .env.example .env
npm run build
npm start
```

Mở `http://127.0.0.1:8787`.

Nếu chỉ phát triển giao diện/API:

```powershell
npm run dev
```

- Client: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:8787`

## 3. Học hôm nay

Trang **Hôm nay** có hai lựa chọn:

- **Học 20 phút:** ôn SRS, khám phá mindmap, ngữ cảnh, nghe và nói.
- **Bản nhanh 10 phút:** ưu tiên từ đến hạn và từ yếu.

Mỗi câu trả lời kết thúc bằng một mức tự đánh giá:

- **Quên:** cần học lại sớm.
- **Khó:** nhớ chậm hoặc cần gợi ý.
- **Tốt:** nhớ đúng trong thời gian hợp lý.
- **Dễ:** nhớ nhanh và dùng được trong ngữ cảnh.

Không nên chọn **Dễ** chỉ vì vừa nhìn thấy đáp án. Hãy chọn theo khả năng tự gọi lại từ.

## 4. Thư viện và mindmap

1. Chọn **Thư viện** ở thanh điều hướng.
2. Lọc theo chủ đề hoặc tìm tên mindmap.
3. Mở **Eating Essentials** để xem dữ liệu mẫu.
4. Kéo node để thay đổi vị trí. Vị trí mới được lưu qua API.
5. Bấm biểu tượng loa trên node để nghe TTS khi 9Router đã cấu hình.
6. Dùng **Danh sách** nếu màn hình nhỏ hoặc muốn đọc tuyến tính.
7. Dùng **Tập trung** để ẩn điều hướng và giữ vùng học chính.

Một từ chỉ có một lịch SRS dù xuất hiện trong nhiều mindmap.

## 5. Tạo mindmap bằng AI

1. Chọn **Tạo mindmap**.
2. Nhập chủ đề, ví dụ `phỏng vấn xin việc`.
3. Mô tả tình huống thực tế.
4. Chọn nhóm thư viện.
5. Bấm **Tạo bản nháp**.
6. Kiểm tra nhánh, từ, IPA, nghĩa và câu mẫu.
7. Bấm **Lưu bản nháp**.
8. Chỉ khi hài lòng mới bấm **Duyệt và mở mindmap**.

AI không được ghi trực tiếp nội dung chưa duyệt vào thư viện chính. Nếu từ đã tồn tại, ứng dụng hiển thị cảnh báo trùng.

## 6. AI gia sư

Bấm **Hỏi gia sư** ở góc phải. Agent dùng hồ sơ học local để:

- Giải thích cách dùng từ.
- Sửa câu theo hướng tự nhiên, thực dụng.
- Gợi ý tình huống luyện tập.
- Hỗ trợ xây mindmap.

Khi 9Router offline, drawer báo offline; thư viện, mindmap, quiz và SRS vẫn hoạt động.

## 7. Luyện nói

Ở hoạt động **Luyện nói**:

1. Bấm nút microphone.
2. Cho phép trình duyệt dùng microphone.
3. Nói một câu tiếng Anh.
4. Bấm dừng.
5. Ứng dụng gửi đoạn ghi âm tới STT qua 9Router.
6. Transcript hiện bên dưới.
7. Bấm **Nghe mẫu** để nghe TTS.

Nếu STT lỗi, tiếp tục bằng ô text. Transcript chỉ hỗ trợ sửa nội dung; không phải điểm phát âm chuyên nghiệp.

## 8. Tiến độ

Trang **Tiến độ** hiển thị:

- Từ mới, từ yếu, từ đang học, từ ổn định.
- Tỷ lệ đúng 30 ngày.
- Phút học trong tuần.
- Số lượt luyện nói.
- Số chủ đề đã chạm.
- Số từ đến hạn.

XP và streak chỉ là phản hồi phụ. Mục tiêu chính là nhớ lâu và dùng được.

## 9. Backup và khôi phục

Trong **Cài đặt**:

- Bấm **Tạo backup** để đóng gói SQLite, media và `manifest.json`.
- Backup nằm trong `data/backups`.
- Bấm **Khôi phục** để staging bản restore.
- Khởi động lại ứng dụng để áp dụng restore.
- Trước khi thay DB, ứng dụng giữ bản `mindmap-english.db.before-restore`.

Không chỉnh sửa file ZIP backup thủ công.

## 10. Dữ liệu local

Mặc định:

```text
data/
├── mindmap-english.db
├── media/
└── backups/
```

Không commit thư mục `data`, file `.env`, API key hoặc audio cá nhân lên Git.

## 11. Từ điển offline và nhập từ

- Khi nhập term trong bản nháp mindmap, app gợi ý tối đa 6 từ và hỗ trợ bàn phím Arrow, Enter, Escape.
- Từ đã có trong vocabulary được báo ngay để tránh tạo bản sao.
- Từ chưa biết không bị chặn; người dùng phải xác nhận rõ trước khi giữ từ đó.
- Có thể đặt word list tại `data/dictionary/words.txt`, mỗi dòng một từ. Không có file này, app vẫn chạy bằng vocabulary local và seed tích hợp.

## 12. Sổ câu và Phòng luyện

1. Trong Bàn đọc, chọn câu rồi bấm **Lưu vào sổ câu**.
2. Mở **Phòng luyện** từ thanh điều hướng chính.
3. Bấm **Bắt đầu luyện**, nghe mẫu hoặc giữ nút microphone để nói.
4. Nếu không dùng microphone/STT, nhập transcript vào ô thử nghiệm.
5. Xem từ thiếu, thừa, thay thế và phần trăm khớp nội dung.
6. Chọn **Nói lại**, **Câu tiếp**, hoặc **Hoàn tất buổi luyện** ở câu cuối.

App không chấm chất lượng phát âm. STT/TTS cần 9Router; transcript thủ công và diff nội dung vẫn dùng được khi speech provider offline.

## 13. Bàn đọc cá nhân

1. Mở **Thư viện → Tài liệu đang đọc**.
2. Nhập file TXT, Markdown hoặc EPUB, tối đa 5 MB.
3. Mở tài liệu, đọc theo section/chapter và dùng mục lục để di chuyển.
4. Dùng nút `+/-` để chỉnh cỡ chữ và giãn dòng. Thiết lập được lưu trên trình duyệt.
5. Chọn đoạn văn rồi dùng **Tạo thẻ từ**, **Lưu vào sổ câu**, **Thêm vào mindmap** hoặc **Hỏi gia sư**. App giữ document ID, section ID và offset nguồn.
6. **Thêm vào mindmap** chỉ prefill form tạo bản nháp; vẫn cần lưu và duyệt thủ công.
7. Bấm **Phân tích chương** để tạo bản nháp AI khi 9Router online.

AI phân loại đề xuất thành **Nên học**, **Có thể biết**, **Bỏ qua**. Đây chỉ là bản nháp xem trước, chưa ghi vào nội dung chính.

## 14. Sự cố thường gặp

### Trang báo AI offline

- Kiểm tra 9Router đang chạy.
- Kiểm tra `NINEROUTER_URL`.
- Kiểm tra model ID trong `.env`.
- Mở **Cài đặt → Kiểm tra kết nối**.

### Không nghe được TTS

- Cấu hình `NINEROUTER_TTS_MODEL` hoặc `NINEROUTER_TTS_VOICE`.
- Kiểm tra model tồn tại trong `/v1/models/tts`.

### Microphone bị từ chối

- Cho phép microphone cho `127.0.0.1`.
- Tải lại trang.
- Dùng text nếu không muốn gửi audio.

### Database bị khóa

- Chỉ chạy một instance server dùng cùng `DATA_DIR`.
- Dừng server cũ rồi khởi động lại.
