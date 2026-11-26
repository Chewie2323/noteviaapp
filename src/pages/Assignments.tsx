import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ClipboardCheck, Plus, Clock, Paperclip, Upload, Send, Save, CheckCircle2, Undo2, PenLine, Download, X, NotebookPen, FileText, Loader2, Trash2, Columns2, ChevronLeft, ChevronRight, Eye,
} from 'lucide-react';
import { useApp, ask } from '@/lib/app';
import { useRow, useTable } from '@/lib/hooks';
import { db, now, uid } from '@/lib/backend';
import type { Assignment, Attachment, CanvasObject, Classroom, ClassroomMember, DocumentRow, Feedback, Notebook, Submission } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input, Label, NativeSelect } from '@/components/ui/input';
import { Badge, BadgeTone } from '@/components/ui/badge';
import { Checkbox, Tabs, TabsList, TabsTrigger } from '@/components/ui/misc';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, Empty, FileBadge, FullSpinner, PageHeader, Spinner } from '@/components/common';
import { RichText, Html } from '@/components/RichText';
import { AudioRecorder, AudioChip } from '@/components/Audio';
import { ResourcePicker } from '@/components/ResourcePicker';
import { Viewer } from '@/components/Viewer';
import { InkCanvas, DEFAULT_TOOLS, ToolState } from '@/canvas/InkCanvas';
import { Toolbar } from '@/canvas/Toolbar';
import { selectionOps, useHistory } from '@/canvas/useInk';
import { openPdf, renderPdfPage, PDFDoc } from '@/lib/pdf';
import { createNotebook } from '@/lib/actions';
import { cn, fileKind, fmtDateTime, safeName, saveBlob, timeAgo, toLocalInput } from '@/lib/utils';

export type DisplayStatus = 'assigned' | 'in_progress' | 'submitted' | 'under_review' | 'returned' | 'completed' | 'overdue';
export const STATUS_LABEL: Record<DisplayStatus, string> = { assigned: 'Not started', in_progress: 'In progress', submitted: 'Submitted', under_review: 'Under review', returned: 'Returned', completed: 'Completed', overdue: 'Overdue' };
export const STATUS_TONE: Record<DisplayStatus, BadgeTone> = { assigned: 'neutral', in_progress: 'blue', submitted: 'lavender', under_review: 'peach', returned: 'pink', completed: 'sage', overdue: 'danger' };
export function submissionStatus(a: Assignment, s?: Submission | null): DisplayStatus {
  const late = new Date(a.due_at).getTime() < Date.now();
  if (!s) return late ? 'overdue' : 'assigned';
  if (s.status === 'in_progress') return late ? 'overdue' : 'in_progress';
  return s.status;
}

export default function Assignments() {
  const app = useApp();
  const { rows: asg } = useTable<Assignment>('assignments', undefined, { col: 'due_at', asc: true });
  const { rows: subs } = useTable<Submission>('submissions');
  const { rows: classes } = useTable<Classroom>('classrooms');
  const { rows: members } = useTable<ClassroomMember>('classroom_members');
  const [tab, setTab] = useState('upcoming');
  const [create, setCreate] = useState(false);
  const teachingIds = new Set(classes.filter((c) => c.owner_id === app.user.id).map((c) => c.id));
  const visible = asg.filter((a) => app.classIds.has(a.classroom_id) && (teachingIds.has(a.classroom_id) || !a.assignee_ids.length || a.assignee_ids.includes(app.user.id)));
  const list = visible.filter((a) => {
    const teaching = teachingIds.has(a.classroom_id);
    if (teaching) {
      const target = a.assignee_ids.length || members.filter((m) => m.classroom_id === a.classroom_id).length;
      const ss = subs.filter((s) => s.assignment_id === a.id);
      if (tab === 'review') return ss.some((s) => s.status === 'submitted' || s.status === 'under_review');
      if (tab === 'done') return target > 0 && ss.filter((s) => s.status === 'completed').length >= target;
      if (tab === 'upcoming') return new Date(a.due_at).getTime() > Date.now() - 86400000 * 7;
      return true;
    }
    const st = submissionStatus(a, subs.find((s) => s.assignment_id === a.id && s.student_id === app.user.id));
    if (tab === 'upcoming') return ['assigned', 'in_progress', 'overdue', 'returned'].includes(st);
    if (tab === 'review') return ['submitted', 'under_review'].includes(st);
    if (tab === 'done') return st === 'completed';
    return true;
  });
  return (
    <div className="animate-fade-up">
      <PageHeader icon={<ClipboardCheck />} title="Assignments" subtitle={teachingIds.size ? 'Set work, review submissions and return feedback.' : 'Track deadlines, submit work and read your feedback.'}
        actions={teachingIds.size > 0 && <Button onClick={() => setCreate(true)}><Plus /> New assignment</Button>} />
      <Tabs value={tab} onValueChange={setTab} className="mb-5"><TabsList><TabsTrigger value="upcoming">{teachingIds.size ? 'Current' : 'To do'}</TabsTrigger><TabsTrigger value="review">{teachingIds.size ? 'To review' : 'Submitted'}</TabsTrigger><TabsTrigger value="done">Completed</TabsTrigger><TabsTrigger value="all">All</TabsTrigger></TabsList></Tabs>
      {list.length ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((a) => {
            const c = classes.find((x) => x.id === a.classroom_id); const teaching = teachingIds.has(a.classroom_id);
            const ss = subs.filter((s) => s.assignment_id === a.id);
            const st = teaching ? null : submissionStatus(a, ss.find((s) => s.student_id === app.user.id));
            return (
              <Link key={a.id} to={`/app/assignments/${a.id}`} className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift">
                <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-charcoal" style={{ background: c?.cover_color || '#E4DDFB' }}><ClipboardCheck className="size-4" /></span>
                  <div className="min-w-0 flex-1"><div className="font-semibold leading-snug">{a.title}</div><div className="mt-0.5 text-xs text-muted-foreground">{c?.name}</div></div></div>
                <div className="mt-3 line-clamp-2 flex-1 text-sm text-muted-foreground">{a.instructions_html.replace(/<[^>]+>/g, ' ').trim() || 'No instructions'}</div>
                <div className="mt-4 flex items-center justify-between text-xs">
                  <span className={cn('inline-flex items-center gap-1', new Date(a.due_at) < new Date() ? 'text-red-600' : 'text-muted-foreground')}><Clock className="size-3.5" /> {fmtDateTime(a.due_at)}</span>
                  {st ? <Badge tone={STATUS_TONE[st]}>{STATUS_LABEL[st]}</Badge> : <span className="text-muted-foreground">{ss.filter((s) => s.status !== 'in_progress').length} submitted · {ss.filter((s) => s.status === 'submitted').length} new</span>}
                </div>
              </Link>
            );
          })}
        </div>
      ) : <Empty icon={<ClipboardCheck />} title="Nothing here" body={tab === 'upcoming' && !teachingIds.size ? 'You’re all caught up.' : undefined} />}
      {create && <AssignmentDialog onClose={() => setCreate(false)} />}
    </div>
  );
}

export function AssignmentDialog({ classroomId, initial, onClose }: { classroomId?: string; initial?: Assignment; onClose: () => void }) {
  const app = useApp();
  const nav = useNavigate();
  const { rows: classes } = useTable<Classroom>('classrooms', { owner_id: app.user.id });
  const { rows: members } = useTable<ClassroomMember>('classroom_members');
  const { rows: docs } = useTable<DocumentRow>('documents', { owner_id: app.user.id });
  const { rows: nbs } = useTable<Notebook>('notebooks', { owner_id: app.user.id });
  const [v, setV] = useState({
    title: initial?.title || '', classroom_id: initial?.classroom_id || classroomId || '', instructions_html: initial?.instructions_html || '',
    due: toLocalInput(initial?.due_at || new Date(Date.now() + 7 * 86400000).toISOString()), attachments: initial?.attachments || [] as Attachment[],
    assignee_ids: initial?.assignee_ids || [] as string[], max_points: initial?.max_points?.toString() || '',
  });
  const [pick, setPick] = useState(false);
  useEffect(() => { if (!v.classroom_id && classes[0]) setV((s) => ({ ...s, classroom_id: classes[0].id })); }, [classes]);
  const roster = members.filter((m) => m.classroom_id === v.classroom_id);
  const label = (a: Attachment) => a.type === 'document' ? docs.find((d) => d.id === a.id)?.name : nbs.find((n) => n.id === a.id)?.title;
  const save = async () => {
    const row = { title: v.title.trim().slice(0, 200), classroom_id: v.classroom_id, instructions_html: v.instructions_html, due_at: new Date(v.due).toISOString(), attachments: v.attachments, assignee_ids: v.assignee_ids, max_points: v.max_points ? Number(v.max_points) : null, created_by: app.user.id };
    let id = initial?.id;
    if (id) await db.update('assignments', id, row);
    else {
      id = (await db.insert<Assignment>('assignments', row)).id;
      const who = v.assignee_ids.length ? v.assignee_ids : roster.map((m) => m.user_id);
      await app.notify(who, { kind: 'assignment', title: `New assignment: ${row.title}`, body: `Due ${fmtDateTime(row.due_at)}`, link: `/app/assignments/${id}` });
      app.log(`set assignment “${row.title}” in`, 'classroom', row.classroom_id, classes.find((c) => c.id === row.classroom_id)?.name || '', row.classroom_id);
    }
    onClose(); if (!initial) nav(`/app/assignments/${id}`);
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="xl">
        <DialogHeader><DialogTitle>{initial ? 'Edit assignment' : 'New assignment'}</DialogTitle></DialogHeader>
        <DialogBody className="space-y-4">
          <div><Label>Title</Label><Input autoFocus maxLength={200} value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="e.g. Build a sales dashboard from the sample dataset" /></div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div><Label>Classroom</Label><NativeSelect value={v.classroom_id} onChange={(e) => setV({ ...v, classroom_id: e.target.value, assignee_ids: [] })}>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect></div>
            <div><Label>Deadline</Label><Input type="datetime-local" value={v.due} onChange={(e) => setV({ ...v, due: e.target.value })} /></div>
            <div><Label hint="optional">Marks available</Label><Input type="number" min={0} value={v.max_points} onChange={(e) => setV({ ...v, max_points: e.target.value })} placeholder="e.g. 100" /></div>
          </div>
          <div><Label>Instructions</Label><RichText value={v.instructions_html} onChange={(h) => setV((s) => ({ ...s, instructions_html: h }))} compact minHeight={120} /></div>
          <div><Label>Attachments</Label>
            <div className="flex flex-wrap gap-2">{v.attachments.map((a) => <Badge key={a.id} tone="lavender" className="py-1">{a.type === 'notebook' ? <NotebookPen className="size-3" /> : <FileText className="size-3" />}{label(a) || 'Item'}<button aria-label="Remove attachment" onClick={() => setV({ ...v, attachments: v.attachments.filter((x) => x.id !== a.id) })}><X className="size-3" /></button></Badge>)}
              <Button size="sm" variant="outline" onClick={() => setPick(true)}><Paperclip /> Attach document or notebook</Button></div>
            <p className="mt-1 text-xs text-muted-foreground">Students in the class can open attachments; PDFs can be annotated on their own copy.</p>
          </div>
          <div><Label>Assign to</Label>
            <div className="flex gap-2"><Button size="sm" variant={v.assignee_ids.length ? 'ghost' : 'secondary'} onClick={() => setV({ ...v, assignee_ids: [] })}>Whole class ({roster.length})</Button><Button size="sm" variant={v.assignee_ids.length ? 'secondary' : 'ghost'} onClick={() => setV({ ...v, assignee_ids: roster.slice(0, 1).map((m) => m.user_id) })}>Selected students</Button></div>
            {v.assignee_ids.length > 0 && <div className="mt-2 grid gap-1 sm:grid-cols-2">{roster.map((m) => { const p = app.profile(m.user_id); const on = v.assignee_ids.includes(m.user_id); return (
              <label key={m.id} className="flex items-center gap-2 rounded-lg p-1.5 text-sm hover:bg-muted"><Checkbox checked={on} onCheckedChange={() => setV({ ...v, assignee_ids: on ? v.assignee_ids.filter((x) => x !== m.user_id) : [...v.assignee_ids, m.user_id] })} /><Avatar name={p?.full_name || '?'} size={22} />{p?.full_name}</label>
            ); })}</div>}
          </div>
        </DialogBody>
        <DialogFooter><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={!v.title.trim() || !v.classroom_id} onClick={save}>{initial ? 'Save' : 'Assign'}</Button></DialogFooter>
      </DialogContent>
      <ResourcePicker open={pick} onOpenChange={setPick} kinds={['document', 'notebook']} mineOnly title="Attach to assignment" onPick={(p) => { if (p.type !== 'link' && !v.attachments.some((a) => a.id === p.item.id)) setV({ ...v, attachments: [...v.attachments, { type: p.type, id: p.item.id }] }); setPick(false); }} />
    </Dialog>
  );
}

export function AssignmentDetail() {
  const { id } = useParams();
  const app = useApp();
  const nav = useNavigate();
  const { row: a, loading } = useRow<Assignment>('assignments', id);
  const { row: cls } = useRow<Classroom>('classrooms', a?.classroom_id);
  const { rows: subs } = useTable<Submission>('submissions', a ? { assignment_id: a.id } : null);
  const { rows: members } = useTable<ClassroomMember>('classroom_members', a ? { classroom_id: a.classroom_id } : null);
  const { rows: docs } = useTable<DocumentRow>('documents');
  const { rows: nbs } = useTable<Notebook>('notebooks');
  const [sel, setSel] = useState<string | null>(null);
  const [edit, setEdit] = useState(false);
  if (loading) return <FullSpinner />;
  if (!a || !app.classIds.has(a.classroom_id)) return <Empty icon={<ClipboardCheck />} title="Assignment not available" action={<Button onClick={() => nav('/app/assignments')}>Back</Button>} />;
  const teaching = cls?.owner_id === app.user.id;
  const targets = (a.assignee_ids.length ? a.assignee_ids : members.map((m) => m.user_id));
  const mine = subs.find((s) => s.student_id === app.user.id);
  const current = teaching ? subs.find((s) => s.id === sel) || null : mine || null;
  return (
    <div className="animate-fade-up">
      <button onClick={() => nav('/app/assignments')} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="size-4" /> Assignments</button>
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[1fr_1.25fr]">
        <div className="space-y-5">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <div className="flex items-start justify-between gap-3">
              <div><Link to={`/app/classes/${a.classroom_id}`} className="text-xs text-muted-foreground hover:underline">{cls?.name}</Link><h1 className="mt-1 text-xl font-semibold">{a.title}</h1>
                <div className={cn('mt-1 inline-flex items-center gap-1.5 text-sm', new Date(a.due_at) < new Date() ? 'text-red-600' : 'text-muted-foreground')}><Clock className="size-4" /> Due {fmtDateTime(a.due_at)}{a.max_points ? ` · ${a.max_points} marks` : ''}</div></div>
              {teaching ? <div className="flex gap-1"><Button size="sm" variant="secondary" onClick={() => setEdit(true)}>Edit</Button><Button size="icon" variant="ghost" aria-label="Delete assignment" onClick={async () => { if (await ask.confirm('Delete assignment?', 'Submissions and feedback will be deleted too.')) { await db.remove('assignments', a.id); nav('/app/assignments'); } }}><Trash2 /></Button></div>
                : <Badge tone={STATUS_TONE[submissionStatus(a, mine)]}>{STATUS_LABEL[submissionStatus(a, mine)]}</Badge>}
            </div>
            <div className="mt-5"><Html html={a.instructions_html} /></div>
            {a.attachments.length > 0 && <div className="mt-5 space-y-1.5"><div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Attachments</div>
              {a.attachments.map((x) => { const d = x.type === 'document' ? docs.find((y) => y.id === x.id) : null; const n = x.type === 'notebook' ? nbs.find((y) => y.id === x.id) : null; if (!d && !n) return null;
                return <Link key={x.id} to={d ? (fileKind(d.mime_type, d.name) === 'pdf' ? `/app/pdf/${d.id}` : `/app/documents?open=${d.id}`) : `/app/notebooks/${n!.id}`} className="flex items-center gap-3 rounded-xl bg-muted/60 p-2.5 hover:bg-muted">
                  {d ? <FileBadge mime={d.mime_type} name={d.name} size={26} /> : <span className="grid h-8 w-7 place-items-center rounded-md" style={{ background: n!.cover_color }}><NotebookPen className="size-3.5" /></span>}
                  <span className="flex-1 truncate text-sm">{d?.name || n?.title}</span>{d && fileKind(d.mime_type, d.name) === 'pdf' && !teaching && <span className="inline-flex items-center gap-1 text-[11px] text-lavender-ink dark:text-lavender"><PenLine className="size-3" /> Annotate your copy</span>}
                </Link>; })}
            </div>}
          </div>
          {teaching && (
            <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
              <div className="mb-2 px-1 text-sm font-semibold">Submissions</div>
              {targets.map((sid) => {
                const p = app.profile(sid); const s = subs.find((x) => x.student_id === sid); const st = submissionStatus(a, s);
                return (
                  <button key={sid} disabled={!s || s.status === 'in_progress'} onClick={async () => { if (s) { setSel(s.id); if (s.status === 'submitted') await db.update('submissions', s.id, { status: 'under_review' }); } }}
                    className={cn('flex w-full items-center gap-3 rounded-xl p-2.5 text-left disabled:cursor-default', current?.student_id === sid ? 'bg-secondary' : 'hover:bg-muted')}>
                    <Avatar name={p?.full_name || 'Student'} color={p?.avatar_color} size={30} /><span className="flex-1 text-sm">{p?.full_name || 'Student'}</span>
                    {s?.submitted_at && <span className="text-[11px] text-muted-foreground">{timeAgo(s.submitted_at)}</span>}<Badge tone={STATUS_TONE[st]}>{STATUS_LABEL[st]}</Badge>
                  </button>
                );
              })}
              {!targets.length && <p className="p-3 text-sm text-muted-foreground">No students in this classroom yet.</p>}
            </div>
          )}
        </div>
        <div className="space-y-5">
          {!teaching && <StudentSubmission a={a} existing={mine} />}
          {teaching && (current ? <SubmissionReview a={a} s={current} /> : <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">Select a submitted piece of work to review it.</div>)}
        </div>
      </div>
      {edit && <AssignmentDialog initial={a} onClose={() => setEdit(false)} />}
    </div>
  );
}

function StudentSubmission({ a, existing }: { a: Assignment; existing?: Submission }) {
  const app = useApp();
  const nav = useNavigate();
  const { rows: nbs } = useTable<Notebook>('notebooks', { owner_id: app.user.id });
  const { rows: fb } = useTable<Feedback>('feedback', existing ? { submission_id: existing.id } : null);
  const [html, setHtml] = useState(existing?.text_html || '');
  const [files, setFiles] = useState<Submission['files']>(existing?.files || []);
  const [nbIds, setNbIds] = useState<string[]>(existing?.notebook_ids || []);
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (existing) { setHtml(existing.text_html); setFiles(existing.files); setNbIds(existing.notebook_ids); } }, [existing?.id]);
  const locked = !!existing && ['submitted', 'under_review', 'completed'].includes(existing.status);
  const addFiles = async (list: File[]) => {
    setBusy(true);
    try { for (const f of list) { if (f.size > 100 * 1024 * 1024) throw new Error(`${f.name} is over 100 MB`); const path = `${app.user.id}/${a.id}/${uid()}-${safeName(f.name)}`; await db.upload('submissions', path, f); setFiles((x) => [...x, { path, name: f.name, mime: f.type || 'application/octet-stream', size: f.size }]); } }
    catch (e: any) { app.toast(e.message, 'err'); } finally { setBusy(false); }
  };
  const save = async (submit: boolean) => {
    const row: any = { text_html: html, files, notebook_ids: nbIds, status: submit ? 'submitted' : 'in_progress', updated_at: now(), ...(submit ? { submitted_at: now() } : {}) };
    if (existing) await db.update('submissions', existing.id, row);
    else await db.insert('submissions', { assignment_id: a.id, student_id: app.user.id, ...row });
    if (submit) { const c = await db.get<Classroom>('classrooms', a.classroom_id); if (c) await app.notify([c.owner_id], { kind: 'submission', title: `${app.user.full_name} submitted “${a.title}”`, link: `/app/assignments/${a.id}` }); app.log(`submitted “${a.title}”`, 'assignment', a.id, a.title, a.classroom_id); }
    app.toast(submit ? 'Submitted' : 'Draft saved');
  };
  const myFb = existing && ['returned', 'completed'].includes(existing.status) ? fb : [];
  return (
    <>
      {myFb.map((f) => (
        <div key={f.id} className="rounded-2xl border border-border border-l-4 border-l-lavender bg-card p-5 shadow-soft">
          <div className="mb-2 flex items-center gap-2"><span className="text-sm font-semibold">Feedback from {app.profile(f.author_id)?.full_name || 'your educator'}</span><span className="text-[11px] text-muted-foreground">{timeAgo(f.created_at)}</span>{f.points != null && <Badge className="ml-auto" tone="sage">{f.points}{a.max_points ? ` / ${a.max_points}` : ''}</Badge>}</div>
          <Html html={f.body_html} />{f.audio_path && <div className="mt-3"><AudioChip bucket="audio" path={f.audio_path} label="Listen to audio feedback" /></div>}
        </div>
      ))}
      {existing?.annotations && Object.values(existing.annotations).some((v) => v.length) && ['returned', 'completed'].includes(existing.status) && <MarkedFiles s={existing} />}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Your work</h2>{existing?.submitted_at && <span className="text-xs text-muted-foreground">Submitted {fmtDateTime(existing.submitted_at)}</span>}</div>
        <RichText value={html} onChange={setHtml} editable={!locked} compact minHeight={140} placeholder="Write your answer or a note for your educator…" />
        <div className="mt-3 flex flex-wrap gap-2">
          {files.map((f, i) => <Badge key={i} tone="blue" className="py-1"><FileBadge mime={f.mime} name={f.name} size={14} />{f.name}{!locked && <button aria-label="Remove file" onClick={() => setFiles(files.filter((_, j) => j !== i))}><X className="size-3" /></button>}</Badge>)}
          {nbIds.map((nid) => { const n = nbs.find((x) => x.id === nid); return <Badge key={nid} tone="lavender" className="py-1"><NotebookPen className="size-3" /><Link to={`/app/notebooks/${nid}`} className="hover:underline">{n?.title || 'Notebook'}</Link>{!locked && <button aria-label="Remove notebook" onClick={() => setNbIds(nbIds.filter((x) => x !== nid))}><X className="size-3" /></button>}</Badge>; })}
        </div>
        {!locked && <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={busy} onClick={() => ref.current?.click()}>{busy ? <Loader2 className="animate-spin" /> : <Upload />} Upload files</Button>
          <Button size="sm" variant="outline" onClick={() => setPick(true)}><NotebookPen /> Attach a notebook</Button>
          <Button size="sm" variant="ghost" onClick={async () => { const n = await createNotebook(app.user, { title: `${a.title} — my work` }); setNbIds([...nbIds, n.id]); if (existing) await db.update('submissions', existing.id, { notebook_ids: [...nbIds, n.id] }); else await db.insert('submissions', { assignment_id: a.id, student_id: app.user.id, text_html: html, files, notebook_ids: [...nbIds, n.id], status: 'in_progress', updated_at: now() }); nav(`/app/notebooks/${n.id}`); }}><Plus /> New notebook for this</Button>
          <input ref={ref} type="file" multiple hidden onChange={(e) => { addFiles(Array.from(e.target.files || [])); e.target.value = ''; }} />
        </div>}
        <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 -mx-5 -mb-5 mt-4 flex flex-wrap justify-end gap-2 rounded-b-2xl border-t border-border bg-card/95 px-5 py-3 backdrop-blur lg:static lg:mx-0 lg:mb-0 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
          {!locked && <><Button variant="outline" onClick={() => save(false)}><Save /> Save draft</Button><Button size="lg" onClick={() => save(true)} disabled={busy || (!html.replace(/<[^>]+>/g, '').trim() && !files.length && !nbIds.length)}><Send /> {existing?.status === 'returned' ? 'Resubmit' : 'Hand in'}</Button></>}
          {locked && existing?.status !== 'completed' && <p className="text-sm text-muted-foreground">Submitted — you can edit again if your educator returns it.</p>}
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">Only you and your educator can see this submission.</p>
      </div>
      <ResourcePicker open={pick} onOpenChange={setPick} kinds={['notebook']} mineOnly title="Attach one of your notebooks" onPick={(p) => { if (!nbIds.includes(p.item.id)) setNbIds([...nbIds, p.item.id]); setPick(false); }} />
    </>
  );
}

function MarkedFiles({ s }: { s: Submission }) {
  const [open, setOpen] = useState<number | null>(null);
  return <div className="rounded-2xl border border-border bg-card p-4"><div className="mb-2 text-sm font-semibold">Your educator marked up your files</div>
    {s.files.map((f, i) => Object.keys(s.annotations || {}).some((k) => k.startsWith(`${i}:`)) && <Button key={i} size="sm" variant="secondary" className="mr-2" onClick={() => setOpen(i)}><Eye /> {f.name}</Button>)}
    {open != null && <SubmissionAnnotator s={s} fileIndex={open} readOnly onClose={() => setOpen(null)} />}</div>;
}

/** Educator review panel — also used as a split-screen pane. */
export function SubmissionReview({ a, s }: { a: Assignment; s: Submission }) {
  const app = useApp();
  const nav = useNavigate();
  const { rows: fb } = useTable<Feedback>('feedback', { submission_id: s.id }, { col: 'created_at', asc: true });
  const { rows: nbs } = useTable<Notebook>('notebooks');
  const [body, setBody] = useState('');
  const [points, setPoints] = useState('');
  const [audio, setAudio] = useState<{ blob: Blob; secs: number } | null>(null);
  const [annot, setAnnot] = useState<number | null>(null);
  const student = app.profile(s.student_id);
  const send = async (status: 'returned' | 'completed') => {
    let audio_path: string | null = null;
    if (audio) { audio_path = `${app.user.id}/fb/${s.id}/${uid()}.${audio.blob.type.includes('mp4') ? 'm4a' : 'webm'}`; await db.upload('audio', audio_path, audio.blob); }
    if (body.replace(/<[^>]+>/g, '').trim() || audio_path || points) await db.insert('feedback', { submission_id: s.id, author_id: app.user.id, body_html: body, audio_path, points: points ? Number(points) : null });
    await db.update('submissions', s.id, { status, updated_at: now() });
    await app.notify([s.student_id], { kind: 'feedback', title: status === 'completed' ? `“${a.title}” marked as completed` : `Feedback returned on “${a.title}”`, link: `/app/assignments/${a.id}` });
    setBody(''); setPoints(''); setAudio(null);
    app.toast(status === 'completed' ? 'Marked completed and returned' : 'Returned to student');
  };
  return (
    <>
      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <div className="mb-3 flex items-center gap-3"><Avatar name={student?.full_name || 'Student'} color={student?.avatar_color} size={36} />
          <div className="flex-1"><div className="font-semibold">{student?.full_name || 'Student'}</div><div className="text-[11px] text-muted-foreground">{s.submitted_at ? `Submitted ${fmtDateTime(s.submitted_at)}` : 'Draft'}{s.submitted_at && new Date(s.submitted_at) > new Date(a.due_at) ? ' · late' : ''}</div></div>
          <Badge tone={STATUS_TONE[submissionStatus(a, s)]}>{STATUS_LABEL[submissionStatus(a, s)]}</Badge></div>
        {s.text_html.replace(/<[^>]+>/g, '').trim() && <div className="rounded-xl bg-muted/50 p-4"><Html html={s.text_html} /></div>}
        <div className="mt-3 space-y-1.5">
          {s.files.map((f, i) => { const k = fileKind(f.mime, f.name); return (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-border p-2">
              <FileBadge mime={f.mime} name={f.name} size={26} /><span className="flex-1 truncate text-sm">{f.name}</span>
              {(k === 'pdf' || k === 'image') && <Button size="sm" variant="secondary" onClick={() => setAnnot(i)}><PenLine /> Annotate</Button>}
              <Button size="icon" variant="ghost" aria-label="Download" onClick={async () => saveBlob(await db.download('submissions', f.path), f.name)}><Download /></Button>
            </div>); })}
          {s.notebook_ids.map((nid) => { const n = nbs.find((x) => x.id === nid); return (
            <div key={nid} className="flex items-center gap-3 rounded-xl border border-border p-2">
              <span className="grid h-8 w-7 place-items-center rounded-md" style={{ background: n?.cover_color || '#E4DDFB' }}><NotebookPen className="size-3.5" /></span><span className="flex-1 truncate text-sm">{n?.title || 'Notebook'}</span>
              <Button size="sm" variant="secondary" onClick={() => nav(`/app/split?left=notebook:${nid}&right=submission:${s.id}`)}><Columns2 /> Review side by side</Button>
            </div>); })}
        </div>
      </div>
      {fb.map((f) => <div key={f.id} className="rounded-2xl border border-border border-l-4 border-l-lavender bg-card p-4"><div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">Your feedback · {timeAgo(f.created_at)}{f.points != null && <Badge tone="sage" className="ml-auto">{f.points}{a.max_points ? ` / ${a.max_points}` : ''}</Badge>}</div><Html html={f.body_html} />{f.audio_path && <div className="mt-2"><AudioChip bucket="audio" path={f.audio_path} label="Audio feedback" /></div>}</div>)}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <div className="mb-3 font-semibold">Feedback</div>
        <RichText value={body} onChange={setBody} compact minHeight={110} placeholder="What went well, and what to improve next time…" />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {audio ? <Badge tone="lavender" className="py-1.5">Audio ready · {audio.secs}s <button aria-label="Discard audio" onClick={() => setAudio(null)}><X className="size-3" /></button></Badge> : <AudioRecorder label="Record audio feedback" onDone={(blob, secs) => setAudio({ blob, secs })} />}
          <div className="flex items-center gap-2"><Input className="w-24" type="number" min={0} aria-label="Marks" value={points} onChange={(e) => setPoints(e.target.value)} placeholder="Mark" />{a.max_points ? <span className="text-sm text-muted-foreground">/ {a.max_points}</span> : null}</div>
        </div>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => send('returned')}><Undo2 /> Return to student</Button>
          <Button onClick={() => send('completed')}><CheckCircle2 /> Return & mark completed</Button>
        </div>
      </div>
      {annot != null && <SubmissionAnnotator s={s} fileIndex={annot} onClose={() => setAnnot(null)} />}
    </>
  );
}

/** Draw on a submitted PDF/photo. Marks are stored on the submission; the student's original file is untouched. */
function SubmissionAnnotator({ s, fileIndex, onClose, readOnly }: { s: Submission; fileIndex: number; onClose: () => void; readOnly?: boolean }) {
  const app = useApp();
  const f = s.files[fileIndex];
  const isPdf = fileKind(f.mime, f.name) === 'pdf';
  const [doc, setDoc] = useState<PDFDoc | null>(null);
  const [n, setN] = useState(1);
  const [bg, setBg] = useState<{ canvas: HTMLCanvasElement; w: number; h: number } | null>(null);
  const [data, setData] = useState<Record<string, CanvasObject[]>>(s.annotations || {});
  const [tools, setTools] = useState<ToolState>({ ...DEFAULT_TOOLS, colors: { ...DEFAULT_TOOLS.colors, ballpoint: '#D04C4C' } });
  const [selected, setSelected] = useState<string[]>([]);
  const [zoom, setZoom] = useState(1);
  const hist = useHistory();
  const wrap = useRef<HTMLDivElement>(null);
  const key = `${fileIndex}:${n}`, objs = data[key] || [];
  useEffect(() => {
    (async () => {
      const blob = await db.download('submissions', f.path);
      if (isPdf) setDoc(await openPdf(blob));
      else { const img = await new Promise<HTMLImageElement>((res) => { const i = new Image(); i.onload = () => res(i); i.src = URL.createObjectURL(blob); }); const w = 794, h = Math.round((img.naturalHeight / img.naturalWidth) * w); const c = document.createElement('canvas'); c.width = w * 2; c.height = h * 2; c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height); setBg({ canvas: c, w, h }); }
    })();
  }, []);
  useEffect(() => { if (doc) renderPdfPage(doc, n, 794, 2).then((r) => setBg({ canvas: r.canvas, w: 794, h: Math.round(r.height) })); }, [doc, n]);
  useEffect(() => { const w = wrap.current?.clientWidth || 800; setZoom(Math.min(1, (w - 24) / 794)); }, [bg]);
  const commit = (o: CanvasObject[], rec = true) => { if (rec) hist.push(key, objs); setData((d) => ({ ...d, [key]: o })); };
  const ops = selectionOps(objs, selected);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="xl">
        <DialogHeader><DialogTitle className="truncate pr-8">{readOnly ? 'Marked-up' : 'Annotate'} · {f.name}</DialogTitle></DialogHeader>
        <DialogBody>
          {!readOnly && <div className="mb-3"><Toolbar tools={tools} setTools={setTools} canUndo={hist.canUndo(key)} canRedo={hist.canRedo(key)} onUndo={() => { const v = hist.undo(key, objs); if (v) commit(v, false); }} onRedo={() => { const v = hist.redo(key, objs); if (v) commit(v, false); }}
            zoom={zoom} setZoom={setZoom} selection={objs.filter((o) => selected.includes(o.id))} onPatch={(fn) => commit(ops.patch(fn))} onDelete={() => { commit(ops.remove()); setSelected([]); }} onDuplicate={() => { const r = ops.duplicate(); commit(r.objects); setSelected(r.ids); }} onOrder={(fr) => commit(ops.order(fr))} /></div>}
          <div ref={wrap} data-scroll className="max-h-[60vh] overflow-auto rounded-xl bg-ivory p-3 dark:bg-background">
            {bg ? <div className="mx-auto w-fit shadow-lift"><InkCanvas key={key} width={bg.w} height={bg.h} zoom={zoom} objects={objs} onCommit={commit} selected={selected} onSelect={setSelected} tools={tools} background={{ kind: 'image', image: bg.canvas }} readOnly={readOnly} pencilOnly={!!app.user.settings?.pencil_only} /></div> : <div className="grid place-items-center py-20"><Spinner /></div>}
          </div>
          {doc && doc.numPages > 1 && <div className="mt-3 flex items-center justify-center gap-3 text-sm"><Button size="icon" variant="ghost" aria-label="Previous page" disabled={n === 1} onClick={() => setN(n - 1)}><ChevronLeft /></Button>Page {n} / {doc.numPages}<Button size="icon" variant="ghost" aria-label="Next page" disabled={n === doc.numPages} onClick={() => setN(n + 1)}><ChevronRight /></Button></div>}
        </DialogBody>
        <DialogFooter>{readOnly ? <Button onClick={onClose}>Close</Button> : <><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={async () => { await db.update('submissions', s.id, { annotations: data }); app.toast('Annotations saved — the student sees them when you return the work'); onClose(); }}>Save annotations</Button></>}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { Viewer };
