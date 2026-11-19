import type { CanvasObject, ConnectorObj } from '@/lib/types';
import { strokeBounds } from './strokes';

export interface Box { x: number; y: number; w: number; h: number }

/** Approximate world-space bounding box (ignores rotation). */
export function objBox(o: CanvasObject, live?: { x: number; y: number }): Box {
  const x = live?.x ?? o.x, y = live?.y ?? o.y, sx = o.scaleX ?? 1, sy = o.scaleY ?? 1;
  let b: Box;
  switch (o.type) {
    case 'stroke': b = strokeBounds(o); break;
    case 'text': b = { x: 0, y: 0, w: o.width, h: Math.max(1, o.text.split('\n').length) * o.fontSize * 1.4 }; break;
    case 'table': b = { x: 0, y: 0, w: o.colWidths.reduce((s, c) => s + c, 0), h: o.cells.length * o.rowHeight }; break;
    case 'connector': b = { x: 0, y: 0, w: 0, h: 0 }; break;
    case 'shape': b = { x: Math.min(0, o.w), y: Math.min(0, o.h), w: Math.abs(o.w), h: Math.abs(o.h) }; break;
    default: b = { x: 0, y: 0, w: (o as any).w || 0, h: (o as any).h || 0 };
  }
  return { x: x + b.x * sx, y: y + b.y * sy, w: b.w * sx, h: b.h * sy };
}

function edgePoint(b: Box, tx: number, ty: number) {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2, dx = tx - cx, dy = ty - cy;
  if (!dx && !dy) return { x: cx, y: cy };
  const sx = b.w / 2 / Math.abs(dx || 1e-6), sy = b.h / 2 / Math.abs(dy || 1e-6);
  const s = Math.min(sx, sy);
  return { x: cx + dx * s, y: cy + dy * s };
}

/** End points of a connector between two objects (from edge to edge). */
export function connectorEnds(c: ConnectorObj, byId: Map<string, CanvasObject>, live: Record<string, { x: number; y: number }> = {}) {
  const a = byId.get(c.from), b = byId.get(c.to);
  if (!a || !b) return null;
  const A = objBox(a, live[a.id]), B = objBox(b, live[b.id]);
  const ac = { x: A.x + A.w / 2, y: A.y + A.h / 2 }, bc = { x: B.x + B.w / 2, y: B.y + B.h / 2 };
  const p1 = edgePoint(A, bc.x, bc.y), p2 = edgePoint(B, ac.x, ac.y);
  const pad = 6, len = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1;
  return { x1: p1.x + ((p2.x - p1.x) / len) * pad, y1: p1.y + ((p2.y - p1.y) / len) * pad, x2: p2.x - ((p2.x - p1.x) / len) * pad, y2: p2.y - ((p2.y - p1.y) / len) * pad };
}

export function pointInPoly(x: number, y: number, poly: number[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 2; i < poly.length; j = i, i += 2) {
    const xi = poly[i], yi = poly[i + 1], xj = poly[j], yj = poly[j + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function shapePoints(shape: string, w: number, h: number): number[] | null {
  switch (shape) {
    case 'diamond': return [w / 2, 0, w, h / 2, w / 2, h, 0, h / 2];
    case 'triangle': return [w / 2, 0, w, h, 0, h];
    case 'parallelogram': { const k = Math.min(Math.abs(w) * 0.2, 40) * Math.sign(w || 1); return [k, 0, w, 0, w - k, h, 0, h]; }
    default: return null;
  }
}
