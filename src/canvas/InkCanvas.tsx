import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Shape, Rect, Ellipse, Line, Arrow, Group, Text, Label, Tag, Image as KImage, Transformer } from 'react-konva';
import type Konva from 'konva';
import { nanoid } from 'nanoid';
import type { CanvasObject, ConnectorObj, PenKind, ShapeKind, StrokeObj, TableObj, TemplateId } from '@/lib/types';
import { drawBoardBackground, drawTemplate, FONT } from './paper';
import { paintStroke, PEN_DEFAULTS, strokeOutline, svgPath, strokePath, createPressureFilter } from './strokes';
import { connectorEnds, objBox, pointInPoly, shapePoints } from './geometry';
import { loadImage } from './render';
import { mathImage } from './math';
import { accentColors } from '@/lib/theme';

export type Tool = 'select' | 'lasso' | 'hand' | 'pen' | 'eraser' | 'text' | 'shape' | 'connector' | 'sticky' | 'table' | 'math' | 'node';
export interface ToolState {
  tool: Tool; pen: PenKind;
  colors: Record<PenKind, string>; sizes: Record<PenKind, number>; opacity: number;
  shape: ShapeKind; shapeColor: string; shapeSize: number; fill: string | null; dash: boolean;
  eraserSize: number; fontSize: number; textColor: string; stickyColor: string; nodeColor: string;
}
export const DEFAULT_TOOLS: ToolState = {
  tool: 'pen', pen: 'ballpoint',
  colors: { ballpoint: PEN_DEFAULTS.ballpoint.color, fountain: PEN_DEFAULTS.fountain.color, pencil: PEN_DEFAULTS.pencil.color, highlighter: PEN_DEFAULTS.highlighter.color },
  sizes: { ballpoint: 2, fountain: 3.5, pencil: 2, highlighter: 18 }, opacity: 1,
  shape: 'rect', shapeColor: '#6D60C2', shapeSize: 2, fill: null, dash: false,
  eraserSize: 14, fontSize: 20, textColor: '#2F2B45', stickyColor: '#FFF2B3', nodeColor: '#E4DDFB',
};

export type CanvasBackground =
  | { kind: 'template'; template: TemplateId; customImage?: HTMLImageElement | null }
  | { kind: 'image'; image: HTMLCanvasElement | HTMLImageElement | null }
  | { kind: 'board'; color: string; pattern: 'none' | 'grid' | 'dots' }
  | { kind: 'none' };   // transparent: ink laid over other content

export interface View { x: number; y: number; scale: number }

interface Props {
  mode?: 'page' | 'board';
  width: number; height: number;          // page: logical page size · board: viewport size in CSS px
  zoom?: number;                            // page mode
  onZoom?: (z: number) => void;             // page mode: pinch / ctrl+wheel zoom
  view?: View; onView?: (v: View) => void;  // board mode
  objects: CanvasObject[];
  onCommit: (objs: CanvasObject[]) => void;
  selected: string[]; onSelect: (ids: string[]) => void;
  tools: ToolState;
  background: CanvasBackground;
  readOnly?: boolean; pencilOnly?: boolean;
  onUndo?: () => void; onRedo?: () => void; tapUndo?: boolean;   // two-finger tap = undo, three-finger tap = redo
  onRequestMath?: (at: { x: number; y: number } | null, existing?: CanvasObject) => void;
  onHint?: (h: string | null) => void;
  stageRef?: React.MutableRefObject<Konva.Stage | null>;
  /** lesson recording: stamp new strokes with the time they were written */
  recClock?: () => { clip: string; ms: number } | null;
  /** lesson playback: strokes written after this moment are dimmed */
  playback?: { clip: string; ms: number } | null;
  /** tap a stroke to jump the audio to when it was written */
  seekMode?: boolean; onSeek?: (rec: { clip: string; ms: number }) => void;
}

const SELECTABLE: Tool[] = ['select', 'lasso'];
const CREATES_ON_DOWN: Tool[] = ['text', 'sticky', 'node', 'table', 'math'];
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

function strokeHit(o: StrokeObj, px: number, py: number, r: number) {
  const sx = o.scaleX ?? 1, sy = o.scaleY ?? 1, rot = ((o.rotation || 0) * Math.PI) / 180, cos = Math.cos(rot), sin = Math.sin(rot);
  const rr = r + o.size / 2;
  let lx0 = 0, ly0 = 0;
  for (let i = 0; i < o.points.length; i += 3) {
    const lx = o.points[i] * sx, ly = o.points[i + 1] * sy;
    const x = o.x + lx * cos - ly * sin, y = o.y + lx * sin + ly * cos;
    if (i > 0) {   // test the segment, not just the vertices, so quick strokes can't slip through
      const dx = x - lx0, dy = y - ly0, len2 = dx * dx + dy * dy;
      const t = len2 ? clamp(((px - lx0) * dx + (py - ly0) * dy) / len2, 0, 1) : 0;
      const cx = lx0 + t * dx - px, cy = ly0 + t * dy - py;
      if (cx * cx + cy * cy <= rr * rr) return true;
    } else if ((x - px) ** 2 + (y - py) ** 2 <= rr * rr) return true;
    lx0 = x; ly0 = y;
  }
  return false;
}

function useImg(src: string) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => { let a = true; loadImage(src).then((i) => a && setImg(i)).catch(() => {}); return () => { a = false; }; }, [src]);
  return img;
}
function ImgNode({ src, w, h }: { src: string; w: number; h: number }) {
  const img = useImg(src);
  return img ? <KImage image={img} width={w} height={h} /> : <Rect width={w} height={h} fill="#F3EFFA" stroke="#D6CCEB" dash={[6, 6]} />;
}
function MathNode({ latex, fontSize, color, w, h }: { latex: string; fontSize: number; color: string; w: number; h: number }) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => { let a = true; mathImage(latex, fontSize, color).then((i) => a && setImg(i)).catch(() => {}); return () => { a = false; }; }, [latex, fontSize, color]);
  return img ? <KImage image={img} width={w} height={h} /> : <Text text={latex} fontSize={fontSize * 0.7} fontFamily="monospace" fill={color} />;
}

export function InkCanvas(p: Props) {
  const ACC = useMemo(() => accentColors(), []);   // selection / handle colours follow the user's accent
  const { mode = 'page', width, height, objects, tools, selected, readOnly } = p;
  const board = mode === 'board';
  const view: View = board ? p.view || { x: 0, y: 0, scale: 1 } : { x: 0, y: 0, scale: p.zoom || 1 };
  const stage = useRef<Konva.Stage | null>(null);
  const layer = useRef<Konva.Layer>(null);
  const live = useRef<Konva.Shape>(null);        // highlighter preview (lives in the page layer so it can multiply over ink)
  const liveInk = useRef<Konva.Shape>(null);     // pen preview, on its own layer so redrawing it never repaints the whole page
  const hideLive = () => { for (const n of [live.current, liveInk.current]) if (n?.visible()) { n.visible(false); n.getLayer()?.batchDraw(); } };
  const tr = useRef<Konva.Transformer>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const drawing = useRef<any>(null);
  const pointers = useRef(new Map<number, { x: number; y: number; type: string }>());
  const gesture = useRef<{ dist: number; cx: number; cy: number; view: View; sl?: number; st?: number; rl?: number; rt?: number } | null>(null);
  const penActive = useRef(false);
  // multi-finger tap tracking (two fingers = undo, three = redo)
  const tapG = useRef<{ t0: number; max: number; moved: boolean; start: Map<number, { x: number; y: number }> } | null>(null);
  const pendingStart = useRef<any>(null);
  const tapOn = p.tapUndo !== false && !p.readOnly && !!p.onUndo;
  const [erasing, setErasing] = useState<Set<string>>(new Set());
  const erased = useRef<Set<string>>(new Set());
  const lastErase = useRef<{ x: number; y: number } | null>(null);
  const objsRef = useRef(objects); objsRef.current = objects;
  const pendingScroll = useRef<{ l: number; t: number } | null>(null);
  const [ghost, setGhost] = useState<CanvasObject | null>(null);
  const [band, setBand] = useState<number[] | null>(null);
  const [editing, setEditing] = useState<{ id: string; r?: number; c?: number } | null>(null);
  const [livePos, setLivePos] = useState<Record<string, { x: number; y: number }>>({});
  const [connFrom, setConnFrom] = useState<string | null>(null);
  const byId = useMemo(() => new Map(objects.map((o) => [o.id, o])), [objects]);

  useEffect(() => { if (p.stageRef) p.stageRef.current = stage.current; });
  useEffect(() => { setLivePos({}); }, [objects]);
  useEffect(() => { if (tools.tool !== 'connector') setConnFrom(null); p.onHint?.(tools.tool === 'connector' ? 'Tap the first object, then the second, to connect them' : null); }, [tools.tool]);

  // transformer ↔ selection
  useEffect(() => {
    const t = tr.current, l = layer.current;
    if (!t || !l) return;
    const nodes = selected.map((id) => (byId.get(id)?.type === 'connector' ? null : l.findOne('#' + id))).filter(Boolean) as Konva.Node[];
    t.nodes(SELECTABLE.includes(tools.tool) && !readOnly ? nodes : []);
    t.getLayer()?.batchDraw();
  }, [selected, objects, tools.tool, readOnly]);

  // keyboard delete
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (editing || readOnly || !selected.length) return;
      const el = e.target as HTMLElement;
      if (el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || el?.isContentEditable) return;
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeIds(selected); p.onSelect([]); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [selected, objects, editing, readOnly]);

  const removeIds = (ids: string[]) => {
    const kill = new Set(ids);
    p.onCommit(objects.filter((o) => !kill.has(o.id) && !(o.type === 'connector' && (kill.has(o.from) || kill.has(o.to)))));
  };

  // board: wheel to pan / ctrl+wheel to zoom
  useEffect(() => {
    if (!board) return;
    const el = wrap.current; if (!el) return;
    const h = (e: WheelEvent) => {
      e.preventDefault();
      const v = p.view || view;
      if (e.ctrlKey || e.metaKey) {
        const r = el.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
        const ns = clamp(v.scale * Math.pow(0.998, e.deltaY), 0.1, 5);
        p.onView?.({ scale: ns, x: px - ((px - v.x) / v.scale) * ns, y: py - ((py - v.y) / v.scale) * ns });
      } else p.onView?.({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY });
    };
    el.addEventListener('wheel', h, { passive: false });
    return () => el.removeEventListener('wheel', h);
  }, [board, p.view, p.onView]);

  useLayoutEffect(() => {
    const s = pendingScroll.current; if (!s) return;
    pendingScroll.current = null;
    const sc = wrap.current?.closest('[data-scroll]') as HTMLElement | null;
    if (sc) { sc.scrollLeft = s.l; sc.scrollTop = s.t; }
  }, [p.zoom]);

  // page mode: ctrl/cmd + wheel (and trackpad pinch) zooms
  useEffect(() => {
    if (board || !p.onZoom) return;
    const el = wrap.current; if (!el) return;
    const h = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const z0 = p.zoom || 1, ns = clamp(+(z0 * Math.pow(0.99, e.deltaY)).toFixed(3), 0.3, 4);
      const sc = el.closest('[data-scroll]') as HTMLElement | null, r = el.getBoundingClientRect();
      if (sc) pendingScroll.current = { l: sc.scrollLeft + ((e.clientX - r.left) / z0) * (ns - z0), t: sc.scrollTop + ((e.clientY - r.top) / z0) * (ns - z0) };
      p.onZoom!(ns);
    };
    el.addEventListener('wheel', h, { passive: false });
    return () => el.removeEventListener('wheel', h);
  }, [board, p.zoom, p.onZoom]);

  const pos = () => layer.current!.getRelativePointerPosition()!;

  const cancelDrawing = () => {
    drawing.current = null; hideLive();
    setBand(null); setGhost(null); setErasing(new Set()); erased.current = new Set(); lastErase.current = null;
  };

  const onDown = (e: Konva.KonvaEventObject<PointerEvent>) => {
    const ev = e.evt;
    if (p.seekMode) return;
    pointers.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY, type: ev.pointerType });
    if (ev.pointerType === 'pen') penActive.current = true;
    if (ev.pointerType === 'touch' && tapOn && !penActive.current) {
      const touches = Array.from(pointers.current.values()).filter((v) => v.type === 'touch').length;
      const now = performance.now();
      if (touches === 1) tapG.current = { t0: now, max: 1, moved: false, start: new Map([[ev.pointerId, { x: ev.clientX, y: ev.clientY }]]) };
      else if (tapG.current && now - tapG.current.t0 < 350) {
        tapG.current.max = Math.max(tapG.current.max, touches); tapG.current.start.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
        clearTimeout(pendingStart.current); cancelDrawing();   // the first finger was the start of a gesture, not a mark
        if (!board && !p.onZoom) return;
      } else tapG.current = null;
    } else tapG.current = null;
    // two-finger pan / pinch on boards
    if ((board || p.onZoom) && pointers.current.size === 2 && Array.from(pointers.current.values()).every((v) => v.type === 'touch' || board)) {
      drawing.current = null; hideLive(); setBand(null); setGhost(null); setErasing(new Set()); erased.current = new Set();
      const [a, b] = Array.from(pointers.current.values());
      const sc = wrap.current?.closest('[data-scroll]') as HTMLElement | null;
      gesture.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, view: { ...view }, sl: sc?.scrollLeft ?? 0, st: sc?.scrollTop ?? 0, rl: wrap.current?.getBoundingClientRect().left ?? 0, rt: wrap.current?.getBoundingClientRect().top ?? 0 };
      return;
    }
    if (readOnly) return;
    // palm rejection: ignore touch while a stylus is in use, or always when "stylus only" is on
    const touchBlocked = ev.pointerType === 'touch' && (p.pencilOnly || penActive.current);
    if (tools.tool === 'hand' || touchBlocked) {
      drawing.current = { kind: 'pan', last: { x: ev.clientX, y: ev.clientY } };
      return;
    }
    // tools that create an object the instant a finger lands wait briefly, so a two-finger tap never leaves one behind
    if (ev.pointerType === 'touch' && tapG.current?.max === 1 && CREATES_ON_DOWN.includes(tools.tool)) { pendingStart.current = setTimeout(() => startAction(e), 90); return; }
    startAction(e);
  };

  const startAction = (e: Konva.KonvaEventObject<PointerEvent>) => {
    const ev = e.evt;
    const pt = pos();
    const onObject = !!e.target.findAncestor?.('.obj', true);
    // S Pen / stylus: hold the barrel button (or flip to the eraser end) to erase temporarily
    const t = ev.pointerType === 'pen' && !readOnly && ((ev.buttons & 32) || (ev.buttons & 2)) && ['pen', 'highlighter'].includes(tools.tool) ? 'eraser' : tools.tool;
    if (t === 'pen') {
      const pen = tools.pen;
      const pressure = createPressureFilter();   // smooths raw stylus pressure for this stroke
      const l = (pen === 'highlighter' ? live : liveInk).current!;
      drawing.current = { kind: 'pen', pen, node: l, points: [pt.x, pt.y, pressure(ev)], pressure, pointerId: ev.pointerId, rec: p.recClock?.() || undefined };
      l.setAttr('nvStroke', { id: 'live', type: 'stroke', pen, x: 0, y: 0, points: drawing.current.points, color: tools.colors[pen], size: tools.sizes[pen], opacity: pen === 'highlighter' ? PEN_DEFAULTS.highlighter.opacity : tools.opacity * PEN_DEFAULTS[pen].opacity });
      l.visible(true); l.getLayer()?.batchDraw();
    } else if (t === 'eraser') {
      drawing.current = { kind: 'eraser' }; erased.current = new Set(); lastErase.current = null; eraseAt(pt.x, pt.y);
    } else if (t === 'lasso' || (t === 'select' && !onObject)) {
      if (onObject && t === 'lasso') return;
      if (e.target.getParent()?.className === 'Transformer') return;
      drawing.current = { kind: t, points: [pt.x, pt.y], start: pt };
      setBand(t === 'lasso' ? [pt.x, pt.y] : [pt.x, pt.y, pt.x, pt.y]);
    } else if (t === 'shape') {
      drawing.current = { kind: 'shape', start: pt };
      setGhost({ id: 'ghost', type: 'shape', shape: tools.shape, x: pt.x, y: pt.y, w: 1, h: 1, stroke: tools.shapeColor, fill: tools.fill, size: tools.shapeSize, dash: tools.dash, opacity: tools.opacity });
    } else if (t === 'text' && !onObject) {
      const id = nanoid(8);
      p.onCommit([...objects, { id, type: 'text', x: pt.x, y: pt.y - tools.fontSize / 2, text: '', fontSize: tools.fontSize, color: tools.textColor, width: 380 }]);
      setTimeout(() => setEditing({ id }), 20);
    } else if (t === 'sticky' && !onObject) {
      const id = nanoid(8);
      p.onCommit([...objects, { id, type: 'sticky', x: pt.x - 90, y: pt.y - 30, w: 190, h: 160, text: '', color: tools.stickyColor, rotation: -1 }]);
      setTimeout(() => setEditing({ id }), 20);
    } else if (t === 'node' && !onObject) {
      const id = nanoid(8);
      p.onCommit([...objects, { id, type: 'node', x: pt.x - 80, y: pt.y - 24, w: 160, h: 48, text: '', color: tools.nodeColor, parent: null }]);
      p.onSelect([id]);
      setTimeout(() => setEditing({ id }), 20);
    } else if (t === 'table' && !onObject) {
      const id = nanoid(8);
      const tbl: TableObj = { id, type: 'table', x: pt.x, y: pt.y, colWidths: [140, 140, 140], rowHeight: 36, cells: [['Heading', 'Heading', 'Heading'], ['', '', ''], ['', '', '']], header: true, color: '#E4DDFB' };
      p.onCommit([...objects, tbl]); p.onSelect([id]);
    } else if (t === 'math' && !onObject) {
      p.onRequestMath?.(pt);
    }
  };

  // Drag-erase: sweep a path from the last position to this one so fast drags don't skip strokes
  const eraseAt = (x: number, y: number) => {
    const prev = lastErase.current; lastErase.current = { x, y };
    const r = tools.eraserSize;
    const steps = prev ? Math.max(1, Math.ceil(Math.hypot(x - prev.x, y - prev.y) / Math.max(2, r * 0.5))) : 1;
    let changed = false;
    for (const o of objsRef.current) {
      if (o.type !== 'stroke' || erased.current.has(o.id)) continue;
      for (let i = 1; i <= steps; i++) {
        const px = prev ? prev.x + ((x - prev.x) * i) / steps : x, py = prev ? prev.y + ((y - prev.y) * i) / steps : y;
        if (strokeHit(o as StrokeObj, px, py, r)) { erased.current.add(o.id); changed = true; break; }
      }
    }
    if (changed) setErasing(new Set(erased.current));
  };

  /**
   * Live pen movement. Runs straight from a native listener (see the effect below), NOT through Konva: Konva hit-tests
   * the pointer against every object on every move, which is what made the ink trail behind the pencil.
   */
  const penMove = (ev: PointerEvent) => {
    const d = drawing.current;
    if (!d || d.kind !== 'pen' || ev.pointerId !== d.pointerId) return;
    const box = wrap.current!.getBoundingClientRect();
    const inv = layer.current!.getAbsoluteTransform().copy().invert();
    const toLocal = (cx: number, cy: number) => inv.point({ x: cx - box.left, y: cy - box.top });
    const pts: number[] = d.points;
    const coalesced: PointerEvent[] = ev.getCoalescedEvents ? ev.getCoalescedEvents() : [];
    for (const ce of coalesced.length ? coalesced : [ev]) {
      const q = toLocal(ce.clientX, ce.clientY);
      const lx = pts[pts.length - 3], ly = pts[pts.length - 2];
      if ((lx - q.x) ** 2 + (ly - q.y) ** 2 < 0.2) continue;   // ~0.45px: keeps small loops and tone marks intact
      if (d.pen === 'highlighter' && ev.shiftKey) { pts.length = 3; pts.push(q.x, pts[1], -1); }
      else pts.push(q.x, q.y, d.pressure(ce));
    }
    // Preview only: let the browser's own prediction lead the pen tip (iOS Safari 18.2+). Never stored.
    const live0 = d.node.getAttr('nvStroke');
    if (live0) {
      const ahead: number[] = [];
      if (d.pen !== 'highlighter' && ev.pointerType === 'pen' && ev.getPredictedEvents) {
        const last = pts.length - 3;
        let px = pts[last], py = pts[last + 1];
        for (const pe of ev.getPredictedEvents().slice(0, 4)) {
          const q = toLocal(pe.clientX, pe.clientY);
          if (Math.hypot(q.x - px, q.y - py) > 24) break;   // ignore a jump the pen could not plausibly make in one frame
          ahead.push(q.x, q.y, pts[last + 2]); px = q.x; py = q.y;
        }
      }
      d.node.setAttr('nvStroke', { ...live0, points: ahead.length ? pts.concat(ahead) : pts });
    }
    d.node.getLayer()?.batchDraw();
  };
  const penMoveRef = useRef(penMove);
  penMoveRef.current = penMove;
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const h = (ev: PointerEvent) => {
      const d = drawing.current;
      if (!d || d.kind !== 'pen' || ev.pointerId !== d.pointerId || gesture.current) return;
      ev.stopPropagation();   // capture phase on the wrapper: Konva never sees this move, so it skips its hit test
      penMoveRef.current(ev);
    };
    el.addEventListener('pointermove', h, true);
    return () => el.removeEventListener('pointermove', h, true);
  }, []);

  const onMove = (e: Konva.KonvaEventObject<PointerEvent>) => {
    const ev = e.evt;
    if (pointers.current.has(ev.pointerId)) pointers.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY, type: ev.pointerType });
    const tg = tapG.current, s0 = tg?.start.get(ev.pointerId);
    if (tg && s0 && Math.hypot(ev.clientX - s0.x, ev.clientY - s0.y) > 12) tg.moved = true;
    if (gesture.current && pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      const g = gesture.current, d = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      const r = wrap.current!.getBoundingClientRect();
      if (!board) {   // page: pinch zooms, two-finger drag scrolls, anchored on the pinch centre
        const z0 = g.view.scale, nz = clamp(+(z0 * (d / (g.dist || 1))).toFixed(3), 0.3, 4);
        const sc = wrap.current?.closest('[data-scroll]') as HTMLElement | null;
        const l = (g.sl ?? 0) + ((g.cx - (g.rl ?? 0)) / z0) * (nz - z0) + (g.cx - cx);
        const t = (g.st ?? 0) + ((g.cy - (g.rt ?? 0)) / z0) * (nz - z0) + (g.cy - cy);
        if (Math.abs(nz - (p.zoom || 1)) > 0.001) { pendingScroll.current = { l, t }; p.onZoom?.(nz); }
        else if (sc) { sc.scrollLeft = l; sc.scrollTop = t; }
        return;
      }
      const ns = clamp(g.view.scale * (d / (g.dist || 1)), 0.1, 5);
      const px = g.cx - r.left, py = g.cy - r.top;
      p.onView?.({ scale: ns, x: px - ((px - g.view.x) / g.view.scale) * ns + (cx - g.cx), y: py - ((py - g.view.y) / g.view.scale) * ns + (cy - g.cy) });
      return;
    }
    const d = drawing.current;
    if (!d) return;
    if (d.kind === 'pan') {
      const dx = ev.clientX - d.last.x, dy = ev.clientY - d.last.y;
      d.last = { x: ev.clientX, y: ev.clientY };
      if (board) p.onView?.({ ...view, x: view.x + dx, y: view.y + dy });
      else (wrap.current?.closest('[data-scroll]') as HTMLElement | null)?.scrollBy(-dx, -dy);
      return;
    }
    if (d.kind === 'pen') { penMoveRef.current(ev); return; }   // normally handled by the fast path below, never reaches here
    const pt = pos();
    if (d.kind === 'eraser') eraseAt(pt.x, pt.y);
    else if (d.kind === 'lasso') { d.points.push(pt.x, pt.y); setBand([...d.points]); }
    else if (d.kind === 'select') setBand([d.start.x, d.start.y, pt.x, pt.y]);
    else if (d.kind === 'shape' && ghost) {
      const s = d.start, g = ghost as any;
      if (g.shape === 'line' || g.shape === 'arrow') setGhost({ ...g, x: s.x, y: s.y, w: pt.x - s.x, h: pt.y - s.y });
      else {
        let w = pt.x - s.x, h = pt.y - s.y;
        if (ev.shiftKey) { const m = Math.max(Math.abs(w), Math.abs(h)); w = Math.sign(w || 1) * m; h = Math.sign(h || 1) * m; }
        setGhost({ ...g, x: Math.min(s.x, s.x + w), y: Math.min(s.y, s.y + h), w: Math.abs(w), h: Math.abs(h) });
      }
    }
  };

  const onUp = (e?: Konva.KonvaEventObject<PointerEvent>) => {
    if (e) { pointers.current.delete(e.evt.pointerId); if (e.evt.pointerType === 'pen') setTimeout(() => { penActive.current = false; }, 600); }
    const tg = tapG.current;
    if (e && tg && e.evt.pointerType === 'touch') {
      if (e.evt.type === 'pointercancel') tapG.current = null;
      else if (e.evt.type === 'pointerup' && tg.max >= 2 && !Array.from(pointers.current.values()).some((v) => v.type === 'touch')) {
        tapG.current = null; gesture.current = null;
        if (!tg.moved && performance.now() - tg.t0 < 400) { if (tg.max === 2) p.onUndo?.(); else if (tg.max === 3) p.onRedo?.(); }
        return;
      }
    }
    if (gesture.current) { if (pointers.current.size < 2) gesture.current = null; return; }
    const d = drawing.current;
    drawing.current = null;
    if (!d) return;
    if (d.kind === 'pen') {
      // Keep the preview up until the saved stroke has been painted, so there is no one-frame blink when the pen lifts.
      const node = d.node, onTop = node === liveInk.current && tools.opacity >= 1;
      const done = () => { if (drawing.current?.node === node) return; node.visible(false); node.getLayer()?.batchDraw(); };
      if (onTop) requestAnimationFrame(() => requestAnimationFrame(done)); else done();
      d.pressure?.learn?.();
      const pen: PenKind = d.pen;
      const stroke: StrokeObj = {
        id: nanoid(8), type: 'stroke', pen, x: 0, y: 0, points: d.points.map((n: number) => Math.round(n * 100) / 100),
        color: tools.colors[pen], size: tools.sizes[pen],
        opacity: pen === 'highlighter' ? PEN_DEFAULTS.highlighter.opacity : tools.opacity * PEN_DEFAULTS[pen].opacity,
        ...(d.rec ? { rec: d.rec } : {}),
      };
      p.onCommit([...objects, stroke]);
    } else if (d.kind === 'eraser') {
      const gone = erased.current;
      if (gone.size) p.onCommit(objects.filter((o) => !gone.has(o.id)));
      erased.current = new Set(); lastErase.current = null; setErasing(new Set());
    } else if (d.kind === 'lasso' || d.kind === 'select') {
      const l = layer.current!;
      const poly = d.kind === 'lasso' ? d.points : null;
      const b4 = band && d.kind === 'select' ? { x1: Math.min(band[0], band[2]), y1: Math.min(band[1], band[3]), x2: Math.max(band[0], band[2]), y2: Math.max(band[1], band[3]) } : null;
      const ids: string[] = [];
      if ((poly && poly.length > 6) || (b4 && b4.x2 - b4.x1 > 4)) {
        for (const o of objects) {
          if (o.type === 'connector') continue;
          const n = l.findOne('#' + o.id); if (!n) continue;
          const r = n.getClientRect({ relativeTo: l as any });
          const pts = [[r.x + r.width / 2, r.y + r.height / 2], [r.x, r.y], [r.x + r.width, r.y], [r.x, r.y + r.height], [r.x + r.width, r.y + r.height]];
          const inside = poly ? pts.filter(([x, y]) => pointInPoly(x, y, poly)).length >= 3 || pointInPoly(pts[0][0], pts[0][1], poly)
            : b4 && r.x >= b4.x1 - 2 && r.y >= b4.y1 - 2 && r.x + r.width <= b4.x2 + 2 && r.y + r.height <= b4.y2 + 2;
          if (inside) ids.push(o.id);
        }
      }
      p.onSelect(ids); setBand(null);
    } else if (d.kind === 'shape' && ghost) {
      const g = ghost as any; setGhost(null);
      if (Math.abs(g.w) > 4 || Math.abs(g.h) > 4) { const id = nanoid(8); p.onCommit([...objects, { ...g, id }]); }
    }
  };

  const commitNodes = (extra?: string) => {
    const l = layer.current!;
    const ids = new Set(selected); if (extra) ids.add(extra);
    p.onCommit(objects.map((o) => {
      if (!ids.has(o.id) || o.type === 'connector') return o;
      const n = l.findOne('#' + o.id); if (!n) return o;
      return { ...o, x: n.x(), y: n.y(), rotation: n.rotation(), scaleX: n.scaleX(), scaleY: n.scaleY() };
    }));
  };
  const ct = useRef<any>();
  const scheduleCommit = (extra?: string) => { clearTimeout(ct.current); ct.current = setTimeout(() => commitNodes(extra), 0); };

  const onObjDown = (o: CanvasObject, e: any) => {
    if (p.seekMode) { if (o.type === 'stroke' && (o as StrokeObj).rec) { e.cancelBubble = true; p.onSeek?.((o as StrokeObj).rec!); } return; }
    if (readOnly) return;
    if (tools.tool === 'connector') {
      e.cancelBubble = true;
      if (o.type === 'connector') return;
      if (!connFrom) { setConnFrom(o.id); p.onHint?.('Now tap the object to connect to'); }
      else if (connFrom !== o.id) {
        p.onCommit([...objects, { id: nanoid(8), type: 'connector', x: 0, y: 0, from: connFrom, to: o.id, stroke: tools.shapeColor, size: Math.max(2, tools.shapeSize), arrow: true, curved: false } as ConnectorObj]);
        setConnFrom(null); p.onHint?.('Connected. Tap another object to start a new connector');
      }
      return;
    }
    if (tools.tool === 'eraser' && o.type !== 'stroke') return;
    if (!SELECTABLE.includes(tools.tool)) return;
    e.cancelBubble = true;
    const multi = e.evt?.shiftKey || e.evt?.metaKey || e.evt?.ctrlKey;
    if (multi) p.onSelect(selected.includes(o.id) ? selected.filter((x) => x !== o.id) : [...selected, o.id]);
    else if (!selected.includes(o.id)) p.onSelect([o.id]);
  };

  const onObjDbl = (o: CanvasObject) => {
    if (readOnly) return;
    if (o.type === 'text' || o.type === 'sticky' || o.type === 'node') setEditing({ id: o.id });
    else if (o.type === 'shape' && !['line', 'arrow'].includes(o.shape)) setEditing({ id: o.id });
    else if (o.type === 'math') p.onRequestMath?.(null, o);
    else if (o.type === 'table') {
      const pt = pos();
      const lx = (pt.x - o.x) / (o.scaleX ?? 1), ly = (pt.y - o.y) / (o.scaleY ?? 1);
      let acc = 0, c = 0;
      for (; c < o.colWidths.length; c++) { if (lx < acc + o.colWidths[c]) break; acc += o.colWidths[c]; }
      const r = clamp(Math.floor(ly / o.rowHeight), 0, o.cells.length - 1);
      setEditing({ id: o.id, r, c: clamp(c, 0, o.colWidths.length - 1) });
    }
  };

  const renderObj = (o: CanvasObject, isGhost = false) => {
    const sel = selected.includes(o.id);
    const common: any = {
      key: o.id, id: isGhost ? undefined : o.id, name: isGhost ? 'ghost' : 'obj', x: o.x, y: o.y,
      rotation: o.rotation || 0, scaleX: o.scaleX ?? 1, scaleY: o.scaleY ?? 1,
      opacity: erasing.has(o.id) ? 0.15 : o.type === 'stroke' ? ((o as StrokeObj).rec && p.playback && (o as StrokeObj).rec!.clip === p.playback.clip && (o as StrokeObj).rec!.ms > p.playback.ms ? 0.12 : 1) : o.opacity ?? 1,
      draggable: !readOnly && !isGhost && (tools.tool === 'select' || (tools.tool === 'lasso' && sel)),
      onPointerDown: (e: any) => onObjDown(o, e),
      onDragStart: () => { if (!selected.includes(o.id)) p.onSelect([o.id]); },
      onDragMove: (e: any) => { const n = e.target; setLivePos((lp) => ({ ...lp, [o.id]: { x: n.x(), y: n.y() } })); },
      onDragEnd: () => scheduleCommit(o.id),
      onTransformEnd: () => scheduleCommit(),
      onDblClick: () => onObjDbl(o), onDblTap: () => onObjDbl(o),
      // While writing/erasing nothing needs to be clickable. Not listening means Konva skips drawing every stroke into its
      // hidden hit canvas (the biggest cost after each saved stroke) and has nothing to hit-test.
      listening: !readOnly && !isGhost && tools.tool !== 'pen' && tools.tool !== 'eraser',
    };
    const highlightConn = connFrom === o.id;
    switch (o.type) {
      case 'stroke':
        return (
          <Group {...common}>
            <Shape sceneFunc={(ctx) => paintStroke((ctx as any)._context, o)}
              hitFunc={(ctx, shape) => { const c = (ctx as any)._context as CanvasRenderingContext2D; c.fillStyle = (shape as any).colorKey; c.strokeStyle = (shape as any).colorKey; c.lineWidth = 10; const pth = strokePath(o); c.fill(pth); c.stroke(pth); }} />
          </Group>
        );
      case 'shape': {
        const pts = shapePoints(o.shape, o.w, o.h);
        const st = { stroke: highlightConn ? ACC.ink : o.stroke, strokeWidth: o.size, fill: o.fill || undefined, dash: o.dash ? [o.size * 3, o.size * 2.5] : undefined, hitStrokeWidth: 14 };
        return (
          <Group {...common}>
            {o.shape === 'line' ? <Line points={[0, 0, o.w, o.h]} {...st} lineCap="round" />
              : o.shape === 'arrow' ? <Arrow points={[0, 0, o.w, o.h]} {...st} fill={o.stroke} pointerLength={10 + o.size * 2} pointerWidth={10 + o.size * 2} lineCap="round" />
              : o.shape === 'ellipse' ? <Ellipse x={o.w / 2} y={o.h / 2} radiusX={Math.abs(o.w / 2)} radiusY={Math.abs(o.h / 2)} {...st} fillEnabled />
              : pts ? <Line points={pts} closed {...st} />
              : <Rect width={o.w} height={o.h} cornerRadius={o.shape === 'rounded' ? Math.min(18, Math.abs(o.h) / 2) : 4} {...st} />}
            {o.label && editing?.id !== o.id && !['line', 'arrow'].includes(o.shape) && (
              <Text text={o.label} width={Math.abs(o.w)} height={Math.abs(o.h)} align="center" verticalAlign="middle" padding={8} fontSize={15} fontFamily={FONT} fontStyle="500" fill="#2F2B45" listening={false} />
            )}
          </Group>
        );
      }
      case 'sticky':
        return (
          <Group {...common}>
            <Rect width={o.w} height={o.h} fill={o.color} cornerRadius={6} shadowColor="#2F2B45" shadowOpacity={0.14} shadowBlur={14} shadowOffsetY={4} stroke={highlightConn ? ACC.ink : undefined} strokeWidth={2} />
            {editing?.id !== o.id && <Text text={o.text || 'Double-tap to write…'} width={o.w - 28} x={14} y={14} fontSize={15} lineHeight={1.4} fontFamily={FONT} fill={o.text ? '#2F2B45' : '#2F2B4566'} wrap="word" />}
          </Group>
        );
      case 'node':
        return (
          <Group {...common}>
            <Rect width={o.w} height={o.h} fill={o.color} cornerRadius={Math.min(22, o.h / 2)} stroke={highlightConn || sel ? ACC.main : '#2F2B451f'} strokeWidth={highlightConn || sel ? 2 : 1} shadowColor="#2F2B45" shadowOpacity={0.06} shadowBlur={8} shadowOffsetY={2} />
            {editing?.id !== o.id && <Text text={o.text || 'Idea'} width={o.w} height={o.h} align="center" verticalAlign="middle" padding={10} fontSize={15} fontStyle="600" fontFamily={FONT} fill={o.text ? '#2F2B45' : '#2F2B4566'} wrap="word" />}
          </Group>
        );
      case 'text':
        return (
          <Group {...common}>
            <Label opacity={editing?.id === o.id ? 0 : 1}>
              <Tag fill={o.highlight || undefined} cornerRadius={3} />
              <Text text={o.text || ' '} width={o.width} fontSize={o.fontSize} fontFamily={FONT} fill={o.color} lineHeight={1.35} wrap="word" align={o.align || 'left'}
                fontStyle={`${o.italic ? 'italic ' : ''}${o.bold ? 'bold' : 'normal'}`} textDecoration={o.underline ? 'underline' : ''} padding={2} />
            </Label>
          </Group>
        );
      case 'table': {
        const W = o.colWidths.reduce((s, c) => s + c, 0), H = o.cells.length * o.rowHeight;
        const xs: number[] = []; o.colWidths.reduce((acc, c) => { xs.push(acc); return acc + c; }, 0);
        return (
          <Group {...common}>
            <Rect width={W} height={H} fill="#fff" stroke={highlightConn ? ACC.ink : '#D5CEE4'} strokeWidth={1} />
            {o.header && <Rect width={W} height={o.rowHeight} fill={o.color} />}
            {xs.slice(1).map((x, i) => <Line key={'c' + i} points={[x, 0, x, H]} stroke="#D5CEE4" strokeWidth={1} listening={false} />)}
            {o.cells.slice(1).map((_, r) => <Line key={'r' + r} points={[0, (r + 1) * o.rowHeight, W, (r + 1) * o.rowHeight]} stroke="#D5CEE4" strokeWidth={1} listening={false} />)}
            {o.cells.map((row, r) => row.map((cell, c) => (editing?.id === o.id && editing.r === r && editing.c === c) ? null : (
              <Text key={`${r}-${c}`} x={xs[c]} y={r * o.rowHeight} width={o.colWidths[c]} height={o.rowHeight} padding={8} verticalAlign="middle" text={cell} fontSize={14} fontFamily={FONT} fontStyle={r === 0 && o.header ? '600' : 'normal'} fill="#2F2B45" ellipsis wrap="none" listening={false} />
            )))}
          </Group>
        );
      }
      case 'math':
        return <Group {...common}><Rect width={o.w} height={o.h} fill="transparent" /><MathNode latex={o.latex} fontSize={o.fontSize} color={o.color} w={o.w} h={o.h} /></Group>;
      case 'image':
        return <Group {...common}><ImgNode src={o.src} w={o.w} h={o.h} /></Group>;
      case 'connector': {
        const e = connectorEnds(o, byId, livePos);
        if (!e) return null;
        const pts = o.curved ? [e.x1, e.y1, (e.x1 + e.x2) / 2, e.y1, (e.x1 + e.x2) / 2, e.y2, e.x2, e.y2] : [e.x1, e.y1, e.x2, e.y2];
        const cprops = { points: pts, stroke: sel ? ACC.ink : o.stroke, strokeWidth: o.size, hitStrokeWidth: 16, lineCap: 'round' as const, bezier: !!o.curved };
        return (
          <Group key={o.id} id={o.id} name="conn" listening={!readOnly} onPointerDown={(ev: any) => { if (SELECTABLE.includes(tools.tool)) { ev.cancelBubble = true; p.onSelect([o.id]); } }}>
            {o.arrow ? <Arrow {...cprops} fill={sel ? ACC.ink : o.stroke} pointerLength={8 + o.size * 2} pointerWidth={8 + o.size * 2} /> : <Line {...cprops} />}
          </Group>
        );
      }
    }
  };

  const bg = useMemo(() => {
    const b = p.background;
    if (b.kind === 'template') return <Shape listening={false} sceneFunc={(ctx) => drawTemplate((ctx as any)._context, width, height, b.template, { customImage: b.customImage })} />;
    if (b.kind === 'image') return b.image ? <KImage image={b.image} width={width} height={height} listening={false} /> : <Rect width={width} height={height} fill="#fff" listening={false} />;
    return null;
  }, [p.background, width, height]);

  const toScreen = (x: number, y: number) => ({ x: x * view.scale + view.x, y: y * view.scale + view.y });
  const ed = editing ? byId.get(editing.id) as any : null;

  const liveScene = (ctx: any, shape: Konva.Shape) => {
    const s = shape.getAttr('nvStroke') as StrokeObj | undefined;
    if (!s || s.points.length < 3) return;
    const c = ctx._context as CanvasRenderingContext2D;
    c.save(); c.globalAlpha = s.opacity ?? 1; if (s.pen === 'highlighter') c.globalCompositeOperation = 'multiply';
    c.fillStyle = s.color; c.fill(new Path2D(svgPath(strokeOutline(s.points, s.pen, s.size)))); c.restore();
  };
  const touchAction = readOnly || (tools.tool === 'hand' && !board) ? 'auto' : 'none';
  const cursor = ({ pen: 'crosshair', eraser: 'cell', text: 'text', sticky: 'copy', node: 'copy', table: 'copy', math: 'copy', hand: 'grab', lasso: 'crosshair', select: 'default', shape: 'crosshair', connector: 'pointer' } as Record<Tool, string>)[tools.tool];
  const stageW = board ? width : width * view.scale, stageH = board ? height : height * view.scale;

  return (
    <div ref={wrap} className="relative select-none" style={{ width: stageW, height: stageH, touchAction, cursor }}>
      <Stage ref={stage as any} width={stageW} height={stageH} x={view.x} y={view.y} scaleX={view.scale} scaleY={view.scale}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        onPointerLeave={(e) => { if (drawing.current?.kind !== 'pan') onUp(e); }}>
        <Layer listening={false}>
          {board && p.background.kind === 'board' ? (
            <Shape sceneFunc={(ctx) => {
              const b = p.background as any; const s = view.scale;
              drawBoardBackground((ctx as any)._context, -view.x / s, -view.y / s, (-view.x + width) / s, (-view.y + height) / s, b, s);
            }} />
          ) : bg}
        </Layer>
        <Layer ref={layer}>
          {objects.filter((o) => o.type === 'connector').map((o) => renderObj(o))}
          {objects.filter((o) => o.type !== 'connector').map((o) => renderObj(o))}
          {ghost && renderObj(ghost, true)}
          <Shape ref={live} visible={false} listening={false} sceneFunc={liveScene} />
          {band && band.length === 4 && <Rect listening={false} x={Math.min(band[0], band[2])} y={Math.min(band[1], band[3])} width={Math.abs(band[2] - band[0])} height={Math.abs(band[3] - band[1])} fill={ACC.main + '1f'} stroke={ACC.main} dash={[6, 4]} strokeWidth={1 / view.scale} />}
          {band && band.length > 4 && <Line listening={false} points={band} closed fill={ACC.main + '14'} stroke={ACC.main} dash={[6, 4]} strokeWidth={1.5 / view.scale} />}
          <Transformer ref={tr} rotateEnabled shouldOverdrawWholeArea anchorSize={10} anchorCornerRadius={5} borderStroke={ACC.main} anchorStroke={ACC.main} anchorFill="#fff" borderDash={[4, 4]}
            boundBoxFunc={(o, n) => (Math.abs(n.width) < 8 || Math.abs(n.height) < 8 ? o : n)} onDragEnd={() => scheduleCommit()} onTransformEnd={() => scheduleCommit()} />
        </Layer>
        <Layer listening={false}>
          <Shape ref={liveInk} visible={false} listening={false} sceneFunc={liveScene} />
        </Layer>
      </Stage>
      {ed && <EditOverlay o={ed} cell={editing} toScreen={toScreen} scale={view.scale} onDone={(val) => {
        const cur = editing!; setEditing(null);
        if (ed.type === 'table') {
          const cells = ed.cells.map((row: string[], r: number) => row.map((c: string, ci: number) => (r === cur.r && ci === cur.c ? val : c)));
          p.onCommit(objects.map((o) => (o.id === ed.id ? { ...o, cells } as any : o)));
        } else if (ed.type === 'shape') {
          p.onCommit(objects.map((o) => (o.id === ed.id ? { ...o, label: val } as any : o)));
        } else if (!val.trim() && (ed.type === 'text')) removeIds([ed.id]);
        else p.onCommit(objects.map((o) => (o.id === ed.id ? { ...o, text: val } as any : o)));
      }} />}
    </div>
  );
}

function EditOverlay({ o, cell, toScreen, scale, onDone }: { o: any; cell: { r?: number; c?: number } | null; toScreen: (x: number, y: number) => { x: number; y: number }; scale: number; onDone: (v: string) => void }) {
  const sx = (o.scaleX ?? 1) * scale, sy = (o.scaleY ?? 1) * scale;
  let x = o.x, y = o.y, w = 300, h = 60, fs = 16, value = '', align: any = 'left', pad = 4, weight = 400;
  if (o.type === 'text') { w = o.width; h = Math.max(o.fontSize * 1.6, 56); fs = o.fontSize; value = o.text; weight = o.bold ? 700 : 400; }
  else if (o.type === 'sticky') { x += 14; y += 14; w = o.w - 28; h = o.h - 28; fs = 15; value = o.text; }
  else if (o.type === 'node' || o.type === 'shape') { w = Math.abs(o.w); h = Math.abs(o.h); fs = 15; value = o.type === 'node' ? o.text : o.label || ''; align = 'center'; pad = 10; weight = 600; }
  else if (o.type === 'table' && cell) {
    const cx = o.colWidths.slice(0, cell.c).reduce((s: number, v: number) => s + v, 0);
    x += cx * (o.scaleX ?? 1); y += (cell.r! * o.rowHeight) * (o.scaleY ?? 1); w = o.colWidths[cell.c!]; h = o.rowHeight; fs = 14; value = o.cells[cell.r!][cell.c!]; pad = 8;
  }
  const s = toScreen(x, y);
  return (
    <textarea autoFocus defaultValue={value} aria-label="Edit text"
      placeholder={o.type === 'sticky' ? 'Note…' : o.type === 'table' ? '' : 'Type here…'}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={(e) => onDone(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') (e.target as HTMLTextAreaElement).blur();
        if ((o.type === 'table' || o.type === 'node') && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); (e.target as HTMLTextAreaElement).blur(); }
      }}
      className="absolute z-10 resize-none rounded bg-white/90 outline-none ring-2 ring-primary"
      style={{ left: s.x, top: s.y, width: w * sx, height: h * sy, fontSize: fs * sy, lineHeight: 1.38, fontFamily: FONT, color: o.color && o.type === 'text' ? o.color : '#2F2B45',
        padding: pad * sy, textAlign: align, fontWeight: weight, fontStyle: o.italic ? 'italic' : 'normal', transform: o.rotation ? `rotate(${o.rotation}deg)` : undefined, transformOrigin: 'top left' }} />
  );
}
