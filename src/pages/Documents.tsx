import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Upload, FolderPlus, ChevronRight, Home as HomeIcon, Search, Download, Pencil, Copy, Trash2, Share2, Star, FolderInput, Eye, PenLine, Palette,
  MoreHorizontal, Tag, FileText, FilePlus2, Wand2, FolderOpen, X, Filter,
} from 'lucide-react';
import { useApp, ask } from '@/lib/app';
import { useLocalState, useTable } from '@/lib/hooks';
import { db, now } from '@/lib/backend';
import type { DocumentRow, Folder, Notebook, Workspace } from '@/lib/types';
import { createFolder, createPage, duplicateDocument, trash, uploadDocuments } from '@/lib/actions';
import { docxToHtml } from '@/lib/office';
import { ACCEPTED, cn, fileKind, PASTELS, saveBlob, FileKind } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input, Label, NativeSelect } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ColorDots, Empty, PageHeader, Progress, ViewToggle } from '@/components/common';
import { DocCard, FolderCard, NotebookCard } from '@/components/Cards';
import { Viewer } from '@/components/Viewer';
import { ShareDialog } from '@/components/ShareDialog';
import { atLeast } from '@/lib/access';

export default function Documents() {
  const app = useApp();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const folderId = params.get('folder');
  const ws = params.get('ws');
  const { rows: allFolders } = useTable<Folder>('folders', { kind: 'documents' }, { col: 'created_at', asc: true });
  const { rows: allDocs } = useTable<DocumentRow>('documents', undefined, { col: 'updated_at' });
  const { rows: allNbs } = useTable<Notebook>('notebooks', undefined, { col: 'updated_at' });
  const { rows: shares } = useTable<any>('shares', { owner_id: app.user.id });
  const { rows: workspaces } = useTable<Workspace>('workspaces', { owner_id: app.user.id });
  const [view, setView] = useLocalState<'grid' | 'list'>('nv-docs-view', 'grid');
  const [q, setQ] = useState('');
  const [type, setType] = useState<'all' | FileKind>('all');
  const [tag, setTag] = useState('');
  const [sort, setSort] = useState<'recent' | 'name' | 'size'>('recent');
  const [drag, setDrag] = useState(false);
  const [uploading, setUploading] = useState<{ d: number; t: number } | null>(null);
  const [preview, setPreview] = useState<DocumentRow | null>(null);
  const [moving, setMoving] = useState<{ kind: 'document' | 'folder' | 'notebook'; id: string } | null>(null);
  const [sharing, setSharing] = useState<{ type: 'document' | 'folder'; id: string; name: string } | null>(null);
  const [tagging, setTagging] = useState<DocumentRow | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const folders = allFolders.filter((f) => !f.deleted_at && app.can('folder', f) && (!ws || f.workspace_id === ws || !!folderId));
  const docs = allDocs.filter((d) => !d.deleted_at && app.can('document', d));
  const nbs = allNbs.filter((n) => !n.deleted_at && app.can('notebook', n));
  const current = folders.find((f) => f.id === folderId) || null;
  const currentAccess = current ? app.can('folder', current) : 'owner';
  const canAddHere = atLeast(currentAccess as any, 'edit');
  const crumbs = useMemo(() => { const out: Folder[] = []; let f = current; let g = 0; while (f && g++ < 30) { out.unshift(f); f = folders.find((x) => x.id === f!.parent_id) || null; } return out; }, [current, folders]);
  const isShared = (type: string, id: string) => shares.some((s: any) => s.resource_type === type && s.resource_id === id);
  const allTags = useMemo(() => Array.from(new Set(docs.flatMap((d) => d.tags || []))).sort(), [docs]);

  const searching = !!q.trim() || type !== 'all' || !!tag;
  const inScope = (x: { folder_id?: string | null; workspace_id?: string | null }) => searching ? (!ws || x.workspace_id === ws) : (x.folder_id || null) === (folderId || null) && (folderId || !ws || x.workspace_id === ws);
  // at root, show folders the user owns plus the top of any shared folder tree
  const subfolders = searching ? [] : folders.filter((f) => folderId ? f.parent_id === folderId : (!f.parent_id || !folders.some((p) => p.id === f.parent_id)) && (!ws || f.workspace_id === ws));
  let files = docs.filter((d) => inScope(d) && (folderId || searching || d.owner_id === app.user.id || !d.folder_id));
  let notebooks = type === 'all' && !tag ? nbs.filter((n) => n.folder_id && inScope(n)) : [];
  if (q.trim()) { const s = q.toLowerCase(); files = files.filter((d) => d.name.toLowerCase().includes(s) || (d.tags || []).some((t) => t.includes(s)) || d.category?.toLowerCase().includes(s)); notebooks = nbs.filter((n) => n.title.toLowerCase().includes(s)); }
  if (type !== 'all') files = files.filter((d) => fileKind(d.mime_type, d.name) === type);
  if (tag) files = files.filter((d) => (d.tags || []).includes(tag));
  files = [...files].sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name) : sort === 'size' ? b.size - a.size : a.updated_at < b.updated_at ? 1 : -1));
  const countIn = (fid: string) => docs.filter((d) => d.folder_id === fid).length + folders.filter((f) => f.parent_id === fid).length + nbs.filter((n) => n.folder_id === fid).length;

  const doUpload = async (list: File[]) => {
    if (!list.length) return;
    if (!canAddHere) return app.toast('You can view this folder but not add to it', 'err');
    setUploading({ d: 0, t: list.length });
    try {
      const out = await uploadDocuments(app.user, list, folderId, ws || current?.workspace_id || null, (d, t) => setUploading({ d, t }));
      out.forEach((d) => app.log('uploaded', 'document', d.id, d.name));
      app.toast(`${list.length} file${list.length > 1 ? 's' : ''} uploaded`);
    } catch (e: any) { app.toast(e.message || 'Upload failed', 'err'); } finally { setUploading(null); }
  };
  const newFolder = async () => {
    const n = await ask.prompt(current ? `New folder in “${current.name}”` : 'New folder', '', 'Folder name', 'Create');
    if (n) { await createFolder(app.user, n.slice(0, 120), folderId, 'documents', ws || current?.workspace_id || null); app.toast('Folder created'); }
  };
  const newPage = async () => { const n = await ask.prompt('New Notevia page', 'Untitled page', 'A rich-text page — headings, lists, tables and checklists', 'Create'); if (n) { const p = await createPage(app.user, n, '', folderId, { workspace_id: ws || null }); nav(`/app/pages/${p.id}`); } };

  useEffect(() => {
    if (params.get('upload')) { setTimeout(() => fileRef.current?.click(), 150); params.delete('upload'); setParams(params, { replace: true }); }
    const open = params.get('open');
    if (open && allDocs.length) { const d = allDocs.find((x) => x.id === open); if (d) openDoc(d); params.delete('open'); setParams(params, { replace: true }); }
  }, [params, allDocs.length]);

  const openDoc = (d: DocumentRow) => {
    app.touchRecent('document', d.id);
    const k = fileKind(d.mime_type, d.name);
    if (k === 'pdf') nav(`/app/pdf/${d.id}`); else if (k === 'page') nav(`/app/pages/${d.id}`); else if (['docx', 'pptx', 'xlsx', 'csv', 'txt', 'image', 'svg'].includes(k)) nav(`/app/doc/${d.id}`); else setPreview(d);
  };
  const download = async (d: DocumentRow) => {
    if (!d.storage_path) { saveBlob(new Blob([`<!doctype html><meta charset="utf-8"><title>${d.name}</title>${d.content_html || ''}`], { type: 'text/html' }), `${d.name}.html`); return; }
    saveBlob(await db.download('documents', d.storage_path), d.name);
    await db.insert('downloads', { user_id: app.user.id, resource_type: 'document', resource_id: d.id, name: d.name, kind: 'original' });
  };
  const convertDocx = async (d: DocumentRow) => {
    try { const html = await docxToHtml(await db.download('documents', d.storage_path!)); const p = await createPage(app.user, d.name.replace(/\.docx$/i, ''), html, d.folder_id); app.toast('Converted to an editable Notevia page — the original DOCX is unchanged'); nav(`/app/pages/${p.id}`); }
    catch (e: any) { app.toast(e.message || 'Conversion failed', 'err'); }
  };
  const goFolder = (id: string | null) => { const p = new URLSearchParams(); if (id) p.set('folder', id); if (ws) p.set('ws', ws); setParams(p); setQ(''); setType('all'); setTag(''); };

  const docMenu = (d: DocumentRow) => {
    const a = app.can('document', d); const own = a === 'owner'; const k = fileKind(d.mime_type, d.name);
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild><button aria-label={`Actions for ${d.name}`} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-muted"><MoreHorizontal className="size-4" /></button></DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => openDoc(d)}>{k === 'pdf' ? <PenLine /> : <Eye />} {k === 'pdf' ? 'Open & annotate' : k === 'page' ? 'Open page' : 'Preview'}</DropdownMenuItem>
          {k === 'pdf' && <DropdownMenuItem onSelect={() => setPreview(d)}><Eye /> Quick preview</DropdownMenuItem>}
          {k === 'docx' && d.name.toLowerCase().endsWith('.docx') && <DropdownMenuItem onSelect={() => convertDocx(d)}><Wand2 /> Edit as Notevia page</DropdownMenuItem>}
          <DropdownMenuItem onSelect={() => download(d)}><Download /> Download</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => app.toggleFav('document', d.id)}><Star /> {app.isFav('document', d.id) ? 'Remove favourite' : 'Add to favourites'}</DropdownMenuItem>
          {atLeast(a, 'edit') && <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={async () => { const n = await ask.prompt('Rename', d.name); if (n) { await db.update('documents', d.id, { name: n.slice(0, 200), updated_at: now() }); app.log('renamed', 'document', d.id, n); } }}><Pencil /> Rename</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setTagging(d)}><Tag /> Tags & category</DropdownMenuItem>
          </>}
          {own && <>
            <DropdownMenuItem onSelect={() => setMoving({ kind: 'document', id: d.id })}><FolderInput /> Move</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setSharing({ type: 'document', id: d.id, name: d.name })}><Share2 /> Share</DropdownMenuItem>
          </>}
          <DropdownMenuItem onSelect={async () => { await duplicateDocument(app.user, d); app.toast('Copy saved to your documents'); }}><Copy /> {own ? 'Duplicate' : 'Save a copy'}</DropdownMenuItem>
          {own && <><DropdownMenuSeparator /><DropdownMenuItem destructive onSelect={async () => { await trash('documents', d.id); app.log('deleted', 'document', d.id, d.name); app.toast('Moved to recycle bin', 'ok', { label: 'Undo', run: () => db.update('documents', d.id, { deleted_at: null }) }); }}><Trash2 /> Delete</DropdownMenuItem></>}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };
  const folderMenu = (f: Folder) => {
    const own = f.owner_id === app.user.id;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild><button aria-label={`Actions for folder ${f.name}`} className="grid h-7 w-7 place-items-center rounded-lg hover:bg-muted"><MoreHorizontal className="size-4" /></button></DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => goFolder(f.id)}><FolderOpen /> Open</DropdownMenuItem>
          {own && <>
            <DropdownMenuItem onSelect={async () => { const n = await ask.prompt('Rename folder', f.name); if (n) db.update('folders', f.id, { name: n.slice(0, 120) }); }}><Pencil /> Rename</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => db.update('folders', f.id, { color: PASTELS[(PASTELS.indexOf(f.color) + 1) % PASTELS.length] })}><Palette /> Next colour</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setMoving({ kind: 'folder', id: f.id })}><FolderInput /> Move</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setSharing({ type: 'folder', id: f.id, name: f.name })}><Share2 /> Share folder</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={async () => { if (await ask.confirm('Delete folder?', `“${f.name}” moves to the recycle bin. Items inside will be hidden until you restore it.`)) { await trash('folders', f.id); app.toast('Folder moved to recycle bin'); } }}><Trash2 /> Delete</DropdownMenuItem>
          </>}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };
  const dropOnFolder = (f: Folder) => async (e: React.DragEvent) => {
    const raw = e.dataTransfer.getData('text/nv-item'); if (!raw) return;
    e.preventDefault(); e.stopPropagation();
    const [kind, id] = raw.split(':');
    await db.update(kind === 'notebook' ? 'notebooks' : 'documents', id, { folder_id: f.id });
    app.toast(`Moved to ${f.name}`);
  };
  const wsName = workspaces.find((w) => w.id === ws)?.name;

  return (
    <div className="relative min-h-[70vh] animate-fade-up"
      onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDrag(true); } }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDrag(false); }}
      onDrop={(e) => { if (e.dataTransfer.files.length) { e.preventDefault(); setDrag(false); doUpload(Array.from(e.dataTransfer.files)); } }}>
      <PageHeader icon={<FileText />} title={wsName ? `${wsName} · Documents` : 'Documents'} subtitle="Upload, organise, tag and share. Drag files anywhere on this page to upload."
        actions={<>
          <Button variant="outline" onClick={newFolder} disabled={!canAddHere}><FolderPlus /> New folder</Button>
          <Button variant="outline" onClick={newPage}><FilePlus2 /> New page</Button>
          <Button onClick={() => fileRef.current?.click()} disabled={!canAddHere}><Upload /> Upload</Button>
          <input ref={fileRef} type="file" multiple accept={ACCEPTED} hidden onChange={(e) => { doUpload(Array.from(e.target.files || [])); e.target.value = ''; }} />
        </>} />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] max-w-sm flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search documents" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search names, tags, categories…" className="pl-9" /></div>
        <NativeSelect aria-label="Type" className="w-auto" value={type} onChange={(e) => setType(e.target.value as any)}>
          <option value="all">All types</option>{(['pdf', 'docx', 'pptx', 'xlsx', 'csv', 'txt', 'image', 'svg', 'audio', 'video', 'page'] as FileKind[]).map((k) => <option key={k} value={k}>{k === 'page' ? 'Notevia pages' : k.toUpperCase()}</option>)}
        </NativeSelect>
        {allTags.length > 0 && <NativeSelect aria-label="Tag" className="w-auto" value={tag} onChange={(e) => setTag(e.target.value)}><option value="">All tags</option>{allTags.map((t) => <option key={t} value={t}>#{t}</option>)}</NativeSelect>}
        <NativeSelect aria-label="Sort" className="w-auto" value={sort} onChange={(e) => setSort(e.target.value as any)}><option value="recent">Recently updated</option><option value="name">Name A–Z</option><option value="size">Largest first</option></NativeSelect>
        <ViewToggle value={view} onChange={setView} />
      </div>

      <nav className="mb-4 flex flex-wrap items-center gap-1 text-sm" aria-label="Breadcrumb">
        <button onClick={() => goFolder(null)} className={cn('flex items-center gap-1.5 rounded-lg px-2 py-1 hover:bg-muted', !current && 'font-semibold')}><HomeIcon className="size-3.5" /> {wsName || 'All documents'}</button>
        {ws && <button onClick={() => setParams({})} className="ml-1 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px]"><X className="size-3" /> clear workspace</button>}
        {crumbs.map((c) => <span key={c.id} className="flex items-center gap-1"><ChevronRight className="size-3.5 text-muted-foreground" /><button onClick={() => goFolder(c.id)} className={cn('rounded-lg px-2 py-1 hover:bg-muted', c.id === folderId && 'font-semibold')}>{c.name}</button></span>)}
        {searching && <span className="ml-2 inline-flex items-center gap-1 text-muted-foreground"><Filter className="size-3.5" /> {files.length + notebooks.length} result{files.length + notebooks.length === 1 ? '' : 's'}</span>}
      </nav>

      {uploading && <div className="mb-4 flex items-center gap-4 rounded-2xl border border-border bg-card p-4"><Upload className="size-4 text-lavender-deep" /><div className="flex-1"><div className="mb-1.5 text-sm">Uploading {uploading.d} of {uploading.t}…</div><Progress value={(uploading.d / uploading.t) * 100} /></div></div>}

      {subfolders.length > 0 && (
        <div className={cn('mb-7', view === 'grid' ? 'grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8' : 'divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card')}>
          {subfolders.map((f) => <FolderCard key={f.id} f={f} view={view} count={countIn(f.id)} onOpen={() => goFolder(f.id)} menu={folderMenu(f)} onDropItem={f.owner_id === app.user.id ? dropOnFolder(f) : undefined} />)}
        </div>
      )}

      {files.length + notebooks.length === 0 && subfolders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border"><Empty icon={<FolderOpen />} title={searching ? 'No matches' : 'This folder is empty'}
          body={canAddHere ? 'Drop PDF, DOCX, PPTX, XLSX, CSV, TXT, images, SVG, MP3, WAV or MP4 files here.' : 'Nothing has been shared here yet.'}
          action={canAddHere && !searching && <Button onClick={() => fileRef.current?.click()}><Upload /> Upload files</Button>} /></div>
      ) : (
        <div className={view === 'grid' ? 'grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5' : 'divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card'}>
          {notebooks.map((n) => <div key={n.id} draggable={n.owner_id === app.user.id} onDragStart={(e) => e.dataTransfer.setData('text/nv-item', `notebook:${n.id}`)}><NotebookCard n={n} view={view} /></div>)}
          {files.map((d) => (
            <div key={d.id} draggable={d.owner_id === app.user.id} onDragStart={(e) => e.dataTransfer.setData('text/nv-item', `document:${d.id}`)}>
              <DocCard d={d} view={view} fav={app.isFav('document', d.id)} shared={d.owner_id === app.user.id ? isShared('document', d.id) : undefined} onOpen={() => openDoc(d)} menu={docMenu(d)} />
            </div>
          ))}
        </div>
      )}

      {drag && <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center rounded-3xl border-2 border-dashed border-lavender-deep bg-lilac/70 dark:bg-lavender/10"><div className="text-center"><Upload className="mx-auto mb-2 size-8 text-lavender-deep" /><div className="font-semibold">Drop to upload{current ? ` into “${current.name}”` : ''}</div></div></div>}

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent size="xl">
          <DialogHeader><DialogTitle className="truncate pr-8">{preview?.name}</DialogTitle></DialogHeader>
          <DialogBody><div className="min-h-[300px] rounded-xl bg-ivory p-3 dark:bg-background">{preview && <Viewer doc={preview} width={760} />}</div></DialogBody>
          <DialogFooter>
            {preview && fileKind(preview.mime_type, preview.name) === 'docx' && preview.name.toLowerCase().endsWith('.docx') && <Button variant="outline" onClick={() => convertDocx(preview)}><Wand2 /> Edit as Notevia page</Button>}
            {preview && <Button variant="outline" onClick={() => nav(`/app/split?left=document:${preview.id}`)}>Open in split screen</Button>}
            {preview && <Button variant="ghost" onClick={() => download(preview)}><Download /> Download</Button>}
            <Button onClick={() => setPreview(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MoveDialog target={moving} folders={folders.filter((f) => f.owner_id === app.user.id)} onClose={() => setMoving(null)} onMove={async (dest) => {
        if (!moving) return;
        if (moving.kind === 'folder') { let p: string | null = dest, g = 0; while (p && g++ < 30) { if (p === moving.id) return app.toast('A folder can’t go inside itself', 'err'); p = folders.find((f) => f.id === p)?.parent_id || null; } await db.update('folders', moving.id, { parent_id: dest }); }
        else await db.update(moving.kind === 'notebook' ? 'notebooks' : 'documents', moving.id, { folder_id: dest, updated_at: now() });
        app.toast('Moved'); setMoving(null);
      }} />
      {sharing && <ShareDialog open onOpenChange={(o) => !o && setSharing(null)} type={sharing.type} id={sharing.id} name={sharing.name} />}
      {tagging && <TagDialog d={tagging} onClose={() => setTagging(null)} suggestions={allTags} />}
    </div>
  );
}

export function MoveDialog({ target, folders, onClose, onMove }: { target: { kind: string; id: string } | null; folders: Folder[]; onClose: () => void; onMove: (id: string | null) => void }) {
  const [dest, setDest] = useState<string | null>(null);
  const tree = (parent: string | null, depth: number): JSX.Element[] => folders.filter((f) => (f.parent_id || null) === parent && f.id !== target?.id).flatMap((f) => [
    <button key={f.id} onClick={() => setDest(f.id)} className={cn('flex w-full items-center gap-2 rounded-lg py-2 pr-3 text-left text-sm', dest === f.id ? 'bg-secondary' : 'hover:bg-muted')} style={{ paddingLeft: 12 + depth * 18 }}>
      <span className="h-3.5 w-4 rounded-sm" style={{ background: f.color }} />{f.name}
    </button>, ...tree(f.id, depth + 1)]);
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm">
        <DialogHeader><DialogTitle>Move to…</DialogTitle></DialogHeader>
        <DialogBody><div className="-mx-2 max-h-80 overflow-auto">
          <button onClick={() => setDest(null)} className={cn('flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm', dest === null ? 'bg-secondary' : 'hover:bg-muted')}><HomeIcon className="size-3.5" /> Top level</button>
          {tree(null, 0)}
        </div></DialogBody>
        <DialogFooter><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={() => onMove(dest)}>Move here</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TagDialog({ d, onClose, suggestions }: { d: DocumentRow; onClose: () => void; suggestions: string[] }) {
  const [tags, setTags] = useState<string[]>(d.tags || []);
  const [t, setT] = useState('');
  const [cat, setCat] = useState(d.category || '');
  const add = (v: string) => { const x = v.trim().toLowerCase().replace(/^#/, '').replace(/[^\w\- ]/g, '').slice(0, 30); if (x && !tags.includes(x)) setTags([...tags, x]); setT(''); };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Tags & category</DialogTitle></DialogHeader>
        <DialogBody className="space-y-4">
          <div><Label>Category</Label><Input value={cat} maxLength={60} onChange={(e) => setCat(e.target.value)} placeholder="e.g. Lecture slides, Reading, Contract, Lab report" /></div>
          <div><Label>Tags</Label>
            <div className="mb-2 flex flex-wrap gap-1.5">{tags.map((x) => <Badge key={x} tone="blue">#{x}<button aria-label={`Remove ${x}`} onClick={() => setTags(tags.filter((y) => y !== x))}><X className="size-3" /></button></Badge>)}</div>
            <Input value={t} onChange={(e) => setT(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(t); } }} placeholder="Type a tag and press Enter" />
            {suggestions.filter((s) => !tags.includes(s)).length > 0 && <div className="mt-2 flex flex-wrap gap-1">{suggestions.filter((s) => !tags.includes(s)).slice(0, 12).map((s) => <button key={s} onClick={() => add(s)} className="rounded-full border border-border px-2 py-0.5 text-[11px] hover:bg-muted">#{s}</button>)}</div>}
          </div>
        </DialogBody>
        <DialogFooter><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={async () => { await db.update('documents', d.id, { tags, category: cat.trim() || null, updated_at: now() }); onClose(); }}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
