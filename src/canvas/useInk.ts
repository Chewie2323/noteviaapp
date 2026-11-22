import { useCallback, useEffect, useRef, useState } from 'react';
import { inkIdle, watchInkActivity } from './inkActivity';
import { nanoid } from 'nanoid';
import type { CanvasObject, NodeObj } from '@/lib/types';
import { db } from '@/lib/backend';

/** Per-page undo / redo. */
export function useHistory() {
  const stacks = useRef(new Map<string, { past: CanvasObject[][]; future: CanvasObject[][] }>());
  const [, tick] = useState(0);
  const get = (k: string) => { if (!stacks.current.has(k)) stacks.current.set(k, { past: [], future: [] }); return stacks.current.get(k)!; };
  return {
    push(k: string, prev: CanvasObject[]) { const s = get(k); s.past.push(prev); if (s.past.length > 150) s.past.shift(); s.future = []; tick((t) => t + 1); },
    undo(k: string, cur: CanvasObject[]) { const s = get(k); const v = s.past.pop(); if (v) s.future.push(cur); tick((t) => t + 1); return v || null; },
    redo(k: string, cur: CanvasObject[]) { const s = get(k); const v = s.future.pop(); if (v) s.past.push(cur); tick((t) => t + 1); return v || null; },
    canUndo: (k: string) => !!stacks.current.get(k)?.past.length,
    canRedo: (k: string) => !!stacks.current.get(k)?.future.length,
  };
}

export function selectionOps(objects: CanvasObject[], selected: string[]) {
  const sel = new Set(selected);
  return {
    patch: (fn: (o: CanvasObject) => CanvasObject) => objects.map((o) => (sel.has(o.id) ? fn(o) : o)),
    remove: () => objects.filter((o) => !sel.has(o.id) && !(o.type === 'connector' && (sel.has(o.from) || sel.has(o.to)))),
    duplicate: () => {
      const map = new Map<string, string>();
      const copies = objects.filter((o) => sel.has(o.id) && o.type !== 'connector').map((o) => { const id = nanoid(8); map.set(o.id, id); return { ...o, id, x: o.x + 24, y: o.y + 24 }; });
      const conns = objects.filter((o) => o.type === 'connector' && map.has(o.from) && map.has(o.to)).map((o: any) => ({ ...o, id: nanoid(8), from: map.get(o.from), to: map.get(o.to) }));
      return { objects: [...objects, ...copies, ...conns], ids: copies.map((c) => c.id) };
    },
    order: (front: boolean) => { const a = objects.filter((o) => sel.has(o.id)), b = objects.filter((o) => !sel.has(o.id)); return front ? [...b, ...a] : [...a, ...b]; },
  };
}

/** Mind map: add a branch (child) or sibling to a node, joined by a curved connector. */
export function addMindNode(objects: CanvasObject[], nodeId: string, sibling: boolean): { objects: CanvasObject[]; id: string } | null {
  const n = objects.find((o) => o.id === nodeId) as NodeObj | undefined;
  if (!n || n.type !== 'node') return null;
  const parentId = sibling ? n.parent : n.id;
  if (sibling && !parentId) return null;
  const parent = objects.find((o) => o.id === parentId) as NodeObj;
  const kids = objects.filter((o) => o.type === 'node' && (o as NodeObj).parent === parent.id) as NodeObj[];
  const dir = parent.parent ? Math.sign(parent.x - (objects.find((o) => o.id === parent.parent)?.x ?? parent.x - 1)) || 1 : (kids.length % 2 === 0 ? 1 : -1);
  const side = kids.filter((k) => Math.sign(k.x - parent.x) === dir);
  const id = nanoid(8);
  const child: NodeObj = {
    id, type: 'node', parent: parent.id, text: '', color: parent.color === '#E4DDFB' ? ['#D5ECE3', '#F9D9E6', '#D6E7F8', '#FDE3D6'][kids.length % 4] : parent.color,
    w: 150, h: 44, x: parent.x + dir * (parent.w + 90) + (dir < 0 ? parent.w - 150 : 0), y: parent.y + (side.length - (side.length > 0 ? 0 : 0)) * 64 - (side.length ? 0 : 0) + (side.length ? 0 : -0),
  };
  // spread siblings vertically around the parent
  child.y = parent.y + parent.h / 2 - 22 + (side.length % 2 ? 1 : -1) * Math.ceil(side.length / 2) * 64;
  const conn: CanvasObject = { id: nanoid(8), type: 'connector', x: 0, y: 0, from: parent.id, to: id, stroke: '#6D60C2', size: 2, arrow: false, curved: true };
  return { objects: [...objects, conn, child], id };
}

/** Upload an image into private storage and return a storage reference + fitted size. */
export async function storeImage(prefix: string, file: File, maxW = 420) {
  const ext = (file.type.split('/')[1] || 'png').replace('jpeg', 'jpg').replace('svg+xml', 'svg');
  const path = `${prefix}/img-${nanoid(10)}.${ext}`;
  await db.upload('notebooks', path, file);
  const dims = await new Promise<{ w: number; h: number }>((res) => {
    const i = new Image(); i.onload = () => res({ w: i.naturalWidth || 400, h: i.naturalHeight || 300 }); i.onerror = () => res({ w: 400, h: 300 }); i.src = URL.createObjectURL(file);
  });
  const s = Math.min(1, maxW / dims.w);
  return { src: `storage:notebooks/${path}`, w: dims.w * s, h: dims.h * s };
}

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';
export interface Saver {
  schedule: (key: string, fn: () => Promise<void>, ms?: number) => void;
  /** Run any queued saves right now (used when the tab is hidden or the editor closes). */
  flush: () => void;
  subscribe: (cb: () => void) => () => void;
  getState: () => SaveState;
}
/**
 * Autosave with a debounce. Two things keep it from disturbing handwriting:
 *  1. The save status lives OUTSIDE React state. If the editor owned it, every "Saving…" / "Saved" flip would re-render
 *     the editor and canvas mid-stroke. Only <SaveBadge> subscribes, so only the little badge re-renders.
 *  2. The save itself (serialising the page, the network request, the Realtime echo) waits until the pen has been
 *     lifted for a moment, instead of firing in the gap between two strokes.
 * The returned object is stable for the component's lifetime.
 */
function createSaver(): Saver {
  let state: SaveState = 'idle';
  const subs = new Set<() => void>();
  const set = (s: SaveState) => { if (s !== state) { state = s; subs.forEach((f) => f()); } };
  const timers: Record<string, any> = {};
  const queued: Record<string, () => Promise<void>> = {};
  let pending = 0;
  const run = async (key: string) => {
    const fn = queued[key];
    if (!fn) return;
    delete queued[key]; delete timers[key];
    pending++;
    try { await fn(); set(pending > 1 ? 'saving' : 'saved'); }
    catch (e) { console.error(e); set('error'); setTimeout(() => { if (!queued[key]) schedule(key, fn, 3000); }, 0); }   // never overwrite a newer queued save with this older one
    finally { pending--; }
  };
  const arm = (key: string, ms: number) => {
    clearTimeout(timers[key]);
    timers[key] = setTimeout(() => {
      if (!inkIdle(600)) { arm(key, 300); return; }   // still writing — look again shortly
      run(key);
    }, ms);
  };
  const schedule: Saver['schedule'] = (key, fn, ms = 900) => {
    queued[key] = fn;
    set('saving');
    arm(key, ms);
  };
  const flush = () => { Object.keys(queued).forEach((k) => { clearTimeout(timers[k]); run(k); }); };
  return { schedule, flush, subscribe: (cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, getState: () => state };
}
export function useSaver(): Saver {
  const ref = useRef<Saver | null>(null);
  if (!ref.current) ref.current = createSaver();
  const saver = ref.current;
  useEffect(() => {
    watchInkActivity();
    const hide = () => { if (document.visibilityState === 'hidden') saver.flush(); };
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('pagehide', saver.flush);
    return () => { document.removeEventListener('visibilitychange', hide); window.removeEventListener('pagehide', saver.flush); saver.flush(); };
  }, [saver]);
  return saver;
}
