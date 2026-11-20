import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { nanoid } from 'nanoid';
import {
  ArrowLeft, Download, FilePlus2, Save, MessageSquare, ChevronLeft, ChevronRight, Trash2, X, FileDown, Maximize2, Minimize2, Search, RotateCw,
  Highlighter, Underline, StickyNote, Loader2, Columns2, MoreHorizontal, GripVertical, Share2,
} from 'lucide-react';
import { db, now, uid } from '@/lib/backend';
import { useApp } from '@/lib/app';
import { useKeyShortcuts, useLocalState, useRow } from '@/lib/hooks';
import type { Annotation, AnnotationPage, CanvasObject, DocumentRow, StickyObj } from '@/lib/types';
import { atLeast } from '@/lib/access';
import { openPdf, renderPdfPage, exportAnnotatedPdf, pageText, searchPdf, PDFDoc, TextItemBox } from '@/lib/pdf';
import { InkCanvas, DEFAULT_TOOLS, ToolState } from '@/canvas/InkCanvas';
import { Toolbar } from '@/canvas/Toolbar';
import { selectionOps, storeImage, useHistory, useSaver } from '@/canvas/useInk';
import { pageDims } from '@/canvas/paper';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip } from '@/components/ui/misc';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Empty, FullSpinner, SaveBadge } from '@/components/common';
import { CollabPanel } from '@/components/CollabPanel';
import { ShareDialog } from '@/components/ShareDialog';
import { cn, HIGHLIGHTS, safeName, saveBlob } from '@/lib/utils';
import { MathDialog } from '@/components/MathDialog';
import { measureMath } from '@/canvas/math';

const W = 794;
type TextMode = null | 'highlight' | 'underline';

function TextLayer({ items, zoom, active, onSelectText }: { items: TextItemBox[]; zoom: number; active: boolean; onSelectText: (rects: DOMRect[], host: HTMLElement) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    el.querySelectorAll<HTMLSpanElement>('span').forEach((s, i) => {
      const it = items[i]; if (!it) return;
      s.style.transform = 'none';
      const w = s.getBoundingClientRect().width;
      if (w > 0) s.style.transform = `scaleX(${(it.w * zoom) / w})`;
    });
  }, [items, zoom]);
  return (
    <div ref={ref} className={cn('nv-textlayer', !active && 'inactive')} style={{ zIndex: active ? 5 : 0 }}
      onMouseUp={() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || !ref.current) return;
        const rects = Array.from(sel.getRangeAt(0).getClientRects()).filter((r) => r.width > 1);
        if (rects.length) onSelectText(rects, ref.current);
        sel.removeAllRanges();
      }}>
      {items.map((it, i) => <span key={i} style={{ left: it.x * zoom, top: it.y * zoom, fontSize: it.h * zoom * 0.86, fontFamily: 'sans-serif' }}>{it.str}</span>)}
    </div>
  );
}

/** Rotate annotations with the page (90° clockwise), rescaled to the fixed logical width. */
function rotateObjects(objs: CanvasObject[], oldH: number, k: number): CanvasObject[] {
  return objs.map((o) => ({ ...o, x: (oldH - o.y) * k, y: o.x * k, rotation: ((o.rotation || 0) + 90) % 360, scaleX: (o.scaleX ?? 1) * k, scaleY: (o.scaleY ?? 1) * k }));
}

export default function PdfAnnotator({ embeddedId, onClose }: { embeddedId?: string; onClose?: () => void }) {
  const params = useParams();
  const id = embeddedId || params.id;
  const nav = useNavigate();
  const app = useApp();
  const { row: doc0, loading } = useRow<DocumentRow>('documents', id);
  const [pdf, setPdf] = useState<PDFDoc | null>(null);
  const [orig, setOrig] = useState<ArrayBuffer | null>(null);
  const [ann, setAnn] = useState<Annotation | null>(null);
  const [dims, setDims] = useState<Record<string, { w: number; h: number }>>({});
  const [bg, setBg] = useState<Record<string, HTMLCanvasElement>>({});
  const [text, setText] = useState<Record<string, TextItemBox[]>>({});
  const [thumbs, setThumbs] = useState<Record<number, string>>({});
  const [active, setActive] = useState(0);
  const [tools, setTools] = useLocalState<ToolState>('nv-pdf-tools', { ...DEFAULT_TOOLS, tool: 'pen', pen: 'highlighter' });
  const [textMode, setTextMode] = useState<TextMode>(null);
  const [hlColor, setHlColor] = useState(HIGHLIGHTS[0]);
  const [selected, setSelected] = useState<string[]>([]);
  const [zoom, setZoom] = useState(1);
  const [panel, setPanel] = useState<null | 'comments' | 'search'>(null);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<{ page: number; snippet: string }[] | null>(null);
  const [flash, setFlash] = useState<{ key: string; boxes: TextItemBox[] } | null>(null);
  const [present, setPresent] = useState(false);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [share, setShare] = useState(false);
  const [mathAt, setMathAt] = useState<{ at: { x: number; y: number } | null; obj?: any } | null>(null);
  const hist = useHistory(); const saver = useSaver();
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragFrom = useRef<number | null>(null);
  const doc = doc0;
  const access = doc ? app.can('document', doc) : null;

  // load the PDF and *this user's* annotation layer
  useEffect(() => {
    if (!doc || !access) return;
    (async () => {
      try {
        const blob = await db.download('documents', doc.storage_path!);
        const buf = await blob.arrayBuffer();
        setOrig(buf);
        const d = await openPdf(buf); setPdf(d);
        const base: AnnotationPage[] = Array.from({ length: d.numPages }, (_, i) => ({ key: `pdf-${i + 1}`, source: 'pdf', pdf_page: i + 1, rotation: 0, objects: [] }));
        let a = (await db.list<Annotation>('annotations', { document_id: doc.id, owner_id: app.user.id }))[0];
        if (!a) a = await db.insert<Annotation>('annotations', { document_id: doc.id, owner_id: app.user.id, pages: base, updated_at: now() });
        if (!a.pages?.length) a.pages = base;
        a.pages = a.pages.map((p) => ({ ...p, rotation: p.rotation ?? 0 }));
        setAnn(a);
        app.touchRecent('document', doc.id);
      } catch (e: any) { setErr(e?.message || 'Could not open this PDF'); }
    })();
  }, [doc?.id, !!access]);

  // page dimensions (visible orientation, normalised to W)
  useEffect(() => {
    if (!pdf || !ann) return;
    (async () => {
      const m: Record<string, { w: number; h: number }> = {};
      for (const p of ann.pages) {
        if (p.source === 'pdf') { const pg = await pdf.getPage(p.pdf_page!); const v = pg.getViewport({ scale: 1, rotation: (pg.rotate + p.rotation) % 360 }); m[p.key] = { w: W, h: Math.round((v.height / v.width) * W) }; }
        else m[p.key] = pageDims('A4', 'portrait');
      }
      setDims(m);
    })();
  }, [pdf, ann?.pages.map((p) => p.key + p.rotation).join()]);

  const page = ann?.pages[active];
  const dim = page ? dims[page.key] || { w: W, h: 1123 } : { w: W, h: 1123 };
  const bgKey = (p: AnnotationPage) => `${p.pdf_page}:${p.rotation}`;

  // render background + text for current and next page
  useEffect(() => {
    if (!pdf || !ann) return;
    [active, active + 1, active - 1].map((i) => ann.pages[i]).filter((p) => p?.source === 'pdf').forEach(async (p) => {
      const k = bgKey(p!);
      if (!bg[k]) { const r = await renderPdfPage(pdf, p!.pdf_page!, W, 2, p!.rotation); setBg((b) => ({ ...b, [k]: r.canvas })); }
      if (!text[k]) { const t = await pageText(pdf, p!.pdf_page!, W, p!.rotation); setText((x) => ({ ...x, [k]: t })); }
    });
  }, [pdf, ann, active]);
  // thumbnails
  useEffect(() => {
    if (!pdf) return;
    (async () => { for (let i = 1; i <= Math.min(pdf.numPages, 200); i++) { if (thumbs[i]) continue; const r = await renderPdfPage(pdf, i, 92, 1); const u = r.canvas.toDataURL('image/jpeg', 0.7); setThumbs((t) => ({ ...t, [i]: u })); } })();
  }, [pdf]);
  useEffect(() => { const fit = () => { const w = scrollRef.current?.clientWidth || 800; setZoom(Math.min(1.5, Math.max(0.3, +((w - 40) / W).toFixed(2)))); }; fit(); window.addEventListener('resize', fit); return () => window.removeEventListener('resize', fit); }, [!!ann, panel, present]);

  const persist = useCallback((a: Annotation) => saver.schedule('ann', () => db.update('annotations', a.id, { pages: a.pages, updated_at: now() }, true)), [saver]);
  const setPages = (pages: AnnotationPage[]) => { if (!ann) return; const a = { ...ann, pages }; setAnn(a); persist(a); };
  const setObjects = (objs: CanvasObject[], record = true) => { if (!ann || !page) return; if (record) hist.push(page.key, page.objects); setPages(ann.pages.map((p, i) => (i === active ? { ...p, objects: objs } : p))); };
  const undo = () => { if (page) { const v = hist.undo(page.key, page.objects); if (v) setObjects(v, false); } };
  const redo = () => { if (page) { const v = hist.redo(page.key, page.objects); if (v) setObjects(v, false); } };
  const ops = page ? selectionOps(page.objects, selected) : null;
  useKeyShortcuts({ 'mod+z': undo, 'mod+shift+z': redo, escape: () => { setSelected([]); setTextMode(null); return false; } }, [ann, page]);

  // text highlight / underline from a selection on the text layer
  const onSelectText = (rects: DOMRect[], host: HTMLElement) => {
    if (!page || !textMode) return;
    const h = host.getBoundingClientRect();
    const objs: CanvasObject[] = rects.map((r) => {
      const x = (r.left - h.left) / zoom, y = (r.top - h.top) / zoom, w = r.width / zoom, hh = r.height / zoom;
      return textMode === 'highlight'
        ? { id: nanoid(8), type: 'shape', shape: 'rect', x, y, w, h: hh, stroke: 'transparent', fill: hlColor, size: 0, opacity: 0.45 }
        : { id: nanoid(8), type: 'shape', shape: 'line', x, y: y + hh - 1, w, h: 0, stroke: '#D04C4C', fill: null, size: 2 };
    });
    setObjects([...page.objects, ...objs]);
  };

  const insertBlank = (template: 'blank' | 'lined' | 'grid') => {
    if (!ann) return;
    const key = `blank-${nanoid(6)}`;
    const list = [...ann.pages]; list.splice(active + 1, 0, { key, source: 'blank', rotation: 0, template, objects: [] });
    setPages(list); setActive(active + 1); app.toast(`Page inserted after page ${active + 1}`);
  };
  const rotate = () => {
    if (!ann || !page) return;
    const oldH = dim.h, k = W / oldH;
    setPages(ann.pages.map((p, i) => (i === active ? { ...p, rotation: (p.rotation + 90) % 360, objects: rotateObjects(p.objects, oldH, k) } : p)));
  };
  const removePage = () => { if (!ann || !page || page.source !== 'blank') return; setPages(ann.pages.filter((p) => p.key !== page.key)); setActive(Math.max(0, active - 1)); };
  const movePage = (from: number, to: number) => { if (!ann || from === to || to < 0 || to >= ann.pages.length) return; const l = [...ann.pages]; const [m] = l.splice(from, 1); l.splice(to, 0, m); setPages(l); setActive(to); };

  const runSearch = async () => { if (!pdf || !q.trim()) return; setBusy('search'); setHits(await searchPdf(pdf, q.trim())); setBusy(''); };
  const jumpHit = async (pageNo: number) => {
    if (!ann || !pdf) return;
    const idx = ann.pages.findIndex((p) => p.source === 'pdf' && p.pdf_page === pageNo); if (idx < 0) return;
    setActive(idx);
    const p = ann.pages[idx]; const items = text[bgKey(p)] || (await pageText(pdf, pageNo, W, p.rotation));
    setFlash({ key: p.key, boxes: items.filter((t) => t.str.toLowerCase().includes(q.toLowerCase())) });
    setTimeout(() => setFlash(null), 2500);
  };

  const buildAnnotated = () => exportAnnotatedPdf(orig!, ann!.pages, dims);
  const annotatedName = () => doc!.name.replace(/\.pdf$/i, '') + ' (annotated).pdf';
  const downloadOriginal = async () => { saveBlob(new Blob([orig!], { type: 'application/pdf' }), doc!.name); await db.insert('downloads', { user_id: app.user.id, resource_type: 'document', resource_id: doc!.id, name: doc!.name, kind: 'original' }); };
  const downloadAnnotated = async () => {
    setBusy('export');
    try { saveBlob(await buildAnnotated(), annotatedName()); await db.insert('downloads', { user_id: app.user.id, resource_type: 'document', resource_id: doc!.id, name: annotatedName(), kind: 'annotated' }); app.log('exported an annotated copy of', 'document', doc!.id, doc!.name); }
    catch (e: any) { app.toast(e.message || 'Export failed', 'err'); } finally { setBusy(''); }
  };
  const saveCopy = async () => {
    setBusy('copy');
    try {
      const blob = await buildAnnotated(), name = annotatedName(), path = `${app.user.id}/${uid()}-${safeName(name)}`;
      await db.upload('documents', path, new File([blob], name, { type: 'application/pdf' }));
      await db.insert('documents', { owner_id: app.user.id, folder_id: doc!.owner_id === app.user.id ? doc!.folder_id : null, name, mime_type: 'application/pdf', size: blob.size, storage_path: path, tags: [...(doc!.tags || []), 'annotated'], annotated_from: doc!.id, updated_at: now() });
      app.toast('Annotated copy saved to your documents — the original is unchanged');
    } catch (e: any) { app.toast(e.message, 'err'); } finally { setBusy(''); }
  };
  const allText = async () => { if (!pdf) return ''; const parts: string[] = []; for (let i = 1; i <= Math.min(pdf.numPages, 60); i++) parts.push(((await (await pdf.getPage(i)).getTextContent()).items as any[]).map((t) => t.str).join(' ')); return parts.join('\n\n'); };

  const stickies = useMemo(() => ann?.pages.flatMap((p, i) => p.objects.filter((o) => o.type === 'sticky').map((o) => ({ o: o as StickyObj, i }))) || [], [ann]);
  const selObjs = page?.objects.filter((o) => selected.includes(o.id)) || [];

  if (loading) return <FullSpinner />;
  if (!doc || !access) return <Empty icon={<FileDown />} title="Document not available" body="It may have been deleted or not shared with you." action={<Button onClick={() => nav('/app/documents')}>Back to documents</Button>} />;
  if (err) return <Empty icon={<FileDown />} title="Couldn’t open this PDF" body={err} action={<Button onClick={() => nav(-1)}>Go back</Button>} />;
  if (!ann || !pdf || !orig) return <FullSpinner label={`Opening ${doc.name}…`} />;

  const pageBg = page?.source === 'pdf' ? { kind: 'image' as const, image: bg[bgKey(page)] || null } : { kind: 'template' as const, template: (page?.template || 'blank') as any };
  const items = page?.source === 'pdf' ? text[bgKey(page)] || [] : [];

  return (
    <div className={cn('flex flex-col bg-ivory dark:bg-background', present ? 'fixed inset-0 z-[90]' : 'h-full')}>
      <div className="flex items-center gap-1 px-3 pb-2 pt-3 sm:gap-2 sm:px-4">
        {!embeddedId && <Button size="icon" variant="ghost" aria-label="Back" onClick={() => nav(-1)}><ArrowLeft /></Button>}
        {embeddedId && onClose && <Button size="icon" variant="ghost" aria-label="Close pane" onClick={onClose}><X /></Button>}
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{doc.name}</div>
          <div className="hidden text-[11px] text-muted-foreground sm:block">Your annotations are a private layer — the original document is never modified</div>
        </div>
        <div className="hidden md:block"><SaveBadge state={saver.state} /></div>
        <Tooltip content="Search text"><Button size="icon" variant={panel === 'search' ? 'secondary' : 'ghost'} aria-label="Search" onClick={() => setPanel(panel === 'search' ? null : 'search')}><Search /></Button></Tooltip>
        <Tooltip content="Comments"><Button size="icon" variant={panel === 'comments' ? 'secondary' : 'ghost'} aria-label="Comments" onClick={() => setPanel(panel === 'comments' ? null : 'comments')}><MessageSquare /></Button></Tooltip>
        {!embeddedId && <Tooltip content="Split screen"><Button size="icon" variant="ghost" aria-label="Split screen" onClick={() => nav(`/app/split?left=document:${doc.id}`)}><Columns2 /></Button></Tooltip>}
        {access === 'owner' && <Tooltip content="Share"><Button size="icon" variant="ghost" aria-label="Share" onClick={() => setShare(true)}><Share2 /></Button></Tooltip>}
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button size="sm" variant="secondary">{busy === 'export' || busy === 'copy' ? <Loader2 className="animate-spin" /> : <Download />}<span className="hidden sm:inline">Save / export</span></Button></DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={downloadAnnotated}><FileDown /> Export annotated PDF</DropdownMenuItem>
            <DropdownMenuItem onSelect={saveCopy}><Save /> Save annotated copy to Documents</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={downloadOriginal}><Download /> Download original</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label="Page options"><MoreHorizontal /></Button></DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={() => insertBlank('blank')}><FilePlus2 /> Insert blank page after</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => insertBlank('lined')}><FilePlus2 /> Insert lined page after</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => insertBlank('grid')}><FilePlus2 /> Insert grid page after</DropdownMenuItem>
            <DropdownMenuItem onSelect={rotate}><RotateCw /> Rotate page 90°</DropdownMenuItem>
            {page?.source === 'blank' && <DropdownMenuItem destructive onSelect={removePage}><Trash2 /> Remove inserted page</DropdownMenuItem>}
            <DropdownMenuItem onSelect={() => setPresent(!present)}>{present ? <Minimize2 /> : <Maximize2 />} {present ? 'Exit presentation' : 'Presentation mode'}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="px-3 pb-2 sm:px-4">
        <Toolbar tools={tools} setTools={(t) => { setTools(t); setTextMode(null); }} canUndo={!!page && hist.canUndo(page.key)} canRedo={!!page && hist.canRedo(page.key)} onUndo={undo} onRedo={redo}
          zoom={zoom} setZoom={setZoom} selection={selObjs}
          onImage={async (f) => { const r = await storeImage(`${app.user.id}/${uid()}`, f); setObjects([...(page?.objects || []), { id: nanoid(8), type: 'image', x: 80, y: 80, w: r.w, h: r.h, src: r.src }]); }}
          onPatch={(fn) => ops && setObjects(ops.patch(fn))} onDelete={() => { if (ops) { setObjects(ops.remove()); setSelected([]); } }}
          onDuplicate={() => { if (ops) { const r = ops.duplicate(); setObjects(r.objects); setSelected(r.ids); } }} onOrder={(f) => ops && setObjects(ops.order(f))}
          extra={
            <div className="flex shrink-0 items-center gap-1 border-l border-border pl-2">
              <Tooltip content="Highlight text (select words)"><button aria-label="Highlight text" aria-pressed={textMode === 'highlight'} onClick={() => setTextMode(textMode === 'highlight' ? null : 'highlight')} className={cn('flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-xs font-medium', textMode === 'highlight' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}><Highlighter className="size-4" /> <span className="hidden lg:inline">Highlight text</span></button></Tooltip>
              <Tooltip content="Underline text (select words)"><button aria-label="Underline text" aria-pressed={textMode === 'underline'} onClick={() => setTextMode(textMode === 'underline' ? null : 'underline')} className={cn('grid h-9 w-9 place-items-center rounded-xl', textMode === 'underline' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}><Underline className="size-4" /></button></Tooltip>
              <Tooltip content="Typed comment (sticky note)"><button aria-label="Comment" onClick={() => { setTools({ ...tools, tool: 'sticky' }); setTextMode(null); }} className="grid h-9 w-9 place-items-center rounded-xl hover:bg-muted"><StickyNote className="size-4" /></button></Tooltip>
            </div>
          } />
        {textMode && (
          <div className="mt-1.5 flex items-center gap-2 rounded-xl bg-secondary/70 px-3 py-1.5 text-xs">
            Select words on the page to {textMode}.
            {textMode === 'highlight' && HIGHLIGHTS.map((c) => <button key={c} aria-label={`Highlight colour ${c}`} onClick={() => setHlColor(c)} className={cn('h-5 w-5 rounded-full', hlColor === c && 'ring-2 ring-lavender-deep ring-offset-1')} style={{ background: c }} />)}
            {!items.length && page?.source === 'pdf' && <span className="text-muted-foreground">This page has no selectable text (it may be a scan) — use the highlighter pen instead.</span>}
            <button className="ml-auto underline" onClick={() => setTextMode(null)}>Done</button>
          </div>
        )}
      </div>

      <div className="flex min-h-0 flex-1 gap-3 px-3 pb-3 sm:px-4">
        <aside className="hidden w-[112px] shrink-0 flex-col gap-1.5 overflow-y-auto rounded-2xl border border-border bg-card/70 p-2 sm:flex" aria-label="Pages">
          {ann.pages.map((p, i) => (
            <button key={p.key} draggable onDragStart={() => { dragFrom.current = i; }} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (dragFrom.current != null) movePage(dragFrom.current, i); dragFrom.current = null; }}
              onClick={() => { setActive(i); setSelected([]); }} aria-label={`Page ${i + 1}`} className={cn('group relative rounded-lg p-1 text-[11px]', i === active ? 'bg-secondary ring-2 ring-lavender-deep' : 'hover:bg-muted')}>
              <GripVertical className="absolute right-1 top-1 size-3 opacity-0 group-hover:opacity-50" />
              <div className="mx-auto overflow-hidden rounded bg-white shadow-soft" style={{ width: 84, transform: `rotate(${p.rotation}deg)` }}>
                {p.source === 'pdf' ? (thumbs[p.pdf_page!] ? <img src={thumbs[p.pdf_page!]} alt="" className="w-full" /> : <div className="aspect-[3/4]" />) : <div className="grid aspect-[3/4] place-items-center text-lavender-ink">+ notes</div>}
              </div>
              <div className="mt-0.5 text-muted-foreground">{i + 1}{p.objects.length ? ` · ${p.objects.length}✎` : ''}</div>
            </button>
          ))}
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <div ref={scrollRef} data-scroll className="flex-1 overflow-auto">
            <div className="flex min-w-fit justify-center p-4">
              {page && (
                <div className="relative overflow-hidden rounded bg-white shadow-lift ring-1 ring-black/5">
                  <div style={{ pointerEvents: textMode ? 'none' : 'auto' }}>
                    <InkCanvas key={page.key + page.rotation} width={dim.w} height={dim.h} zoom={zoom} objects={page.objects} onCommit={(o) => setObjects(o)} selected={selected} onSelect={setSelected}
                      tools={tools} background={pageBg} pencilOnly={!!app.user.settings?.pencil_only} onRequestMath={(at, obj) => setMathAt({ at, obj })} />
                  </div>
                  {items.length > 0 && <TextLayer items={items} zoom={zoom} active={!!textMode} onSelectText={onSelectText} />}
                  {flash?.key === page.key && flash.boxes.map((b, i) => <div key={i} className="pointer-events-none absolute animate-pulse rounded-sm bg-[#7C6FD1]/45" style={{ left: b.x * zoom, top: b.y * zoom, width: b.w * zoom, height: b.h * zoom }} />)}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2 text-sm">
            <Button size="icon" variant="ghost" aria-label="Previous page" disabled={active === 0} onClick={() => setActive(active - 1)}><ChevronLeft /></Button>
            <span className="tabular-nums text-muted-foreground">{active + 1} / {ann.pages.length}{page?.source === 'blank' ? ' · inserted page' : ''}</span>
            <Button size="icon" variant="ghost" aria-label="Next page" disabled={active === ann.pages.length - 1} onClick={() => setActive(active + 1)}><ChevronRight /></Button>
          </div>
        </div>
        {panel && (
          <aside className="flex w-[320px] shrink-0 flex-col overflow-hidden rounded-2xl border border-border bg-card max-md:fixed max-md:inset-x-2 max-md:bottom-2 max-md:top-28 max-md:z-40 max-md:w-auto max-md:shadow-lift">
            {(
              <>
                <div className="flex items-center border-b border-border px-4 py-2.5"><span className="flex-1 text-sm font-semibold">{panel === 'search' ? 'Search this document' : 'Comments'}</span><Button size="icon" variant="ghost" aria-label="Close" onClick={() => setPanel(null)}><X /></Button></div>
                {panel === 'search' ? (
                  <div className="flex-1 space-y-3 overflow-auto p-3">
                    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); runSearch(); }}><Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find words…" /><Button type="submit" disabled={busy === 'search'}>{busy === 'search' ? <Loader2 className="animate-spin" /> : <Search />}</Button></form>
                    {hits && <p className="text-xs text-muted-foreground">{hits.length} match{hits.length === 1 ? '' : 'es'}</p>}
                    {hits?.map((h, i) => <button key={i} onClick={() => jumpHit(h.page)} className="block w-full rounded-lg p-2 text-left text-xs hover:bg-muted"><b className="text-lavender-ink dark:text-lavender">p.{h.page}</b> …{h.snippet}…</button>)}
                  </div>
                ) : (
                  <div className="flex min-h-0 flex-1 flex-col">
                    <div className="max-h-[45%] space-y-2 overflow-auto border-b border-border p-3">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Notes on pages (your layer)</div>
                      {stickies.map(({ o, i }) => (
                        <div key={o.id} className="rounded-xl p-2.5 text-sm" style={{ background: o.color }}>
                          <button className="text-[11px] font-medium text-charcoal/60 hover:underline" onClick={() => { setActive(i); setSelected([o.id]); setTools({ ...tools, tool: 'select' }); }}>Page {i + 1} →</button>
                          <p className="mt-0.5 whitespace-pre-wrap text-charcoal">{o.text || <em className="opacity-50">Empty note</em>}</p>
                        </div>
                      ))}
                      {!stickies.length && <p className="text-xs text-muted-foreground">Use the sticky-note tool to add typed comments on the page.</p>}
                    </div>
                    <div className="min-h-0 flex-1"><CollabPanel type="document" id={doc.id} name={doc.name} access={access} /></div>
                  </div>
                )}
              </>
            )}
          </aside>
        )}
      </div>
      <MathDialog open={!!mathAt} initial={mathAt?.obj?.latex} onClose={() => setMathAt(null)} onSave={(latex) => {
        if (!page || !mathAt) return; const fs = mathAt.obj?.fontSize || 20; const { w, h } = measureMath(latex, fs);
        if (mathAt.obj) setObjects(page.objects.map((o) => (o.id === mathAt.obj.id ? { ...o, latex, w, h } as any : o)));
        else setObjects([...page.objects, { id: nanoid(8), type: 'math', latex, fontSize: fs, color: '#2F2B45', w, h, x: mathAt.at?.x || 80, y: mathAt.at?.y || 80 }]);
        setMathAt(null);
      }} />
      {access === 'owner' && <ShareDialog open={share} onOpenChange={setShare} type="document" id={doc.id} name={doc.name} />}
    </div>
  );
}
