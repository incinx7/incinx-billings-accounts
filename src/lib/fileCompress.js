// Compresses an uploaded bill (image or PDF) down to a small JPEG data URL
// before it gets stored in the DB blob. Keeps every bill copy lightweight
// regardless of how big the original photo/scan was.

import { pdfPagesToImage } from './pdfToImage.js';

/**
 * Loads a File/Blob into an HTMLImageElement.
 */
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

/**
 * Draws an image onto a canvas, scaled down so its longest side is at most
 * maxDim, and returns a compressed JPEG data URL.
 */
function drawToJpeg(img, { maxDim, maxWidth }, quality) {
  // Photos are limited by their longest side; stitched multi-page PDFs are
  // very tall, so those are limited by width instead (else text turns to mush).
  const scale = maxWidth
    ? Math.min(1, maxWidth / img.width)
    : Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  // White background first — JPEGs have no transparency, and scanned bills
  // are often PNGs/screenshots with a transparent or off-white background.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  return canvas.toDataURL('image/jpeg', quality);
}

function dataUrlSizeKB(dataUrl) {
  const base64 = dataUrl.split(',')[1] || '';
  return Math.round((base64.length * 3) / 4 / 1024);
}

/**
 * Compresses a bill file (image or PDF) into a small JPEG data URL.
 * PDFs: up to the first 3 pages are rendered, stitched top-to-bottom into
 * one image, then compressed hard (target ~250 KB total) so the DB blob
 * stays light. Photos target ~150 KB.
 *
 * Tries progressively smaller sizes/quality until under targetKB.
 *
 * Returns { dataUrl, name, sizeKB, wasPdf, pages, totalPages }.
 */
export async function compressBillFile(file, { maxPdfPages = 3 } = {}) {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');

  let sourceFile = file, pages = 1, totalPages = 1;
  if (isPdf) {
    const r = await pdfPagesToImage(file, { maxPages: maxPdfPages });
    sourceFile = r.file; pages = r.usedPages; totalPages = r.totalPages;
  }
  const img = await loadImage(sourceFile);

  const attempts = isPdf
    ? [
        { maxWidth: 1000, quality: 0.55 },
        { maxWidth: 900, quality: 0.5 },
        { maxWidth: 800, quality: 0.45 },
        { maxWidth: 700, quality: 0.4 },
        { maxWidth: 600, quality: 0.35 },
      ]
    : [
        { maxDim: 1600, quality: 0.7 },
        { maxDim: 1200, quality: 0.6 },
        { maxDim: 1000, quality: 0.5 },
        { maxDim: 800, quality: 0.4 },
      ];
  const targetKB = isPdf ? 250 : 150;

  let dataUrl = '';
  for (const a of attempts) {
    dataUrl = drawToJpeg(img, a, a.quality);
    if (dataUrlSizeKB(dataUrl) <= targetKB) break;
  }

  return {
    dataUrl,
    name: (file.name || 'bill').replace(/\.pdf$/i, '.jpg'),
    sizeKB: dataUrlSizeKB(dataUrl),
    wasPdf: isPdf,
    pages,
    totalPages,
  };
}