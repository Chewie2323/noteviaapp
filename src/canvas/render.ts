/** Plain 2D-canvas renderer for thumbnails and PDF/PNG export. Mirrors what InkCanvas draws. */
import type { CanvasObject, TemplateId } from '@/lib/types';
import { db, Bucket } from '@/lib/backend';
import { drawTemplate, drawBoardBackground, FONT } from './paper';
import { paintStroke } from './strokes';
import { connectorEnds, objBox, shapePoints } from './geometry';
import { mathImage } from './math';

const imgCache = new Map<string, Promise<HTMLImageElement>>();
export async function resolveSrc(src: string) {
  if (src.startsWith('storage:')) { const [bucket, ...rest] = src.slice(8).split('/'); return db.fileUrl(bucket as Bucket, rest.join('/')); }
  return src;
}
export function loadImage(src: string): Promise<HTMLImageElement> {
  if (!imgCache.has(src)) imgCache.set(src, resolveSrc(src).then((url) => new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = url;
  })));
  return imgCache.get(src)!;
}

export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    const words = para.split(/(\s+)/);
    let line = '';
    for (const w of words) {
      const test = line + w;
      if (ctx.measureText(test).width > maxW && line.trim()) { out.push(line.trimEnd()); line = w.trimStart(); }
      else line = test;
      while (ctx.measureText(line).width > maxW && line.length > 1) { // very long words
        let k = line.length - 1; while (k > 1 && ctx.measureText(line.slice(0, k)).width > maxW) k--;
        out.push(line.slice(0, k)); line = line.slice(k);
      }
    }
    out.push(line);
  }
  return out;
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  if ((ctx as any).roundRect) (ctx as any).roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
}

export async function drawObjects(ctx: CanvasRenderingContext2D, objects: CanvasObject[]) {
  const byId = new Map(objects.map((o) => [o.id, o]));
  // connectors first so they sit under the nodes they join
  for (const c of objects) {
    if (c.type !== 'connector') continue;
    const e = connectorEnds(c, byId); if (!e) continue;
    ctx.save(); ctx.strokeStyle = c.stroke; ctx.fillStyle = c.stroke; ctx.lineWidth = c.size; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(e.x1, e.y1);
    if (c.curved) { const mx = (e.x1 + e.x2) / 2; ctx.bezierCurveTo(mx, e.y1, mx, e.y2, e.x2, e.y2); } else ctx.lineTo(e.x2, e.y2);
    ctx.stroke();
    if (c.arrow) { const a = Math.atan2(e.y2 - (c.curved ? e.y2 : e.y1), e.x2 - (c.curved ? (e.x1 + e.x2) / 2 : e.x1)), L = 8 + c.size * 2; ctx.beginPath(); ctx.moveTo(e.x2, e.y2); ctx.lineTo(e.x2 - L * Math.cos(a - 0.45), e.y2 - L * Math.sin(a - 0.45)); ctx.lineTo(e.x2 - L * Math.cos(a + 0.45), e.y2 - L * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }
  for (const o of objects) {
    if (o.type === 'connector') continue;
    ctx.save();
    ctx.translate(o.x, o.y);
    if (o.rotation) ctx.rotate((o.rotation * Math.PI) / 180);
    ctx.scale(o.scaleX ?? 1, o.scaleY ?? 1);
    if (o.type !== 'stroke') ctx.globalAlpha = o.opacity ?? 1;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    switch (o.type) {
      case 'stroke': paintStroke(ctx, o); break;
      case 'shape': {
        ctx.lineWidth = o.size; ctx.strokeStyle = o.stroke; if (o.dash) ctx.setLineDash([o.size * 3, o.size * 2.5]);
        const pts = shapePoints(o.shape, o.w, o.h);
        if (o.shape === 'line' || o.shape === 'arrow') {
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(o.w, o.h); ctx.stroke();
          if (o.shape === 'arrow') { const a = Math.atan2(o.h, o.w), L = 10 + o.size * 2; ctx.setLineDash([]); ctx.fillStyle = o.stroke; ctx.beginPath(); ctx.moveTo(o.w, o.h); ctx.lineTo(o.w - L * Math.cos(a - 0.45), o.h - L * Math.sin(a - 0.45)); ctx.lineTo(o.w - L * Math.cos(a + 0.45), o.h - L * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill(); }
        } else {
          if (pts) { ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.closePath(); }
          else if (o.shape === 'ellipse') { ctx.beginPath(); ctx.ellipse(o.w / 2, o.h / 2, Math.abs(o.w / 2), Math.abs(o.h / 2), 0, 0, Math.PI * 2); }
          else rr(ctx, 0, 0, o.w, o.h, o.shape === 'rounded' ? Math.min(18, Math.abs(o.h) / 2) : 4);
          if (o.fill) { ctx.fillStyle = o.fill; ctx.fill(); }
          ctx.stroke();
          if (o.label) { ctx.setLineDash([]); ctx.fillStyle = '#2F2B45'; ctx.font = `500 15px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; wrapText(ctx, o.label, Math.abs(o.w) - 16).forEach((l, i, arr) => ctx.fillText(l, o.w / 2, o.h / 2 + (i - (arr.length - 1) / 2) * 19)); }
        }
        break;
      }
      case 'sticky': {
        ctx.shadowColor = 'rgba(47,43,69,.14)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4;
        ctx.fillStyle = o.color; rr(ctx, 0, 0, o.w, o.h, 6); ctx.fill(); ctx.shadowColor = 'transparent';
        ctx.fillStyle = '#2F2B45'; ctx.font = `15px ${FONT}`; ctx.textBaseline = 'top';
        wrapText(ctx, o.text, o.w - 28).forEach((l, i) => ctx.fillText(l, 14, 14 + i * 21));
        break;
      }
      case 'node': {
        ctx.fillStyle = o.color; ctx.strokeStyle = 'rgba(47,43,69,.12)'; ctx.lineWidth = 1;
        rr(ctx, 0, 0, o.w, o.h, Math.min(22, o.h / 2)); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#2F2B45'; ctx.font = `600 15px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        wrapText(ctx, o.text || ' ', o.w - 20).forEach((l, i, arr) => ctx.fillText(l, o.w / 2, o.h / 2 + (i - (arr.length - 1) / 2) * 19));
        break;
      }
      case 'text': {
        ctx.font = `${o.italic ? 'italic ' : ''}${o.bold ? '700 ' : '400 '}${o.fontSize}px ${FONT}`;
        ctx.textBaseline = 'top';
        const lines = wrapText(ctx, o.text, o.width), lh = o.fontSize * 1.35;
        if (o.highlight) { ctx.fillStyle = o.highlight; lines.forEach((l, i) => ctx.fillRect(-3, i * lh, ctx.measureText(l).width + 6, lh)); }
        ctx.fillStyle = o.color;
        lines.forEach((l, i) => {
          const lw = ctx.measureText(l).width, x = o.align === 'center' ? (o.width - lw) / 2 : o.align === 'right' ? o.width - lw : 0;
          ctx.fillText(l, x, i * lh + (lh - o.fontSize) / 2);
          if (o.underline) ctx.fillRect(x, i * lh + o.fontSize * 1.2, lw, Math.max(1, o.fontSize / 15));
        });
        break;
      }
      case 'table': {
        const W = o.colWidths.reduce((s, c) => s + c, 0), H = o.cells.length * o.rowHeight;
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
        if (o.header) { ctx.fillStyle = o.color; ctx.fillRect(0, 0, W, o.rowHeight); }
        ctx.strokeStyle = '#D5CEE4'; ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, W, H);
        let cx = 0;
        o.colWidths.forEach((cw, c) => { if (c) { ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.stroke(); } cx += cw; });
        o.cells.forEach((row, r) => {
          if (r) { ctx.beginPath(); ctx.moveTo(0, r * o.rowHeight); ctx.lineTo(W, r * o.rowHeight); ctx.stroke(); }
          let x = 0;
          row.forEach((cell, c) => {
            ctx.fillStyle = '#2F2B45'; ctx.font = `${r === 0 && o.header ? 600 : 400} 14px ${FONT}`; ctx.textBaseline = 'middle';
            ctx.save(); ctx.beginPath(); ctx.rect(x, r * o.rowHeight, o.colWidths[c], o.rowHeight); ctx.clip();
            ctx.fillText(cell, x + 8, r * o.rowHeight + o.rowHeight / 2); ctx.restore();
            x += o.colWidths[c];
          });
        });
        break;
      }
      case 'math':
        try { const img = await mathImage(o.latex, o.fontSize, o.color); ctx.drawImage(img, 0, 0, o.w, o.h); }
        catch { ctx.fillStyle = o.color; ctx.font = `${o.fontSize * 0.8}px monospace`; ctx.textBaseline = 'top'; ctx.fillText(o.latex, 0, 0); }
        break;
      case 'image':
        try { ctx.drawImage(await loadImage(o.src), 0, 0, o.w, o.h); } catch { ctx.strokeStyle = '#ccc'; ctx.strokeRect(0, 0, o.w, o.h); }
        break;
    }
    ctx.restore();
  }
}

export async function renderPage(opts: { template: TemplateId; objects: CanvasObject[]; w: number; h: number; scale?: number; background?: CanvasImageSource; customImage?: CanvasImageSource | null }) {
  const s = opts.scale ?? 1;
  const c = document.createElement('canvas');
  c.width = Math.round(opts.w * s); c.height = Math.round(opts.h * s);
  const ctx = c.getContext('2d')!;
  ctx.scale(s, s);
  if (opts.background) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, opts.w, opts.h); ctx.drawImage(opts.background, 0, 0, opts.w, opts.h); }
  else drawTemplate(ctx, opts.w, opts.h, opts.template, { customImage: opts.customImage });
  await drawObjects(ctx, opts.objects);
  return c;
}

/** Whiteboard → image of everything on it (auto-cropped with padding). */
export async function renderBoard(objects: CanvasObject[], bg: { color: string; pattern: 'none' | 'grid' | 'dots' }, scale = 2) {
  const boxes = objects.filter((o) => o.type !== 'connector').map((o) => objBox(o));
  const x0 = Math.min(0, ...boxes.map((b) => b.x)) - 60, y0 = Math.min(0, ...boxes.map((b) => b.y)) - 60;
  const x1 = Math.max(800, ...boxes.map((b) => b.x + b.w)) + 60, y1 = Math.max(600, ...boxes.map((b) => b.y + b.h)) + 60;
  const w = x1 - x0, h = y1 - y0, s = Math.min(scale, 8000 / Math.max(w, h));
  const c = document.createElement('canvas'); c.width = Math.round(w * s); c.height = Math.round(h * s);
  const ctx = c.getContext('2d')!;
  ctx.scale(s, s); ctx.translate(-x0, -y0);
  drawBoardBackground(ctx, x0, y0, x1, y1, bg, 1);
  await drawObjects(ctx, objects);
  return { canvas: c, w, h };
}
