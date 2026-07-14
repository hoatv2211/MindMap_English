# Web Speech Pronunciation Design

## Mục tiêu

Dùng Web Speech API để nút loa đọc từ và câu mẫu ngay trong trình duyệt, miễn phí và không phụ thuộc 9Router.

## Phạm vi

- Mindmap vocabulary node.
- Nút nghe từ trong quiz.
- Nút nghe mẫu trong phần luyện nói.

## Thiết kế

Tạo helper `speakEnglish(text, options)` tại `src/client/lib/speech.ts`. Helper hủy câu đang đọc, tạo `SpeechSynthesisUtterance`, dùng `en-US`, tốc độ `0.8`, pitch `1`, ưu tiên voice cùng ngôn ngữ nếu có. Khi trình duyệt không hỗ trợ, helper ném lỗi rõ để UI hiện thông báo hoặc bỏ qua tại mindmap nơi IPA vẫn còn hiển thị.

Không gọi API backend, không dùng key, không cache audio và không thêm dependency.

## Kiểm thử

Mock `speechSynthesis` và `SpeechSynthesisUtterance` trong Vitest để xác nhận cancel trước speak, cấu hình mặc định và lỗi unsupported.