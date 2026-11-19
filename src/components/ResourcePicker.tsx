import { useMemo, useState } from 'react';
import { NotebookPen, Link2, PenLine } from 'lucide-react';
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useApp } from '@/lib/app';
import { useTable } from '@/lib/hooks';
import type { DocumentRow, Notebook, ResourceLink } from '@/lib/types';
import { FileBadge } from './common';
import { timeAgo } from '@/lib/utils';

export type Picked = { type: 'document'; item: DocumentRow } | { type: 'notebook'; item: Notebook } | { type: 'link'; item: ResourceLink };

export function ResourcePicker({ open, onOpenChange, kinds = ['document', 'notebook', 'link'], onPick, title = 'Choose an item', mineOnly }: {
  open: boolean; onOpenChange: (o: boolean) => void; kinds?: ('document' | 'notebook' | 'whiteboard' | 'link')[]; onPick: (p: Picked) => void; title?: string; mineOnly?: boolean;
}) {
  const app = useApp();
  const { rows: docs } = useTable<DocumentRow>('documents', open && kinds.includes('document') ? {} : null, { col: 'updated_at' });
  const { rows: nbs } = useTable<Notebook>('notebooks', open && (kinds.includes('notebook') || kinds.includes('whiteboard')) ? {} : null, { col: 'updated_at' });
  const { rows: links } = useTable<ResourceLink>('resource_links', open && kinds.includes('link') ? {} : null);
  const [q, setQ] = useState('');
  const m = (s: string) => s.toLowerCase().includes(q.toLowerCase());
  const ok = (type: any, it: any) => (mineOnly ? it.owner_id === app.user.id : !!app.can(type, it)) && !it.deleted_at;
  const d = useMemo(() => docs.filter((x) => ok('document', x) && m(x.name)), [docs, q]);
  const n = useMemo(() => nbs.filter((x) => ok('notebook', x) && m(x.title) && kinds.includes(x.kind)), [nbs, q]);
  const l = useMemo(() => links.filter((x) => ok('link', x) && m(x.title)), [links, q]);
  const Row = ({ icon, name, sub, on }: any) => <button onClick={on} className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-muted">{icon}<span className="min-w-0 flex-1"><span className="block truncate text-sm">{name}</span><span className="text-[11px] text-muted-foreground">{sub}</span></span></button>;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>Only items you have access to are listed.</DialogDescription></DialogHeader>
        <DialogBody>
          <Input autoFocus placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="mb-3" />
          <div className="max-h-[55vh] space-y-4 overflow-auto">
            {kinds.includes('document') && <section><h4 className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Documents</h4>
              {d.map((x) => <Row key={x.id} icon={<FileBadge mime={x.mime_type} name={x.name} size={28} />} name={x.name} sub={timeAgo(x.updated_at)} on={() => onPick({ type: 'document', item: x })} />)}
              {!d.length && <p className="px-2 text-sm text-muted-foreground">None</p>}</section>}
            {(kinds.includes('notebook') || kinds.includes('whiteboard')) && <section><h4 className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Notebooks & whiteboards</h4>
              {n.map((x) => <Row key={x.id} icon={<span className="grid h-[34px] w-7 place-items-center rounded-md" style={{ background: x.cover_color }}>{x.kind === 'whiteboard' ? <PenLine className="size-3.5" /> : <NotebookPen className="size-3.5" />}</span>} name={x.title} sub={`${x.kind === 'whiteboard' ? 'Whiteboard' : 'Notebook'} · ${timeAgo(x.updated_at)}`} on={() => onPick({ type: 'notebook', item: x })} />)}
              {!n.length && <p className="px-2 text-sm text-muted-foreground">None</p>}</section>}
            {kinds.includes('link') && <section><h4 className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Learning resources</h4>
              {l.map((x) => <Row key={x.id} icon={<span className="grid h-[34px] w-7 place-items-center rounded-md bg-sage/60"><Link2 className="size-3.5" /></span>} name={x.title} sub={x.provider} on={() => onPick({ type: 'link', item: x })} />)}
              {!l.length && <p className="px-2 text-sm text-muted-foreground">None</p>}</section>}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
