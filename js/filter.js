// Dựng lệnh ffmpeg ghép "video chữ trắng nền đen" lên video chính.
//
// Thuật toán giống `Chương trình xử lý.py`:
//   1. mask = độ sáng video chữ (nền đen = 0 → giữ nguyên video chính).
//   2. Viền tối: mask dãn nở (dilation) → trộn lớp đen vào vùng quanh chữ.
//   3. Chữ trắng: trộn lớp trắng theo mask gốc (tương đương Screen, giữ anti-aliasing).
//
// Khác bản desktop: trộn trực tiếp trên YUV thay vì RGB (gbrp). Phép trộn theo mask là
// nội suy tuyến tính nên kết quả tương đương, nhưng trong ffmpeg.wasm nhanh hơn ~4.5 lần
// (bộ lọc 101s → 22s cho video 11s). Mask cho kênh màu được thu nhỏ 1/2 (mergeplanes).
//
// Bổ sung:
//  - scale2ref: tự co giãn video chữ theo kích thước video chính.
//  - Video chữ được đặt (overlay) lên nền đen tạo từ chính video chính trước khi làm mask.
//    Lý do: video chữ thường có nhịp khung không đều (VFR); maskedmerge xuất một khung cho
//    MỌI mốc thời gian của mọi input nên hình bị nhân đôi/lệch nhịp. overlay chỉ xuất khung theo
//    video chính → mọi lớp cùng lưới thời gian, đầu ra khớp từng khung với video gốc.
//    overlay eof_action=pass còn làm: video chữ ngắn hơn → hết chữ; dài hơn → cắt theo video chính.

export const MAX_OUTLINE = 3;

export const QUALITY_PRESETS = Object.freeze({
  fast: Object.freeze({ preset: "superfast", crf: "18" }),
  high: Object.freeze({ preset: "medium", crf: "16" }),
});

// Đen/trắng theo dải TV (16–235) của yuv420p, khớp với cách video điện thoại được lưu.
const Y_BLACK = 16;
const Y_WHITE = 235;
const UV_NEUTRAL = 128;

function validateOutline(outline) {
  if (!Number.isInteger(outline) || outline < 0 || outline > MAX_OUTLINE) {
    throw new RangeError(`outline phải là số nguyên từ 0 đến ${MAX_OUTLINE}`);
  }
  return outline;
}

function isValidDuration(sec) {
  return typeof sec === "number" && Number.isFinite(sec) && sec > 0;
}

// Biến một mask xám (gray) thành mask yuv420p: Y giữ nguyên, U/V là bản thu nhỏ 1/2.
function grayToYuvMask(input, output) {
  return [
    `[${input}]split=2[${output}_y][${output}_c]`,
    `[${output}_c]scale=iw/2:ih/2:flags=area,split=2[${output}_u][${output}_v]`,
    `[${output}_y][${output}_u][${output}_v]mergeplanes=0x001020:yuv420p[${output}]`,
  ];
}

/**
 * @param {number} outline độ dày viền tối (px), 0 = không viền
 * @returns {string}
 */
export function buildFilterGraph(outline) {
  const px = validateOutline(outline);
  const dilate = px > 0 ? Array(px).fill("dilation=coordinates=255").join(",") : "null";
  const black = `lutyuv=y=${Y_BLACK}:u=${UV_NEUTRAL}:v=${UV_NEUTRAL}`;

  return [
    "[0:v]setpts=PTS-STARTPTS,format=yuv420p,split=4[base][k0][w0][c0]",
    `[k0]${black}[blk]`,
    `[w0]lutyuv=y=${Y_WHITE}:u=${UV_NEUTRAL}:v=${UV_NEUTRAL}[wht]`,
    `[c0]${black}[canvas0]`,
    "[1:v]setpts=PTS-STARTPTS,format=yuv420p[ov0]",
    "[ov0][canvas0]scale2ref=flags=lanczos[ov1][canvas1]",
    "[canvas1][ov1]overlay=eof_action=pass:format=yuv420[ovSynced]",
    "[ovSynced]format=gray,split=2[mA][mB]",
    `[mA]${dilate}[ringGray]`,
    ...grayToYuvMask("ringGray", "ring"),
    ...grayToYuvMask("mB", "mask"),
    "[base][blk][ring]maskedmerge[o1]",
    "[o1][wht][mask]maskedmerge,format=yuv420p[out]",
  ].join(";");
}

/**
 * @param {{mainName: string, textName: string, outName: string,
 *          outline?: number, quality?: "fast"|"high"}} opts
 * @returns {string[]}
 */
export function buildArgs({ mainName, textName, outName, outline = 1, quality = "fast" }) {
  const q = QUALITY_PRESETS[quality];
  if (!q) throw new RangeError(`quality không hợp lệ: ${quality}`);

  return [
    "-i", mainName,
    "-i", textName,
    "-filter_complex", buildFilterGraph(outline),
    "-map", "[out]",
    "-map", "0:a?",
    "-c:v", "libx264",
    "-preset", q.preset,
    "-crf", q.crf,
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "192k",
    "-movflags", "+faststart",
    "-shortest",
    outName,
  ];
}

/**
 * Đọc thời lượng từ log của `ffmpeg -i <file>` (dòng "Duration: 00:00:11.10").
 * @param {string} log
 * @returns {number|null} giây, hoặc null nếu không đọc được
 */
export function parseDuration(log) {
  const m = /Duration:\s*(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/.exec(log);
  if (!m) return null;
  const sec = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  return isValidDuration(sec) ? sec : null;
}
