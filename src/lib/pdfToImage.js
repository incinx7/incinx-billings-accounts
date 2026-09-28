// Legacy build ships polyfills (Promise.withResolvers, Map.getOrInsertComputed)
// that the modern build assumes the browser already has — without them PDF
// processing fails on any browser that doesn't yet support those features.
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfjsWorker from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export async function pdfFirstPageToImage(file) {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const page = await pdf.getPage(1);

  const scale = 2;
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');

  await page.render({ canvasContext: ctx, viewport }).promise;

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  return new File([blob], file.name.replace(/\.pdf$/i, '.png'), { type: 'image/png' });
}

/**
 * Renders up to `maxPages` pages of a PDF and stitches them top-to-bottom
 * into ONE tall image, so a multi-page bill can be stored/viewed as a single
 * attachment. Every page is scaled to the same width so text stays readable.
 * Returns { file, totalPages, usedPages }.
 */
export async function pdfPagesToImage(file, { maxPages = 3, pageWidth = 1100 } = {}) {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const totalPages = pdf.numPages;
  const usedPages = Math.min(totalPages, maxPages);

  const canvases = [];
  for (let n = 1; n <= usedPages; n++) {
    const page = await pdf.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: pageWidth / base.width });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    canvases.push(canvas);
  }

  const gap = 12; // thin grey divider so page breaks are visible
  const totalHeight = canvases.reduce((s, c) => s + c.height, 0) + gap * (canvases.length - 1);
  const out = document.createElement('canvas');
  out.width = pageWidth;
  out.height = totalHeight;
  const octx = out.getContext('2d');
  octx.fillStyle = '#d4d4d4';
  octx.fillRect(0, 0, out.width, out.height);
  let y = 0;
  for (const c of canvases) {
    octx.drawImage(c, 0, y);
    y += c.height + gap;
  }

  const blob = await new Promise((resolve) => out.toBlob(resolve, 'image/png'));
  return {
    file: new File([blob], file.name.replace(/\.pdf$/i, '.png'), { type: 'image/png' }),
    totalPages,
    usedPages,
  };
}