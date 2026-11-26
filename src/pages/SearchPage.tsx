import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, NotebookPen, FileText, GraduationCap } from 'lucide-react';
import { useApp } from '@/lib/app';
import { useTable } from '@/lib/hooks';
import type { Classroom, DocumentRow, Notebook } from '@/lib/types';
import { docHref } from '@/components/Cards';

const TRY = ['cell', 'memory', 'quiz', 'nucleus'];

/** Tutor design: full-page search with "Try" suggestion chips. */
export default function SearchPage() {
  const app = useApp();
  const [q, setQ] = useState('');
  const { rows: nbs } = useTable<Notebook>('notebooks');
  const { rows: docs } = useTable<DocumentRow>('documents');
  const { rows: classes } = useTable<Classroom>('classrooms');
  const needle = q.trim().toLowerCase();
  const res = useMemo(() => {
    if (!needle) return [];
    const has = (s?: string | null) => (s || '').toLowerCase().includes(needle);
    return [
      ...nbs.filter((n) => !n.deleted_at && (has(n.title) || n.tags?.some(has))).map((n) => ({ k: 'Notebook', name: n.title, to: `/app/${n.kind === 'whiteboard' ? 'whiteboards' : 'notebooks'}/${n.id}`, icon: <NotebookPen /> })),
      ...docs.filter((d) => !d.deleted_at && has(d.name)).map((d) => ({ k: 'Document', name: d.name, to: docHref(d), icon: <FileText /> })),
      ...classes.filter((c) => app.classIds.has(c.id) && (has(c.name) || has(c.subject))).map((c) => ({ k: 'Class', name: c.name, to: `/app/classes/${c.id}`, icon: <GraduationCap /> })),
    ];
  }, [needle, nbs, docs, classes]);
  return (
    <div className="animate-fade-up pb-24">
      <h1 className="text-[28px] font-bold tracking-tight">Search</h1>
      <label className="mt-4 flex h-12 items-center gap-2 rounded-2xl border border-border bg-card px-4 text-muted-foreground">
        <Search className="size-4" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notes, PDFs and classes" className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground" />
      </label>
      {!needle ? (
        <div className="mt-5">
          <div className="text-sm text-muted-foreground">Try</div>
          <div className="mt-2 flex flex-wrap gap-2">{TRY.map((t) => <button key={t} onClick={() => setQ(t)} className="h-9 rounded-full bg-card px-4 text-sm ring-1 ring-border">{t}</button>)}</div>
        </div>
      ) : res.length ? (
        <div className="mt-4 overflow-hidden rounded-2xl bg-card ring-1 ring-border">
          {res.map((r, i) => (
            <Link key={i} to={r.to} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0 [&_svg]:size-5 [&_svg]:text-foreground/60">
              {r.icon}<span className="min-w-0 flex-1 truncate text-sm font-medium">{r.name}</span><span className="text-xs text-muted-foreground">{r.k}</span>
            </Link>
          ))}
        </div>
      ) : <div className="mt-16 text-center text-sm text-muted-foreground">No results for “{q}”.</div>}
    </div>
  );
}
