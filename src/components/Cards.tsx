import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { NotebookPen, PenLine, Star, Users, Lock } from 'lucide-react';
import type { DocumentRow, Folder, Notebook, NotebookPage } from '@/lib/types';
import { db } from '@/lib/backend';
import { pdfThumbnail } from '@/lib/pdf';
import { renderPage } from '@/canvas/render';
import { pageDims } from '@/canvas/paper';
import { cn, fileKind, formatBytes, KIND_STYLE, timeAgo } from '@/lib/utils';
import { FileBadge, FolderArt } from './common';
import { Badge } from '@/components/ui/badge';

const thumbCache = new Map<string, string | null>();
export function docHref(d: DocumentRow) {
  const k = fileKind(d.mime_type, d.name);
  return k === 'pdf' ? `/app/pdf/${d.id}` : k === 'page' ? `/app/pages/${d.id}` : `/app/documents?open=${d.id}`;
}

export function DocThumb({ d, className }: { d: DocumentRow; className?: string }) {
  const k = fileKind(d.mime_type, d.name);
  const key = d.id + d.updated_at;
  const [src, setSrc] = useState<string | null>(thumbCache.get(key) ?? null);
  useEffect(() => {
    if (thumbCache.has(key) || !d.storage_path || !['pdf', 'image', 'svg'].includes(k)) return;
    let alive = true;
    (async () => {
      let s: string | null = null;
      try { const b = await db.download('documents', d.storage_path!); s = k === 'pdf' ? await pdfThumbnail(b) : URL.createObjectURL(b); } catch { /* none */ }
      thumbCache.set(key, s); alive && setSrc(s);
    })();
    return () => { alive = false; };
  }, [key]);
  const st = KIND_STYLE[k];
  if (k === 'page') return (
    <div className={cn('aspect-[4/3] overflow-hidden rounded-xl bg-card p-3 ring-1 ring-border', className)}>
      <div className="mb-2 h-2 w-2/3 rounded bg-lilac" />{[90, 75, 85, 60, 80].map((w, i) => <div key={i} className="mb-1.5 h-1.5 rounded bg-muted" style={{ width: `${w}%` }} />)}
    </div>
  );
  return (
    <div className={cn('grid aspect-[4/3] place-items-center overflow-hidden rounded-xl', className)} style={{ background: src ? '#fff' : st.bg }}>
      {src ? <img src={src} alt="" className="h-full w-full object-cover object-top" /> : <span className="text-lg font-bold" style={{ color: st.fg }}>{st.label}</span>}
    </div>
  );
}

const nbCache = new Map<string, string>();
export function NotebookThumb({ n }: { n: Notebook }) {
  const key = n.id + n.updated_at;
  const [src, setSrc] = useState(nbCache.get(key) || '');
  useEffect(() => {
    if (nbCache.has(key)) return;
    let alive = true;
    db.list<NotebookPage>('notebook_pages', { notebook_id: n.id }, { col: 'position', asc: true }, 1).then(async ([p]) => {
      if (!p || n.kind === 'whiteboard' || p.template.startsWith('custom:')) return;
      const d = pageDims(p.paper_size, p.orientation);
      const u = (await renderPage({ template: p.template, objects: p.objects, w: d.w, h: d.h, scale: 0.22 })).toDataURL('image/jpeg', 0.75);
      nbCache.set(key, u); alive && setSrc(u);
    }).catch(() => {});
    return () => { alive = false; };
  }, [key]);
  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-xl" style={{ background: n.cover_color }}>
      <div className="absolute inset-y-0 left-0 w-2.5 bg-black/5" />
      {src ? <img src={src} alt="" className="absolute bottom-0 left-1/2 w-[62%] -translate-x-1/2 translate-y-[14%] rounded-t-md shadow-soft" />
        : <div className="absolute inset-0 grid place-items-center">{n.kind === 'whiteboard' ? <PenLine className="size-7 text-charcoal/30" /> : <NotebookPen className="size-7 text-charcoal/30" />}</div>}
    </div>
  );
}

export function SharedBadge({ shared }: { shared: boolean }) {
  return shared ? <Badge tone="sage"><Users className="size-3" /> Shared</Badge> : <Badge tone="neutral"><Lock className="size-3" /> Private</Badge>;
}

export function DocCard({ d, view, fav, shared, onOpen, menu }: { d: DocumentRow; view: 'grid' | 'list'; fav?: boolean; shared?: boolean; onOpen?: () => void; menu?: React.ReactNode }) {
  const inner = view === 'grid' ? (
    <div className="group rounded-2xl border border-border bg-card p-2.5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift">
      <DocThumb d={d} />
      <div className="mt-2.5 flex items-start gap-1 px-0.5">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium" title={d.name}>{d.name}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">{d.storage_path ? formatBytes(d.size) + ' · ' : ''}{timeAgo(d.updated_at)}</div>
          <div className="mt-1.5 flex flex-wrap gap-1">{shared !== undefined && <SharedBadge shared={shared} />}{d.annotated_from && <Badge tone="peach">Annotated</Badge>}{(d.tags || []).slice(0, 2).map((t) => <Badge key={t} tone="blue">#{t}</Badge>)}{fav && <Star className="size-3.5 fill-amber-400 text-amber-400" />}</div>
        </div>
        <div onClick={(e) => e.preventDefault()}>{menu}</div>
      </div>
    </div>
  ) : (
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50">
      <FileBadge mime={d.mime_type} name={d.name} size={30} />
      <div className="min-w-0 flex-1"><div className="truncate text-sm">{d.name}</div><div className="flex gap-1">{(d.tags || []).slice(0, 3).map((t) => <span key={t} className="text-[11px] text-muted-foreground">#{t}</span>)}</div></div>
      {fav && <Star className="size-3.5 fill-amber-400 text-amber-400" />}
      {shared !== undefined && <span className="hidden sm:block"><SharedBadge shared={shared} /></span>}
      <span className="hidden w-20 text-right text-xs text-muted-foreground sm:block">{d.storage_path ? formatBytes(d.size) : 'Page'}</span>
      <span className="hidden w-24 text-right text-xs text-muted-foreground md:block">{timeAgo(d.updated_at)}</span>
      <div onClick={(e) => e.preventDefault()}>{menu}</div>
    </div>
  );
  return onOpen ? <div role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => e.key === 'Enter' && onOpen()} className="cursor-pointer">{inner}</div> : <Link to={docHref(d)}>{inner}</Link>;
}

export function NotebookCard({ n, view, sub, menu }: { n: Notebook; view: 'grid' | 'list'; sub?: string; menu?: React.ReactNode }) {
  const href = `/app/${n.kind === 'whiteboard' ? 'whiteboards' : 'notebooks'}/${n.id}`;
  if (view === 'list') return (
    <Link to={href} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50">
      <span className="grid h-9 w-8 place-items-center rounded-md" style={{ background: n.cover_color }}>{n.kind === 'whiteboard' ? <PenLine className="size-3.5" /> : <NotebookPen className="size-3.5" />}</span>
      <span className="min-w-0 flex-1 truncate text-sm">{n.title}</span><span className="hidden text-xs text-muted-foreground sm:block">{sub}</span>
      <span className="w-24 text-right text-xs text-muted-foreground">{timeAgo(n.updated_at)}</span><div onClick={(e) => e.preventDefault()}>{menu}</div>
    </Link>
  );
  return (
    <Link to={href} className="group block rounded-2xl border border-border bg-card p-2.5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift">
      <NotebookThumb n={n} />
      <div className="mt-2.5 flex items-start gap-1 px-0.5">
        <div className="min-w-0 flex-1"><div className="truncate text-[13px] font-medium">{n.title}</div><div className="mt-0.5 text-[11px] text-muted-foreground">{sub || (n.kind === 'whiteboard' ? 'Whiteboard' : 'Notebook')} · {timeAgo(n.updated_at)}</div></div>
        <div onClick={(e) => e.preventDefault()}>{menu}</div>
      </div>
    </Link>
  );
}

export function FolderCard({ f, count, view, menu, onOpen, onDropItem }: { f: Folder; count?: number; view: 'grid' | 'list'; menu?: React.ReactNode; onOpen: () => void; onDropItem?: (e: React.DragEvent) => void }) {
  const drop = onDropItem ? { onDragOver: (e: React.DragEvent) => { if (e.dataTransfer.types.includes('text/nv-item')) e.preventDefault(); }, onDrop: onDropItem } : {};
  if (view === 'list') return (
    <div role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => e.key === 'Enter' && onOpen()} {...drop} className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-muted/50">
      <div className="w-8"><FolderArt color={f.color} /></div><span className="flex-1 truncate text-sm font-medium">{f.name}</span>
      {count != null && <span className="text-xs text-muted-foreground">{count} item{count === 1 ? '' : 's'}</span>}<div onClick={(e) => e.stopPropagation()}>{menu}</div>
    </div>
  );
  return (
    <div role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => e.key === 'Enter' && onOpen()} {...drop} className="group relative cursor-pointer rounded-2xl p-1 transition hover:-translate-y-0.5">
      <FolderArt color={f.color} className="drop-shadow-sm transition group-hover:drop-shadow-md" />
      <div className="mt-1.5 flex items-start gap-1 px-1"><div className="min-w-0 flex-1"><div className="truncate text-[13px] font-medium">{f.name}</div>{count != null && <div className="text-[11px] text-muted-foreground">{count} item{count === 1 ? '' : 's'}</div>}</div><div onClick={(e) => e.stopPropagation()}>{menu}</div></div>
    </div>
  );
}
