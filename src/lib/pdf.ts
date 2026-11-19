import * as pdfjs from 'pdfjs-dist';
import { PDFDocument, degrees } from 'pdf-lib';
import type { AnnotationPage, CanvasObject, TemplateId } from './types';
import { drawObjects, renderPage } from '@/canvas/render';
import { drawTemplate } from '@/canvas/paper';

let worker: Promise<void> | null = null;
function ensureWorker() {
  if (!worker) worker = import('pdfjs-dist/build/pdf.worker.min.mjs?raw').then(({ default: code }) => {
    pdfjs.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
  });
  return worker;
}
export type PDFDoc = pdfjs.PDFDocumentProxy;
export async function openPdf(data: Blob | ArrayBuffer): Promise<PDFDoc> {
  await ensureWorker();
  const buf = data instanceof Blob ? await data.arrayBuffer() : data;
  return pdfjs.getDocument({ data: new Uint8Array(buf.slice(0)) }).promise;
}

/** Renders a page `targetWidth` CSS px wide; `rotation` is extra rotation (0/90/180/270). */
export async function renderPdfPage(doc: PDFDoc, pageNo: number, targetWidth: number, dpr = Math.min(2, window.devicePixelRatio || 1), rotation = 0) {
  const page = await doc.getPage(pageNo);
  const rot = (page.rotate + rotation) % 360;
  const vp1 = page.getViewport({ scale: 1, rotation: rot });
  const scale = (targetWidth / vp1.width) * dpr;
  const vp = page.getViewport({ scale, rotation: rot });
  const c = document.createElement('canvas'); c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
  await page.render({ canvasContext: c.getContext('2d')!, viewport: vp }).promise;
  return { canvas: c, width: targetWidth, height: (vp1.height / vp1.width) * targetWidth };
}

export interface TextItemBox { str: string; x: number; y: number; w: number; h: number }
/** Text positions in page coordinates scaled to `targetWidth` (for highlight-by-selection and search). */
export async function pageText(doc: PDFDoc, pageNo: number, targetWidth: number, rotation = 0): Promise<TextItemBox[]> {
  const page = await doc.getPage(pageNo);
  const rot = (page.rotate + rotation) % 360;
  const vp1 = page.getViewport({ scale: 1, rotation: rot });
  const vp = page.getViewport({ scale: targetWidth / vp1.width, rotation: rot });
  const tc = await page.getTextContent();
  const out: TextItemBox[] = [];
  for (const it of tc.items as any[]) {
    if (!it.str?.trim()) continue;
    const m = pdfjs.Util.transform(vp.transform, it.transform);
    const fh = Math.hypot(m[2], m[3]);
    const w = it.width * vp.scale;
    out.push({ str: it.str, x: m[4], y: m[5] - fh, w: rot % 180 === 0 ? w : fh, h: rot % 180 === 0 ? fh * 1.15 : w });
  }
  return out;
}
export async function searchPdf(doc: PDFDoc, q: string) {
  const hits: { page: number; snippet: string }[] = [];
  const needle = q.toLowerCase();
  for (let i = 1; i <= doc.numPages; i++) {
    const tc = await (await doc.getPage(i)).getTextContent();
    const text = (tc.items as any[]).map((t) => t.str).join(' ');
    let idx = text.toLowerCase().indexOf(needle);
    while (idx >= 0 && hits.length < 200) {
      hits.push({ page: i, snippet: text.slice(Math.max(0, idx - 30), idx + q.length + 40) });
      idx = text.toLowerCase().indexOf(needle, idx + needle.length);
    }
  }
  return hits;
}
export async function pdfThumbnail(blob: Blob, width = 260) {
  try { const d = await openPdf(blob); const { canvas } = await renderPdfPage(d, 1, width, 1); return canvas.toDataURL('image/jpeg', 0.8); } catch { return null; }
}

/**
 * Builds the annotated copy with pdf-lib: original pages are copied as vectors (text stays selectable),
 * rotation/reordering applied, annotations overlaid as transparent PNG, inserted note pages added.
 */
export async function exportAnnotatedPdf(original: ArrayBuffer, pages: AnnotationPage[], dims: Record<string, { w: number; h: number }>) {
  const src = await PDFDocument.load(original.slice(0), { ignoreEncryption: true });
  const out = await PDFDocument.create();
  out.setProducer('Notevia'); out.setCreator('Notevia — One space. Endless learning.');
  for (const p of pages) {
    const d = dims[p.key];
    if (p.source === 'pdf' && p.pdf_page) {
      const [pg] = await out.copyPages(src, [p.pdf_page - 1]);
      const base = pg.getRotation().angle;
      pg.setRotation(degrees((base + p.rotation) % 360));
      out.addPage(pg);
      if (p.objects.length) {
        const { width, height } = pg.getSize();
        const rot = (base + p.rotation) % 360;
        const vw = rot % 180 === 0 ? width : height, vh = rot % 180 === 0 ? height : width;   // visible page size
        const c = document.createElement('canvas'); const s = 2;
        c.width = Math.round(d.w * s); c.height = Math.round(d.h * s);
        const ctx = c.getContext('2d')!; ctx.scale(s, s); await drawObjects(ctx, p.objects);
        const png = await out.embedPng(c.toDataURL('image/png'));
        // map overlay (visible orientation) back into the page's unrotated coordinate space
        const sx = vw / d.w;
        const opts: any = { width: d.w * sx, height: d.h * sx };
        if (rot === 0) Object.assign(opts, { x: 0, y: 0 });
        else if (rot === 90) Object.assign(opts, { x: width, y: 0, rotate: degrees(90) });
        else if (rot === 180) Object.assign(opts, { x: width, y: height, rotate: degrees(180) });
        else Object.assign(opts, { x: 0, y: height, rotate: degrees(270) });
        pg.drawImage(png, opts);
      }
    } else {
      const c = await renderPage({ template: (p.template || 'blank') as TemplateId, objects: p.objects, w: d.w, h: d.h, scale: 2 });
      const img = await out.embedJpg(c.toDataURL('image/jpeg', 0.92));
      const pg = out.addPage([d.w * 0.75, d.h * 0.75]);
      pg.drawImage(img, { x: 0, y: 0, width: d.w * 0.75, height: d.h * 0.75 });
    }
  }
  return new Blob([await out.save()], { type: 'application/pdf' });
}

/** Notebook / whiteboard pages → PDF (pdf-lib). Sizes are CSS px at 96 dpi → points. */
export async function exportPagesPdf(title: string, pages: { template: TemplateId; objects: CanvasObject[]; w: number; h: number; customImage?: HTMLImageElement | null }[]) {
  const out = await PDFDocument.create();
  out.setTitle(title); out.setProducer('Notevia');
  for (const p of pages) {
    const c = await renderPage({ ...p, scale: 2 });
    const img = await out.embedJpg(c.toDataURL('image/jpeg', 0.92));
    const pg = out.addPage([p.w * 0.75, p.h * 0.75]);
    pg.drawImage(img, { x: 0, y: 0, width: p.w * 0.75, height: p.h * 0.75 });
  }
  return new Blob([await out.save()], { type: 'application/pdf' });
}
export async function canvasToPdf(canvas: HTMLCanvasElement, w: number, h: number, title: string) {
  const out = await PDFDocument.create(); out.setTitle(title);
  const img = await out.embedPng(canvas.toDataURL('image/png'));
  const pg = out.addPage([w * 0.75, h * 0.75]); pg.drawImage(img, { x: 0, y: 0, width: w * 0.75, height: h * 0.75 });
  return new Blob([await out.save()], { type: 'application/pdf' });
}
export { drawTemplate };
