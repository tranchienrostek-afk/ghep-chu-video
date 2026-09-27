# Active Work

## Workstream

Phát hành bản PWA đầu tiên, rồi thử trên thiết bị thật.

## Objective

Người dùng iPhone và Android dùng được app ngay từ một link, không phải cài từ App Store hay CH Play.

## Change boundary

### Allowed

- Chỉnh giao diện, lời hướng dẫn, tham số nén, cách lưu file theo từng hệ điều hành.

### Must preserve / do not break

- Thuật toán ghép và độ khớp từng khung hình ([ADR-001](../30-decisions/ADR-001-yuv-overlay-graph.md)). Phải chạy lại `test/filter.test.mjs` sau mỗi lần sửa `filter.js`.
- Video chỉ được xử lý trên máy người dùng, không có máy chủ.

## Affected subsystems

- `app/` (toàn bộ), nhánh `gh-pages` (bản sao `app/` qua subtree).

## Open hypotheses / unresolved questions

- [Unverified] iPhone có đủ bộ nhớ cho video khoảng 1 phút, 1080p hay không.
- [Unverified] Lõi ffmpeg.wasm có giải mã được HEVC không.

## Evidence inspected

- `test/out/` (được gitignore): kết quả E2E, ảnh chụp giao diện, số đo PSNR từng khung.
