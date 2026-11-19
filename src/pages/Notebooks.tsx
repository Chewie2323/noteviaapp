import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus, NotebookPen, PenLine, MoreHorizontal, Pencil, Copy, Trash2, Star, Share2, FolderInput } from 'lucide-react';
import { useApp, ask } from '@/lib/app';
import { useLocalState, useTable } from '@/lib/hooks';
import { db, now } from '@/lib/backend';
import type { Folder, Notebook } from '@/lib/types';
import { createNotebook, createWhiteboard, duplicateNotebook, trash } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/misc';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Empty, PageHeader, ViewToggle } from '@/components/common';
import { NotebookCard } from '@/components/Cards';
import { NewNotebookDialog } from '@/components/NewNotebookDialog';
import { ShareDialog } from '@/components/ShareDialog';
import { MoveDialog } from './Documents';

export default function Notebooks() {
  const app = useApp();
  const nav = useNavigate();
  const loc = useLocation();
  const boards = loc.pathname.includes('whiteboards');
  const { rows } = useTable<Notebook>('notebooks', undefined, { col: 'updated_at' });
  const { rows: folders } = useTable<Folder>('folders', { owner_id: app.user.id, kind: 'documents' });
  const [scope, setScope] = useState<'all' | 'mine' | 'shared'>('all');
  const [view, setView] = useLocalState<'grid' | 'list'>('nv-nb-view', 'grid');
  const [open, setOpen] = useState(false);
  const [share, setShare] = useState<Notebook | null>(null);
  const [move, setMove] = useState<Notebook | null>(null);
  const kind = boards ? 'whiteboard' : 'notebook';
  const vis = rows.filter((n) => n.kind === kind && !n.deleted_at && app.can('notebook', n));
  const list = vis.filter((n) => (scope === 'mine' ? n.owner_id === app.user.id : scope === 'shared' ? n.owner_id !== app.user.id : true));
  const create = async () => { if (boards) { const w = await createWhiteboard(app.user); nav(`/app/whiteboards/${w.id}`); } else setOpen(true); };
  const menu = (n: Notebook) => {
    const own = n.owner_id === app.user.id;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild><button aria-label={`Actions for ${n.title}`} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-muted"><MoreHorizontal className="size-4" /></button></DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => app.toggleFav('notebook', n.id)}><Star /> {app.isFav('notebook', n.id) ? 'Remove favourite' : 'Favourite'}</DropdownMenuItem>
          {own && <DropdownMenuItem onSelect={async () => { const t = await ask.prompt('Rename', n.title); if (t) db.update('notebooks', n.id, { title: t.slice(0, 200), updated_at: now() }); }}><Pencil /> Rename</DropdownMenuItem>}
          {own && <DropdownMenuItem onSelect={() => setShare(n)}><Share2 /> Share</DropdownMenuItem>}
          {own && <DropdownMenuItem onSelect={() => setMove(n)}><FolderInput /> Move to folder</DropdownMenuItem>}
          <DropdownMenuItem onSelect={async () => { const c = await duplicateNotebook(app.user, n); app.toast('Copy created'); nav(`/app/${boards ? 'whiteboards' : 'notebooks'}/${c.id}`); }}><Copy /> {own ? 'Duplicate' : 'Make my own copy'}</DropdownMenuItem>
          {own && <><DropdownMenuSeparator /><DropdownMenuItem destructive onSelect={async () => { await trash('notebooks', n.id); app.toast('Moved to recycle bin', 'ok', { label: 'Undo', run: () => db.update('notebooks', n.id, { deleted_at: null }) }); }}><Trash2 /> Delete</DropdownMenuItem></>}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };
  return (
    <div className="animate-fade-up">
      <PageHeader icon={boards ? <PenLine /> : <NotebookPen />} title={boards ? 'Whiteboards' : 'My Notebooks'}
        subtitle={boards ? 'Infinite canvases for brainstorming, mind maps and diagrams.' : 'Handwrite, type, diagram and record — everything saves automatically.'}
        actions={<><Button variant="outline" onClick={() => nav(boards ? '/app/notebooks' : '/app/whiteboards')}>{boards ? <><NotebookPen /> Notebooks</> : <><PenLine /> Whiteboards</>}</Button><Button onClick={create}><Plus /> {boards ? 'New whiteboard' : 'New notebook'}</Button></>} />
      <div className="mb-5 flex items-center justify-between gap-3">
        <Tabs value={scope} onValueChange={(v) => setScope(v as any)}><TabsList><TabsTrigger value="all">All ({vis.length})</TabsTrigger><TabsTrigger value="mine">Created by me</TabsTrigger><TabsTrigger value="shared">Shared with me</TabsTrigger></TabsList></Tabs>
        <ViewToggle value={view} onChange={setView} />
      </div>
      {list.length ? (
        <div className={view === 'grid' ? 'grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5' : 'divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card'}>
          {list.map((n) => <NotebookCard key={n.id} n={n} view={view} menu={menu(n)} sub={n.owner_id !== app.user.id ? `From ${app.profile(n.owner_id)?.full_name || 'a collaborator'}` : undefined} />)}
        </div>
      ) : <Empty icon={boards ? <PenLine /> : <NotebookPen />} title={boards ? 'No whiteboards yet' : 'No notebooks here'} action={<Button onClick={create}><Plus /> Create one</Button>} />}
      <NewNotebookDialog open={open} onOpenChange={setOpen} onCreate={async (v) => { const n = await createNotebook(app.user, v); app.log('created', 'notebook', n.id, n.title); nav(`/app/notebooks/${n.id}`); }} />
      {share && <ShareDialog open onOpenChange={(o) => !o && setShare(null)} type="notebook" id={share.id} name={share.title} />}
      <MoveDialog target={move ? { kind: 'notebook', id: move.id } : null} folders={folders.filter((f) => !f.deleted_at)} onClose={() => setMove(null)} onMove={async (dest) => { if (move) await db.update('notebooks', move.id, { folder_id: dest }); setMove(null); app.toast('Moved'); }} />
    </div>
  );
}
