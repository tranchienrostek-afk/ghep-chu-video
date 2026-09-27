import { loadEngine, composeVideo, cancelEngine, recentLog } from "./engine.js";
import {
  platformName, isInAppBrowser, isStandalone, isIOS, isAndroid, chromeIntentUrl, copyPageLink,
  outputFileName, downloadBlob, shareFile, supportsFileShare, keepScreenOn,
} from "./platform.js";

const LARGE_FILE_BYTES = 200 * 1024 * 1024;
const $ = (id) => document.getElementById(id);

const ui = {
  mainInput: $("mainInput"), textInput: $("textInput"),
  mainName: $("mainName"), textName: $("textName"),
  mainPreview: $("mainPreview"), textPreview: $("textPreview"),
  startBtn: $("startBtn"), startHint: $("startHint"),
  progressCard: $("progressCard"), progressTitle: $("progressTitle"),
  bar: $("bar"), barFill: $("barFill"), progressPct: $("progressPct"), elapsed: $("elapsed"),
  cancelBtn: $("cancelBtn"),
  resultCard: $("resultCard"), resultVideo: $("resultVideo"), resultInfo: $("resultInfo"),
  saveBtn: $("saveBtn"), shareBtn: $("shareBtn"), saveTip: $("saveTip"), againBtn: $("againBtn"),
  errorCard: $("errorCard"), errorMsg: $("errorMsg"), errorLog: $("errorLog"), retryBtn: $("retryBtn"),
};

let resultFile = null;
let resultUrl = null;
let timer = null;
let wakeLock = null;
// Mỗi lần bấm Ghép tăng runId; Hủy cũng tăng để vô hiệu lượt đang chạy (kể cả khi đang tải lõi).
let runId = 0;

// "#t=0.1" buộc Safari/Chrome vẽ khung hình đầu làm ảnh xem trước thay vì khung đen.
const withPoster = (url) => `${url}#t=0.1`;
const formatMB = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const formatClock = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
const selectedValue = (name) => document.querySelector(`input[name="${name}"]:checked`).value;

function showOnly(card) {
  for (const c of [ui.progressCard, ui.resultCard, ui.errorCard]) c.hidden = c !== card;
}

function setInputsLocked(locked) {
  for (const el of document.querySelectorAll("#stepPick input, .seg input")) el.disabled = locked;
  ui.startBtn.disabled = locked || !(ui.mainInput.files[0] && ui.textInput.files[0]);
}

// ---------- Chọn video ----------

function bindPicker(input, nameEl, previewEl) {
  input.addEventListener("change", () => {
    const file = input.files[0];
    const label = input.closest(".picker");
    if (previewEl.dataset.url) URL.revokeObjectURL(previewEl.dataset.url);
    if (!file) {
      nameEl.textContent = "Chưa chọn";
      label.classList.remove("chosen");
      previewEl.hidden = true;
      previewEl.removeAttribute("src");
      delete previewEl.dataset.url;
    } else {
      const warn = file.size > LARGE_FILE_BYTES ? " — video lớn, có thể chậm hoặc thiếu bộ nhớ" : "";
      nameEl.textContent = `✓ ${file.name} (${formatMB(file.size)})${warn}`;
      label.classList.add("chosen");
      previewEl.dataset.url = URL.createObjectURL(file);
      previewEl.src = withPoster(previewEl.dataset.url);
      previewEl.hidden = false;
    }
    updateStartState();
  });
}

function updateStartState() {
  const ready = Boolean(ui.mainInput.files[0] && ui.textInput.files[0]);
  ui.startBtn.disabled = !ready;
  ui.startHint.hidden = ready;
}

// ---------- Tiến trình ----------

function setProgress(title, ratio) {
  ui.progressTitle.textContent = title;
  const known = typeof ratio === "number";
  ui.bar.classList.toggle("indeterminate", !known);
  ui.barFill.style.width = known ? `${Math.round(ratio * 100)}%` : "";
  ui.progressPct.textContent = known ? `${Math.round(ratio * 100)}%` : "…";
  if (known) ui.bar.setAttribute("aria-valuenow", String(Math.round(ratio * 100)));
}

function startTimer() {
  const t0 = Date.now();
  ui.elapsed.textContent = "0:00";
  timer = setInterval(() => { ui.elapsed.textContent = formatClock((Date.now() - t0) / 1000); }, 1000);
}

function stopTimer() {
  clearInterval(timer);
  timer = null;
}

// ---------- Ghép ----------

async function start() {
  const mainFile = ui.mainInput.files[0];
  const textFile = ui.textInput.files[0];
  if (!mainFile || !textFile) return;

  const myRun = ++runId;
  const isCurrent = () => myRun === runId;
  clearResult();
  setInputsLocked(true);
  showOnly(ui.progressCard);
  startTimer();
  wakeLock = await keepScreenOn();

  try {
    setProgress("Đang tải bộ xử lý (chỉ lần đầu, ~32 MB)…", 0);
    await loadEngine((r) => {
      if (isCurrent()) setProgress("Đang tải bộ xử lý (chỉ lần đầu, ~32 MB)…", r);
    });
    if (!isCurrent()) return;

    setProgress("Đang đọc video…", null);
    const t0 = Date.now();
    const data = await composeVideo({
      mainFile,
      textFile,
      outline: Number(selectedValue("outline")),
      quality: selectedValue("quality"),
      onProgress: (r) => setProgress("Đang ghép chữ vào video…", r),
    });
    if (isCurrent()) showResult(data, (Date.now() - t0) / 1000);
  } catch (err) {
    if (isCurrent()) showError(err);
  } finally {
    if (isCurrent()) finishRun();
  }
}

function finishRun() {
  stopTimer();
  setInputsLocked(false);
  updateStartState();
  wakeLock?.release?.().catch(() => {});
  wakeLock = null;
}

function cancel() {
  runId += 1;
  cancelEngine();
  showOnly(null);
  finishRun();
}

function showResult(data, seconds) {
  resultFile = new File([data], outputFileName(), { type: "video/mp4" });
  resultUrl = URL.createObjectURL(resultFile);
  ui.resultVideo.src = withPoster(resultUrl);
  ui.resultInfo.textContent = `${resultFile.name} · ${formatMB(resultFile.size)} · ghép trong ${formatClock(seconds)}`;
  ui.shareBtn.hidden = isIOS || !supportsFileShare(resultFile);
  ui.saveTip.hidden = true;
  showOnly(ui.resultCard);
  ui.resultCard.scrollIntoView({ behavior: "smooth", block: "start" });
}

function clearResult() {
  if (resultUrl) URL.revokeObjectURL(resultUrl);
  resultUrl = null;
  resultFile = null;
  ui.resultVideo.removeAttribute("src");
  ui.resultVideo.load();
}

function friendlyError(err) {
  const msg = String(err?.message || err || "");
  if (/memory|OOM|Out of bounds|allocation/i.test(msg)) {
    return "Máy không đủ bộ nhớ cho video này. Hãy đóng bớt app khác, chọn chất lượng Nhanh hoặc dùng video ngắn hơn.";
  }
  if (/fetch|network|Failed to load|NetworkError/i.test(msg)) {
    return "Không tải được bộ xử lý. Kiểm tra kết nối mạng rồi bấm Thử lại.";
  }
  if (/mã lỗi/.test(msg)) {
    return "Không đọc được một trong hai video. Hãy kiểm tra lại video (mở thử trong app Ảnh/Thư viện) hoặc chọn video khác.";
  }
  return `Có lỗi xảy ra: ${msg || "không rõ nguyên nhân"}. Bấm Thử lại, hoặc gửi phần chi tiết kỹ thuật cho người hỗ trợ.`;
}

function showError(err) {
  ui.errorMsg.textContent = friendlyError(err);
  ui.errorLog.textContent = `${err?.stack || err}\n\n${recentLog()}`;
  showOnly(ui.errorCard);
  ui.errorCard.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---------- Lưu / chia sẻ ----------

function showSaveTip(html) {
  ui.saveTip.innerHTML = html;
  ui.saveTip.hidden = false;
}

const IN_APP_SAVE_TIP =
  "<b>Trình duyệt trong Zalo/Messenger không cho lưu video.</b> Bấm <b>Mở bằng Chrome</b> (iPhone: mở bằng <b>Safari</b>) " +
  "ở khung cảnh báo phía trên, rồi chọn lại 2 video và ghép lại (khoảng 1 phút).";

async function saveInsideInAppBrowser() {
  // Một số app có hỗ trợ bảng chia sẻ; thử trước, không được thì hướng dẫn sang trình duyệt thật.
  try {
    const r = await shareFile(resultFile);
    if (r === "shared" || r === "cancelled") return;
  } catch {
    // Không chia sẻ được: rơi xuống hướng dẫn bên dưới.
  }
  showSaveTip(IN_APP_SAVE_TIP);
  $("inAppWarning").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function save() {
  if (!resultFile) return;
  if (isInAppBrowser) {
    await saveInsideInAppBrowser();
    return;
  }
  if (isIOS) {
    try {
      const r = await shareFile(resultFile);
      if (r === "shared" || r === "cancelled") {
        showSaveTip('Trong bảng chia sẻ, chọn <b>Lưu video</b> → video vào app <b>Ảnh</b>. Không thấy? Chọn <b>Lưu vào Tệp</b>. <a href="#huong-dan-luu">Xem hướng dẫn</a>');
        return;
      }
    } catch (err) {
      showSaveTip(`Không mở được bảng chia sẻ (${err?.message || err}). Đang thử tải trực tiếp…`);
    }
    downloadBlob(resultFile, resultFile.name);
    showSaveTip('Safari đang tải file. Bấm biểu tượng <b>↓</b> (Tải về) trên thanh địa chỉ → chạm video → <b>Chia sẻ</b> → <b>Lưu video</b>. <a href="#huong-dan-luu">Xem hướng dẫn</a>');
    return;
  }
  downloadBlob(resultFile, resultFile.name);
  showSaveTip(`Đã tải về thư mục <b>Tải xuống (Download)</b> với tên <code>${resultFile.name}</code>. Mở app <b>Tệp/Files</b> hoặc <b>Google Photos → Thư viện → Download</b>. <a href="#huong-dan-luu">Xem hướng dẫn</a>`);
}

async function share() {
  if (!resultFile) return;
  try {
    await shareFile(resultFile);
  } catch (err) {
    showSaveTip(`Không chia sẻ được (${err?.message || err}). Hãy bấm <b>Lưu video về máy</b> rồi gửi file từ thư mục Tải xuống.`);
  }
}

// ---------- Hướng dẫn theo hệ điều hành ----------

function selectGuideOS(os) {
  for (const tab of document.querySelectorAll(".tabs [role=tab]")) {
    tab.setAttribute("aria-selected", String(tab.dataset.os === os));
  }
  for (const el of document.querySelectorAll(".os-ios")) el.hidden = os !== "ios";
  for (const el of document.querySelectorAll(".os-android")) el.hidden = os !== "android";
}

// Mở mục hướng dẫn theo #id (kể cả khung "Hướng dẫn sử dụng" bao ngoài đang đóng).
function openGuideTarget() {
  let node = document.getElementById(location.hash.slice(1));
  while (node) {
    if (node.tagName === "DETAILS") node.open = true;
    node = node.parentElement;
  }
}

function setupInAppWarning() {
  const box = $("inAppWarning");
  box.hidden = !isInAppBrowser;
  if (!isInAppBrowser) return;
  const openChrome = $("openChromeBtn");
  openChrome.hidden = !isAndroid;
  openChrome.addEventListener("click", () => { window.location.href = chromeIntentUrl(); });
  $("copyLinkBtn").addEventListener("click", async () => {
    const ok = await copyPageLink();
    $("copyLinkHint").textContent = ok
      ? `Đã sao chép link. Mở ${isIOS ? "Safari" : "Chrome"}, chạm vào thanh địa chỉ, dán link rồi bấm Đi.`
      : `Không sao chép tự động được. Link: ${window.location.href.split("#")[0]}`;
  });
}

// ---------- Khởi động ----------

function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
  navigator.serviceWorker.register("sw.js").catch(() => {
    // Không có service worker vẫn dùng được, chỉ mất khả năng chạy offline.
  });
}

function init() {
  bindPicker(ui.mainInput, ui.mainName, ui.mainPreview);
  bindPicker(ui.textInput, ui.textName, ui.textPreview);
  ui.startBtn.addEventListener("click", start);
  ui.cancelBtn.addEventListener("click", cancel);
  ui.saveBtn.addEventListener("click", save);
  ui.shareBtn.addEventListener("click", share);
  ui.retryBtn.addEventListener("click", start);
  ui.againBtn.addEventListener("click", () => {
    clearResult();
    showOnly(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  for (const tab of document.querySelectorAll(".tabs [role=tab]")) {
    tab.addEventListener("click", () => selectGuideOS(tab.dataset.os));
  }
  window.addEventListener("hashchange", openGuideTarget);
  document.addEventListener("click", (e) => {
    // Bấm lại cùng một link #huong-dan-… không đổi hash → tự mở mục tương ứng.
    const a = e.target.closest?.('a[href^="#huong-dan"]');
    if (a && a.getAttribute("href") === location.hash) openGuideTarget();
  });

  const os = platformName();
  selectGuideOS(os === "android" ? "android" : "ios");
  document.body.classList.add(os === "android" ? "is-android" : "is-ios");
  setupInAppWarning();
  $("installBanner").hidden = isStandalone || isInAppBrowser || os === "other";
  updateStartState();
  registerServiceWorker();
}

init();
