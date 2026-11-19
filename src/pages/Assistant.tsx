import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useApp } from '@/lib/app';
import { useTable } from '@/lib/hooks';
import type { DocumentRow, Notebook } from '@/lib/types';
import { Textarea, NativeSelect, Label } from '@/components/ui/input';
import { PageHeader } from '@/components/common';
import { AIPanel } from '@/components/AIPanel';

const htmlToText = (html?: string | null) => {
  if (!html) return '';
  const d = new DOMParser().parseFromString(html, 'text/html');
  return (d.body.textContent || '').replace(/\s+\n/g, '\n').trim();
};

/** Stand-alone AI Assistant: pick material (paste, a notebook's typed notes, or a document) and run the helper on it. */
export default function Assistant() {
  const app = useApp();
  const nav = useNavigate();
  const { rows: notebooks } = useTable<Notebook>('notebooks', { owner_id: app.user.id });
  const { rows: docs } = useTable<DocumentRow>('documents', { owner_id: app.user.id });
  const [source, setSource] = useState('paste');
  const [pasted, setPasted] = useState('');

  const nbs = useMemo(() => notebooks.filter((n) => !n.deleted_at && htmlToText(n.notes_html)), [notebooks]);
  const dcs = useMemo(() => docs.filter((d) => !d.deleted_at && htmlToText(d.content_html)), [docs]);

  const getText = () => {
    if (source === 'paste') return pasted;
    const [kind, id] = source.split(':');
    if (kind === 'nb') return htmlToText(notebooks.find((n) => n.id === id)?.notes_html);
    return htmlToText(docs.find((d) => d.id === id)?.content_html);
  };
  const label = source === 'paste' ? 'pasted text' : source.startsWith('nb:') ? notebooks.find((n) => n.id === source.slice(3))?.title || 'notebook' : docs.find((d) => d.id === source.slice(2))?.name || 'document';

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader icon={<Sparkles />} title="AI Assistant" subtitle="Summaries, revision notes, quizzes, flashcards and lesson plans from your own material." />
      <div className="grid gap-5 lg:grid-cols-[1fr_minmax(0,420px)]">
        <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
          <div>
            <Label>Material</Label>
            <NativeSelect value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="paste">Paste text…</option>
              {nbs.length > 0 && <optgroup label="My notebooks (typed notes)">{nbs.map((n) => <option key={n.id} value={`nb:${n.id}`}>{n.title}</option>)}</optgroup>}
              {dcs.length > 0 && <optgroup label="My documents (text pages)">{dcs.map((d) => <option key={d.id} value={`dc:${d.id}`}>{d.name}</option>)}</optgroup>}
            </NativeSelect>
          </div>
          {source === 'paste' ? (
            <Textarea rows={16} placeholder="Paste lecture notes, an article or a chapter here, then choose a task on the right." value={pasted} onChange={(e) => setPasted(e.target.value)} />
          ) : (
            <div className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
              <p className="line-clamp-[12] whitespace-pre-wrap">{getText().slice(0, 1200) || 'No typed text found.'}</p>
            </div>
          )}
          <p className="text-xs text-muted-foreground">Handwriting and scanned PDFs need converting to text first.</p>
        </div>
        <div className="min-h-[520px] overflow-hidden rounded-2xl border border-border bg-card">
          <AIPanel getText={getText} contextLabel={label} onClose={() => nav('/app')} />
        </div>
      </div>
    </div>
  );
}
