// Free, fully client-side OCR using Tesseract.js — no API key, no server,
// no per-use cost. Runs entirely in the browser via WebAssembly.

import { createWorker } from 'tesseract.js';

/**
 * Runs OCR on an image file and returns the raw extracted text.
 * onProgress receives a 0–100 number.
 */
export async function ocrImage(file, onProgress) {
  const worker = await createWorker('eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text' && onProgress) {
        onProgress(Math.round((m.progress || 0) * 100));
      }
    },
  });
  try {
    const { data } = await worker.recognize(file);
    return data.text || '';
  } finally {
    await worker.terminate();
  }
}
