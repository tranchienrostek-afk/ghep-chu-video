// Chạy: node --test test/filter.test.mjs   (các ca tích hợp cần ffmpeg/ffprobe desktop trong PATH)
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, existsSync, readFileSync } from "node:fs";
import { buildArgs, buildFilterGraph, parseDuration } from "../app/js/filter.js";

const MAIN = "../Video chính.mp4";
const TEXT = "../Video chữ nền đen.mp4";
const OUT = "test/out";
const NO_AUDIO = `${OUT}/main_noaudio.mp4`;
const FFMPEG_TIMEOUT_MS = 120_000;
const TEXT_REGION = "crop=iw:ih/5:0:0";
const NO_TEXT_REGION = "crop=iw:ih*0.6:0:ih*0.4";
const MIN_FRAME_PSNR_DB = 35;

mkdirSync(OUT, { recursive: true });

const ff = (args) => execFileSync("ffmpeg", ["-v", "error", "-y", ...args], { timeout: FFMPEG_TIMEOUT_MS });
const ffStderr = (args) => spawnSync("ffmpeg", args, { encoding: "utf8", timeout: FFMPEG_TIMEOUT_MS }).stderr;
const probe = (file, entries, stream = []) =>
  execFileSync("ffprobe", ["-v", "error", ...stream, "-show_entries", entries, "-of", "csv=p=0", file]).toString().trim();
const duration = (file) => Number(probe(file, "format=duration"));
const hasAudio = (file) => probe(file, "stream=index", ["-select_streams", "a"]) !== "";
const compose = (out, opts = {}) => ff(buildArgs({ mainName: MAIN, textName: TEXT, outName: out, ...opts }));

function ensureNoAudioMain() {
  if (!existsSync(NO_AUDIO)) ff(["-i", MAIN, "-an", "-c", "copy", NO_AUDIO]);
}

// PSNR độ sáng từng khung, so theo THỨ TỰ khung (không theo timestamp) trong một vùng ảnh.
function perFramePsnrY(a, b, crop) {
  const stats = `${OUT}/psnr_stats.txt`;
  ffStderr(["-v", "error", "-i", a, "-i", b, "-filter_complex",
    `[0:v]setpts=N/30/TB,${crop}[a];[1:v]setpts=N/30/TB,${crop}[b];[a][b]psnr=stats_file=${stats}`, "-f", "null", "-"]);
  return readFileSync(stats, "utf8").trim().split(/\r?\n/).map((line) => {
    const v = /psnr_y:([\d.]+|inf)/.exec(line)[1];
    return v === "inf" ? Infinity : Number(v);
  });
}

test("parseDuration đọc dòng Duration của ffmpeg", () => {
  assert.equal(parseDuration("  Duration: 00:00:11.10, start: 0.000000"), 11.1);
  assert.equal(parseDuration("  Duration: 01:02:03.50, start"), 3723.5);
  assert.equal(parseDuration("  Duration: N/A, bitrate: N/A"), null);
  assert.equal(parseDuration(""), null);
});

test("outline ngoài khoảng 0..3 hoặc không nguyên bị từ chối", () => {
  assert.throws(() => buildFilterGraph(-1), RangeError);
  assert.throws(() => buildFilterGraph(4), RangeError);
  assert.throws(() => buildFilterGraph(1.5), RangeError);
  assert.match(buildFilterGraph(0), /\[mA\]null\[ringGray\]/);
  assert.equal(buildFilterGraph(2).match(/dilation/g).length, 2);
});

test("quality không hợp lệ bị từ chối", () => {
  assert.throws(() => buildArgs({ mainName: "a", textName: "b", outName: "c", quality: "x" }), RangeError);
});

test("mọi khung hình khớp đúng thứ tự với video gốc (không nhân đôi/lệch nhịp)", () => {
  const out = `${OUT}/frame_accuracy.mp4`;
  compose(out, { quality: "fast" });
  const psnr = perFramePsnrY(out, MAIN, NO_TEXT_REGION);
  const bad = psnr.filter((v) => v < MIN_FRAME_PSNR_DB).length;
  assert.equal(bad, 0, `${bad}/${psnr.length} khung lệch so với video gốc`);
  assert.ok(hasAudio(out));
  assert.equal(probe(out, "stream=width,height", ["-select_streams", "v"]), "576,1024");
});

test("vùng chữ thực sự có chữ (khác hẳn video gốc)", () => {
  const out = `${OUT}/frame_accuracy.mp4`;
  if (!existsSync(out)) compose(out);
  const psnr = perFramePsnrY(out, MAIN, TEXT_REGION);
  const avg = psnr.reduce((s, v) => s + v, 0) / psnr.length;
  assert.ok(avg < 25, `vùng chữ phải khác video gốc rõ rệt (PSNR TB ${avg.toFixed(1)} dB)`);
});

test("video chính không có tiếng: không treo, thời lượng bằng video chính", () => {
  ensureNoAudioMain();
  const out = `${OUT}/edge_noaudio.mp4`;
  ff(buildArgs({ mainName: NO_AUDIO, textName: TEXT, outName: out }));
  assert.ok(Math.abs(duration(out) - duration(NO_AUDIO)) < 0.1);
});

test("video chữ nhỏ hơn và ngắn hơn: co giãn đúng, hết chữ thì chỉ còn video chính", () => {
  const small = `${OUT}/text_small_short.mp4`;
  ff(["-i", TEXT, "-vf", "scale=288:512", "-t", "5", "-an", small]);
  const out = `${OUT}/edge_small_short.mp4`;
  ff(buildArgs({ mainName: MAIN, textName: small, outName: out }));
  assert.ok(Math.abs(duration(out) - duration(MAIN)) < 0.1);
  assert.equal(probe(out, "stream=width,height", ["-select_streams", "v"]), "576,1024");
  const psnr = perFramePsnrY(out, MAIN, TEXT_REGION);
  const at = (sec) => psnr[Math.round(sec * 30)];
  assert.ok(at(2) < 25, "giây 2 phải có chữ");
  assert.ok(at(8) > MIN_FRAME_PSNR_DB, "giây 8 (sau khi video chữ hết) phải không còn chữ");
});

test("video chữ dài hơn video chính: đầu ra dài bằng video chính", () => {
  ensureNoAudioMain();
  const out = `${OUT}/edge_long_text.mp4`;
  ff(buildArgs({ mainName: NO_AUDIO, textName: TEXT, outName: out })); // TEXT dài 11.6s > 11.1s
  assert.ok(Math.abs(duration(out) - duration(NO_AUDIO)) < 0.1);
});
