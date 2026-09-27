// Bọc ffmpeg.wasm: nạp lõi (có tiến độ), đọc thời lượng, chạy ghép chữ, hủy.
import { FFmpeg } from "../vendor/ffmpeg/index.js";
import { buildArgs, parseDuration } from "./filter.js";

const CORE_URL = new URL("../vendor/core/ffmpeg-core.js", import.meta.url).href;
const WASM_URL = new URL("../vendor/core/ffmpeg-core.wasm", import.meta.url).href;
const WASM_BYTES_ESTIMATE = 32_232_419;
const OUT_NAME = "ket_qua.mp4";
const LOG_TAIL_LINES = 200;

let ffmpeg = null;
let loading = null;
const logTail = [];
let logListener = null;

function onLog({ message }) {
  logTail.push(message);
  if (logTail.length > LOG_TAIL_LINES) logTail.shift();
  if (logListener) logListener(message);
}

/** @returns {string} các dòng log gần nhất để hiển thị khi lỗi */
export function recentLog() {
  return logTail.join("\n");
}

/**
 * Tải file wasm có báo tiến độ, trả về blob URL.
 * Không dùng downloadWithProgress của @ffmpeg/util: khi máy chủ nén gzip (GitHub Pages),
 * Content-Length là kích thước bản nén (10 MB) còn số byte nhận được là bản giải nén (32 MB);
 * hàm đó coi là tải hỏng rồi đọc lại body đã đọc → lỗi "body stream already read".
 * @param {(ratio: number) => void} onProgress
 * @returns {Promise<string>}
 */
async function fetchWasmBlobURL(onProgress) {
  const res = await fetch(WASM_URL);
  if (!res.ok) throw new Error(`Không tải được bộ xử lý (HTTP ${res.status}).`);

  const declared = Number(res.headers.get("Content-Length"));
  const isCompressed = Boolean(res.headers.get("Content-Encoding"));
  const total = !isCompressed && declared > 0 ? declared : WASM_BYTES_ESTIMATE;

  const reader = res.body?.getReader();
  if (!reader) {
    const buf = await res.arrayBuffer();
    onProgress(1);
    return URL.createObjectURL(new Blob([buf], { type: "application/wasm" }));
  }

  const chunks = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    onProgress(Math.min(1, received / total));
  }
  onProgress(1);
  return URL.createObjectURL(new Blob(chunks, { type: "application/wasm" }));
}

/**
 * Nạp lõi ffmpeg (~32 MB, lần đầu cần mạng; sau đó lấy từ bộ nhớ đệm).
 * @param {(ratio: number) => void} onProgress
 */
export function loadEngine(onProgress) {
  if (ffmpeg?.loaded) return Promise.resolve();
  if (loading) return loading;

  loading = (async () => {
    const instance = new FFmpeg();
    instance.on("log", onLog);
    const wasmURL = await fetchWasmBlobURL(onProgress);
    await instance.load({ coreURL: CORE_URL, wasmURL });
    ffmpeg = instance;
  })();

  return loading.finally(() => { loading = null; });
}

function extOf(file, fallback) {
  const m = /\.([a-z0-9]{2,4})$/i.exec(file.name || "");
  return m ? m[1].toLowerCase() : fallback;
}

async function probeDuration(ff, name) {
  const lines = [];
  logListener = (msg) => lines.push(msg);
  try {
    await ff.exec(["-hide_banner", "-i", name]); // không có output -> mã lỗi là bình thường
  } finally {
    logListener = null;
  }
  return parseDuration(lines.join("\n"));
}

function parseTimeSec(line) {
  const m = /time=\s*(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/.exec(line);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
}

/**
 * Ghép video chữ lên video chính.
 * @param {{mainFile: File, textFile: File, outline: number, quality: "fast"|"high",
 *          onProgress: (ratio: number|null) => void}} opts  ratio=null khi chưa biết thời lượng
 * @returns {Promise<Uint8Array>} dữ liệu mp4 kết quả
 */
export async function composeVideo({ mainFile, textFile, outline, quality, onProgress }) {
  const ff = ffmpeg; // giữ tham chiếu riêng: cancelEngine() có thể đặt ffmpeg = null giữa chừng
  if (!ff?.loaded) throw new Error("Bộ xử lý chưa được nạp.");

  const mainName = `chinh.${extOf(mainFile, "mp4")}`;
  const textName = `chu.${extOf(textFile, "mp4")}`;
  await ff.writeFile(mainName, new Uint8Array(await mainFile.arrayBuffer()));
  await ff.writeFile(textName, new Uint8Array(await textFile.arrayBuffer()));

  try {
    const durationSec = await probeDuration(ff, mainName); // chỉ dùng để tính % tiến độ
    logListener = (line) => {
      const t = parseTimeSec(line);
      if (t === null) return;
      onProgress(durationSec ? Math.min(1, t / durationSec) : null);
    };

    const code = await ff.exec(buildArgs({ mainName, textName, outName: OUT_NAME, outline, quality }));
    if (code !== 0) throw new Error(`ffmpeg dừng với mã lỗi ${code}.`);

    const data = await ff.readFile(OUT_NAME);
    if (!(data instanceof Uint8Array) || data.byteLength === 0) {
      throw new Error("Không tạo được video kết quả.");
    }
    return data;
  } finally {
    logListener = null;
    await Promise.allSettled([mainName, textName, OUT_NAME].map(async (n) => ff.deleteFile(n)));
  }
}

/** Dừng ngay quá trình đang chạy. Lần xử lý sau sẽ nạp lại lõi (từ bộ nhớ đệm). */
export function cancelEngine() {
  if (!ffmpeg) return;
  ffmpeg.terminate();
  ffmpeg = null;
}
