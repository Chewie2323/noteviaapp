import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { db, now } from '@/lib/backend';
import { useApp } from '@/lib/app';
import { useLocalState } from '@/lib/hooks';
import type { Annotation, AnnotationPage, CanvasObject } from '@/lib/types';
import { DEFAULT_TOOLS, InkCanvas, ToolState } from '@/canvas/InkCanvas';
import { Toolbar } from '@/canvas/Toolbar';
import { selectionOps, useHistory, useSaver } from '@/canvas/useInk';

const KEY = 'ink';
const blankPage = (): AnnotationPage => ({ key: KEY, source: 'blank', rotation: 0, objects: [] });

/** The user's private handwriting layer for any document (Word, slides, sheets, images, text, Notevia pages). */
export function useDocInk(docId: string | undefined) {
  const app = useApp();
  const [ann, setAnn] = useState<Annotation | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const hist = useHistory();
  const saver = useSaver();
  const [tools, setTools] = useLocalState<ToolState>('nv-doc-tools', { ...DEFAULT_TOOLS, tool: 'pen', pen: 'ballpoint' });

  useEffect(() => {
    if (!docId) return;
    let alive = true;
    setAnn(null);
    (async () => {
      let a = (await db.list<Annotation>('annotations', { document_id: docId, owner_id: app.user.id }))[0];
      if (!a) a = await db.insert<Annotation>('annotations', { document_id: docId, owner_id: app.user.id, pages: [blankPage()], updated_at: now() });
      if (!a.pages?.length) a = { ...a, pages: [blankPage()] };
      if (alive) setAnn(a);
    })().catch((e) => console.error('ink layer', e));
    return () => { alive = false; };
  }, [docId, app.user.id]);

  const objects: CanvasObject[] = ann?.pages[0]?.objects ?? [];
  const setObjects = useCallback((objs: CanvasObject[], record = true) => {
    if (!ann) return;
    if (record) hist.push(KEY, ann.pages[0].objects);
    const next = { ...ann, pages: [{ ...ann.pages[0], objects: objs }, ...ann.pages.slice(1)] };
    setAnn(next);
    saver.schedule('ink', () => db.update('annotations', next.id, { pages: next.pages, updated_at: now() }, true));
  }, [ann, hist, saver]);
  const undo = () => { const v = hist.undo(KEY, objects); if (v) setObjects(v, false); };
  const redo = () => { const v = hist.redo(KEY, objects); if (v) setObjects(v, false); };
  const ops = selectionOps(objects, selected);
  return {
    ready: !!ann, objects, setObjects, undo, redo, tools, setTools, selected, setSelected, saveState: saver.state,
    canUndo: hist.canUndo(KEY), canRedo: hist.canRedo(KEY),
    toolbar: (
      <Toolbar tools={tools} setTools={setTools} canUndo={hist.canUndo(KEY)} canRedo={hist.canRedo(KEY)} onUndo={undo} onRedo={redo}
        selection={objects.filter((o) => selected.includes(o.id))}
        onPatch={(fn) => setObjects(ops.patch(fn))} onDelete={() => { setObjects(ops.remove()); setSelected([]); }}
        onDuplicate={() => { const r = ops.duplicate(); setObjects(r.objects); setSelected(r.ids); }} onOrder={(f) => setObjects(ops.order(f))} />
    ),
  };
}
export type DocInk = ReturnType<typeof useDocInk>;

/**
 * Lays a transparent ink canvas over `children`, sized to match them.
 * While `writing` is on the pen (Apple Pencil, S Pen, finger or mouse) draws straight onto the content; otherwise
 * the strokes stay visible but touches pass through so you can scroll, type and select as normal.
 */
export function InkOverlay({ ink, writing, children, className }: { ink: DocInk; writing: boolean; children: ReactNode; className?: string }) {
  const app = useApp();
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const measure = () => setSize({ w: Math.round(el.clientWidth), h: Math.round(el.scrollHeight) });
    measure();
    const ro = new ResizeObserver(measure); ro.observe(el);
    const mo = new MutationObserver(measure); mo.observe(el, { childList: true, subtree: true, characterData: true });
    return () => { ro.disconnect(); mo.disconnect(); };
  }, []);
  return (
    <div ref={ref} className={`relative ${className || ''}`}>
      {children}
      {ink.ready && size.w > 0 && (
        <div className="absolute left-0 top-0 z-20" style={{ width: size.w, height: size.h, pointerEvents: writing ? 'auto' : 'none' }} data-ink-overlay>
          <InkCanvas width={size.w} height={size.h} zoom={1} objects={ink.objects} onCommit={(o) => ink.setObjects(o)} selected={ink.selected} onSelect={ink.setSelected}
            tools={ink.tools} background={{ kind: 'none' }} readOnly={!writing} pencilOnly={!!app.user.settings?.pencil_only} onUndo={ink.undo} onRedo={ink.redo} tapUndo={app.user.settings?.tap_undo !== false} />
        </div>
      )}
    </div>
  );
}
