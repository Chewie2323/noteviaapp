import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { nanoid } from 'nanoid';
import {
  ArrowLeft, Plus, Copy, Trash2, ChevronUp, ChevronDown, Maximize2, Minimize2, Columns2, FileDown, Mic, MessageSquare, Share2, Star,
  PanelLeftClose, PanelLeft, ChevronLeft, ChevronRight, LayoutTemplate, NotebookText, Upload, X, MoreHorizontal, Loader2,
} from 'lucide-react';
import { db, now } from '@/lib/backend';
import { useApp, ask } from '@/lib/app';
import { useKeyShortcuts, useLocalState, useRow } from '@/lib/hooks';
import type { AudioClip, CanvasObject, MathObj, Notebook, NotebookPage, Orientation, PaperSize, TemplateId } from '@/lib/types';
import { atLeast } from '@/lib/access';
import { usePencilActions } from '@/canvas/usePencil';
import { InkCanvas, DEFAULT_TOOLS, ToolState } from '@/canvas/InkCanvas';
import { Toolbar } from '@/canvas/Toolbar';
import { pageDims, TEMPLATE_GROUPS, templateLabel } from '@/canvas/paper';
import { renderPage } from '@/canvas/render';
import { addMindNode, selectionOps, storeImage, useHistory, useSaver } from '@/canvas/useInk';
import { measureMath } from '@/canvas/math';
import { customTemplateImage } from '@/canvas/templates';
import { addPage, duplicateNotebook, reposition } from '@/lib/actions';
import { exportPagesPdf, openPdf, renderPdfPage } from '@/lib/pdf';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { NativeSelect, Label } from '@/components/ui/input';
import { Tooltip } from '@/components/ui/misc';
import { Empty, FullSpinner, SaveBadge } from '@/components/common';
import { clearDraft, loadDraft, saveDraft } from '@/lib/drafts';
import { inkIdle } from '@/canvas/inkActivity';
import { ShareDialog } from '@/components/ShareDialog';
import { CollabPanel } from '@/components/CollabPanel';
import { MathDialog } from '@/components/MathDialog';
import { AudioRecorder, AudioChip } from '@/components/Audio';
import { RichText } from '@/components/RichText';
import { cn, safeName, saveBlob, timeAgo } from '@/lib/utils';

function useCustomImages(pages: NotebookPage[] | null) {
  const [imgs, setImgs] = useState<Record<string, HTMLImageElement | null>>({});
  useEffect(() => {
    (pages || []).forEach((p) => { if (p.template.startsWith('custom:') && !(p.template in imgs)) customTemplateImage(p.template).then((i) => setImgs((m) => ({ ...m, [p.template]: i }))); });
  }, [pages]);
  return imgs;
}

function Thumb({ page, active, index, img, onClick, draggable, onDragStart, onDrop }: any) {
  const [src, setSrc] = useState('');
  const d = pageDims(page.paper_size, page.orientation);
  useEffect(() => {
    let t: any, dead = false;
    // redrawing the thumbnail is heavy, so wait until the pen has been up for a moment instead of doing it right after every stroke
    const go = () => { if (dead) return; if (!inkIdle(900)) { t = setTimeout(go, 400); return; } renderPage({ template: page.template, objects: page.objects, w: d.w, h: d.h, scale: 0.18, customImage: img }).then((c) => { if (!dead) setSrc(c.toDataURL('image/jpeg', 0.7)); }); };
    t = setTimeout(go, 300);
    return () => { dead = true; clearTimeout(t); };
  }, [page.objects, page.template, page.orientation, page.paper_size, img]);
  return (
    <button onClick={onClick} draggable={draggable} onDragStart={onDragStart} onDragOver={(e) => e.preventDefault()} onDrop={onDrop} aria-label={`Page ${index + 1}`} aria-current={active}
      className={cn('block w-full rounded-xl p-1.5 transition', active ? 'bg-secondary ring-2 ring-lavender-deep' : 'hover:bg-muted')}>
      <div className="overflow-hidden rounded-md bg-white shadow-soft" style={{ aspectRatio: `${d.w}/${d.h}` }}>{src && <img src={src} alt="" className="h-full w-full object-cover" />}</div>
      <div className="mt-1 text-[11px] text-muted-foreground">{index + 1}{page.audio?.length ? ' · 🎙' : ''}</div>
    </button>
  );
}

export default function NotebookEditor({ embeddedId, onClose }: { embeddedId?: string; onClose?: () => void }) {
  const params = useParams();
  const id = embeddedId || params.id;
  const embedded = !!embeddedId;
  const nav = useNavigate();
  const app = useApp();
  const { row: nb, loading } = useRow<Notebook>('notebooks', id);
  const [pages, setPages] = useState<NotebookPage[] | null>(null);
  const [active, setActive] = useState(0);
  const [tools, setTools] = useLocalState<ToolState>('nv-tools', DEFAULT_TOOLS);
  usePencilActions(tools, setTools);
  const [selected, setSelected] = useState<string[]>([]);
  const [zoom, setZoom] = useState(1);
  const [thumbs, setThumbs] = useState(() => !embedded && window.innerWidth > 900);
  const [panel, setPanel] = useState<null | 'collab' | 'audio' | 'notes'>(null);
  const [present, setPresent] = useState(false);
  const [share, setShare] = useState(false);
  const [setup, setSetup] = useState(false);
  const [mathAt, setMathAt] = useState<{ at: { x: number; y: number } | null; obj?: MathObj } | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [busy, setBusy] = useState('');
  const [sp, setSp] = useSearchParams();
  const [autoRec] = useState(() => sp.get('record') === '1');
  const recRef = useRef<{ clip: string; t0: number } | null>(null);
  const [recording, setRecording] = useState(false);
  const [seekMode, setSeekMode] = useState(false);
  const [playMs, setPlayMs] = useState<{ clip: string; ms: number } | null>(null);
  const chips = useRef<Record<string, { seek: (ms: number) => void } | null>>({});
  const hist = useHistory();
  const saver = useSaver();
  const recovered = useRef<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const tplInput = useRef<HTMLInputElement>(null);
  const logged = useRef(false);
  const customImgs = useCustomImages(pages);

  const access = nb ? app.can('notebook', nb) : null;
  const editable = atLeast(access, 'edit');
  const page = pages?.[active];
  const dims = page ? pageDims(page.paper_size, page.orientation) : { w: 794, h: 1123 };

  useEffect(() => {
    if (!id) return;
    db.list<NotebookPage>('notebook_pages', { notebook_id: id }, { col: 'position', asc: true }).then(async (ps) => {
      // put back any writing that could not be saved last time (e.g. the connection dropped)
      const merged = await Promise.all(ps.map(async (p) => {
        const d = await loadDraft(p.id);
        if (d && d.at > Date.parse(p.updated_at || '') + 1000) { recovered.current.push(p.id); return { ...p, ...d.patch }; }
        if (d) clearDraft(p.id);
        return p;
      }));
      setPages(merged);
    });
    app.touchRecent('notebook', id);
  }, [id]);
  useEffect(() => {
    const fit = () => { const w = scrollRef.current?.clientWidth || 800; setZoom(Math.min(1.4, Math.max(0.3, +((w - 40) / dims.w).toFixed(2)))); };
    fit(); const t = setTimeout(fit, 80); window.addEventListener('resize', fit);
    return () => { clearTimeout(t); window.removeEventListener('resize', fit); };
  }, [thumbs, panel, present, !!pages, dims.w]);

  const persist = useCallback((pg: NotebookPage) => {
    saver.schedule(pg.id, async () => {
      const patch = { objects: pg.objects, audio: pg.audio, template: pg.template, paper_size: pg.paper_size, orientation: pg.orientation };
      try {
        await db.update('notebook_pages', pg.id, { ...patch, updated_at: now() }, true);
        await db.update('notebooks', pg.notebook_id, { updated_at: now() }, true);
        clearDraft(pg.id);
      } catch (e) { await saveDraft(pg.id, patch); throw e; }   // keep a copy on this device, then let the saver retry
    });
    if (!logged.current && nb) { logged.current = true; app.log('edited', 'notebook', nb.id, nb.title); }
  }, [saver, nb]);

  const setObjects = useCallback((objs: CanvasObject[], record = true) => {
    if (!pages || !page) return;
    if (record) hist.push(page.id, page.objects);
    const next = { ...page, objects: objs };
    setPages(pages.map((p, i) => (i === active ? next : p)));
    persist(next);
  }, [pages, page, active, persist]);
  useEffect(() => {
    if (!pages || !recovered.current.length) return;
    const ids = recovered.current; recovered.current = [];
    pages.filter((p) => ids.includes(p.id)).forEach(persist);
    app.toast('Restored writing that hadn’t finished saving');
  }, [pages, persist]);
  const patchPage = (patch: Partial<NotebookPage>, all = false) => {
    if (!pages || !page) return;
    const next = pages.map((p, i) => (all || i === active ? { ...p, ...patch } : p));
    setPages(next); next.forEach((p, i) => (all || i === active) && persist(p));
  };
  const undo = () => { if (page) { const v = hist.undo(page.id, page.objects); if (v) { setObjects(v, false); setSelected([]); } } };
  const redo = () => { if (page) { const v = hist.redo(page.id, page.objects); if (v) { setObjects(v, false); setSelected([]); } } };
  const ops = page ? selectionOps(page.objects, selected) : null;
  const addChild = (sibling: boolean): boolean => { if (!page || selected.length !== 1) return false; const r = addMindNode(page.objects, selected[0], sibling); if (!r) return false; setObjects(r.objects); setSelected([r.id]); return true; };

  useKeyShortcuts({
    'mod+z': undo, 'mod+shift+z': redo, 'mod+y': redo,
    p: () => setTools({ ...tools, tool: 'pen', pen: 'ballpoint' }), e: () => setTools({ ...tools, tool: 'eraser' }), v: () => setTools({ ...tools, tool: 'select' }),
    t: () => setTools({ ...tools, tool: 'text' }), l: () => setTools({ ...tools, tool: 'lasso' }), h: () => setTools({ ...tools, tool: 'hand' }),
    'mod+d': () => { if (ops && selected.length) { const r = ops.duplicate(); setObjects(r.objects); setSelected(r.ids); } },
    tab: () => addChild(false), enter: () => addChild(true),
    escape: () => { setSelected([]); if (present) exitPresent(); return false; },
    arrowright: () => { if (selected.length || !pages) return false; setActive((a) => Math.min(pages.length - 1, a + 1)); },
    arrowleft: () => { if (selected.length) return false; setActive((a) => Math.max(0, a - 1)); },
  }, [page, selected, present, pages, tools]);

  // page management
  const add = async (template?: TemplateId) => { if (!pages || !nb) return; const list = await addPage(nb, active, pages, template ? { template } : undefined); setPages(list); setActive(active + 1); };
  const duplicatePage = async () => {
    if (!pages || !page) return;
    const pg = await db.insert<NotebookPage>('notebook_pages', { notebook_id: page.notebook_id, position: active + 1, template: page.template, paper_size: page.paper_size, orientation: page.orientation, objects: page.objects.map((o) => ({ ...o })), audio: [], updated_at: now() });
    const list = [...pages]; list.splice(active + 1, 0, pg); await reposition(list); setPages(list.map((p, i) => ({ ...p, position: i }))); setActive(active + 1);
  };
  const deletePage = async () => {
    if (!pages || !page) return;
    if (pages.length === 1) return app.toast('A notebook needs at least one page', 'info');
    if (page.objects.length && !(await ask.confirm('Delete this page?', 'Everything on this page will be removed.'))) return;
    await db.remove('notebook_pages', page.id);
    const list = pages.filter((p) => p.id !== page.id); await reposition(list); setPages(list.map((p, i) => ({ ...p, position: i }))); setActive(Math.max(0, active - 1));
  };
  const move = async (from: number, to: number) => {
    if (!pages || to < 0 || to >= pages.length || from === to) return;
    const list = [...pages]; const [m] = list.splice(from, 1); list.splice(to, 0, m);
    await reposition(list); setPages(list.map((p, i) => ({ ...p, position: i }))); setActive(to);
  };
  const dragFrom = useRef<number | null>(null);

  const centre = () => { const el = scrollRef.current; return { x: dims.w / 2, y: el ? Math.min(dims.h - 100, (el.scrollTop + el.clientHeight / 2) / zoom) : dims.h / 3 }; };
  const onImage = async (f: File) => {
    if (!nb || !page) return;
    try {
      const r = await storeImage(`${nb.owner_id}/${nb.id}`, f);
      const c = centre();
      setObjects([...page.objects, { id: nanoid(8), type: 'image', x: c.x - r.w / 2, y: c.y - r.h / 2, w: r.w, h: r.h, src: r.src }]);
      setTools({ ...tools, tool: 'select' });
    } catch (e: any) { app.toast(e.message || 'Image upload failed', 'err'); }
  };
  const saveMath = (latex: string) => {
    if (!page || !mathAt) return;
    const fontSize = mathAt.obj?.fontSize || 22, color = mathAt.obj?.color || tools.textColor;
    const { w, h } = measureMath(latex, fontSize);
    if (mathAt.obj) setObjects(page.objects.map((o) => (o.id === mathAt.obj!.id ? { ...o, latex, w, h } as MathObj : o)));
    else { const at = mathAt.at || centre(); setObjects([...page.objects, { id: nanoid(8), type: 'math', latex, fontSize, color, w, h, x: at.x, y: at.y - h / 2 }]); }
    setMathAt(null);
  };
  const onAudio = async (blob: Blob, secs: number) => {
    if (!nb || !page) return;
    const cid = recRef.current?.clip || nanoid(8), path = `${nb.owner_id}/nb/${nb.id}/${cid}.${blob.type.includes('mp4') ? 'm4a' : 'webm'}`;
    await db.upload('audio', path, blob);
    const clip: AudioClip = { id: cid, storage_path: path, label: `Recording ${(page.audio?.length || 0) + 1}`, duration: secs, created_at: now() };
    recRef.current = null; setRecording(false);
    // attach to the current page and to every page that has writing made during this recording
    const next = (pages || []).map((p, i) => (i === active || p.objects.some((o: any) => o.rec?.clip === cid)) ? { ...p, audio: [...(p.audio || []), { ...clip, label: `Recording ${(p.audio?.length || 0) + 1}` }] } : p);
    setPages(next); next.forEach((p, i) => { if (p !== (pages || [])[i]) persist(p); });
    app.toast('Lesson recording saved — tap “Tap writing to jump” to replay it');
  };
  const onAudioRef = useRef(onAudio); onAudioRef.current = onAudio;
  const uploadTemplate = async (f: File) => {
    try {
      setBusy('template');
      let blob: Blob = f, w = 794, h = 1123;
      if (f.type === 'application/pdf') { const d = await openPdf(f); const r = await renderPdfPage(d, 1, 794, 2); w = 794; h = Math.round(r.height); blob = await new Promise<Blob>((res) => r.canvas.toBlob((b) => res(b!), 'image/png')); }
      else { const dims2 = await new Promise<{ w: number; h: number }>((res) => { const i = new Image(); i.onload = () => res({ w: i.naturalWidth, h: i.naturalHeight }); i.src = URL.createObjectURL(f); }); w = dims2.w; h = dims2.h; }
      const path = `${app.user.id}/${nanoid(10)}.png`;
      await db.upload('templates', path, blob);
      const t = await db.insert<any>('templates', { owner_id: app.user.id, name: f.name.replace(/\.[^.]+$/, ''), storage_path: path, width: w, height: h });
      patchPage({ template: `custom:${t.id}`, orientation: w > h ? 'landscape' : 'portrait' });
      app.toast('Custom template saved — reuse it from Page setup');
    } catch (e: any) { app.toast(e.message || 'Template upload failed', 'err'); } finally { setBusy(''); }
  };

  const enterPresent = () => { setPresent(true); setThumbs(false); rootRef.current?.requestFullscreen?.().catch(() => {}); };
  const exitPresent = () => { setPresent(false); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); };
  useEffect(() => { const h = () => !document.fullscreenElement && setPresent(false); document.addEventListener('fullscreenchange', h); return () => document.removeEventListener('fullscreenchange', h); }, []);

  const exportPdf = async () => {
    if (!pages || !nb) return;
    setBusy('export');
    try {
      const imgs = await Promise.all(pages.map((p) => customTemplateImage(p.template)));
      const blob = await exportPagesPdf(nb.title, pages.map((p, i) => ({ template: p.template, objects: p.objects, ...pageDims(p.paper_size, p.orientation), customImage: imgs[i] })));
      saveBlob(blob, `${safeName(nb.title)}.pdf`);
      await db.insert('downloads', { user_id: app.user.id, resource_type: 'notebook', resource_id: nb.id, name: `${nb.title}.pdf`, kind: 'export' });
      app.toast('PDF exported');
    } catch (e: any) { app.toast(e.message || 'Export failed', 'err'); } finally { setBusy(''); }
  };

  const textContent = () => {
    const parts: string[] = [];
    (pages || []).forEach((p, i) => {
      const t = p.objects.flatMap((o: any) => o.type === 'text' || o.type === 'sticky' || o.type === 'node' ? [o.text] : o.type === 'table' ? o.cells.map((r: string[]) => r.join(' | ')) : o.type === 'math' ? [`$${o.latex}$`] : o.type === 'shape' && o.label ? [o.label] : []).filter(Boolean);
      if (t.length) parts.push(`Page ${i + 1}:\n${t.join('\n')}`);
    });
    if (nb?.notes_html) { const d = document.createElement('div'); d.innerHTML = nb.notes_html; parts.push(d.innerText); }
    return parts.join('\n\n');
  };
  const snapshot = () => pages?.map(({ template, paper_size, orientation, objects }) => ({ template, paper_size, orientation, objects })) || [];
  const restore = async (snap: any[]) => {
    if (!nb || !pages) return;
    for (const p of pages) await db.remove('notebook_pages', p.id);
    const fresh: NotebookPage[] = [];
    for (let i = 0; i < snap.length; i++) fresh.push(await db.insert<NotebookPage>('notebook_pages', { notebook_id: nb.id, position: i, ...snap[i], audio: [], updated_at: now() }));
    setPages(fresh); setActive(0);
  };
  const selObjs = useMemo(() => page?.objects.filter((o) => selected.includes(o.id)) || [], [page, selected]);

  if (loading || !pages) return <FullSpinner label="Opening notebook…" />;
  if (!nb || !access) return <Empty icon={<NotebookText />} title="Notebook not available" body="It may have been deleted, or it hasn’t been shared with you." action={<Button onClick={() => nav('/app/notebooks')}>Back to notebooks</Button>} />;
  if (nb.kind === 'whiteboard' && !embedded) { nav(`/app/whiteboards/${nb.id}`, { replace: true }); return null; }

  const bgImg = page?.template.startsWith('custom:') ? customImgs[page.template] || null : null;

  return (
    <div ref={rootRef} className={cn('flex flex-col bg-ivory dark:bg-background', present ? 'fixed inset-0 z-[90]' : 'h-full')}>
      <div className="flex flex-wrap items-center gap-1 px-3 pb-2 pt-3 sm:flex-nowrap sm:gap-2 sm:px-4">
        {!present && !embedded && <Tooltip content="Back"><Button size="icon" variant="ghost" aria-label="Back" onClick={() => nav(-1)}><ArrowLeft /></Button></Tooltip>}
        {embedded && onClose && <Button size="icon" variant="ghost" aria-label="Close pane" onClick={onClose}><X /></Button>}
        <Tooltip content={thumbs ? 'Hide pages' : 'Show pages'}><Button size="icon" variant="ghost" aria-label="Toggle pages" onClick={() => setThumbs((t) => !t)}>{thumbs ? <PanelLeftClose /> : <PanelLeft />}</Button></Tooltip>
        <input aria-label="Notebook title" className="min-w-0 flex-1 rounded-lg bg-transparent px-2 py-1 text-base font-semibold outline-none focus:bg-card max-sm:order-last max-sm:basis-full sm:text-lg"
          defaultValue={nb.title} key={nb.title} disabled={!editable} maxLength={200}
          onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== nb.title) db.update('notebooks', nb.id, { title: v, updated_at: now() }); }} />
        <div className="hidden md:block"><SaveBadge saver={saver} readOnly={!editable} /></div>
        {!editable && <Button size="sm" variant="secondary" onClick={async () => { const c = await duplicateNotebook(app.user, nb, `${nb.title} (my copy)`); app.toast('Your editable copy is ready'); nav(`/app/notebooks/${c.id}`); }}><Copy /> Make my copy</Button>}
        <Tooltip content="Favourite"><Button size="icon" variant="ghost" aria-label="Favourite" onClick={() => app.toggleFav('notebook', nb.id)}><Star className={app.isFav('notebook', nb.id) ? 'fill-amber-400 text-amber-400' : ''} /></Button></Tooltip>
        {!embedded && <Tooltip content="Split screen"><Button size="icon" variant="ghost" aria-label="Split screen" onClick={() => nav(`/app/split?left=notebook:${nb.id}`)}><Columns2 /></Button></Tooltip>}
        <Tooltip content="Typed notes"><Button size="icon" variant={panel === 'notes' ? 'secondary' : 'ghost'} aria-label="Typed notes" onClick={() => setPanel(panel === 'notes' ? null : 'notes')}><NotebookText /></Button></Tooltip>
        <Tooltip content="Audio recordings"><Button size="icon" variant={panel === 'audio' ? 'secondary' : 'ghost'} aria-label="Audio" onClick={() => setPanel(panel === 'audio' ? null : 'audio')}><Mic /></Button></Tooltip>
        <Tooltip content="Comments & versions"><Button size="icon" variant={panel === 'collab' ? 'secondary' : 'ghost'} aria-label="Comments and versions" onClick={() => setPanel(panel === 'collab' ? null : 'collab')}><MessageSquare /></Button></Tooltip>
        {access === 'owner' && <Tooltip content="Share"><Button size="icon" variant="ghost" aria-label="Share" onClick={() => setShare(true)}><Share2 /></Button></Tooltip>}
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label="More"><MoreHorizontal /></Button></DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={exportPdf}>{busy === 'export' ? <Loader2 className="animate-spin" /> : <FileDown />} Export as PDF</DropdownMenuItem>
            {editable && <DropdownMenuItem onSelect={() => setSetup(true)}><LayoutTemplate /> Page setup</DropdownMenuItem>}
            <DropdownMenuItem onSelect={present ? exitPresent : enterPresent}>{present ? <Minimize2 /> : <Maximize2 />} {present ? 'Exit presentation' : 'Presentation mode'}</DropdownMenuItem>
            <DropdownMenuItem onSelect={async () => { const c = await duplicateNotebook(app.user, nb); nav(`/app/notebooks/${c.id}`); }}><Copy /> Duplicate notebook</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Tooltip content={present ? 'Exit presentation' : 'Presentation mode'}><Button size="icon" variant={present ? 'secondary' : 'ghost'} aria-label="Presentation mode" className="hidden sm:inline-flex" onClick={present ? exitPresent : enterPresent}>{present ? <Minimize2 /> : <Maximize2 />}</Button></Tooltip>
      </div>

      {editable && (
        <div className="px-3 pb-2 sm:px-4">
          <Toolbar tools={tools} setTools={setTools} canUndo={!!page && hist.canUndo(page.id)} canRedo={!!page && hist.canRedo(page.id)} onUndo={undo} onRedo={redo}
            zoom={zoom} setZoom={setZoom} onImage={onImage} onAudio={() => setPanel('audio')} selection={selObjs} hint={hint}
            onPatch={(fn) => ops && setObjects(ops.patch(fn))} onDelete={() => { if (ops) { setObjects(ops.remove()); setSelected([]); } }}
            onDuplicate={() => { if (ops) { const r = ops.duplicate(); setObjects(r.objects); setSelected(r.ids); } }} onOrder={(f) => ops && setObjects(ops.order(f))} onAddChild={addChild}
            extra={<button onClick={() => setSetup(true)} className="hidden h-9 shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-xs hover:bg-white/10 lg:flex"><LayoutTemplate className="size-4" /> {templateLabel(page?.template || 'blank')} · {page?.paper_size} {page?.orientation === 'landscape' ? '↔' : '↕'}</button>} />
        </div>
      )}

      <div className="flex min-h-0 flex-1 gap-3 px-3 pb-3 sm:px-4">
        {thumbs && (
          <aside className="flex w-[124px] shrink-0 flex-col rounded-2xl border border-border bg-card/70" aria-label="Pages">
            <div className="flex-1 space-y-1.5 overflow-y-auto p-2">
              {pages.map((p, i) => (
                <Thumb key={p.id} page={p} index={i} active={i === active} img={p.template.startsWith('custom:') ? customImgs[p.template] : null}
                  onClick={() => { setActive(i); setSelected([]); }} draggable={editable}
                  onDragStart={() => { dragFrom.current = i; }} onDrop={() => { if (dragFrom.current != null) move(dragFrom.current, i); dragFrom.current = null; }} />
              ))}
            </div>
            {editable && (
              <div className="grid grid-cols-3 gap-1 border-t border-border p-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label="Add page"><Plus /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="max-h-[60vh] overflow-auto">
                    <DropdownMenuItem onSelect={() => add()}><Plus /> Same as current</DropdownMenuItem>
                    {TEMPLATE_GROUPS.map((g) => (
                      <DropdownMenuSub key={g.group}><DropdownMenuSubTrigger>{g.group}</DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>{g.items.map((it) => <DropdownMenuItem key={it.id} onSelect={() => add(it.id)}>{it.label}</DropdownMenuItem>)}</DropdownMenuSubContent>
                      </DropdownMenuSub>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Tooltip content="Duplicate page"><Button size="icon" variant="ghost" aria-label="Duplicate page" onClick={duplicatePage}><Copy /></Button></Tooltip>
                <Tooltip content="Delete page"><Button size="icon" variant="ghost" aria-label="Delete page" onClick={deletePage}><Trash2 /></Button></Tooltip>
                <Tooltip content="Move up"><Button size="icon" variant="ghost" aria-label="Move page up" onClick={() => move(active, active - 1)}><ChevronUp /></Button></Tooltip>
                <Tooltip content="Move down"><Button size="icon" variant="ghost" aria-label="Move page down" onClick={() => move(active, active + 1)}><ChevronDown /></Button></Tooltip>
              </div>
            )}
          </aside>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          {editable && !embedded && <div className="fixed bottom-4 left-4 z-30 rounded-2xl bg-card/90 p-1.5 shadow-lift backdrop-blur"><AudioRecorder autoStart={autoRec} label="Record lesson" onStart={(t0) => { recRef.current = { clip: nanoid(8), t0 }; setRecording(true); }} onDone={(b, n) => onAudioRef.current(b, n)} /></div>}
          <div ref={scrollRef} data-scroll className="flex-1 overflow-auto rounded-2xl [-webkit-overflow-scrolling:touch] [overscroll-behavior:contain]" style={{ WebkitTouchCallout: 'none' } as React.CSSProperties}>
            <div className="flex min-w-fit justify-center p-4">
              {page && (
                <div className="overflow-hidden rounded-md shadow-lift ring-1 ring-black/5">
                  <InkCanvas key={page.id} width={dims.w} height={dims.h} zoom={zoom} onZoom={setZoom} objects={page.objects} onCommit={(o) => setObjects(o)}
                    selected={selected} onSelect={setSelected} tools={tools} readOnly={!editable} pencilOnly={!!app.user.settings?.pencil_only} onUndo={undo} onRedo={redo} tapUndo={app.user.settings?.tap_undo !== false}
                    background={{ kind: 'template', template: page.template, customImage: bgImg }} onHint={setHint}
                    onRequestMath={(at, existing) => setMathAt({ at, obj: existing as MathObj })}
                    recClock={() => (recRef.current ? { clip: recRef.current.clip, ms: Date.now() - recRef.current.t0 } : null)}
                    playback={playMs} seekMode={seekMode} onSeek={(r) => chips.current[r.clip]?.seek(r.ms)} />
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2 text-sm">
            <Button size="icon" variant="ghost" aria-label="Previous page" disabled={active === 0} onClick={() => { setActive(active - 1); setSelected([]); }}><ChevronLeft /></Button>
            <span className="tabular-nums text-muted-foreground">Page {active + 1} of {pages.length}</span>
            <Button size="icon" variant="ghost" aria-label="Next page" disabled={active === pages.length - 1} onClick={() => { setActive(active + 1); setSelected([]); }}><ChevronRight /></Button>
            {editable && <Button size="sm" variant="secondary" onClick={() => add()}><Plus /> Page</Button>}
          </div>
        </div>

        {panel && (
          <aside className="flex w-[340px] shrink-0 flex-col overflow-hidden rounded-2xl border border-border bg-card max-md:fixed max-md:inset-x-2 max-md:bottom-2 max-md:top-24 max-md:z-40 max-md:w-auto max-md:shadow-lift">
            {(
              <>
                <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
                  <span className="flex-1 text-sm font-semibold">{panel === 'collab' ? 'Comments & history' : panel === 'audio' ? 'Audio recordings' : 'Typed notes'}</span>
                  <Button size="icon" variant="ghost" aria-label="Close panel" onClick={() => setPanel(null)}><X /></Button>
                </div>
                <div className="min-h-0 flex-1 overflow-auto">
                  {panel === 'collab' && <CollabPanel type="notebook" id={nb.id} name={nb.title} access={access} snapshot={snapshot} onRestore={restore} />}
                  {panel === 'notes' && <div className="p-3"><RichText value={nb.notes_html || ''} editable={editable} minHeight={320} placeholder="Typed notes alongside your handwriting…"
                    onChange={(html) => saver.schedule('notes', () => db.update('notebooks', nb.id, { notes_html: html, updated_at: now() }, true))} /></div>}
                  {panel === 'audio' && (
                    <div className="space-y-4 p-4">
                      <p className="text-xs text-muted-foreground">Recordings attach to <b>page {active + 1}</b> and are stored privately with this notebook.</p>
                      <button onClick={() => setSeekMode((v) => !v)} className={`rounded-xl px-3 py-2 text-sm font-medium ${seekMode ? 'bg-charcoal text-white' : 'bg-secondary'}`}>{seekMode ? 'Tap writing to jump: ON' : 'Tap writing to jump'}</button>
                      <div className="space-y-2">
                        {(page?.audio || []).map((a) => (
                          <div key={a.id} className="flex items-center gap-2">
                            <AudioChip bucket="audio" path={a.storage_path} label={a.label} duration={a.duration} chipRef={(h) => { chips.current[a.id] = h; }} onTime={(ms) => setPlayMs(ms == null ? null : { clip: a.id, ms })} />
                            <span className="text-[11px] text-muted-foreground">{timeAgo(a.created_at)}</span>
                            {editable && <>
                              <button className="text-xs text-muted-foreground hover:text-foreground" onClick={async () => { const n = await ask.prompt('Rename recording', a.label); if (n) patchPage({ audio: page!.audio.map((x) => (x.id === a.id ? { ...x, label: n } : x)) }); }}>Rename</button>
                              <button className="text-xs text-red-500" onClick={() => patchPage({ audio: page!.audio.filter((x) => x.id !== a.id) })}>Remove</button>
                            </>}
                          </div>
                        ))}
                        {!page?.audio?.length && <p className="text-sm text-muted-foreground">No recordings on this page.</p>}
                      </div>
                      <p className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">Transcription is part of Notevia AI and needs an AI provider configured (Phase 2).</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </aside>
        )}
      </div>

      <MathDialog open={!!mathAt} initial={mathAt?.obj?.latex} onClose={() => setMathAt(null)} onSave={saveMath} />
      {access === 'owner' && <ShareDialog open={share} onOpenChange={setShare} type="notebook" id={nb.id} name={nb.title} />}
      <PageSetup open={setup} onOpenChange={setSetup} page={page} busy={busy === 'template'}
        onApply={(patch, all) => { patchPage(patch, all); if (all) db.update('notebooks', nb.id, { template: patch.template || nb.template, paper_size: patch.paper_size || nb.paper_size, orientation: patch.orientation || nb.orientation }); }}
        onUpload={() => tplInput.current?.click()} />
      <input ref={tplInput} type="file" accept="image/*,application/pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadTemplate(f); e.target.value = ''; setSetup(false); }} />
    </div>
  );
}

function PageSetup({ open, onOpenChange, page, onApply, onUpload, busy }: { open: boolean; onOpenChange: (o: boolean) => void; page?: NotebookPage; onApply: (p: Partial<NotebookPage>, all: boolean) => void; onUpload: () => void; busy: boolean }) {
  const app = useApp();
  const [t, setT] = useState<TemplateId>('lined');
  const [size, setSize] = useState<PaperSize>('A4');
  const [o, setO] = useState<Orientation>('portrait');
  const [all, setAll] = useState(false);
  const [custom, setCustom] = useState<any[]>([]);
  useEffect(() => { if (open && page) { setT(page.template); setSize(page.paper_size); setO(page.orientation); db.list('templates', { owner_id: app.user.id }).then(setCustom); } }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl">
        <DialogHeader><DialogTitle>Page setup</DialogTitle></DialogHeader>
        <DialogBody className="space-y-5">
          {TEMPLATE_GROUPS.map((g) => (
            <div key={g.group}>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.group}</div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {g.items.map((it) => <TemplateCard key={it.id} id={it.id} label={it.label} active={t === it.id} onClick={() => setT(it.id)} />)}
              </div>
            </div>
          ))}
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">My templates</div>
            <div className="flex flex-wrap gap-2">
              {custom.map((c) => <button key={c.id} onClick={() => setT(`custom:${c.id}`)} className={cn('rounded-xl border px-3 py-2 text-sm', t === `custom:${c.id}` ? 'border-lavender-deep bg-secondary' : 'border-border hover:bg-muted')}>{c.name}</button>)}
              <Button variant="outline" onClick={onUpload} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Upload />} Upload template (image or PDF)</Button>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div><Label>Paper size</Label><NativeSelect value={size} onChange={(e) => setSize(e.target.value as PaperSize)}><option>A4</option><option>A5</option><option>Letter</option></NativeSelect></div>
            <div><Label>Orientation</Label><NativeSelect value={o} onChange={(e) => setO(e.target.value as Orientation)}><option value="portrait">Portrait</option><option value="landscape">Landscape</option></NativeSelect></div>
            <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-primary" checked={all} onChange={(e) => setAll(e.target.checked)} /> Apply to all pages</label>
          </div>
        </DialogBody>
        <DialogFooter><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={() => { onApply({ template: t, paper_size: size, orientation: o }, all); onOpenChange(false); }}>Apply</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const tplCache = new Map<string, string>();
export function TemplateCard({ id, label, active, onClick }: { id: TemplateId; label: string; active: boolean; onClick: () => void }) {
  const [src, setSrc] = useState(tplCache.get(id) || '');
  useEffect(() => { if (!src) renderPage({ template: id, objects: [], w: 794, h: 1123, scale: 0.16 }).then((c) => { const u = c.toDataURL('image/png'); tplCache.set(id, u); setSrc(u); }); }, [id]);
  return (
    <button onClick={onClick} aria-pressed={active} className={cn('rounded-xl border p-1.5 text-left transition', active ? 'border-lavender-deep bg-secondary ring-2 ring-lavender/40' : 'border-border hover:bg-muted')}>
      <div className="aspect-[794/1123] overflow-hidden rounded-md border border-border bg-white">{src && <img src={src} alt="" className="h-full w-full object-cover" />}</div>
      <div className="mt-1 truncate text-[11px] font-medium">{label}</div>
    </button>
  );
}
