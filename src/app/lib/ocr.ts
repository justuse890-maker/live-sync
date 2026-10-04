/**
 * ocr.ts — fully on-device receipt OCR.
 *
 * Engine: Tesseract (via tesseract.js 7 + tesseract.js-core 7), Apache-2.0,
 * free for commercial use. Every file the engine needs is bundled in
 * /public/ocr, so scanning works offline and no image ever leaves the phone.
 *
 * Why the old scanner failed: tesseract.js by default downloads its worker,
 * WebAssembly core and language data from public CDNs at scan time. Inside the
 * Android app (and offline, or behind restricted networks) those downloads fail,
 * so every scan ended in "Couldn't read this image".
 */
import { createWorker, OEM, PSM, type Worker } from "tesseract.js";

/** WebAssembly SIMD support check (same probe module as wasm-feature-detect). */
const simd = async () => {
  try {
    return WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]));
  } catch { return false; }
};

export type OcrLang = "eng" | "eng+hin";
export type OcrProgress = { stage: string; pct: number };
export type OcrResult = { text: string; confidence: number; lang: OcrLang; ms: number };

const base = () => new URL(import.meta.env.BASE_URL || "/", window.location.href).href.replace(/\/$/, "");

let worker: Worker | null = null;
let workerLang: OcrLang | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let progressCb: ((p: OcrProgress) => void) | null = null;

const STAGES: Record<string, string> = {
  "loading tesseract core": "Starting on-device OCR engine…",
  "initializing tesseract": "Starting on-device OCR engine…",
  "loading language traineddata": "Loading language model…",
  "initializing api": "Preparing…",
  "recognizing text": "Reading receipt text…",
};

async function getWorker(lang: OcrLang): Promise<Worker> {
  if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
  if (worker && workerLang === lang) return worker;
  if (worker) { await worker.terminate().catch(() => {}); worker = null; }

  const hasSimd = await simd().catch(() => false);
  const root = base();
  worker = await createWorker(lang.split("+"), OEM.LSTM_ONLY, {
    workerPath: `${root}/ocr/worker.min.js`,
    corePath: `${root}/ocr/core/${hasSimd ? "tesseract-core-simd-lstm.wasm.js" : "tesseract-core-lstm.wasm.js"}`,
    langPath: `${root}/ocr/lang`,
    gzip: true,
    logger: (m: { status: string; progress: number }) => {
      progressCb?.({ stage: STAGES[m.status] ?? "Working…", pct: Math.round((m.progress || 0) * 100) });
    },
    errorHandler: (e: unknown) => console.warn("[ocr] worker error", e),
  });
  await worker.setParameters({
    // One uniform block keeps "Item ..... 240.00" on the same line. Auto/column
    // modes split the right-hand amount column off and lose the prices.
    tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
    preserve_interword_spaces: "1",
    user_defined_dpi: "300",
  });
  workerLang = lang;
  return worker;
}

function scheduleIdleShutdown() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(async () => {
    await worker?.terminate().catch(() => {});
    worker = null; workerLang = null;
  }, 90_000); // free ~100 MB of memory when the user is done scanning
}

/**
 * Prepare a phone photo for OCR: honour EXIF rotation, scale so text is
 * ~300 DPI-equivalent, convert to grayscale and stretch contrast (auto-levels).
 * Tesseract does its own binarisation, so we deliberately avoid hard thresholds
 * that destroy faint thermal-paper print.
 */
export async function preprocess(file: Blob): Promise<{ blob: Blob; previewUrl: string }> {
  let bmp: ImageBitmap | HTMLImageElement;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
  } catch {
    bmp = await new Promise<HTMLImageElement>((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = URL.createObjectURL(file);
    });
  }
  const w0 = (bmp as any).width, h0 = (bmp as any).height;
  const longSide = Math.max(w0, h0);
  const target = Math.min(2000, Math.max(1400, longSide)); // upscale tiny shots, cap huge ones
  const scale = target / longSide;
  const w = Math.round(w0 * scale), h = Math.round(h0 * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { blob: file, previewUrl: URL.createObjectURL(file) };
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp as CanvasImageSource, 0, 0, w, h);

  try {
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    const hist = new Uint32Array(256);
    const gray = new Uint8ClampedArray(w * h);
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
      gray[p] = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) | 0;
    }
    // 3×3 median filter: removes paper texture / camera speckle that Tesseract
    // otherwise reads as stray characters (biggest accuracy gain on phone photos).
    const med = median3x3(gray, w, h);
    for (let p = 0; p < med.length; p++) hist[med[p]]++;
    gray.set(med);
    // 1st / 99th percentile → black / white
    const total = w * h; let acc = 0, lo = 0, hi = 255;
    for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= total * 0.01) { lo = v; break; } }
    acc = 0;
    for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc >= total * 0.01) { hi = v; break; } }
    const range = Math.max(1, hi - lo);
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
      const v = ((gray[p] - lo) * 255) / range;
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    ctx.putImageData(img, 0, 0);
  } catch (e) {
    console.warn("[ocr] contrast step skipped", e);
  }

  const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b || file), "image/png"));
  return { blob, previewUrl: URL.createObjectURL(blob) };
}

function median3x3(src: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(src.length);
  const v = new Uint8Array(9);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let k = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy < 0 ? 0 : y + dy >= h ? h - 1 : y + dy;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx < 0 ? 0 : x + dx >= w ? w - 1 : x + dx;
          v[k++] = src[yy * w + xx];
        }
      }
      // insertion sort of 9 values
      for (let i = 1; i < 9; i++) { const t = v[i]; let j = i - 1; while (j >= 0 && v[j] > t) { v[j + 1] = v[j]; j--; } v[j + 1] = t; }
      out[y * w + x] = v[4];
    }
  }
  return out;
}

/** Run OCR on a prepared image (on device). */
export async function recognize(image: Blob, lang: OcrLang, onProgress?: (p: OcrProgress) => void): Promise<OcrResult> {
  const t0 = performance.now();
  progressCb = onProgress ?? null;
  try {
    const w = await getWorker(lang);
    const { data } = await w.recognize(image);
    const text = (data.text || "").trim();
    const conf = data.confidence ?? 0;
    return { text, confidence: Math.round(conf), lang, ms: Math.round(performance.now() - t0) };
  } finally {
    progressCb = null;
    scheduleIdleShutdown();
  }
}
