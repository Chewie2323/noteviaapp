import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, X, NotebookPen, FileText, PenLine, Zap, ScanLine, Star } from 'lucide-react';
import { useApp } from '@/lib/app';
import { useTable } from '@/lib/hooks';
import type { DocumentRow, Notebook } from '@/lib/types';
import { createNotebook, createPage, createWhiteboard, uploadDocuments } from '@/lib/actions';
import { fileKind, cn, initials, ACCEPTED } from '@/lib/utils';
import { NewNotebookDialog } from '@/components/NewNotebookDialog';
import { DocThumb, NotebookThumb, docHref } from '@/components/Cards';

type Chip = 'all' | 'notebooks' | 'pdfs' | 'starred';
const CHIPS: { id: Chip; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'notebooks', label: 'Notebooks' }, { id: 'pdfs', label: 'PDFs' }, { id: 'starred', label: 'Starred' },
];

/** Tutor design: "Notes" library — title + avatar, search, filter chips, 2-column grid, dark FAB + Create sheet. */
export default function Notes() {
  const app = useApp();
  const nav = useNavigate();
  const { rows: notebooks } = useTable<Notebook>('notebooks');
  const { rows: docs } = useTable<DocumentRow>('documents');
  const [chip, setChip] = useState<Chip>('all');
  const [q, setQ] = useState('');
  const [sheet, setSheet] = useState(false);
  const [paper, setPaper] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const items = useMemo(() => {
    const nb = notebooks.filter((n) => !n.deleted_at && n.kind === 'notebook').map((n) => ({ t: 'nb' as const, id: n.id, name: n.title, at: n.updated_at, n }));
    const pdf = docs.filter((d) => !d.deleted_at && fileKind(d.mime_type, d.name) === 'pdf').map((d) => ({ t: 'pdf' as const, id: d.id, name: d.name, at: d.updated_at, d }));
    let all: (typeof nb[number] | typeof pdf[number])[] = [...nb, ...pdf];
    if (chip === 'notebooks') all = nb;
    if (chip === 'pdfs') all = pdf;
    if (chip === 'starred') all = all.filter((i) => app.isFav(i.t === 'nb' ? 'notebook' : 'document', i.id));
    if (q.trim()) all = all.filter((i) => i.name.toLowerCase().includes(q.trim().toLowerCase()));
    return all.sort((a, b) => b.at.localeCompare(a.at));
  }, [notebooks, docs, chip, q, app.favourites]);

  const onFiles = async (list: File[]) => {
    if (!list.length) return;
    try {
      const out = await uploadDocuments(app.user, list, null, null);
      out.forEach((d) => app.log('uploaded', 'document', d.id, d.name));
      app.toast(`${list.length} file${list.length > 1 ? 's' : ''} imported`);
    } catch (e: any) { app.toast(e.message || 'Import failed', 'err'); }
  };

  return (
    <div className="animate-fade-up pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-[28px] font-bold tracking-tight">Notes</h1>
        <Link to="/app/me" aria-label="Me" className="grid h-10 w-10 place-items-center rounded-full bg-lilac text-sm font-semibold text-[#4E3F80]">{initials(app.user.full_name)}</Link>
      </div>
      <label className="mt-4 flex h-12 items-center gap-2 rounded-2xl border border-border bg-card px-4 text-muted-foreground">
        <Search className="size-4" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notes, PDFs and handwriting" className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground" />
      </label>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {CHIPS.map((c) => (
          <button key={c.id} onClick={() => setChip(c.id)} className={cn('h-9 shrink-0 rounded-full px-4 text-sm font-medium transition', chip === c.id ? 'bg-charcoal text-white' : 'bg-card text-foreground/70 ring-1 ring-border')}>{c.label}</button>
        ))}
      </div>

      {items.length ? (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {items.map((i) => i.t === 'nb' ? (
            <Link key={i.id} to={`/app/notebooks/${i.id}`} className="group rounded-3xl bg-card p-2.5 shadow-soft ring-1 ring-border transition active:scale-[.98]">
              <div className="relative aspect-[4/5] overflow-hidden rounded-2xl" style={{ background: i.n.cover_color }}>
                <div className="absolute inset-y-0 left-0 w-2.5 bg-black/10" />
                <div className="absolute inset-0 grid place-items-center p-4 pl-6"><NotebookThumb n={i.n} /></div>
                {app.isFav('notebook', i.id) && <Star className="absolute right-2 top-2 size-4 fill-amber-400 text-amber-400" />}
              </div>
              <div className="mt-2 truncate px-1 text-sm font-semibold">{i.name}</div>
            </Link>
          ) : (
            <Link key={i.id} to={docHref(i.d)} className="group rounded-3xl bg-card p-2.5 shadow-soft ring-1 ring-border transition active:scale-[.98]">
              <div className="relative">
                <DocThumb d={i.d} className="aspect-[4/5]" />
                <span className="absolute left-2 top-2 rounded-md bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600">PDF</span>
                {app.isFav('document', i.id) && <Star className="absolute right-2 top-2 size-4 fill-amber-400 text-amber-400" />}
              </div>
              <div className="mt-2 truncate px-1 text-sm font-semibold">{i.name}</div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-16 text-center text-sm text-muted-foreground">{q || chip !== 'all' ? 'Nothing matches yet.' : 'No notes yet — tap + to start your first notebook.'}</div>
      )}

      <button onClick={() => setSheet(true)} aria-label="Create" className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-5 z-30 grid h-14 w-14 place-items-center rounded-full bg-charcoal text-white shadow-lift transition active:scale-95 lg:bottom-8 lg:right-8"><Plus className="size-6" /></button>
      <input ref={file} type="file" hidden multiple accept={ACCEPTED} onChange={(e) => { onFiles(Array.from(e.target.files || [])); e.target.value = ''; }} />

      {sheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setSheet(false)}>
          <div className="w-full max-w-lg rounded-t-[28px] bg-background p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] animate-fade-up" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-border" />
            <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold">Create</h2><button onClick={() => setSheet(false)} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full bg-card ring-1 ring-border"><X className="size-4" /></button></div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => { setSheet(false); setPaper(true); }} className="rounded-3xl bg-[#E6DFF5] p-4 text-left"><NotebookPen className="mb-6 size-6 text-[#4E3F80]" /><div className="font-semibold">Notebook</div><div className="text-xs text-foreground/60">Write or draw on paper</div></button>
              <button onClick={() => { setSheet(false); file.current?.click(); }} className="rounded-3xl bg-[#F6DDE4] p-4 text-left"><FileText className="mb-6 size-6 text-[#A04062]" /><div className="font-semibold">Import PDF</div><div className="text-xs text-foreground/60">Mark up a document</div></button>
            </div>
            <div className="mt-3 overflow-hidden rounded-2xl bg-card ring-1 ring-border">
              <Row icon={<Zap />} label="Quick note" onClick={async () => { setSheet(false); const p = await createPage(app.user, 'Quick note', '<p></p>'); nav(`/app/pages/${p.id}`); }} />
              <Row icon={<PenLine />} label="Whiteboard" onClick={async () => { setSheet(false); const w = await createWhiteboard(app.user); nav(`/app/whiteboards/${w.id}`); }} />
              <Row icon={<ScanLine />} label="Scan a document" onClick={() => { setSheet(false); file.current?.click(); }} />
            </div>
          </div>
        </div>
      )}
      <NewNotebookDialog open={paper} onOpenChange={setPaper} onCreate={async (v) => { const n = await createNotebook(app.user, v); app.log('created', 'notebook', n.id, n.title); nav(`/app/notebooks/${n.id}`); }} />
    </div>
  );
}

function Row({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return <button onClick={onClick} className="flex w-full items-center gap-3 border-b border-border px-4 py-3.5 text-left text-sm font-medium last:border-0 [&_svg]:size-5 [&_svg]:text-foreground/60">{icon}{label}</button>;
}
