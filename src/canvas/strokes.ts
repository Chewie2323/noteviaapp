import { getStroke } from 'perfect-freehand';
import type { PenKind, StrokeObj } from '@/lib/types';

export const PEN_DEFAULTS: Record<PenKind, { size: number; color: string; opacity: number; label: string }> = {
  ballpoint: { size: 3, color: '#2F2B45', opacity: 1, label: 'Ballpoint pen' },
  fountain: { size: 5, color: '#2B3A67', opacity: 1, label: 'Fountain pen' },
  pencil: { size: 2.4, color: '#5A5D6B', opacity: 0.78, label: 'Pencil' },
  highlighter: { size: 18, color: '#FFE88A', opacity: 0.42, label: 'Highlighter' },
};

/**
 * Stroke shape options.
 * Pressure mode (Apple Pencil / S Pen): width follows pressure, but gently. The previous values (thinning 0.85–0.9
 * on raw, unfiltered pressure) swung each stroke between ~0.6px hairlines and ~4px blobs. With thinning ≈ 0.5 the
 * thinnest part of a stroke is ~half as wide as the thickest, which still reads as pressure but never as a glitch.
 */
function options(pen: PenKind, size: number, hasPressure: boolean) {
  const s = hasPressure ? size * 1.25 : size;
  switch (pen) {
    case 'fountain': return { size: s, thinning: hasPressure ? 0.7 : 0.72, smoothing: 0.62, streamline: hasPressure ? 0.45 : 0.42, simulatePressure: !hasPressure, start: { taper: size * 2 }, end: { taper: size * 5 } };
    case 'pencil': return { size: s, thinning: hasPressure ? 0.5 : 0.18, smoothing: 0.45, streamline: hasPressure ? 0.35 : 0.3, simulatePressure: !hasPressure };
    case 'highlighter': return { size, thinning: 0, smoothing: 0.5, streamline: 0.5, simulatePressure: false, start: { cap: false }, end: { cap: false } };
    default: return { size: s, thinning: hasPressure ? 0.5 : 0.18, smoothing: 0.6, streamline: hasPressure ? 0.45 : 0.5, simulatePressure: !hasPressure };
  }
}

// ---------------- pressure handling ----------------

export type PressureLevel = 'off' | 'soft' | 'normal' | 'firm';
/** `factor` scales how far pressure moves line width away from the middle; 0 = ignore pressure. */
export const PRESSURE_LEVELS: Record<PressureLevel, { label: string; factor: number }> = {
  off: { label: 'Off', factor: 0 },
  soft: { label: 'Soft', factor: 0.55 },
  normal: { label: 'Normal', factor: 1 },
  firm: { label: 'Firm', factor: 1.5 },
};
const PRESSURE_KEY = 'nv-pressure';
export function getPressureLevel(): PressureLevel {
  try { const v = localStorage.getItem(PRESSURE_KEY) as PressureLevel | null; if (v && v in PRESSURE_LEVELS) return v; } catch { /* storage blocked */ }
  return 'normal';
}
export function setPressureLevel(l: PressureLevel) { try { localStorage.setItem(PRESSURE_KEY, l); } catch { /* storage blocked */ } }

const clamp01 = (n: number, lo = 0.05) => Math.min(1, Math.max(lo, n));

/**
 * Per-stroke pressure filter, used while drawing. Raw stylus pressure is noisy (and some browsers report 0 or a fixed
 * 0.5), so each sample is low-pass filtered, then scaled by the user's sensitivity setting.
 * Returns -1 for non-stylus input or when pressure is switched off, which keeps the simulated-taper look.
 */
export function createPressureFilter() {
  const k = PRESSURE_LEVELS[getPressureLevel()].factor;
  let s: number | null = null;
  return (e: { pointerType: string; pressure: number }): number => {
    if (e.pointerType !== 'pen' || k === 0) return -1;
    const raw = clamp01(e.pressure || 0.5);
    s = s === null ? raw : s + (raw - s) * 0.3;
    return clamp01(0.5 + (s - 0.5) * k);
  };
}

/** Symmetric weighted moving average — removes the remaining jitter from stored strokes (including older ones). */
function smoothPressure(p: number[]): number[] {
  const n = p.length;
  if (n < 3) return p;
  const w = [1, 2, 3, 2, 1];
  return p.map((_, i) => {
    let acc = 0, wt = 0;
    for (let j = -2; j <= 2; j++) { const k = i + j; if (k < 0 || k >= n) continue; acc += p[k] * w[j + 2]; wt += w[j + 2]; }
    return acc / wt;
  });
}

/** points are stored flat: [x, y, pressure, ...]. Pressure < 0 means "no real pressure" (mouse / finger). */
export function strokeOutline(points: number[], pen: PenKind, size: number): number[][] {
  const pts: number[][] = [];
  const raw: number[] = [];
  let hasPressure = false;
  for (let i = 0; i < points.length; i += 3) {
    const p = points[i + 2];
    if (p >= 0 && Math.abs(p - 0.5) > 0.001) hasPressure = true;
    raw.push(p < 0 ? 0.5 : p);
    pts.push([points[i], points[i + 1], 0.5]);
  }
  const pr = hasPressure ? smoothPressure(raw) : raw;
  for (let i = 0; i < pts.length; i++) pts[i][2] = hasPressure ? clamp01(Math.pow(pr[i], 0.85)) : 0.5;
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
