// Kiểm thử giao diện theo từng loại trình duyệt (User-Agent): cảnh báo trình duyệt nhúng,
// nút Mở bằng Chrome, hướng dẫn thu gọn, và luồng Lưu khi đang ở trong Zalo/Messenger.
// Dùng: node test/ui.mjs            (E2E_URL=https://... để chạy trên bản đã đăng)
import { chromium, webkit, devices } from "playwright";
import { startServer } from "./serve.mjs";

const PORT = Number(process.env.E2E_PORT || 8810);
const BASE_URL = process.env.E2E_URL || `http://127.0.0.1:${PORT}/`;
const server = process.env.E2E_URL ? null : await startServer("app", PORT);
const COMPOSE_TIMEOUT_MS = 5 * 60_000;

const UA = {
  chromeAndroid: "Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36",
  webviewGeneric: "Mozilla/5.0 (Linux; Android 14; SM-A546E Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.100 Mobile Safari/537.36",
  zaloAndroid: "Mozilla/5.0 (Linux; Android 14; SM-A546E Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.100 Mobile Safari/537.36 Zalo android/12100607 ZaloTheme/light ZaloLanguage/vi",
  messengerIOS: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/470.0.0.34.107;FBBV/620000000;FBDV/iPhone14,5;FBMD/iPhone;FBSN/iOS;FBSV/17.5;FBSS/3;FBCR/;FBID/phone;FBLC/vi_VN;FBOP/5]",
  safariIOS: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
};

const CASES = [
  { name: "Chrome Android", engine: chromium, device: devices["Pixel 7"], ua: UA.chromeAndroid, inApp: false, chromeBtn: false },
  { name: "Android WebView (không ghi tên app)", engine: chromium, device: devices["Pixel 7"], ua: UA.webviewGeneric, inApp: true, chromeBtn: true },
  { name: "Zalo Android", engine: chromium, device: devices["Pixel 7"], ua: UA.zaloAndroid, inApp: true, chromeBtn: true },
  { name: "Messenger iPhone", engine: webkit, device: devices["iPhone 13"], ua: UA.messengerIOS, inApp: true, chromeBtn: false },
  { name: "Safari iPhone", engine: webkit, device: devices["iPhone 13"], ua: UA.safariIOS, inApp: false, chromeBtn: false },
];

const failures = [];
const check = (cond, msg) => { if (!cond) failures.push(msg); return cond; };

async function withPage(c, fn) {
  const browser = await c.engine.launch();
  const context = await browser.newContext({ ...c.device, userAgent: c.ua, acceptDownloads: true });
  const page = await context.newPage();
  try { await fn(page); } finally { await browser.close(); }
}

for (const c of CASES) {
  await withPage(c, async (page) => {
    await page.goto(BASE_URL);
    const warn = await page.locator("#inAppWarning").isVisible();
    const chromeBtn = await page.locator("#openChromeBtn").isVisible();
    const guideOpen = await page.locator("#huong-dan").evaluate((d) => d.open);
    check(warn === c.inApp, `${c.name}: cảnh báo trình duyệt nhúng hiện=${warn}, mong đợi ${c.inApp}`);
    check(chromeBtn === c.chromeBtn, `${c.name}: nút Mở bằng Chrome hiện=${chromeBtn}, mong đợi ${c.chromeBtn}`);
    check(!guideOpen, `${c.name}: hướng dẫn phải thu gọn khi mở trang`);
    await page.click("#huong-dan > summary");
    check(await page.locator("#huong-dan").evaluate((d) => d.open), `${c.name}: bấm "Hướng dẫn sử dụng" phải mở ra`);
    const innerOpen = await page.locator("#huong-dan details[open]").count();
    check(innerOpen === 0, `${c.name}: các mục con phải đóng sẵn (đang mở ${innerOpen})`);
    if (c.chromeBtn) {
      const href = await page.evaluate(async () => (await import("./js/platform.js")).chromeIntentUrl());
      check(/^intent:\/\/.+#Intent;scheme=https;package=com\.android\.chrome;end$/.test(href), `${c.name}: link intent sai: ${href}`);
    }
    console.log(`${c.name}: cảnh báo=${warn} nútChrome=${chromeBtn} hướngDẫnThuGọn=${!guideOpen}`);
  });
}

// Hash #huong-dan-luu (link "Xem hướng dẫn" trong gợi ý) phải mở cả khung ngoài lẫn mục con.
await withPage(CASES[0], async (page) => {
  await page.goto(`${BASE_URL}#huong-dan-luu`);
  await page.evaluate(() => window.dispatchEvent(new HashChangeEvent("hashchange")));
  const open = await page.evaluate(() => [document.getElementById("huong-dan").open, document.getElementById("huong-dan-luu").open]);
  check(open[0] && open[1], `link #huong-dan-luu phải mở khung hướng dẫn và mục 6 (được: ${open})`);
});

// Trong WebView: ghép xong bấm Lưu phải hiện hướng dẫn chuyển sang Chrome, không im lặng.
await withPage(CASES[1], async (page) => {
  await page.goto(BASE_URL);
  await page.setInputFiles("#mainInput", "../Video chính.mp4");
  await page.setInputFiles("#textInput", "../Video chữ nền đen.mp4");
  await page.click("#startBtn");
  await page.waitForSelector("#resultCard:not([hidden]), #errorCard:not([hidden])", { timeout: COMPOSE_TIMEOUT_MS });
  if (!check(await page.locator("#resultCard").isVisible(), "WebView: ghép phải thành công")) return;
  await page.click("#saveBtn");
  await page.waitForSelector("#saveTip:not([hidden])", { timeout: 10_000 }).catch(() => {});
  const tip = (await page.locator("#saveTip").textContent()) || "";
  check(/không cho lưu video/i.test(tip) && /Chrome/.test(tip), `WebView: bấm Lưu phải hiện hướng dẫn mở bằng Chrome (được: "${tip}")`);
  console.log(`WebView bấm Lưu → "${tip.trim().slice(0, 90)}…"`);
});

server?.close();
if (failures.length) {
  console.error(`UI FAIL (${failures.length}):\n- ${failures.join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log("UI OK: tất cả ca đạt");
}
