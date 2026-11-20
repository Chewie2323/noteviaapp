import { getStroke } from 'perfect-freehand';
import type { PenKind, StrokeObj } from '@/lib/types';

export const PEN_DEFAULTS: Record<PenKind, { size: number; color: string; opacity: number; label: string }> = {
  ballpoint: { size: 3, color: '#2F2B45', opacity: 1, label: 'Ballpoint pen' },
  fountain: { size: 5, color: '#2B3A67', opacity: 1, label: 'Fountain pen' },
  pencil: { size: 2.4, color: '#5A5D6B', opacity: 0.78, label: 'Pencil' },
  highlighter: { size: 18, color: '#FFE88A', opacity: 0.42, label: 'Highlighter' },
};

function options(pen: PenKind, size: number, hasPressure: boolean) {
  // With a real stylus the line width follows pressure strongly (Apple Pencil / S Pen); mouse and finger keep the gentle simulated taper.
  const s = hasPressure ? size * 1.5 : size;
  switch (pen) {
    case 'fountain': return { size: s, thinning: hasPressure ? 0.9 : 0.72, smoothing: 0.62, streamline: hasPressure ? 0.3 : 0.42, simulatePressure: !hasPressure, start: { taper: size * 2 }, end: { taper: size * 5 } };
    case 'pencil': return { size: s, thinning: hasPressure ? 0.75 : 0.18, smoothing: 0.4, streamline: hasPressure ? 0.2 : 0.3, simulatePressure: !hasPressure };
    case 'highlighter': return { size, thinning: 0, smoothing: 0.5, streamline: 0.5, simulatePressure: false, start: { cap: false }, end: { cap: false } };
    default: return { size: s, thinning: hasPressure ? 0.85 : 0.18, smoothing: 0.55, streamline: hasPressure ? 0.3 : 0.5, simulatePressure: !hasPressure };
  }
}

/** points are stored flat: [x, y, pressure, ...]. Pressure < 0 means "no real pressure" (mouse / finger). */
export function strokeOutline(points: number[], pen: PenKind, size: number): number[][] {
  const pts: number[][] = [];
  let hasPressure = false;
  for (let i = 0; i < points.length; i += 3) {
    const p = points[i + 2];
    if (p >= 0 && Math.abs(p - 0.5) > 0.001) hasPressure = true;
    pts.push([points[i], points[i + 1], p < 0 ? 0.5 : Math.pow(p, 0.85)]);
  }
  if (pen === 'pencil') {
    // slight deterministic grain so pencil lines feel hand-drawn
    for (let i = 0; i < pts.length; i++) { const n = Math.sin(i * 12.9898) * 0.35; pts[i][0] += n; pts[i][1] -= n; }
  }
  return getStroke(pts, { ...options(pen, size, hasPressure), last: true });
}

const cache = new Map<string, Path2D>();
export function strokePath(o: StrokeObj): Path2D {
  const key = `${o.id}:${o.points.length}:${o.size}:${o.pen}:${o.points[o.points.length - 2]}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const outline = strokeOutline(o.points, o.pen, o.size);
  const p = new Path2D(svgPath(outline));
  if (cache.size > 4000) cache.clear();
  cache.set(key, p);
  return p;
}

export function svgPath(stroke: number[][]): string {
  if (!stroke.length) return '';
  const d = stroke.reduce((acc: (string | number)[], [x0, y0], i, arr) => {
    const [x1, y1] = arr[(i + 1) % arr.length];
    acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
    return acc;
  }, ['M', ...stroke[0], 'Q']);
  d.push('Z');
  return d.map((v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v)).join(' ');
}

/** Paint a stroke into a raw 2D context (already translated to the object's origin). */
export function paintStroke(ctx: CanvasRenderingContext2D, o: StrokeObj) {
  ctx.save();
  ctx.globalAlpha *= o.opacity ?? PEN_DEFAULTS[o.pen].opacity;
  if (o.pen === 'highlighter') ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = o.color;
  ctx.fill(strokePath(o));
  ctx.restore();
}

export function strokeBounds(o: StrokeObj) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < o.points.length; i += 3) { const x = o.points[i], y = o.points[i + 1]; if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
  const pad = o.size;
  return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + pad * 2, h: y1 - y0 + pad * 2 };
}
