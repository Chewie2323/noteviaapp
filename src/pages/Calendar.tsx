import { Fragment, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Trash2, Link2, NotebookPen, FileText, GraduationCap, CheckSquare, X, Pencil } from 'lucide-react';
import { useApp } from '@/lib/app';
import { useTable } from '@/lib/hooks';
import { db } from '@/lib/backend';
import type { Assignment, CalendarEvent, Classroom, DocumentRow, EventKind, Notebook, Task } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input, Label, NativeSelect, Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox, Tabs, TabsList, TabsTrigger } from '@/components/ui/misc';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ColorDots, PageHeader } from '@/components/common';
import { ResourcePicker } from '@/components/ResourcePicker';
import { cn, fmtDate, fmtTime, toLocalInput } from '@/lib/utils';

const KIND_COLORS: Record<EventKind, string> = { class: '#E4DDFB', meeting: '#D6E7F8', study: '#D5ECE3', reminder: '#FDE3D6', personal: '#F9D9E6', deadline: '#F6D5DC' };
const KIND_LABEL: Record<EventKind, string> = { class: 'Class', meeting: 'Meeting', study: 'Study session', reminder: 'Reminder', personal: 'Personal', deadline: 'Deadline' };
type Item = { id: string; title: string; start: Date; end: Date; allDay: boolean; color: string; kind: EventKind; ev?: CalendarEvent; href?: string };
const sod = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const sameDay = (a: Date, b: Date) => sod(a).getTime() === sod(b).getTime();
const mondayOf = (d: Date) => addDays(sod(d), -((d.getDay() + 6) % 7));

export default function Calendar() {
  const app = useApp();
  const nav = useNavigate();
  const { rows: events } = useTable<CalendarEvent>('calendar_events', undefined, { col: 'starts_at', asc: true });
  const { rows: asg } = useTable<Assignment>('assignments');
  const { rows: tasks } = useTable<Task>('tasks', { owner_id: app.user.id }, { col: 'created_at', asc: true });
  const [mode, setMode] = useState<'day' | 'week' | 'month'>(window.innerWidth < 700 ? 'day' : 'week');
  const [cursor, setCursor] = useState(sod(new Date()));
  const [edit, setEdit] = useState<Partial<CalendarEvent> | null>(null);
  const [task, setTask] = useState('');

  const items: Item[] = useMemo(() => [
    ...events.filter((e) => e.owner_id === app.user.id || (e.classroom_id && app.classIds.has(e.classroom_id))).map((e) => ({ id: e.id, title: e.title, start: new Date(e.starts_at), end: new Date(e.ends_at), allDay: e.all_day, color: e.color, kind: e.kind, ev: e })),
    ...asg.filter((a) => app.classIds.has(a.classroom_id) && (!a.assignee_ids.length || a.assignee_ids.includes(app.user.id) || app.access.ownedClassrooms.some((c) => c.id === a.classroom_id)))
      .map((a) => ({ id: 'a' + a.id, title: `Due: ${a.title}`, start: new Date(a.due_at), end: new Date(a.due_at), allDay: false, color: KIND_COLORS.deadline, kind: 'deadline' as EventKind, href: `/app/assignments/${a.id}` })),
    ...tasks.filter((t) => t.due_at && !t.done).map((t) => ({ id: 't' + t.id, title: `☐ ${t.title}`, start: new Date(t.due_at!), end: new Date(t.due_at!), allDay: true, color: '#FDE3D6', kind: 'reminder' as EventKind })),
  ], [events, asg, tasks, app]);

  const range = mode === 'day' ? [cursor] : mode === 'week' ? Array.from({ length: 7 }, (_, i) => addDays(mondayOf(cursor), i)) : (() => { const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1); const start = mondayOf(first); return Array.from({ length: 42 }, (_, i) => addDays(start, i)); })();
  const step = (dir: number) => setCursor(mode === 'day' ? addDays(cursor, dir) : mode === 'week' ? addDays(cursor, 7 * dir) : new Date(cursor.getFullYear(), cursor.getMonth() + dir, 1));
  const title = mode === 'month' ? cursor.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : mode === 'week' ? `${fmtDate(range[0].toISOString())} – ${fmtDate(range[6].toISOString())}` : cursor.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const onDay = (d: Date) => items.filter((i) => sameDay(i.start, d) || (i.start < d && i.end > d)).sort((a, b) => +a.start - +b.start);
  const open = (i: Item) => { if (i.href) nav(i.href); else if (i.ev) setEdit(i.ev); };
  const newAt = (d: Date, hour = 9) => { const s = new Date(d); s.setHours(hour, 0, 0, 0); setEdit({ starts_at: s.toISOString(), ends_at: new Date(+s + 3600000).toISOString(), kind: 'study', color: KIND_COLORS.study }); };
  const HOURS = Array.from({ length: 16 }, (_, i) => i + 7);

  const Chip = ({ i, compact }: { i: Item; compact?: boolean }) => (
    <button onClick={(e) => { e.stopPropagation(); open(i); }} className={cn('w-full truncate rounded-md px-1.5 py-0.5 text-left text-[11px] text-charcoal', compact ? '' : 'py-1')} style={{ background: i.color }} title={i.title}>
      {!i.allDay && <span className="mr-1 opacity-70">{fmtTime(i.start.toISOString())}</span>}{i.title}
    </button>
  );

  return (
    <div className="animate-fade-up">
      <PageHeader icon={<CalendarDays />} title="Calendar" subtitle="Classes, deadlines, meetings, study sessions and reminders in one view."
        actions={<Button onClick={() => newAt(cursor, new Date().getHours() + 1)}><Plus /> New event</Button>} />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_300px]">
        <div className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-soft">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Button size="icon" variant="ghost" aria-label="Previous" onClick={() => step(-1)}><ChevronLeft /></Button>
            <Button size="sm" variant="outline" onClick={() => setCursor(sod(new Date()))}>Today</Button>
            <Button size="icon" variant="ghost" aria-label="Next" onClick={() => step(1)}><ChevronRight /></Button>
            <h2 className="ml-1 font-semibold">{title}</h2>
            <div className="flex-1" />
            <Tabs value={mode} onValueChange={(v) => setMode(v as any)}><TabsList><TabsTrigger value="day">Day</TabsTrigger><TabsTrigger value="week">Week</TabsTrigger><TabsTrigger value="month">Month</TabsTrigger></TabsList></Tabs>
          </div>
          {mode === 'month' ? (
            <div className="grid grid-cols-7 overflow-hidden rounded-xl border border-border">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="border-b border-border bg-muted/50 py-2 text-center text-[11px] font-semibold uppercase text-muted-foreground">{d}</div>)}
              {range.map((d) => { const its = onDay(d); return (
                <div key={+d} role="button" tabIndex={0} onClick={() => newAt(d)} onKeyDown={(e) => e.key === 'Enter' && newAt(d)} className={cn('min-h-[96px] cursor-pointer border-b border-r border-border p-1.5 hover:bg-muted/30', d.getMonth() !== cursor.getMonth() && 'bg-muted/20 text-muted-foreground')}>
                  <div className={cn('mb-1 grid h-6 w-6 place-items-center rounded-full text-xs', sameDay(d, new Date()) && 'bg-primary font-semibold text-primary-foreground')}>{d.getDate()}</div>
                  <div className="space-y-0.5">{its.slice(0, 3).map((i) => <Chip key={i.id} i={i} compact />)}{its.length > 3 && <div className="px-1 text-[10px] text-muted-foreground">+{its.length - 3} more</div>}</div>
                </div>); })}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[640px]" style={{ display: 'grid', gridTemplateColumns: `56px repeat(${range.length}, minmax(0,1fr))` }}>
                <div />
                {range.map((d) => <div key={+d} className="border-b border-border pb-2 text-center"><div className="text-[11px] uppercase text-muted-foreground">{d.toLocaleDateString('en-GB', { weekday: 'short' })}</div><div className={cn('mx-auto mt-0.5 grid h-8 w-8 place-items-center rounded-full text-sm font-semibold', sameDay(d, new Date()) && 'bg-primary text-primary-foreground')}>{d.getDate()}</div>
                  <div className="mt-1 space-y-0.5 px-1">{onDay(d).filter((i) => i.allDay).map((i) => <Chip key={i.id} i={i} compact />)}</div></div>)}
                {HOURS.map((h) => <Fragment key={h}>
                  <div key={'h' + h} className="h-14 pr-2 pt-0.5 text-right text-[11px] text-muted-foreground">{String(h).padStart(2, '0')}:00</div>
                  {range.map((d) => (
                    <div key={+d + '-' + h} role="button" tabIndex={-1} onClick={() => newAt(d, h)} className="relative h-14 cursor-pointer border-b border-l border-border/70 hover:bg-muted/30">
                      {onDay(d).filter((i) => !i.allDay && i.start.getHours() === h).map((i) => {
                        const dur = Math.max(0.5, (+i.end - +i.start) / 3600000), top = (i.start.getMinutes() / 60) * 56;
                        return <button key={i.id} onClick={(e) => { e.stopPropagation(); open(i); }} className="absolute inset-x-0.5 z-10 overflow-hidden rounded-md px-1.5 py-1 text-left text-[11px] text-charcoal shadow-sm" style={{ top, height: Math.min(dur * 56, 56 * (23 - h)) - 2, background: i.color }} title={i.title}>
                          <div className="truncate font-medium">{i.title}</div><div className="opacity-70">{fmtTime(i.start.toISOString())}{+i.end !== +i.start && `–${fmtTime(i.end.toISOString())}`}</div></button>;
                      })}
                    </div>
                  ))}
                </Fragment>)}
              </div>
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">{(Object.keys(KIND_COLORS) as EventKind[]).map((k) => <span key={k} className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className="h-3 w-3 rounded" style={{ background: KIND_COLORS[k] }} />{KIND_LABEL[k]}</span>)}</div>
        </div>

        <div className="space-y-5">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
            <div className="mb-3 flex items-center gap-2 font-semibold"><CheckSquare className="size-4 text-lavender-deep" /> To-do list</div>
            <form className="mb-3 flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (task.trim()) { await db.insert('tasks', { owner_id: app.user.id, title: task.trim().slice(0, 200), done: false, due_at: null }); setTask(''); } }}>
              <Input value={task} onChange={(e) => setTask(e.target.value)} placeholder="Add a task…" aria-label="New task" /><Button type="submit" size="icon" aria-label="Add task"><Plus /></Button>
            </form>
            <div className="space-y-1">
              {tasks.map((t) => (
                <div key={t.id} className="group flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-muted">
                  <Checkbox checked={t.done} onCheckedChange={(v) => db.update('tasks', t.id, { done: !!v })} aria-label={`Done: ${t.title}`} />
                  <span className={cn('flex-1 text-sm', t.done && 'text-muted-foreground line-through')}>{t.title}</span>
                  <input type="date" aria-label="Due date" className="w-[110px] rounded border-0 bg-transparent text-[11px] text-muted-foreground" value={t.due_at ? t.due_at.slice(0, 10) : ''} onChange={(e) => db.update('tasks', t.id, { due_at: e.target.value ? new Date(e.target.value + 'T09:00').toISOString() : null })} />
                  <button aria-label="Delete task" className="opacity-0 group-hover:opacity-70" onClick={() => db.remove('tasks', t.id)}><X className="size-3.5" /></button>
                </div>
              ))}
              {!tasks.length && <p className="text-sm text-muted-foreground">Nothing on your list.</p>}
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
            <div className="mb-2 font-semibold">Next up</div>
            {items.filter((i) => i.end >= new Date()).sort((a, b) => +a.start - +b.start).slice(0, 6).map((i) => (
              <button key={i.id} onClick={() => open(i)} className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-muted"><span className="h-8 w-1.5 rounded-full" style={{ background: i.color }} /><span className="min-w-0 flex-1"><span className="block truncate text-sm">{i.title}</span><span className="text-[11px] text-muted-foreground">{fmtDate(i.start.toISOString())}{!i.allDay && ` · ${fmtTime(i.start.toISOString())}`}</span></span></button>
            ))}
          </div>
        </div>
      </div>
      {edit && <EventDialog initial={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

export function EventDialog({ initial, onClose }: { initial: Partial<CalendarEvent>; onClose: () => void }) {
  const app = useApp();
  const { rows: classes } = useTable<Classroom>('classrooms', { owner_id: app.user.id });
  const { rows: docs } = useTable<DocumentRow>('documents');
  const { rows: nbs } = useTable<Notebook>('notebooks');
  const readOnly = !!initial.id && initial.owner_id !== app.user.id;
  const start = initial.starts_at || new Date(Date.now() + 3600000).toISOString();
  const [v, setV] = useState({ title: initial.title || '', kind: (initial.kind || 'study') as EventKind, start: toLocalInput(start), end: toLocalInput(initial.ends_at || new Date(+new Date(start) + 3600000).toISOString()), all_day: !!initial.all_day, color: initial.color || KIND_COLORS[initial.kind || 'study'], classroom_id: initial.classroom_id || '', notes: initial.notes || '', links: initial.links || [] });
  const [pick, setPick] = useState(false);
  const [err, setErr] = useState('');
  const save = async () => {
    const s = new Date(v.start), e = new Date(v.end);
    if (e < s) return setErr('The end must be after the start.');
    const row = { title: v.title.trim().slice(0, 200), kind: v.kind, starts_at: s.toISOString(), ends_at: e.toISOString(), all_day: v.all_day, color: v.color, classroom_id: v.classroom_id || null, notes: v.notes || null, links: v.links };
    if (initial.id) await db.update('calendar_events', initial.id, row); else await db.insert('calendar_events', { ...row, owner_id: app.user.id });
    if (!initial.id && row.classroom_id) { const ms = await db.list<any>('classroom_members', { classroom_id: row.classroom_id }); await app.notify(ms.map((m) => m.user_id), { kind: 'event', title: `New session: ${row.title}`, body: `${fmtDate(row.starts_at)} ${fmtTime(row.starts_at)}`, link: '/app/calendar' }); }
    onClose();
  };
  const linkLabel = (l: { type: string; id: string }) => l.type === 'document' ? docs.find((d) => d.id === l.id)?.name : l.type === 'notebook' ? nbs.find((n) => n.id === l.id)?.title : classes.find((c) => c.id === l.id)?.name;
  const linkHref = (l: { type: string; id: string }) => l.type === 'document' ? `/app/documents?open=${l.id}` : l.type === 'notebook' ? `/app/notebooks/${l.id}` : `/app/classes/${l.id}`;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="lg">
        <DialogHeader><DialogTitle>{readOnly ? v.title : initial.id ? 'Edit event' : 'New event'}</DialogTitle></DialogHeader>
        <DialogBody className="space-y-4">
          <fieldset disabled={readOnly} className="space-y-4">
            <div><Label>Title</Label><Input autoFocus maxLength={200} value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label>Type</Label><NativeSelect value={v.kind} onChange={(e) => { const k = e.target.value as EventKind; setV({ ...v, kind: k, color: KIND_COLORS[k] }); }}>{(Object.keys(KIND_LABEL) as EventKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</NativeSelect></div>
              {classes.length > 0 && <div><Label hint="shows to the class">Classroom</Label><NativeSelect value={v.classroom_id} onChange={(e) => setV({ ...v, classroom_id: e.target.value })}><option value="">Just me</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect></div>}
              <div><Label>Starts</Label><Input type="datetime-local" value={v.start} onChange={(e) => setV({ ...v, start: e.target.value })} /></div>
              <div><Label>Ends</Label><Input type="datetime-local" value={v.end} onChange={(e) => setV({ ...v, end: e.target.value })} /></div>
            </div>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={v.all_day} onCheckedChange={(c) => setV({ ...v, all_day: !!c })} /> All day</label>
            <div><Label>Colour</Label><ColorDots colors={Object.values(KIND_COLORS)} value={v.color} onChange={(c) => setV({ ...v, color: c })} size={24} /></div>
            <div><Label>Notes</Label><Textarea rows={2} value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} /></div>
          </fieldset>
          <div><Label>Linked items</Label>
            <div className="flex flex-wrap gap-2">
              {v.links.map((l) => <Badge key={l.id} tone="lavender" className="py-1">{l.type === 'notebook' ? <NotebookPen className="size-3" /> : l.type === 'document' ? <FileText className="size-3" /> : <GraduationCap className="size-3" />}<Link to={linkHref(l)} onClick={onClose} className="hover:underline">{linkLabel(l) || 'Item'}</Link>{!readOnly && <button aria-label="Unlink" onClick={() => setV({ ...v, links: v.links.filter((x) => x.id !== l.id) })}><X className="size-3" /></button>}</Badge>)}
              {!readOnly && <Button size="sm" variant="outline" onClick={() => setPick(true)}><Link2 /> Link notebook or document</Button>}
              {!readOnly && classes.length > 0 && <NativeSelect className="h-8 w-auto text-xs" value="" onChange={(e) => e.target.value && setV({ ...v, links: [...v.links, { type: 'classroom', id: e.target.value }] })}><option value="">+ Link classroom</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect>}
            </div>
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
        </DialogBody>
        <DialogFooter>
          {initial.id && !readOnly && <Button variant="ghost" className="mr-auto text-red-600" onClick={async () => { await db.remove('calendar_events', initial.id!); onClose(); }}><Trash2 /> Delete</Button>}
          <Button variant="ghost" onClick={onClose}>{readOnly ? 'Close' : 'Cancel'}</Button>{!readOnly && <Button disabled={!v.title.trim()} onClick={save}><Pencil /> Save</Button>}
        </DialogFooter>
      </DialogContent>
      <ResourcePicker open={pick} onOpenChange={setPick} kinds={['document', 'notebook']} title="Link to this event" onPick={(p) => { if (p.type !== 'link' && !v.links.some((x) => x.id === p.item.id)) setV({ ...v, links: [...v.links, { type: p.type, id: p.item.id }] }); setPick(false); }} />
    </Dialog>
  );
}
