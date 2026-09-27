# Ghép Chữ Video

App web cài được (PWA) để ghép **video chữ trắng nền đen** lên **video chính**, có viền tối quanh chữ cho dễ đọc. Dùng được trên cả **iPhone** lẫn **Android**. Video được xử lý ngay trên điện thoại bằng [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm) và không bị tải lên máy chủ nào.

Hướng dẫn chi tiết cho người dùng có sẵn ngay trong app (mục **📖 Hướng dẫn sử dụng**).

## Dùng nhanh

1. Mở link app bằng **Safari** (iPhone) hoặc **Chrome** (Android). Không mở trong Zalo/Facebook.
2. (Tuỳ chọn) Cài lên màn hình chính:
   - iPhone: nút **Chia sẻ** → **Thêm vào MH chính** → **Thêm**.
   - Android: **⋮** → **Cài đặt ứng dụng** / **Thêm vào màn hình chính**.
3. Chọn **video chính**, rồi chọn **video chữ** (chữ trắng, nền đen tuyệt đối).
4. Chọn độ dày viền và chất lượng, rồi bấm **Ghép video**. Lần đầu app tải bộ xử lý khoảng 32 MB.
5. Bấm **Lưu video về máy**:
   - iPhone: chọn **Lưu video**, video sẽ vào app **Ảnh**.
   - Android: file nằm trong thư mục **Tải xuống (Download)**.

## Thuật toán

Thuật toán giống `Chương trình xử lý.py` bản desktop:

- mask = độ sáng của video chữ.
- Viền tối = mask dãn nở (dilation) trộn với lớp đen.
- Chữ trắng = trộn lớp trắng theo mask (tương đương Screen, giữ anti-aliasing).

Khác biệt duy nhất: bản web trộn trên YUV thay vì RGB, nên phần bộ lọc trong wasm nhanh hơn khoảng 4.5 lần. Kết quả được kiểm chứng như sau:

- Vùng chữ đạt PSNR ≥ 40 dB so với bản desktop đã duyệt.
- Vùng không có chữ giống video gốc ít nhất bằng bản desktop.

## Cấu trúc

```
app/                  ← thư mục được đăng lên GitHub Pages
  index.html          giao diện + hướng dẫn
  js/filter.js        dựng lệnh ffmpeg (thuần, có test)
  js/engine.js        nạp ffmpeg.wasm, đọc thời lượng, ghép, hủy
  js/platform.js      nhận diện iPhone/Android, lưu/chia sẻ file
  js/app.js           điều khiển giao diện
  sw.js               service worker (chạy offline, cache lõi 32 MB)
  vendor/             @ffmpeg/ffmpeg, @ffmpeg/util, @ffmpeg/core 0.12.10
test/
  filter.test.mjs     test lệnh ffmpeg với ffmpeg desktop (8 ca)
  e2e.mjs             chạy thử như người dùng trên Chromium (Android) / WebKit (iPhone)
  bench.mjs           đo tốc độ trong ffmpeg.wasm
```

## Phát triển

```bash
npm install
npx playwright install chromium-headless-shell webkit
node --test test/filter.test.mjs          # cần ffmpeg/ffprobe trong PATH
node test/e2e.mjs chromium fast           # hoặc: webkit fast
node test/serve.mjs app 8791              # mở http://127.0.0.1:8791/
```

## Giấy phép

Mã của app dùng giấy phép MIT. `vendor/core` là bản build FFmpeg (có libx264) của dự án ffmpeg.wasm và tuân theo giấy phép GPL của FFmpeg/x264.
