import { getStroke } from 'perfect-freehand';
import type { PenKind, StrokeObj } from '@/lib/types';

export const PEN_DEFAULTS: Record<PenKind, { size: number; color: string; opacity: number; label: string }> = {
  ballpoint: { size: 2, color: '#2F2B45', opacity: 1, label: 'Ballpoint pen' },
  fountain: { size: 3.5, color: '#2B3A67', opacity: 1, label: 'Fountain pen' },
  pencil: { size: 2, color: '#5A5D6B', opacity: 0.78, label: 'Pencil' },
  highlighter: { size: 18, color: '#FFE88A', opacity: 0.42, label: 'Highlighter' },
};

/**
 * Stroke shape options, tuned for HANDWRITING (small script such as Thai: tight loops, heads, tiny tone marks).
 *  - The nominal size is the line you get at your normal writing pressure; pressure only modulates around it.
 *  - Smoothing is deliberately light. Heavy "streamline" lags behind the pen tip and rounds off small loops.
 *  - Tapers are capped to a fraction of the stroke length so dots and short tone marks don't shrink to nothing.
 */
function options(pen: PenKind, size: number, hasPressure: boolean, len: number) {
  const cap = (t: number) => Math.max(0, Math.min(t, len * 0.3));
  switch (pen) {
    case 'fountain': return { size, thinning: hasPressure ? 0.6 : 0.72, smoothing: 0.55, streamline: hasPressure ? 0.28 : 0.42, simulatePressure: !hasPressure, start: { taper: cap(size * 2) }, end: { taper: cap(size * 5) } };
    case 'pencil': return { size, thinning: hasPressure ? 0.5 : 0.18, smoothing: 0.4, streamline: hasPressure ? 0.2 : 0.3, simulatePressure: !hasPressure };
    case 'highlighter': return { size, thinning: 0, smoothing: 0.5, streamline: 0.5, simulatePressure: false, start: { cap: false }, end: { cap: false } };
    default: return { size, thinning: hasPressure ? 0.5 : 0.18, smoothing: 0.5, streamline: hasPressure ? 0.2 : 0.5, simulatePressure: !hasPressure };
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

// "Typical writing pressure" for this person/stylus. Pressure above it thickens the line, below it thins it, and at
// exactly this pressure you get the nominal thickness. It adapts slowly to how hard the user actually writes, so the
// thickness slider stays honest for light and heavy writers alike.
const BASE_KEY = 'nv-pressure-base';
const BASE_DEFAULT = 0.3, BASE_MIN = 0.12, BASE_MAX = 0.55;
export function getPressureBase(): number {
  try { const v = parseFloat(localStorage.getItem(BASE_KEY) || ''); if (v >= BASE_MIN && v <= BASE_MAX) return v; } catch { /* storage blocked */ }
  return BASE_DEFAULT;
}
export function resetPressureBase() { try { localStorage.removeItem(BASE_KEY); } catch { /* storage blocked */ } }
function learnPressureBase(mean: number) {
  const b = getPressureBase();
  const n = Math.min(BASE_MAX, Math.max(BASE_MIN, b + (mean - b) * 0.15));
  try { localStorage.setItem(BASE_KEY, n.toFixed(3)); } catch { /* storage blocked */ }
}

/**
 * Maps smoothed raw pressure to the stored value. Stored pressure 0.5 = nominal width; width ratio = 0.5 + stored,
 * so the line is never thinner than 55% or thicker than 150% of the nominal size (no hairlines, no blobs).
 */
function pressureToStored(p: number, base: number, k: number): number {
  const r = p < base ? 1 - 0.35 * k * (1 - p / base) : 1 + 0.5 * k * ((p - base) / (1 - base));
  return clamp01(Math.min(1.5, Math.max(0.55, r)) - 0.5);
}

/**
 * Per-stroke pressure filter, used while drawing. Raw stylus pressure is noisy, reads 0 when "not reported", and
 * ramps up from ~0 as the tip lands, so each sample is low-pass filtered and the first few samples are held at the
 * typical pressure (otherwise every stroke starts as a hairline).
 * Returns -1 for non-stylus input or when pressure is switched off, which keeps the simulated-taper look.
 * Call `.learn()` when the stroke ends to let the typical pressure adapt.
 */
export function createPressureFilter() {
  const k = PRESSURE_LEVELS[getPressureLevel()].factor;
  const base = getPressureBase();
  let s: number | null = null, n = 0, sum = 0;
  const f = (e: { pointerType: string; pressure: number }): number => {
    if (e.pointerType !== 'pen' || k === 0) return -1;
    let raw = e.pressure > 0 ? Math.min(1, e.pressure) : base;
    if (n < 3) raw = Math.max(raw, base);
    n++; sum += raw;
    s = s === null ? raw : s + (raw - s) * 0.35;
    return pressureToStored(s, base, k);
  };
  f.learn = () => { if (n >= 8) learnPressureBase(sum / n); };
  return f;
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
  for (let i = 0; i < pts.length; i++) pts[i][2] = hasPressure ? clamp01(pr[i]) : 0.5;
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  if (pen === 'pencil') {
    // slight deterministic grain so pencil lines feel hand-drawn
    for (let i = 0; i < pts.length; i++) { const n = Math.sin(i * 12.9898) * 0.35; pts[i][0] += n; pts[i][1] -= n; }
  }
  return getStroke(pts, { ...options(pen, size, hasPressure, len), last: true });
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
