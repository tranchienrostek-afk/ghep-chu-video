// Service worker: cho app mở được khi không có mạng và không phải tải lại bộ xử lý 32 MB.
// - Giao diện (html/css/js/icon): lấy mạng trước để luôn có bản mới, mất mạng thì dùng bản đã lưu.
// - Thư viện ffmpeg (vendor/): lấy bộ nhớ đệm trước, vì file lớn và không đổi trong một phiên bản.
const VERSION = "v2";
const SHELL_CACHE = `shell-${VERSION}`;
const VENDOR_CACHE = `vendor-${VERSION}`;

const SHELL_FILES = [
  "./",
  "index.html",
  "css/style.css",
  "js/app.js",
  "js/engine.js",
  "js/filter.js",
  "js/platform.js",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  const keep = new Set([SHELL_CACHE, VENDOR_CACHE]);
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Chỉ lưu phản hồi đầy đủ (200). waitUntil giữ service worker sống tới khi ghi cache xong
// (quan trọng với file wasm 32 MB); lỗi ghi cache (hết dung lượng) không làm hỏng phản hồi.
function storeInBackground(event, cache, request, res) {
  if (res.status !== 200) return;
  event.waitUntil(cache.put(request, res.clone()).catch(() => {}));
}

async function cacheFirst(event) {
  const cache = await caches.open(VENDOR_CACHE);
  const hit = await cache.match(event.request);
  if (hit) return hit;
  const res = await fetch(event.request);
  storeInBackground(event, cache, event.request, res);
  return res;
}

async function networkFirst(event) {
  const { request } = event;
  const cache = await caches.open(SHELL_CACHE);
  try {
    const res = await fetch(request);
    storeInBackground(event, cache, request, res);
    return res;
  } catch (err) {
    const hit = await cache.match(request, { ignoreSearch: true });
    if (hit) return hit;
    throw err;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(url.pathname.includes("/vendor/") ? cacheFirst(event) : networkFirst(event));
});
