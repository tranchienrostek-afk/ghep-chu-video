# Failures and Reversals Worth Remembering

Record only failures that are likely to recur if forgotten: destructive simplifications, invalid assumptions, failed migrations, misleading abstractions, performance traps, or reverted architecture.

For each: symptom, root cause, evidence, fix/reversal, and rule that prevents recurrence.


## 2026-09-27 — Link thật không tải được lõi wasm
- Triệu chứng: "Failed to execute 'arrayBuffer' on 'Response': body stream already read", chỉ xảy ra trên GitHub Pages.
- Nguyên nhân: GitHub Pages gửi wasm dạng gzip, `Content-Length` = 10.3 MB (bản nén) ≠ 32.2 MB nhận được; `downloadWithProgress` coi là tải hỏng rồi đọc lại body.
- Vì sao test không bắt được: máy chủ cục bộ không nén.
- Phòng ngừa: `test/serve.mjs` nén gzip; E2E báo lỗi ngay khi thẻ lỗi hiện.
