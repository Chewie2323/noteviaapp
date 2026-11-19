import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LayoutGrid, Plus, MoreHorizontal, Pencil, Trash2, FolderOpen, NotebookPen, FileText } from 'lucide-react';
import { useApp, ask } from '@/lib/app';
import { useTable } from '@/lib/hooks';
import { db } from '@/lib/backend';
import type { DocumentRow, Folder, Notebook, Workspace as WS } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/input';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ColorDots, PageHeader } from '@/components/common';
import { PASTELS, timeAgo } from '@/lib/utils';
import { createFolder } from '@/lib/actions';

/** Workspaces group folders, documents and notebooks by area of life or work — no predefined subjects. */
export default function Workspace() {
  const app = useApp();
  const nav = useNavigate();
  const { rows: spaces } = useTable<WS>('workspaces', { owner_id: app.user.id }, { col: 'created_at', asc: true });
  const { rows: folders } = useTable<Folder>('folders', { owner_id: app.user.id });
  const { rows: docs } = useTable<DocumentRow>('documents', { owner_id: app.user.id });
  const { rows: nbs } = useTable<Notebook>('notebooks', { owner_id: app.user.id });
  const [edit, setEdit] = useState<Partial<WS> | null>(null);
  const stats = useMemo(() => Object.fromEntries(spaces.map((w) => {
    const fs = folders.filter((f) => f.workspace_id === w.id && !f.deleted_at);
    const fids = new Set(fs.map((f) => f.id));
    return [w.id, { folders: fs.length, docs: docs.filter((d) => !d.deleted_at && (d.workspace_id === w.id || (d.folder_id && fids.has(d.folder_id)))).length, nbs: nbs.filter((n) => !n.deleted_at && (n.workspace_id === w.id || (n.folder_id && fids.has(n.folder_id)))).length }];
  })), [spaces, folders, docs, nbs]);
  const unsorted = { docs: docs.filter((d) => !d.deleted_at && !d.workspace_id && !d.folder_id).length, nbs: nbs.filter((n) => !n.deleted_at && !n.folder_id).length };
  return (
    <div className="animate-fade-up">
      <PageHeader icon={<LayoutGrid />} title="My Workspace" subtitle="Create spaces for any part of your work or study — a course, a research project, a client, a hobby."
        actions={<Button onClick={() => setEdit({ color: PASTELS[0] })}><Plus /> New workspace</Button>} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {spaces.map((w) => (
          <div key={w.id} className="group relative overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift">
            <Link to={`/app/documents?ws=${w.id}`} className="block">
              <div className="h-20" style={{ background: `linear-gradient(135deg, ${w.color}, #fff0)` }} />
              <div className="p-5 pt-3">
                <h3 className="font-semibold">{w.name}</h3>
                <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-sm text-muted-foreground">{w.description || 'No description'}</p>
                <div className="mt-4 flex gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><FolderOpen className="size-3.5" />{stats[w.id]?.folders || 0} folders</span>
                  <span className="flex items-center gap-1"><FileText className="size-3.5" />{stats[w.id]?.docs || 0} documents</span>
                  <span className="flex items-center gap-1"><NotebookPen className="size-3.5" />{stats[w.id]?.nbs || 0} notebooks</span>
                </div>
              </div>
            </Link>
            <div className="absolute right-2 top-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild><button aria-label="Workspace actions" className="grid h-8 w-8 place-items-center rounded-lg bg-card/80 hover:bg-card"><MoreHorizontal className="size-4" /></button></DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onSelect={async () => { const n = await ask.prompt('New folder in this workspace', '', 'Folder name', 'Create'); if (n) { const f = await createFolder(app.user, n, null, 'documents', w.id); nav(`/app/documents?folder=${f.id}`); } }}><Plus /> Add folder</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setEdit(w)}><Pencil /> Edit</DropdownMenuItem>
                  {spaces.length > 1 && <DropdownMenuItem destructive onSelect={async () => { if (await ask.confirm('Delete workspace?', 'Folders and files inside are kept and move to “All documents”.')) { for (const f of folders.filter((x) => x.workspace_id === w.id)) await db.update('folders', f.id, { workspace_id: null }); await db.remove('workspaces', w.id); } }}><Trash2 /> Delete workspace</DropdownMenuItem>}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-8 rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
        Not in a workspace: {unsorted.docs} documents and {unsorted.nbs} notebooks. <Link to="/app/documents" className="text-lavender-ink underline dark:text-lavender">Open all documents</Link> · Updated {spaces[0] ? timeAgo(spaces[0].created_at) : '—'}
      </div>
      {edit && (
        <Dialog open onOpenChange={(o) => !o && setEdit(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>{edit.id ? 'Edit workspace' : 'New workspace'}</DialogTitle></DialogHeader>
            <DialogBody className="space-y-4">
              <div><Label>Name</Label><Input autoFocus maxLength={120} value={edit.name || ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="e.g. MSc Data Science, Client: Acme, Personal" /></div>
              <div><Label>Description</Label><Textarea rows={2} value={edit.description || ''} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></div>
              <div><Label>Colour</Label><ColorDots colors={PASTELS} value={edit.color || PASTELS[0]} onChange={(c) => setEdit({ ...edit, color: c })} /></div>
            </DialogBody>
            <DialogFooter><Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button><Button disabled={!edit.name?.trim()} onClick={async () => {
              const row = { name: edit.name!.trim(), description: edit.description || null, color: edit.color || PASTELS[0] };
              if (edit.id) await db.update('workspaces', edit.id, row); else await db.insert('workspaces', { ...row, owner_id: app.user.id });
              setEdit(null);
            }}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
