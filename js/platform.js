// Nhận diện thiết bị/trình duyệt và lưu file kết quả theo cách phù hợp từng máy.

const ua = navigator.userAgent || "";

export const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
export const isAndroid = /Android/i.test(ua);
export const isStandalone =
  window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true;

// Trình duyệt nhúng trong app (Zalo, Messenger, Facebook…) không lưu được file do trang tự tạo.
// Nhận diện theo tên app VÀ theo dấu hiệu chung, vì không phải app nào cũng ghi tên vào User-Agent:
//  - Android WebView: có "; wv)" hoặc "Version/x.y Chrome/" (Chrome thật không có "Version/").
//  - iOS WebView: không có "Safari/" (Safari, Chrome iOS đều có; web app đã cài thì bỏ qua).
const NAMED_IN_APP = /Zalo|FBAN|FBAV|FB_IAB|FBIOS|Messenger|Instagram|Line\/|TikTok|musical_ly|Snapchat|Twitter/i;
const isAndroidWebView = isAndroid && (/; wv\)/.test(ua) || /Version\/[\d.]+ Chrome\//.test(ua));
const isIOSWebView = isIOS && !isStandalone && !/Safari\//.test(ua);
export const isInAppBrowser = NAMED_IN_APP.test(ua) || isAndroidWebView || isIOSWebView;

/** Link intent mở đúng trang này trong Chrome (Android). */
export function chromeIntentUrl(loc = window.location) {
  return `intent://${loc.host}${loc.pathname}${loc.search}#Intent;scheme=https;package=com.android.chrome;end`;
}

/** Sao chép link trang hiện tại. @returns {Promise<boolean>} */
export async function copyPageLink() {
  const url = window.location.href.split("#")[0];
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    const input = document.createElement("input");
    input.value = url;
    input.setAttribute("readonly", "");
    document.body.appendChild(input);
    input.select();
    const ok = document.execCommand?.("copy") ?? false;
    input.remove();
    return ok;
  }
}

/** @returns {"ios"|"android"|"other"} */
export function platformName() {
  if (isIOS) return "ios";
  if (isAndroid) return "android";
  return "other";
}

function canShareFile(file) {
  try {
    return typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

/** Tên file duy nhất theo thời gian, ví dụ video_ghep_chu_20260927_1905.mp4 */
export function outputFileName(now = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}_${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
  return `video_ghep_chu_${stamp}.mp4`;
}

export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Mở bảng chia sẻ của hệ điều hành (iPhone: có mục "Lưu video" để vào app Ảnh).
 * @returns {Promise<"shared"|"cancelled"|"unsupported">}
 */
export async function shareFile(file) {
  if (!canShareFile(file)) return "unsupported";
  try {
    await navigator.share({ files: [file], title: file.name });
    return "shared";
  } catch (err) {
    if (err?.name === "AbortError") return "cancelled";
    throw err;
  }
}

export function supportsFileShare(file) {
  return canShareFile(file);
}

/** Giữ màn hình sáng khi đang xử lý (nếu trình duyệt hỗ trợ). */
export async function keepScreenOn() {
  try {
    if ("wakeLock" in navigator) return await navigator.wakeLock.request("screen");
  } catch {
    // Không hỗ trợ hoặc bị từ chối: vẫn xử lý bình thường, hướng dẫn đã nhắc giữ màn hình sáng.
  }
  return null;
}
