# Next Actions

## Next exact actions

1. Mở link GitHub Pages trên **iPhone thật** (Safari), rồi làm đủ quy trình: chọn 2 video → Ghép → Lưu video → kiểm tra video đã vào app Ảnh.
2. Làm tương tự trên **Android thật** (Chrome): kiểm tra file trong thư mục Download và thử nút Chia sẻ.
3. Thử một video `.mov` HEVC quay trực tiếp bằng iPhone. Nếu ffmpeg.wasm báo lỗi giải mã, thêm hướng dẫn chuyển camera iPhone sang "Tương thích nhất", hoặc chuyển mã trước khi ghép.
4. Đo thời gian ghép trên điện thoại thật, rồi cập nhật ước lượng thời gian trong hướng dẫn.

## Blockers / decisions still needed

- Cần một người có điện thoại thật để thử (bước 1–4).

## Verification still required

- Chạy trên thiết bị thật (xem bước 1–4).

## Do not accidentally redo

- Không quay lại trộn trên `gbrp`: bộ lọc chậm hơn 4.5 lần trong wasm (ADR-001).
- Không dùng preset `ultrafast`: file nặng 25.9 MB cho 11s video, so với 7.8 MB khi dùng `superfast`.
- Không dùng tpad kéo dài vô hạn hoặc `-t` để cắt thời lượng: `overlay eof_action=pass` đã xử lý việc này.
