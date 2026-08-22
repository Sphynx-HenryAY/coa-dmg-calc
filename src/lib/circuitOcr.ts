import type { Worker } from "tesseract.js";
import { normalizeCircuitScanText } from "./circuitParse";

export type OcrProgress = {
  status: string;
  progress: number;
};

let workerPromise: Promise<Worker> | null = null;

function tessCdn(pkg: string, file: string): string {
  return `https://cdn.jsdelivr.net/npm/${pkg}/${file}`;
}

async function getWorker(
  onProgress?: (info: OcrProgress) => void,
): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("chi_tra+eng", 1, {
        workerPath: tessCdn("tesseract.js@5.1.1", "dist/worker.min.js"),
        corePath: tessCdn("tesseract.js-core@5.1.1", "tesseract-core.wasm.js"),
        langPath: "https://tessdata.projectnaptha.com/4.0.0",
        logger: (m: { status?: string; progress?: number }) => {
          onProgress?.({
            status: m.status ?? "recognizing text",
            progress: typeof m.progress === "number" ? m.progress : 0,
          });
        },
      });
      await worker.setParameters({
        tessedit_pageseg_mode: "6" as import("tesseract.js").PSM,
        preserve_interword_spaces: "1",
      });
      return worker;
    })();
  }
  try {
    return await workerPromise;
  } catch (err) {
    workerPromise = null;
    throw err;
  }
}

export async function preprocessCircuitImage(file: Blob): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const scale = img.width < 700 ? 3 : img.width < 1200 ? 2 : 1.5;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const y = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
      const contrast = (y - 128) * 1.5 + 128;
      const v = contrast < 0 ? 0 : contrast > 255 ? 255 : contrast;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
    }
    ctx.putImageData(imageData, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/png");
    });
    return blob ?? file;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function recognizeCircuitImage(
  file: Blob,
  onProgress?: (info: OcrProgress) => void,
): Promise<string> {
  const prepared = await preprocessCircuitImage(file);
  const worker = await getWorker(onProgress);
  const { data } = await worker.recognize(prepared);
  return normalizeCircuitScanText(data.text ?? "");
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("無法讀取圖片"));
    img.src = url;
  });
}
