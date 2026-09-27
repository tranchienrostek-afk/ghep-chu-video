// Đo thời gian trong ffmpeg.wasm: tách chi phí bộ lọc và chi phí nén x264.
// Dùng: node test/bench.mjs
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { startServer } from "./serve.mjs";

const PORT = Number(process.env.E2E_PORT || 8792);
const server = await startServer("app", PORT);
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${PORT}/`);

const main = readFileSync("../Video chính.mp4").toString("base64");
const text = readFileSync("../Video chữ nền đen.mp4").toString("base64");
const graphs = JSON.parse(process.env.BENCH_CASES || "null");

const result = await page.evaluate(async ({ main, text, graphs }) => {
  const { FFmpeg } = await import("/vendor/ffmpeg/index.js");
  const { buildFilterGraph } = await import("/js/filter.js");
  const ff = new FFmpeg();
  await ff.load({ coreURL: "/vendor/core/ffmpeg-core.js", wasmURL: "/vendor/core/ffmpeg-core.wasm" });
  const dec = (b) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
  await ff.writeFile("m.mp4", dec(main));
  await ff.writeFile("t.mp4", dec(text));
  const time = async (args) => { const t = performance.now(); const code = await ff.exec(args); return { sec: +((performance.now() - t) / 1000).toFixed(1), code }; };
  const cases = graphs || {
    decode_only: ["-i", "m.mp4", "-i", "t.mp4", "-map", "0:v", "-map", "1:v", "-f", "null", "-"],
    filter_only: ["-i", "m.mp4", "-i", "t.mp4", "-filter_complex", buildFilterGraph(1, true), "-map", "[out]", "-t", "11.1", "-f", "null", "-"],
    encode_veryfast: ["-i", "m.mp4", "-map", "0:v", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-f", "mp4", "-y", "o.mp4"],
    encode_ultrafast: ["-i", "m.mp4", "-map", "0:v", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "18", "-f", "mp4", "-y", "o.mp4"],
  };
  const out = {};
  for (const [k, args] of Object.entries(cases)) out[k] = await time(args);
  return out;
}, { main, text, graphs });

console.log(JSON.stringify(result, null, 2));
await browser.close();
server.close();
