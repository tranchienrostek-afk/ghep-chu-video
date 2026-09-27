---
memory_flow: 1
status: initialized
last_verified_commit: da87436 (gh-pages) / main
---
# Current State

## System in one paragraph

PWA tĩnh "Ghép Chữ Video" (thư mục `app/`, đăng lên GitHub Pages từ nhánh `gh-pages` bằng lệnh `git subtree push --prefix app origin gh-pages`; không dùng Actions vì token gh thiếu quyền `workflow`). Người dùng iPhone (Safari iOS 15+) hoặc Android (Chrome) chọn 2 video từ máy: video chính và video chữ trắng nền đen. App ghép chữ lên video chính kèm viền tối, ngay trong trình duyệt bằng ffmpeg.wasm 0.12.10 (bản lõi đơn luồng, tự host trong `app/vendor/`). Kết quả lưu về máy: iPhone mở bảng chia sẻ để "Lưu video", Android tải file vào thư mục Download. Video không được gửi lên máy chủ nào. Thuật toán gốc lấy từ script desktop `../Chương trình xử lý.py` (bản đã duyệt 9/10).

## Capabilities that must remain

- Chọn video bằng `<input type=file accept=video/*>`, có ảnh xem trước (dùng thủ thuật `#t=0.1`).
- Ghép chữ gồm viền tối 0–3px (dilation) và chữ trắng trộn theo mask, giữ anti-aliasing.
- Video đầu ra khớp **từng khung hình** với video chính, kể cả khi video chữ có nhịp khung không đều (VFR).
- Video chữ khác kích thước được tự co giãn (scale2ref). Video chữ ngắn hơn: hết chữ thì chỉ còn video chính. Video chữ dài hơn: bị cắt theo video chính. Video chính không có tiếng: app không bị treo.
- Có thanh tiến độ (đọc `time=` trong log, chia cho thời lượng). Nút Hủy dùng được cả khi đang tải lõi. Giữ màn hình sáng bằng wake lock.
- Hướng dẫn chi tiết theo từng hệ điều hành ngay trong `index.html` (8 mục). Có cảnh báo khi app được mở trong Zalo/Facebook.
- Service worker cache lõi 32 MB (cacheFirst cho `vendor/`, networkFirst cho giao diện).

## Current architecture / major subsystems

- `app/js/filter.js`: hàm thuần dựng lệnh ffmpeg, là nơi chứa toàn bộ thuật toán. Xem [ADR-001](../30-decisions/ADR-001-yuv-overlay-graph.md).
- `app/js/engine.js`: nạp ffmpeg.wasm (toBlobURL có tiến độ), đọc thời lượng, chạy ghép, hủy (terminate).
- `app/js/platform.js`: nhận diện iOS/Android/trình duyệt trong app, lưu và chia sẻ file, wake lock.
- `app/js/app.js`: điều khiển giao diện. Mỗi lượt chạy có một `runId`; Hủy làm tăng `runId` để vô hiệu lượt cũ.
- `app/sw.js`: cache offline. Đổi `VERSION` khi cập nhật file trong vendor.

## Important invariants

- Mọi URL trong app phải là **đường dẫn tương đối**, vì app được host dưới sub-path `/ghep-chu-video/`.
- Không dùng `tpad` vô hạn khi không có `-t`: lệnh sẽ treo nếu video chính không có tiếng (đã xảy ra thật).
- Không để `maskedmerge` nhận trực tiếp một input VFR. Video chữ phải đi qua `overlay` lên nền đen lấy từ video chính.
- `navigator.share` trên iOS phải được gọi ngay trong lượt bấm của người dùng, không await gì trước nó.

## Current risks / known inconsistencies

- **Chưa thử trên iPhone và Android thật.** Mới kiểm thử trên WebKit (Playwright, Windows) và Chromium giả lập Pixel 7. Chưa rõ giới hạn bộ nhớ và tốc độ trên điện thoại thật.
- Chưa thử video HEVC `.mov` quay từ iPhone. Lõi wasm có thể không có bộ giải mã HEVC.
- Các tab hướng dẫn thiếu `aria-controls` và điều hướng bằng phím mũi tên (LOW).

## Verification baseline

- `node --test test/filter.test.mjs`: 8/8 ca đạt (ffmpeg desktop 8.1.2).
- Link chạy thật: https://tranchienrostek-afk.github.io/ghep-chu-video/ (mọi file trả HTTP 200, wasm trả `application/wasm`).
- `node test/e2e.mjs chromium fast` và `webkit fast` (máy chủ cục bộ): đạt. Có thể chạy trên link thật bằng `E2E_URL=<link>`. Ghép mất 27–34s cho video 11s. Kết quả 333/333 khung khớp video gốc (TB 41.2 dB ở vùng không có chữ). Bước Hủy khi đang tải lõi hoạt động đúng.
