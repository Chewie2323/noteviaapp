import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Columns2, Rows2, Plus, X, ArrowLeftRight, Maximize2, Minimize2, PenLine, NotebookPen } from 'lucide-react';
import { useApp } from '@/lib/app';
import { useMediaQuery, useRow } from '@/lib/hooks';
import type { Assignment, DocumentRow, Notebook, ResourceLink, Submission } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/misc';
import { Empty, FullSpinner } from '@/components/common';
import { ResourcePicker } from '@/components/ResourcePicker';
import { Viewer } from '@/components/Viewer';
import { fileKind, cn } from '@/lib/utils';
import { createNotebook, createWhiteboard } from '@/lib/actions';
import NotebookEditor from './NotebookEditor';
import WhiteboardEditor from './WhiteboardEditor';
import PdfAnnotator from './PdfAnnotator';
import PageEditor from './PageEditor';
import { SubmissionReview } from './Assignments';

type PaneRef = { type: 'notebook' | 'document' | 'link' | 'submission'; id: string } | null;
const parse = (v: string | null): PaneRef => { if (!v) return null; const [type, id] = v.split(':'); return type && id ? { type: type as any, id } : null; };

function DocPane({ id, onClose }: { id: string; onClose: () => void }) {
  const { row: d, loading } = useRow<DocumentRow>('documents', id);
  const ref = useRef<HTMLDivElement>(null); const [w, setW] = useState(600);
  useEffect(() => { const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.floor(e.contentRect.width - 32)))); if (ref.current) ro.observe(ref.current); return () => ro.disconnect(); }, [d?.id]);
  if (loading) return <FullSpinner />;
  if (!d) return <Empty icon={<X />} title="Not available" />;
  const k = fileKind(d.mime_type, d.name);
  if (k === 'pdf') return <PdfAnnotator embeddedId={d.id} onClose={onClose} />;
  if (k === 'page') return <PageEditor embeddedId={d.id} onClose={onClose} />;
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 pb-2 pt-3"><Button size="icon" variant="ghost" aria-label="Close pane" onClick={onClose}><X /></Button><span className="truncate font-semibold">{d.name}</span></div>
      <div ref={ref} className="flex-1 overflow-auto px-4 pb-4"><Viewer doc={d} width={w} /></div>
    </div>
  );
}
function NotebookPane({ id, onClose }: { id: string; onClose: () => void }) {
  const { row: n, loading } = useRow<Notebook>('notebooks', id);
  if (loading) return <FullSpinner />;
  if (!n) return <Empty icon={<X />} title="Not available" />;
  return n.kind === 'whiteboard' ? <WhiteboardEditor embeddedId={n.id} onClose={onClose} /> : <NotebookEditor embeddedId={n.id} onClose={onClose} />;
}
function LinkPane({ id, onClose }: { id: string; onClose: () => void }) {
  const { row: l } = useRow<ResourceLink>('resource_links', id);
  return <div className="flex h-full flex-col"><div className="flex items-center gap-2 px-4 pb-2 pt-3"><Button size="icon" variant="ghost" aria-label="Close pane" onClick={onClose}><X /></Button><span className="truncate font-semibold">{l?.title}</span></div><div className="flex-1 p-3"><Viewer link={l} className="h-full" /></div></div>;
}
function SubmissionPane({ id, onClose }: { id: string; onClose: () => void }) {
  const { row: s } = useRow<Submission>('submissions', id);
  const { row: a } = useRow<Assignment>('assignments', s?.assignment_id);
  if (!s || !a) return <FullSpinner />;
  return <div className="flex h-full flex-col"><div className="flex items-center gap-2 px-4 pb-2 pt-3"><Button size="icon" variant="ghost" aria-label="Close pane" onClick={onClose}><X /></Button><span className="truncate font-semibold">Feedback · {a.title}</span></div><div className="flex-1 space-y-4 overflow-auto px-4 pb-4"><SubmissionReview a={a} s={s} /></div></div>;
}

export default function Split() {
  const app = useApp();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const left = parse(params.get('left')), right = parse(params.get('right'));
  const narrow = useMediaQuery('(max-width: 900px)');
  const [vertical, setVertical] = useState(narrow);
  useEffect(() => setVertical(narrow), [narrow]);
  const [ratio, setRatio] = useState(0.5);
  const [picking, setPicking] = useState<'left' | 'right' | null>(null);
  const [full, setFull] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const setPane = (side: 'left' | 'right', v: PaneRef) => { const p = new URLSearchParams(params); if (v) p.set(side, `${v.type}:${v.id}`); else p.delete(side); setParams(p, { replace: true }); };
  const createHere = async (side: 'left' | 'right', kind: 'whiteboard' | 'notebook') => {
    try {
      const n = kind === 'whiteboard' ? await createWhiteboard(app.user) : await createNotebook(app.user, { title: 'Untitled notebook', template: 'blank' });
      app.log('created', 'notebook', n.id, n.title);
      setPane(side, { type: 'notebook', id: n.id });
    } catch (err: any) { app.toast(err?.message || 'Couldn’t create that — please try again'); }
  };
  const onMove = (e: PointerEvent) => {
    if (!dragging.current || !box.current) return;
    const r = box.current.getBoundingClientRect();
    setRatio(Math.min(0.82, Math.max(0.18, vertical ? (e.clientY - r.top) / r.height : (e.clientX - r.left) / r.width)));
  };
  useEffect(() => { const up = () => { dragging.current = false; document.body.style.userSelect = ''; }; window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', up); return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', up); }; }, [vertical]);

  const pane = (side: 'left' | 'right', v: PaneRef) => (
    <div className="min-h-0 min-w-0 overflow-hidden rounded-2xl border border-border bg-ivory dark:bg-background" style={vertical ? { height: `calc(${(side === 'left' ? ratio : 1 - ratio) * 100}% - 6px)` } : { width: `calc(${(side === 'left' ? ratio : 1 - ratio) * 100}% - 6px)` }}>
      {!v ? (
        <div className="grid h-full place-items-center p-6 text-center">
          <div><div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-secondary"><Plus className="size-5 text-lavender-ink" /></div>
            <div className="font-medium">Open something here</div><p className="mb-4 mt-1 text-sm text-muted-foreground">A PDF, slides, a notebook, a whiteboard or a learning resource.</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => setPicking(side)}>Choose…</Button>
              <Button variant="outline" onClick={() => createHere(side, 'whiteboard')}><PenLine /> New whiteboard</Button>
              <Button variant="outline" onClick={() => createHere(side, 'notebook')}><NotebookPen /> New blank notebook</Button>
            </div></div>
        </div>
      ) : v.type === 'notebook' ? <NotebookPane key={v.id} id={v.id} onClose={() => setPane(side, null)} />
        : v.type === 'document' ? <DocPane key={v.id} id={v.id} onClose={() => setPane(side, null)} />
        : v.type === 'link' ? <LinkPane key={v.id} id={v.id} onClose={() => setPane(side, null)} />
        : <SubmissionPane key={v.id} id={v.id} onClose={() => setPane(side, null)} />}
    </div>
  );

  return (
    <div className={cn('flex flex-col bg-background', 'h-full')}>
      <div className="flex items-center gap-2 px-3 py-2 sm:px-4">
        {!full && <Button size="icon" variant="ghost" aria-label="Back" onClick={() => nav(-1)}><ArrowLeft /></Button>}
        <Columns2 className="size-4 text-lavender-deep" /><span className="font-semibold">Split screen</span>
        <div className="flex-1" />
        <Tooltip content="Swap sides"><Button size="icon" variant="ghost" aria-label="Swap sides" onClick={() => { const p = new URLSearchParams(); if (right) p.set('left', `${right.type}:${right.id}`); if (left) p.set('right', `${left.type}:${left.id}`); setParams(p, { replace: true }); }}><ArrowLeftRight /></Button></Tooltip>
        <Tooltip content={vertical ? 'Side by side' : 'Stacked'}><Button size="icon" variant="ghost" aria-label="Toggle layout" onClick={() => setVertical(!vertical)}>{vertical ? <Columns2 /> : <Rows2 />}</Button></Tooltip>
        <Button size="sm" variant="ghost" onClick={() => setRatio(0.5)}>50 / 50</Button>
        <Tooltip content={full ? 'Exit presentation' : 'Full-screen presentation'}><Button size="icon" variant="ghost" aria-label="Presentation mode" onClick={() => { if (!full) { setFull(true); document.documentElement.requestFullscreen?.().catch(() => {}); } else { setFull(false); document.fullscreenElement && document.exitFullscreen().catch(() => {}); } }}>{full ? <Minimize2 /> : <Maximize2 />}</Button></Tooltip>
      </div>
      <div ref={box} className={cn('flex min-h-0 flex-1 gap-0 px-3 pb-3 sm:px-4', vertical ? 'flex-col' : 'flex-row')}>
        {pane('left', left)}
        <div role="separator" aria-orientation={vertical ? 'horizontal' : 'vertical'} aria-label="Resize panes" tabIndex={0}
          onKeyDown={(e) => { if (['ArrowLeft', 'ArrowUp'].includes(e.key)) setRatio((r) => Math.max(0.18, r - 0.05)); if (['ArrowRight', 'ArrowDown'].includes(e.key)) setRatio((r) => Math.min(0.82, r + 0.05)); }}
          onPointerDown={(e) => { dragging.current = true; document.body.style.userSelect = 'none'; e.preventDefault(); }}
          className={cn('group flex shrink-0 items-center justify-center', vertical ? 'h-3 cursor-row-resize' : 'w-3 cursor-col-resize')}>
          <span className={cn('rounded-full bg-border transition group-hover:bg-lavender-deep', vertical ? 'h-1 w-12' : 'h-12 w-1')} />
        </div>
        {pane('right', right)}
      </div>
      <ResourcePicker open={!!picking} onOpenChange={(o) => !o && setPicking(null)} kinds={['document', 'notebook', 'whiteboard', 'link']} title="Open in this pane"
        onPick={(p) => { setPane(picking!, { type: p.type === 'link' ? 'link' : p.type, id: p.item.id }); setPicking(null); }} />
    </div>
  );
}
