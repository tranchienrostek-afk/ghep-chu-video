// Chạy thử end-to-end như người dùng: mở app, chọn 2 video, ghép, lấy video kết quả ra so sánh.
// Dùng: node test/e2e.mjs [chromium|webkit] [fast|high]   (E2E_URL=https://... để chạy trên bản đã đăng)
import { chromium, webkit, devices } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";
import { startServer } from "./serve.mjs";

const browserName = process.argv[2] || "chromium";
const quality = process.argv[3] || "fast";
const PORT = Number(process.env.E2E_PORT || 8791);
const OUT = "test/out";
const PROCESS_TIMEOUT_MS = 15 * 60_000;

mkdirSync(OUT, { recursive: true });
// E2E_URL: chạy trên bản đã đăng (vd. GitHub Pages) thay vì máy chủ cục bộ.
const BASE_URL = process.env.E2E_URL || `http://127.0.0.1:${PORT}/`;
const server = process.env.E2E_URL ? null : await startServer("app", PORT);
const engine = browserName === "webkit" ? webkit : chromium;
const device = browserName === "webkit" ? devices["iPhone 13"] : devices["Pixel 7"];
const browser = await engine.launch();
const context = await browser.newContext({ ...device, acceptDownloads: true });
const page = await context.newPage();
const problems = [];
page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
page.on("console", (m) => { if (m.type() === "error") problems.push(`console: ${m.text()}`); });

const tag = `${browserName}_${quality}`;
try {
  await page.goto(BASE_URL);
  await page.screenshot({ path: `${OUT}/e2e_${tag}_1_open.png`, fullPage: true });

  if (!(await page.locator("#startBtn").isDisabled())) throw new Error("Nút Ghép phải bị khóa khi chưa chọn video");
  await page.setInputFiles("#mainInput", "../Video chính.mp4");
  await page.setInputFiles("#textInput", "../Video chữ nền đen.mp4");
  await page.check(`input[name=quality][value=${quality}]`, { force: true });
  if (await page.locator("#startBtn").isDisabled()) throw new Error("Nút Ghép phải mở khi đã chọn đủ 2 video");
  await page.screenshot({ path: `${OUT}/e2e_${tag}_2_picked.png`, fullPage: true });

  // Hủy ngay khi đang tải lõi: giao diện phải trở lại ngay và không tự ghép tiếp.
  await page.click("#startBtn");
  await page.click("#cancelBtn");
  if (await page.locator("#progressCard").isVisible()) throw new Error("Hủy khi đang tải lõi: thanh tiến trình vẫn hiện");
  if (await page.locator("#startBtn").isDisabled()) throw new Error("Hủy khi đang tải lõi: nút Ghép vẫn bị khóa");
  await page.waitForTimeout(8000);
  if (await page.locator("#resultCard, #progressCard, #errorCard").evaluateAll((els) => els.some((e) => !e.hidden))) {
    throw new Error("Sau khi Hủy, app vẫn tự chạy tiếp hoặc báo lỗi");
  }

  const t0 = Date.now();
  await page.click("#startBtn");
  await page.waitForSelector("#progressCard:not([hidden])");
  await page.waitForFunction(
    () => /ghép chữ/i.test(document.getElementById("progressTitle").textContent) || !document.getElementById("errorCard").hidden,
    null, { timeout: 180_000 });
  if (await page.locator("#errorCard").isVisible()) {
    throw new Error(`App báo lỗi khi tải lõi: ${await page.textContent("#errorMsg")}`);
  }
  const tLoaded = Date.now();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}/e2e_${tag}_3_progress.png` });

  await page.waitForSelector("#resultCard:not([hidden]), #errorCard:not([hidden])", { timeout: PROCESS_TIMEOUT_MS });
  const tDone = Date.now();
  if (await page.locator("#errorCard").isVisible()) {
    throw new Error(`App báo lỗi: ${await page.textContent("#errorMsg")}\n${await page.textContent("#errorLog")}`);
  }
  await page.screenshot({ path: `${OUT}/e2e_${tag}_4_result.png`, fullPage: true });

  const b64 = await page.evaluate(async () => {
    const buf = new Uint8Array(await (await fetch(document.getElementById("resultVideo").src)).arrayBuffer());
    let s = "";
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return btoa(s);
  });
  const outFile = `${OUT}/e2e_${tag}.mp4`;
  writeFileSync(outFile, Buffer.from(b64, "base64"));

  let downloadName = null;
  if (browserName === "chromium") {
    const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 15_000 }), page.click("#saveBtn")]);
    downloadName = dl.suggestedFilename();
    await dl.saveAs(`${OUT}/e2e_${tag}_download.mp4`);
    await page.screenshot({ path: `${OUT}/e2e_${tag}_5_saved.png`, fullPage: true });
  }

  console.log(JSON.stringify({
    tag,
    loadEngineSec: (tLoaded - t0) / 1000,
    composeSec: (tDone - tLoaded) / 1000,
    resultInfo: await page.textContent("#resultInfo"),
    outFile,
    downloadName,
    problems,
  }, null, 2));
} catch (err) {
  await page.screenshot({ path: `${OUT}/e2e_${tag}_FAIL.png`, fullPage: true }).catch(() => {});
  console.error("E2E FAIL:", err.message, "\nproblems:", problems);
  process.exitCode = 1;
} finally {
  await browser.close();
  server?.close();
}
