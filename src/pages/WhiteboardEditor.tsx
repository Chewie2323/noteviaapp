import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { nanoid } from 'nanoid';
import { ArrowLeft, Share2, MessageSquare, Star, Image as ImageIcon, FileDown, Palette, Maximize2, Minimize2, X, Locate } from 'lucide-react';
import { db, now } from '@/lib/backend';
import { useApp } from '@/lib/app';
import { useKeyShortcuts, useLocalState, useRow } from '@/lib/hooks';
import type { CanvasObject, MathObj, Notebook, NotebookPage } from '@/lib/types';
import { atLeast } from '@/lib/access';
import { usePencilActions } from '@/canvas/usePencil';
import { InkCanvas, DEFAULT_TOOLS, ToolState, View } from '@/canvas/InkCanvas';
import { Toolbar } from '@/canvas/Toolbar';
import { addMindNode, selectionOps, storeImage, useHistory, useSaver } from '@/canvas/useInk';
import { renderBoard } from '@/canvas/render';
import { objBox } from '@/canvas/geometry';
import { measureMath } from '@/canvas/math';
import { canvasToPdf } from '@/lib/pdf';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger, Tooltip } from '@/components/ui/misc';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Empty, FullSpinner, SaveBadge } from '@/components/common';
import { ShareDialog } from '@/components/ShareDialog';
import { CollabPanel } from '@/components/CollabPanel';
import { MathDialog } from '@/components/MathDialog';
import { cn, safeName, saveBlob } from '@/lib/utils';

const BG_COLORS = ['#FBFAF7', '#FFFFFF', '#F3EEFB', '#EEF5F1', '#F2F5FA', '#FBF3EE', '#23262F'];

export default function WhiteboardEditor({ embeddedId, onClose }: { embeddedId?: string; onClose?: () => void }) {
  const params = useParams();
  const id = embeddedId || params.id;
  const nav = useNavigate();
  const app = useApp();
  const { row: nb, loading } = useRow<Notebook>('notebooks', id);
  const [page, setPage] = useState<NotebookPage | null>(null);
  const [tools, setTools] = useLocalState<ToolState>('nv-board-tools', { ...DEFAULT_TOOLS, tool: 'select' });
  usePencilActions(tools, setTools);
  const [selected, setSelected] = useState<string[]>([]);
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: 1 });
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [panel, setPanel] = useState<null | 'collab'>(null);
  const [share, setShare] = useState(false);
  const [full, setFull] = useState(false);
  const [mathAt, setMathAt] = useState<{ at: { x: number; y: number } | null; obj?: MathObj } | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const hist = useHistory();
  const saver = useSaver();
  const box = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);

  const access = nb ? app.can('notebook', nb) : null;
  const editable = atLeast(access, 'edit');
  const bg = nb?.background || { color: '#FBFAF7', pattern: 'dots' as const };

  useEffect(() => { if (id) { db.list<NotebookPage>('notebook_pages', { notebook_id: id }, { col: 'position', asc: true }).then((p) => setPage(p[0] || null)); app.touchRecent('notebook', id); } }, [id]);
  useEffect(() => {
    const el = box.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.floor(e.contentRect.width), h: Math.floor(e.contentRect.height) }));
    ro.observe(el); return () => ro.disconnect();
  }, [!!page]);

  const setObjects = useCallback((objs: CanvasObject[], record = true) => {
    if (!page) return;
    if (record) hist.push(page.id, page.objects);
    const next = { ...page, objects: objs };
    setPage(next);
    saver.schedule(page.id, async () => { await db.update('notebook_pages', page.id, { objects: objs, updated_at: now() }, true); await db.update('notebooks', page.notebook_id, { updated_at: now() }, true); });
  }, [page]);
  const ops = page ? selectionOps(page.objects, selected) : null;
  const undo = () => { if (page) { const v = hist.undo(page.id, page.objects); if (v) setObjects(v, false); } };
  const redo = () => { if (page) { const v = hist.redo(page.id, page.objects); if (v) setObjects(v, false); } };
  const addChild = (sibling: boolean) => { if (!page || selected.length !== 1) return false; const r = addMindNode(page.objects, selected[0], sibling); if (!r) return false; setObjects(r.objects); setSelected([r.id]); return true; };
  const setZoom = (z: number) => setView((v) => { const cx = size.w / 2, cy = size.h / 2; return { scale: z, x: cx - ((cx - v.x) / v.scale) * z, y: cy - ((cy - v.y) / v.scale) * z }; });
  const centre = () => ({ x: (size.w / 2 - view.x) / view.scale, y: (size.h / 2 - view.y) / view.scale });
  const fitAll = () => {
    if (!page?.objects.length) return setView({ x: 0, y: 0, scale: 1 });
    const bs = page.objects.filter((o) => o.type !== 'connector').map((o) => objBox(o));
    const x0 = Math.min(...bs.map((b) => b.x)), y0 = Math.min(...bs.map((b) => b.y)), x1 = Math.max(...bs.map((b) => b.x + b.w)), y1 = Math.max(...bs.map((b) => b.y + b.h));
    const s = Math.min(2, Math.max(0.15, Math.min((size.w - 80) / (x1 - x0 || 1), (size.h - 80) / (y1 - y0 || 1))));
    setView({ scale: s, x: size.w / 2 - ((x0 + x1) / 2) * s, y: size.h / 2 - ((y0 + y1) / 2) * s });
  };
  useEffect(() => { if (page && size.w > 100) fitAll(); }, [page?.id, size.w > 100]);

  useKeyShortcuts({
    'mod+z': undo, 'mod+shift+z': redo, v: () => setTools({ ...tools, tool: 'select' }), p: () => setTools({ ...tools, tool: 'pen' }), h: () => setTools({ ...tools, tool: 'hand' }),
    e: () => setTools({ ...tools, tool: 'eraser' }), t: () => setTools({ ...tools, tool: 'text' }), n: () => setTools({ ...tools, tool: 'node' }), s: () => setTools({ ...tools, tool: 'sticky' }),
    tab: () => addChild(false), enter: () => addChild(true), 'mod+d': () => { if (ops && selected.length) { const r = ops.duplicate(); setObjects(r.objects); setSelected(r.ids); } },
    escape: () => { setSelected([]); return false; },
  }, [page, selected, tools, view]);

  const onImage = async (f: File) => {
    if (!nb || !page) return;
    const r = await storeImage(`${nb.owner_id}/${nb.id}`, f, 520); const c = centre();
    setObjects([...page.objects, { id: nanoid(8), type: 'image', x: c.x - r.w / 2, y: c.y - r.h / 2, w: r.w, h: r.h, src: r.src }]);
  };
  const saveMath = (latex: string) => {
    if (!page || !mathAt) return;
    const fontSize = mathAt.obj?.fontSize || 26, color = mathAt.obj?.color || tools.textColor, { w, h } = measureMath(latex, fontSize);
    if (mathAt.obj) setObjects(page.objects.map((o) => (o.id === mathAt.obj!.id ? { ...o, latex, w, h } as MathObj : o)));
    else { const at = mathAt.at || centre(); setObjects([...page.objects, { id: nanoid(8), type: 'math', latex, fontSize, color, w, h, x: at.x, y: at.y - h / 2 }]); }
    setMathAt(null);
  };
  const exportAs = async (fmt: 'png' | 'pdf') => {
    if (!page || !nb) return;
    const { canvas, w, h } = await renderBoard(page.objects, bg);
    if (fmt === 'png') canvas.toBlob((b) => b && saveBlob(b, `${safeName(nb.title)}.png`), 'image/png');
    else saveBlob(await canvasToPdf(canvas, w, h, nb.title), `${safeName(nb.title)}.pdf`);
    await db.insert('downloads', { user_id: app.user.id, resource_type: 'notebook', resource_id: nb.id, name: `${nb.title}.${fmt}`, kind: 'export' });
  };
  const toggleFull = () => { if (!full) { setFull(true); root.current?.requestFullscreen?.().catch(() => {}); } else { setFull(false); document.fullscreenElement && document.exitFullscreen().catch(() => {}); } };
  const selObjs = useMemo(() => page?.objects.filter((o) => selected.includes(o.id)) || [], [page, selected]);
  const text = () => (page?.objects || []).flatMap((o: any) => (o.type === 'node' || o.type === 'sticky' || o.type === 'text' ? [o.text] : o.type === 'shape' && o.label ? [o.label] : [])).join('\n');

  if (loading || (nb && !page)) return <FullSpinner label="Opening whiteboard…" />;
  if (!nb || !access || !page) return <Empty icon={<Palette />} title="Whiteboard not available" action={<Button onClick={() => nav('/app/whiteboards')}>Back</Button>} />;

  return (
    <div ref={root} className={cn('flex flex-col bg-ivory dark:bg-background', full ? 'fixed inset-0 z-[90]' : 'h-full')}>
      <div className="flex items-center gap-1 px-3 pb-2 pt-3 sm:gap-2 sm:px-4">
        {!embeddedId && <Button size="icon" variant="ghost" aria-label="Back" onClick={() => nav(-1)}><ArrowLeft /></Button>}
        {embeddedId && onClose && <Button size="icon" variant="ghost" aria-label="Close pane" onClick={onClose}><X /></Button>}
        <input aria-label="Whiteboard title" className="min-w-0 flex-1 rounded-lg bg-transparent px-2 py-1 text-base font-semibold outline-none focus:bg-card sm:text-lg" defaultValue={nb.title} key={nb.title} disabled={!editable}
          onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== nb.title) db.update('notebooks', nb.id, { title: v, updated_at: now() }); }} />
        <div className="hidden md:block"><SaveBadge state={saver.state} readOnly={!editable} /></div>
        <Tooltip content="Fit to content"><Button size="icon" variant="ghost" aria-label="Fit to content" onClick={fitAll}><Locate /></Button></Tooltip>
        {editable && (
          <Popover>
            <PopoverTrigger asChild><Button size="icon" variant="ghost" aria-label="Background"><Palette /></Button></PopoverTrigger>
            <PopoverContent align="end" className="w-64 space-y-3">
              <div className="text-xs font-medium text-muted-foreground">Background colour</div>
              <div className="flex flex-wrap gap-2">{BG_COLORS.map((c) => <button key={c} aria-label={c} onClick={() => db.update('notebooks', nb.id, { background: { ...bg, color: c } })} className={cn('h-8 w-8 rounded-lg border border-border', bg.color === c && 'ring-2 ring-lavender-deep')} style={{ background: c }} />)}</div>
              <div className="text-xs font-medium text-muted-foreground">Pattern</div>
              <div className="flex gap-1">{(['none', 'dots', 'grid'] as const).map((p) => <Button key={p} size="sm" variant={bg.pattern === p ? 'secondary' : 'ghost'} onClick={() => db.update('notebooks', nb.id, { background: { ...bg, pattern: p } })} className="capitalize">{p}</Button>)}</div>
            </PopoverContent>
          </Popover>
        )}
        <Tooltip content="Favourite"><Button size="icon" variant="ghost" aria-label="Favourite" onClick={() => app.toggleFav('notebook', nb.id)}><Star className={app.isFav('notebook', nb.id) ? 'fill-amber-400 text-amber-400' : ''} /></Button></Tooltip>
        <Tooltip content="Comments & versions"><Button size="icon" variant={panel === 'collab' ? 'secondary' : 'ghost'} aria-label="Comments" onClick={() => setPanel(panel === 'collab' ? null : 'collab')}><MessageSquare /></Button></Tooltip>
        {access === 'owner' && <Tooltip content="Share"><Button size="icon" variant="ghost" aria-label="Share" onClick={() => setShare(true)}><Share2 /></Button></Tooltip>}
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label="Export"><FileDown /></Button></DropdownMenuTrigger>
          <DropdownMenuContent><DropdownMenuItem onSelect={() => exportAs('png')}><ImageIcon /> Export as PNG image</DropdownMenuItem><DropdownMenuItem onSelect={() => exportAs('pdf')}><FileDown /> Export as PDF</DropdownMenuItem></DropdownMenuContent>
        </DropdownMenu>
        <Tooltip content={full ? 'Exit full screen' : 'Full screen'}><Button size="icon" variant="ghost" aria-label="Full screen" onClick={toggleFull}>{full ? <Minimize2 /> : <Maximize2 />}</Button></Tooltip>
      </div>
      {editable && (
        <div className="px-3 pb-2 sm:px-4">
          <Toolbar tools={tools} setTools={setTools} canUndo={hist.canUndo(page.id)} canRedo={hist.canRedo(page.id)} onUndo={undo} onRedo={redo} zoom={view.scale} setZoom={setZoom}
            onImage={onImage} selection={selObjs} hint={hint} onAddChild={addChild}
            onPatch={(fn) => ops && setObjects(ops.patch(fn))} onDelete={() => { if (ops) { setObjects(ops.remove()); setSelected([]); } }}
            onDuplicate={() => { if (ops) { const r = ops.duplicate(); setObjects(r.objects); setSelected(r.ids); } }} onOrder={(f) => ops && setObjects(ops.order(f))} />
        </div>
      )}
      <div className="flex min-h-0 flex-1 gap-3 px-3 pb-3 sm:px-4">
        <div ref={box} className="relative min-w-0 flex-1 overflow-hidden rounded-2xl border border-border shadow-soft">
          <InkCanvas mode="board" width={size.w} height={size.h} view={view} onView={setView} objects={page.objects} onCommit={(o) => setObjects(o)} selected={selected} onSelect={setSelected}
            tools={tools} readOnly={!editable} pencilOnly={!!app.user.settings?.pencil_only} onUndo={undo} onRedo={redo} tapUndo={app.user.settings?.tap_undo !== false} background={{ kind: 'board', ...bg }} onHint={setHint}
            onRequestMath={(at, existing) => setMathAt({ at, obj: existing as MathObj })} />
          {!page.objects.length && editable && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="rounded-2xl bg-card/90 px-5 py-4 text-center text-sm text-muted-foreground shadow-soft">Pick a tool and start drawing. Add a <b>mind-map node</b>, then press <kbd className="rounded border px-1">Tab</kbd> to branch.<br />Scroll to pan · Ctrl/⌘ + scroll or pinch to zoom.</div>
            </div>
          )}
        </div>
        {panel && (
          <aside className="flex w-[340px] shrink-0 flex-col overflow-hidden rounded-2xl border border-border bg-card max-md:fixed max-md:inset-x-2 max-md:bottom-2 max-md:top-24 max-md:z-40 max-md:w-auto max-md:shadow-lift">
            {<><div className="flex items-center border-b border-border px-4 py-2.5"><span className="flex-1 text-sm font-semibold">Comments & history</span><Button size="icon" variant="ghost" aria-label="Close" onClick={() => setPanel(null)}><X /></Button></div>
                <div className="min-h-0 flex-1"><CollabPanel type="notebook" id={nb.id} name={nb.title} access={access} snapshot={() => page.objects} onRestore={async (s) => setObjects(s)} /></div></>}
          </aside>
        )}
      </div>
      <MathDialog open={!!mathAt} initial={mathAt?.obj?.latex} onClose={() => setMathAt(null)} onSave={saveMath} />
      {access === 'owner' && <ShareDialog open={share} onOpenChange={setShare} type="notebook" id={nb.id} name={nb.title} />}
    </div>
  );
}
