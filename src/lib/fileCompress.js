// Compresses an uploaded bill (image or PDF) down to a small JPEG data URL
// before it gets stored in the DB blob. Keeps every bill copy lightweight
// regardless of how big the original photo/scan was.

import { pdfFirstPageToImage } from './pdfToImage.js';

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
function drawToJpeg(img, maxDim, quality) {
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
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
 * PDFs are rasterized to their first page first, then compressed the same
 * way — so every stored bill is a consistent, lightweight JPEG.
 *
 * Tries progressively smaller sizes/quality until under targetKB, so a
 * huge phone photo doesn't end up as a multi-MB attachment.
 *
 * Returns { dataUrl, name, sizeKB, wasPdf }.
 */
export async function compressBillFile(file, { targetKB = 150 } = {}) {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
  const sourceFile = isPdf ? await pdfFirstPageToImage(file) : file;
  const img = await loadImage(sourceFile);

  const attempts = [
    { maxDim: 1600, quality: 0.7 },
    { maxDim: 1200, quality: 0.6 },
    { maxDim: 1000, quality: 0.5 },
    { maxDim: 800, quality: 0.4 },
  ];

  let dataUrl = drawToJpeg(img, attempts[0].maxDim, attempts[0].quality);
  for (const a of attempts) {
    dataUrl = drawToJpeg(img, a.maxDim, a.quality);
    if (dataUrlSizeKB(dataUrl) <= targetKB) break;
  }

  return {
    dataUrl,
    name: (file.name || 'bill').replace(/\.pdf$/i, '.jpg'),
    sizeKB: dataUrlSizeKB(dataUrl),
    wasPdf: isPdf,
  };
}