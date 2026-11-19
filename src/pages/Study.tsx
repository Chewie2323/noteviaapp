import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Layers, Plus, Trash2, Play, ArrowLeft, Sparkles, Check } from 'lucide-react';
import { useApp, ask } from '@/lib/app';
import { useTable, useRow } from '@/lib/hooks';
import { db } from '@/lib/backend';
import type { Flashcard, FlashcardDeck, Notebook } from '@/lib/types';
import { addCard, cardsFromText, createDeck, schedule } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Input, Label, NativeSelect, Textarea } from '@/components/ui/input';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Empty, PageHeader } from '@/components/common';

const htmlToText = (html?: string | null) => (html ? (new DOMParser().parseFromString(html, 'text/html').body.textContent || '').trim() : '');
const isDue = (c: Flashcard) => new Date(c.due_at).getTime() <= Date.now();

/** Study hub: your decks, what's due today, and a way to turn notes into flashcards. */
export default function Study() {
  const app = useApp();
  const nav = useNavigate();
  const { rows: decks } = useTable<FlashcardDeck>('flashcard_decks', { owner_id: app.user.id });
  const { rows: cards } = useTable<Flashcard>('flashcards', { owner_id: app.user.id });
  const [open, setOpen] = useState(false);
  const due = cards.filter(isDue);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader icon={<Layers />} title="Study" subtitle="Flashcards that come back just before you’d forget them."
        actions={<Button onClick={() => setOpen(true)}><Plus /> New deck</Button>} />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5 shadow-soft">
        <div><div className="text-3xl font-bold">{due.length}</div><div className="text-sm text-muted-foreground">card{due.length === 1 ? '' : 's'} due now</div></div>
        <Button size="lg" disabled={!due.length} onClick={() => nav('/app/study/all')}><Play /> Review all due</Button>
      </div>
      {decks.length ? (
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {decks.map((d) => {
            const mine = cards.filter((c) => c.deck_id === d.id);
            return (
              <Link key={d.id} to={`/app/study/${d.id}`} className="rounded-2xl p-4 text-charcoal transition hover:-translate-y-0.5 hover:shadow-soft" style={{ background: d.color }}>
                <div className="line-clamp-2 text-[15px] font-semibold">{d.title}</div>
                <div className="mt-6 flex items-end justify-between text-sm"><span>{mine.length} card{mine.length === 1 ? '' : 's'}</span><span className="rounded-full bg-white/70 px-2.5 py-0.5 text-xs font-medium">{mine.filter(isDue).length} due</span></div>
              </Link>
            );
          })}
        </div>
      ) : <Empty icon={<Layers />} title="No decks yet" body="Paste your notes and Notevia will draft flashcards for you to edit." action={<Button onClick={() => setOpen(true)}><Plus /> Create your first deck</Button>} />}
      {open && <NewDeckDialog onClose={() => setOpen(false)} onCreated={(id) => nav(`/app/study/${id}`)} />}
    </div>
  );
}

function NewDeckDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const app = useApp();
  const { rows: nbs } = useTable<Notebook>('notebooks', { owner_id: app.user.id });
  const withNotes = useMemo(() => nbs.filter((n) => !n.deleted_at && htmlToText(n.notes_html)), [nbs]);
  const [title, setTitle] = useState('');
  const [source, setSource] = useState('none');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const material = source === 'none' ? '' : source === 'paste' ? text : htmlToText(nbs.find((n) => n.id === source)?.notes_html);
  const create = async () => {
    setBusy(true);
    try {
      const cards = material.trim() ? cardsFromText(material, 12) : [];
      const nbId = source !== 'none' && source !== 'paste' ? source : null;
      const d = await createDeck(app.user, title, cards, { notebook_id: nbId });
      app.toast(cards.length ? `Deck created with ${cards.length} draft cards — check and edit them` : 'Deck created');
      onCreated(d.id);
    } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="md">
        <DialogHeader><DialogTitle>New deck</DialogTitle><DialogDescription>Start empty, or draft cards from your notes.</DialogDescription></DialogHeader>
        <DialogBody className="space-y-3">
          <div><Label htmlFor="dt">Deck name</Label><Input id="dt" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Photosynthesis" /></div>
          <div><Label>Draft cards from</Label>
            <NativeSelect value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="none">Nothing — I’ll add cards myself</option>
              <option value="paste">Pasted text</option>
              {withNotes.length > 0 && <optgroup label="My notebooks (typed notes)">{withNotes.map((n) => <option key={n.id} value={n.id}>{n.title}</option>)}</optgroup>}
            </NativeSelect>
          </div>
          {source === 'paste' && <Textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste notes or a chapter…" />}
          {source !== 'none' && <p className="flex items-start gap-1.5 text-xs text-muted-foreground"><Sparkles className="mt-0.5 size-3.5 shrink-0" /> Draft cards are made on your device with simple text analysis. They’re a starting point, so edit or delete any that don’t make sense.</p>}
        </DialogBody>
        <DialogFooter><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={busy || !title.trim()} onClick={create}>Create deck</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** /app/study/:id — a deck (edit cards, start review) or 'all' (review everything due). */
export function StudyDeck() {
  const { id = '' } = useParams();
  const app = useApp();
  const nav = useNavigate();
  const all = id === 'all';
  const { row: deck } = useRow<FlashcardDeck>('flashcard_decks', all ? null : id);
  const { rows: cards } = useTable<Flashcard>('flashcards', all ? { owner_id: app.user.id } : { deck_id: id });
  const [reviewing, setReviewing] = useState(all);
  const [front, setFront] = useState(''); const [back, setBack] = useState('');
  const due = cards.filter(isDue);

  if (reviewing) return <Review queue={due} title={all ? 'All due cards' : deck?.title || 'Review'} onExit={() => (all ? nav('/app/study') : setReviewing(false))} />;
  if (!all && !deck) return <Empty icon={<Layers />} title="Deck not found" action={<Button onClick={() => nav('/app/study')}>Back to Study</Button>} />;

  return (
    <div className="mx-auto max-w-3xl">
      <button onClick={() => nav('/app/study')} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Study</button>
      <PageHeader icon={<Layers />} title={deck!.title} subtitle={`${cards.length} card${cards.length === 1 ? '' : 's'} · ${due.length} due now`}
        actions={<><Button variant="outline" onClick={async () => { if (await ask.confirm('Delete this deck?', 'The deck and all its cards will be deleted.')) { await db.remove('flashcard_decks', deck!.id); nav('/app/study'); } }}><Trash2 /> Delete</Button>
          <Button disabled={!due.length} onClick={() => setReviewing(true)}><Play /> Review {due.length || ''}</Button></>} />
      <form className="mb-5 grid gap-2 rounded-2xl border border-border bg-card p-4 sm:grid-cols-[1fr_1fr_auto]" onSubmit={async (e) => { e.preventDefault(); if (!front.trim() || !back.trim()) return; await addCard(app.user, deck!.id, front, back); setFront(''); setBack(''); }}>
        <Input aria-label="Front" placeholder="Front (question or term)" value={front} onChange={(e) => setFront(e.target.value)} />
        <Input aria-label="Back" placeholder="Back (answer)" value={back} onChange={(e) => setBack(e.target.value)} />
        <Button type="submit" disabled={!front.trim() || !back.trim()}><Plus /> Add</Button>
      </form>
      {cards.length ? (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {cards.map((c) => (
            <li key={c.id} className="flex items-start gap-3 px-4 py-3">
              <div className="grid min-w-0 flex-1 gap-1 sm:grid-cols-2 sm:gap-4">
                <EditableText value={c.front} onSave={(v) => db.update('flashcards', c.id, { front: v })} />
                <EditableText value={c.back} muted onSave={(v) => db.update('flashcards', c.id, { back: v })} />
              </div>
              <button aria-label="Delete card" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => db.remove('flashcards', c.id)}><Trash2 className="size-4" /></button>
            </li>
          ))}
        </ul>
      ) : <Empty icon={<Layers />} title="No cards yet" body="Add your first card above." />}
    </div>
  );
}

function EditableText({ value, onSave, muted }: { value: string; onSave: (v: string) => void; muted?: boolean }) {
  const [v, setV] = useState(value);
  return <textarea rows={Math.min(5, Math.max(1, Math.ceil(v.length / 40)))} value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v.trim() && v !== value && onSave(v.trim())}
    className={`w-full resize-none rounded-lg bg-transparent px-2 py-1 text-sm focus:bg-muted/60 focus:outline-none ${muted ? 'text-muted-foreground' : 'font-medium'}`} />;
}

function Review({ queue, title, onExit }: { queue: Flashcard[]; title: string; onExit: () => void }) {
  const [order] = useState(() => [...queue].sort(() => Math.random() - 0.5));
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(false);
  const [done, setDone] = useState(0);
  const card = order[i];
  const hint = (g: 0 | 1 | 2 | 3) => { const s = schedule(card, g); return g === 0 ? '10 min' : `${s.interval_days} day${s.interval_days === 1 ? '' : 's'}`; };
  const grade = async (g: 0 | 1 | 2 | 3) => { await db.update('flashcards', card.id, schedule(card, g), true); setDone(done + 1); setShown(false); setI(i + 1); };

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-4 flex items-center justify-between"><button onClick={onExit} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> {title}</button><span className="text-xs text-muted-foreground">{Math.min(i + 1, order.length)} / {order.length}</span></div>
      {!card ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-soft">
          <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-sage text-charcoal"><Check /></div>
          <h2 className="text-xl font-semibold">{done ? 'All done for now' : 'Nothing due'}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{done ? `You reviewed ${done} card${done === 1 ? '' : 's'}.` : 'Come back later.'}</p>
          <Button className="mt-6" onClick={onExit}>Back</Button>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft sm:p-8">
          <div className="min-h-[160px] whitespace-pre-wrap text-lg font-medium">{card.front}</div>
          {shown ? (
            <>
              <div className="mt-4 border-t border-border pt-4 text-base text-muted-foreground whitespace-pre-wrap">{card.back}</div>
              <div className="mt-6 grid grid-cols-4 gap-2">
                {([[0, 'Again'], [1, 'Hard'], [2, 'Good'], [3, 'Easy']] as const).map(([g, l]) => (
                  <button key={g} onClick={() => grade(g)} className="rounded-xl border border-border px-2 py-2.5 text-center text-sm transition hover:bg-secondary"><div className="font-medium">{l}</div><div className="text-[11px] text-muted-foreground">{hint(g)}</div></button>
                ))}
              </div>
            </>
          ) : <Button className="mt-6 w-full" size="lg" onClick={() => setShown(true)}>Show answer</Button>}
        </div>
      )}
    </div>
  );
}
