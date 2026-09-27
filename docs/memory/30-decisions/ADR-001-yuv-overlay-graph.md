---
id: ADR-001
status: accepted
date: 2026-09-27
superseded_by: null
---
# ADR-001 — Bộ lọc ghép chữ: trộn trên YUV và lấy mẫu video chữ bằng overlay

## Context

Script desktop đã duyệt (`Chương trình xử lý.py`) trộn trên RGB (`gbrp`) bằng `maskedmerge` và nhận video chữ trực tiếp. Khi chuyển sang ffmpeg.wasm (đơn luồng, không SIMD), gặp ba vấn đề:

1. Phần bộ lọc mất 101s cho video 11s (đo trong `test/bench.mjs`).
2. Video chữ có nhịp khung không đều (VFR: 0.000, 0.033, 0.067, 0.078…). `maskedmerge` xuất một khung cho mọi mốc thời gian của mọi input, nên hình bị nhân đôi hoặc lệch nhịp. Có tới 217/333 khung lệch so với video gốc, **kể cả ở bản desktop đã duyệt**.
3. Dùng `tpad` vô hạn để giữ thời lượng thì lệnh treo khi video chính không có tiếng.

## Decision

- Trộn trên yuv420p. Mask xám được chuyển thành mask yuv420p bằng `mergeplanes`, với U/V thu nhỏ 1/2.
- Video chữ đi qua `scale2ref`, rồi được `overlay=eof_action=pass` lên nền đen lấy từ video chính, sau đó mới làm mask.
- Không dùng tpad hay `-t`.

## Why

- Trộn theo mask là phép nội suy tuyến tính, còn chuyển RGB↔YUV là phép affine, nên kết quả tương đương. Bộ lọc giảm từ 101s xuống 22s. Phóng to 3 lần vùng chữ không thấy khác biệt với bản đã duyệt.
- `overlay` chỉ xuất khung theo input chính, nên mọi lớp cùng lưới thời gian. Kết quả 0/333 khung lệch, TB 41.2 dB so với video gốc. Tốc độ E2E cũng tăng: 45–56s → 27–34s.
- `eof_action=pass` xử lý cả trường hợp video chữ ngắn hơn lẫn dài hơn mà không có nguy cơ treo.

## Consequences

- Đầu ra không còn trùng từng pixel với bản desktop cũ. Thay vào đó, nó giống video gốc hơn. Test chuyển từ "trùng pixel với bản đã duyệt" sang "khớp từng khung với video gốc".
- Bản desktop `Chương trình xử lý.py` vẫn còn lỗi lệch khung khi video chữ VFR (chưa sửa phía desktop).

## Evidence

- `test/filter.test.mjs` (ca "mọi khung hình khớp đúng thứ tự với video gốc"), `test/bench.mjs`, `test/e2e.mjs`.

## Related

- `docs/memory/10-current/STATE.md`
