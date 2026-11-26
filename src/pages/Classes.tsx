import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  GraduationCap, Plus, KeyRound, Users, Megaphone, FolderOpen, NotebookPen, Link2, ClipboardCheck, MessageSquareQuote, CalendarDays, BarChart3,
  Copy, Mail, RefreshCw, Trash2, Pencil, ArrowLeft, Share2, Send, UserPlus, ExternalLink, Image as ImageIcon, Archive,
} from 'lucide-react';
import { useApp, ask } from '@/lib/app';
import { joinByCode } from '@/lib/actions';
import { useRow, useTable } from '@/lib/hooks';
import { db, now, supabase, uid } from '@/lib/backend';
import type { Announcement, Assignment, CalendarEvent, Classroom, ClassroomMember, DocumentRow, Feedback, Invitation, Notebook, ResourceLink, Share, Submission } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/misc';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, ColorDots, Empty, FullSpinner, PageHeader, Progress } from '@/components/common';
import { DocCard, NotebookCard } from '@/components/Cards';
import { RichText, Html } from '@/components/RichText';
import { AudioChip } from '@/components/Audio';
import { ResourcePicker } from '@/components/ResourcePicker';
import { AssignmentDialog, STATUS_LABEL, STATUS_TONE, submissionStatus } from './Assignments';
import { EventDialog } from './Calendar';
import { cn, fmtDate, fmtDateTime, fmtTime, PASTELS, timeAgo } from '@/lib/utils';

export const SUBJECT_EXAMPLES = ['Business Intelligence', 'Computer Science', 'Mathematics', 'English Language', 'Foreign Languages', 'Biology', 'Business Management', 'Art and Design', 'Professional Development'];
const code = () => Array.from(crypto.getRandomValues(new Uint8Array(7))).map((b) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('');

export function ClassCover({ c, className }: { c: Classroom; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { if (c.cover_path) db.fileUrl('covers', c.cover_path).then(setUrl).catch(() => setUrl(null)); else setUrl(null); }, [c.cover_path]);
  return (
    <div className={cn('relative overflow-hidden', className)} style={{ background: c.cover_color }}>
      {url ? <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <>
        <div className="absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/35" />
        <div className="absolute -bottom-16 left-10 h-32 w-32 rounded-full bg-white/25" />
      </>}
    </div>
  );
}

export default function Classes() {
  const app = useApp();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const { rows } = useTable<Classroom>('classrooms', undefined, { col: 'created_at', asc: true });
  const { rows: members } = useTable<ClassroomMember>('classroom_members');
  const { rows: asg } = useTable<Assignment>('assignments');
  const [edit, setEdit] = useState<Partial<Classroom> | null>(null);
  const [join, setJoin] = useState(false);
  const isTeacher = app.user.role === 'educator';
  useEffect(() => { if (params.get('new') && isTeacher) { setEdit({}); params.delete('new'); setParams(params, { replace: true }); } }, [params]);
  const mine = rows.filter((c) => app.classIds.has(c.id) && !c.archived);
  return (
    <div className="animate-fade-up">
      <PageHeader icon={<GraduationCap />} title="My Classes" subtitle={isTeacher ? 'Private classrooms for individual students or groups — any subject, any level.' : 'Classrooms you belong to.'}
        actions={<><Button variant="outline" onClick={() => setJoin(true)}><KeyRound /> Join with code</Button>{isTeacher && <Button onClick={() => setEdit({})}><Plus /> Create classroom</Button>}</>} />
      <JoinCard />
      {mine.length ? (
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {mine.map((c) => {
            const m = members.filter((x) => x.classroom_id === c.id);
            const teacher = app.profile(c.owner_id);
            const due = asg.filter((a) => a.classroom_id === c.id && new Date(a.due_at) > new Date()).length;
            return (
              <Link key={c.id} to={`/app/classes/${c.id}`} className="relative block overflow-hidden rounded-3xl p-5 shadow-soft transition active:scale-[.99]" style={{ background: c.cover_color }}>
                <div className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/35" />
                <h3 className="relative text-lg font-bold text-charcoal">{c.name}</h3>
                <div className="relative mt-0.5 text-sm text-charcoal/70">{c.owner_id === app.user.id ? `${m.length} student${m.length === 1 ? '' : 's'}` : teacher?.full_name || c.subject}</div>
                <div className="relative mt-8"><span className="inline-flex h-7 items-center rounded-full bg-white/70 px-3 text-xs font-semibold text-charcoal">{due ? `${due} due` : 'Up to date'}</span></div>
              </Link>
            );
          })}
        </div>
      ) : <Empty icon={<GraduationCap />} title={isTeacher ? 'No classrooms yet' : 'You haven’t joined a classroom'} body={isTeacher ? 'Create one for a whole group or a single student.' : 'Ask your educator for a classroom code or invitation link.'}
        action={isTeacher ? <Button onClick={() => setEdit({})}><Plus /> Create classroom</Button> : <Button onClick={() => setJoin(true)}><KeyRound /> Join with code</Button>} />}
      {edit && <ClassroomDialog initial={edit} onClose={() => setEdit(null)} onSaved={(id) => nav(`/app/classes/${id}`)} />}
      <JoinClassDialog open={join} onOpenChange={setJoin} />
    </div>
  );
}

function JoinCard() {
  const app = useApp();
  const nav = useNavigate();
  const [c, setC] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const go = async () => {
    setErr(''); setBusy(true);
    try { const cid = await joinByCode(app.user, c); app.toast('You’ve joined the classroom'); setC(''); nav(`/app/classes/${cid}`); }
    catch (e: any) { setErr(e.message || 'Could not join'); } finally { setBusy(false); }
  };
  return (
    <div className="rounded-3xl bg-card p-4 ring-1 ring-border">
      <div className="mb-2 text-sm font-semibold">Join a class</div>
      <div className="flex gap-2">
        <Input className="h-12 flex-1 rounded-2xl font-mono uppercase tracking-[.2em]" maxLength={10} value={c} onChange={(e) => setC(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && c.trim().length >= 5 && go()} placeholder="Class code" aria-label="Class code" />
        <Button size="lg" disabled={busy || c.trim().length < 5} onClick={go}>Join</Button>
      </div>
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
    </div>
  );
}

export function JoinClassDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const app = useApp();
  const nav = useNavigate();
  const [c, setC] = useState(''); const [err, setErr] = useState('');
  const join = async () => {
    setErr('');
    try {
      let cid: string;
      if (supabase) cid = await db.rpc<string>('join_classroom', { p_code: c });
      else {
        const cls = (await db.list<Classroom>('classrooms')).find((x) => x.join_code === c.trim().toUpperCase() && !x.archived);
        if (!cls) throw new Error('Classroom code not recognised');
        if (!(await db.list<ClassroomMember>('classroom_members', { classroom_id: cls.id, user_id: app.user.id })).length && cls.owner_id !== app.user.id) await db.insert('classroom_members', { classroom_id: cls.id, user_id: app.user.id, role: 'student', progress: 0 });
        cid = cls.id;
      }
      app.toast('You’ve joined the classroom'); onOpenChange(false); nav(`/app/classes/${cid}`);
    } catch (e: any) { setErr(e.message || 'Could not join'); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader><DialogTitle>Join a classroom</DialogTitle><DialogDescription>Enter the code your educator gave you.</DialogDescription></DialogHeader>
        <DialogBody><Input autoFocus className="text-center font-mono text-lg uppercase tracking-[.3em]" maxLength={10} value={c} onChange={(e) => setC(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && join()} placeholder="CODE" />{err && <p className="mt-2 text-sm text-red-600">{err}</p>}</DialogBody>
        <DialogFooter><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={c.trim().length < 5} onClick={join}>Join</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ClassroomDialog({ initial, onClose, onSaved }: { initial: Partial<Classroom>; onClose: () => void; onSaved?: (id: string) => void }) {
  const app = useApp();
  const [v, setV] = useState<Partial<Classroom>>({ name: '', description: '', subject: '', cover_color: PASTELS[Math.floor(Math.random() * 5)], ...initial });
  const [cover, setCover] = useState<File | null>(null);
  const save = async () => {
    let id = initial.id;
    const row: any = { name: v.name!.trim().slice(0, 120), description: v.description || null, subject: v.subject?.trim() || 'General', cover_color: v.cover_color };
    if (id) await db.update('classrooms', id, row);
    else id = (await db.insert<Classroom>('classrooms', { ...row, owner_id: app.user.id, join_code: code(), archived: false })).id;
    if (cover) { const path = `${app.user.id}/${id}/${uid()}-cover.${cover.type.split('/')[1] || 'jpg'}`; await db.upload('covers', path, cover); await db.update('classrooms', id!, { cover_path: path }); }
    app.log(initial.id ? 'updated classroom' : 'created classroom', 'classroom', id!, row.name, id);
    onClose(); onSaved?.(id!);
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="lg">
        <DialogHeader><DialogTitle>{initial.id ? 'Edit classroom' : 'Create classroom'}</DialogTitle></DialogHeader>
        <DialogBody className="space-y-4">
          <div><Label>Classroom name</Label><Input autoFocus maxLength={120} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="e.g. BI Fundamentals — Group A, or Sam · 1-to-1 tutoring" /></div>
          <div><Label>Subject</Label><Input list="subjects" maxLength={80} value={v.subject} onChange={(e) => setV({ ...v, subject: e.target.value })} placeholder="Any subject or discipline" /><datalist id="subjects">{SUBJECT_EXAMPLES.map((s) => <option key={s} value={s} />)}</datalist></div>
          <div><Label>Description</Label><Textarea rows={3} value={v.description || ''} onChange={(e) => setV({ ...v, description: e.target.value })} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label>Cover colour</Label><ColorDots colors={PASTELS} value={v.cover_color!} onChange={(c) => setV({ ...v, cover_color: c })} size={24} /></div>
            <div><Label hint="optional">Cover image</Label><label className="flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border px-3 text-sm text-muted-foreground hover:bg-muted"><ImageIcon className="size-4" />{cover ? cover.name : 'Choose image…'}<input type="file" accept="image/*" hidden onChange={(e) => setCover(e.target.files?.[0] || null)} /></label></div>
          </div>
        </DialogBody>
        <DialogFooter><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={!v.name?.trim()} onClick={save}>{initial.id ? 'Save' : 'Create classroom'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ClassroomDetail() {
  const { id } = useParams();
  const app = useApp();
  const nav = useNavigate();
  const { row: c, loading } = useRow<Classroom>('classrooms', id);
  const { rows: members } = useTable<ClassroomMember>('classroom_members', { classroom_id: id });
  const { rows: ann } = useTable<Announcement>('announcements', { classroom_id: id });
  const { rows: asg } = useTable<Assignment>('assignments', { classroom_id: id }, { col: 'due_at' });
  const { rows: subs } = useTable<Submission>('submissions');
  const { rows: fb } = useTable<Feedback>('feedback');
  const { rows: shares } = useTable<Share>('shares', { grantee_type: 'classroom', grantee_id: id });
  const { rows: docs } = useTable<DocumentRow>('documents');
  const { rows: nbs } = useTable<Notebook>('notebooks');
  const { rows: links } = useTable<ResourceLink>('resource_links');
  const { rows: events } = useTable<CalendarEvent>('calendar_events', { classroom_id: id }, { col: 'starts_at', asc: true });
  const { rows: invites } = useTable<Invitation>('invitations', { classroom_id: id });
  const [tab, setTab] = useState(app.user.role === 'educator' ? 'stream' : 'assignments');
  const [post, setPost] = useState('');
  const [pick, setPick] = useState(false);
  const [newAsg, setNewAsg] = useState(false);
  const [newEvent, setNewEvent] = useState(false);
  const [edit, setEdit] = useState(false);
  const [invite, setInvite] = useState(false);

  if (loading) return <FullSpinner />;
  if (!c || !app.classIds.has(c.id)) return <Empty icon={<GraduationCap />} title="Classroom not available" body="You’re not a member of this classroom." action={<Button onClick={() => nav('/app/classes')}>My Classes</Button>} />;
  const teacher = c.owner_id === app.user.id;
  const educator = app.profile(c.owner_id);
  const shared = (type: string) => shares.filter((s) => s.resource_type === type).map((s) => s.resource_id);
  const sDocs = docs.filter((d) => shared('document').includes(d.id) && !d.deleted_at);
  const sNbs = nbs.filter((n) => shared('notebook').includes(n.id) && !n.deleted_at);
  const sLinks = links.filter((l) => shared('link').includes(l.id));
  const myAsg = teacher ? asg : asg.filter((a) => !a.assignee_ids.length || a.assignee_ids.includes(app.user.id));
  const classSubs = subs.filter((s) => asg.some((a) => a.id === s.assignment_id) && (teacher || s.student_id === app.user.id));
  const classFb = fb.filter((f) => classSubs.some((s) => s.id === f.submission_id));
  const me = members.find((m) => m.user_id === app.user.id);

  const sharePicked = async (p: any) => {
    const type = p.type as 'document' | 'notebook' | 'link';
    if (shares.some((s) => s.resource_type === type && s.resource_id === p.item.id)) return app.toast('Already shared with this class', 'info');
    if (p.item.owner_id !== app.user.id) return app.toast('You can only share items you own', 'err');
    await db.insert('shares', { resource_type: type, resource_id: p.item.id, owner_id: app.user.id, grantee_type: 'classroom', grantee_id: c.id, permission: 'view' });
    await app.notify(members.map((m) => m.user_id), { kind: 'share', title: `New material in ${c.name}: ${p.item.name || p.item.title}`, link: `/app/classes/${c.id}` });
    app.log(`shared “${p.item.name || p.item.title}” with`, 'classroom', c.id, c.name, c.id);
    setPick(false); app.toast('Shared with the class');
  };
  const unshare = async (type: string, rid: string) => { const s = shares.find((x) => x.resource_type === type && x.resource_id === rid); if (s) await db.remove('shares', s.id); };

  return (
    <div className="animate-fade-up">
      <button onClick={() => nav('/app/classes')} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> My Classes</button>
      <div className="relative mb-6 overflow-hidden rounded-[24px] border border-border">
        <ClassCover c={c} className="h-36 sm:h-44" />
        <div className={cn("absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-3 p-5 sm:p-6", c.cover_path ? "bg-gradient-to-t from-black/45 to-transparent text-white" : "text-charcoal")}>
          <div><div className="text-xs font-medium opacity-90">{c.subject}</div><h1 className="text-2xl font-bold">{c.name}</h1><div className="mt-1 flex items-center gap-2 text-xs opacity-90">{educator && <><Avatar name={educator.full_name} color={educator.avatar_color} size={20} /> {educator.full_name}</>}</div></div>
          {teacher && <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => setInvite(true)}><UserPlus /> Invite</Button>
            <Button size="sm" variant="secondary" onClick={() => setEdit(true)}><Pencil /> Edit</Button>
          </div>}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="max-w-full overflow-x-auto">
          <TabsTrigger value="assignments"><ClipboardCheck className="size-3.5" /> To do</TabsTrigger>
          <TabsTrigger value="materials"><FolderOpen className="size-3.5" /> Materials</TabsTrigger>
          <TabsTrigger value="stream"><Megaphone className="size-3.5" /> Updates</TabsTrigger>
          <TabsTrigger value="feedback"><MessageSquareQuote className="size-3.5" /> Feedback</TabsTrigger>
          <TabsTrigger value="calendar"><CalendarDays className="size-3.5" /> Calendar</TabsTrigger>
          <TabsTrigger value="people"><Users className="size-3.5" /> {teacher ? 'Students & progress' : 'Progress'}</TabsTrigger>
        </TabsList>

        <TabsContent value="stream">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_300px]">
            <div className="space-y-4">
              {teacher && <div className="rounded-2xl border border-border bg-card p-4"><RichText value={post} onChange={setPost} compact minHeight={70} placeholder="Share an announcement with your class…" /><div className="mt-2 flex justify-end"><Button size="sm" disabled={!post.replace(/<[^>]+>/g, '').trim()} onClick={async () => { await db.insert('announcements', { classroom_id: c.id, author_id: app.user.id, body_html: post }); await app.notify(members.map((m) => m.user_id), { kind: 'announcement', title: `New announcement in ${c.name}`, link: `/app/classes/${c.id}` }); setPost(''); }}><Send /> Post</Button></div></div>}
              {ann.map((a) => (
                <div key={a.id} className="rounded-2xl border border-border bg-card p-5">
                  <div className="mb-2 flex items-center gap-2"><Avatar name={app.profile(a.author_id)?.full_name || 'Educator'} size={28} /><span className="text-sm font-medium">{app.profile(a.author_id)?.full_name || 'Educator'}</span><span className="text-xs text-muted-foreground">{timeAgo(a.created_at)}</span>
                    {teacher && <button aria-label="Delete announcement" className="ml-auto text-muted-foreground hover:text-red-600" onClick={() => db.remove('announcements', a.id)}><Trash2 className="size-4" /></button>}</div>
                  <Html html={a.body_html} />
                </div>
              ))}
              {!ann.length && <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No announcements yet.</div>}
            </div>
            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-card p-4"><div className="mb-2 text-sm font-semibold">About</div><p className="text-sm text-muted-foreground">{c.description || 'No description.'}</p>
                {teacher && <div className="mt-3 rounded-xl bg-muted p-3"><div className="text-[11px] text-muted-foreground">Class code</div><div className="flex items-center gap-2"><span className="font-mono text-lg font-semibold tracking-[.25em]">{c.join_code}</span><button aria-label="Copy code" onClick={() => { navigator.clipboard?.writeText(c.join_code); app.toast('Code copied'); }}><Copy className="size-4" /></button></div></div>}
              </div>
              <div className="rounded-2xl border border-border bg-card p-4"><div className="mb-2 text-sm font-semibold">Coming up</div>
                {[...myAsg.filter((a) => new Date(a.due_at) > new Date()).slice(0, 3).map((a) => ({ id: a.id, t: a.title, when: a.due_at, href: `/app/assignments/${a.id}`, k: 'Due' })), ...events.filter((e) => new Date(e.starts_at) > new Date()).slice(0, 3).map((e) => ({ id: e.id, t: e.title, when: e.starts_at, href: '/app/calendar', k: 'Class' }))]
                  .sort((a, b) => (a.when > b.when ? 1 : -1)).slice(0, 5).map((x) => <Link key={x.id} to={x.href} className="flex justify-between gap-2 py-1.5 text-sm hover:text-lavender-ink"><span className="truncate">{x.t}</span><span className="shrink-0 text-[11px] text-muted-foreground">{x.k} {fmtDate(x.when)}</span></Link>)}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="materials" className="space-y-6">
          {teacher && <Button onClick={() => setPick(true)}><Share2 /> Share materials with this class</Button>}
          <section><h3 className="mb-3 font-semibold">Documents</h3>{sDocs.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{sDocs.map((d) => <div key={d.id} className="relative"><DocCard d={d} view="grid" />{teacher && <button aria-label="Stop sharing" title="Stop sharing" className="absolute right-2 top-2 rounded-lg bg-card/90 p-1.5 shadow-soft hover:text-red-600" onClick={() => unshare('document', d.id)}><Trash2 className="size-3.5" /></button>}</div>)}</div> : <p className="text-sm text-muted-foreground">No documents shared yet.</p>}</section>
          <section><h3 className="mb-3 font-semibold">Shared notebooks</h3>{sNbs.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{sNbs.map((n) => <NotebookCard key={n.id} n={n} view="grid" />)}</div> : <p className="text-sm text-muted-foreground">No notebooks shared yet.</p>}</section>
          <section><h3 className="mb-3 font-semibold">Learning links</h3>{sLinks.length ? <div className="grid gap-2 sm:grid-cols-2">{sLinks.map((l) => <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 hover:shadow-soft"><Link2 className="size-4 text-lavender-deep" /><span className="flex-1 truncate text-sm">{l.title}</span><Badge tone="sage">{l.provider}</Badge><ExternalLink className="size-3.5 text-muted-foreground" /></a>)}</div> : <p className="text-sm text-muted-foreground">No links shared yet.</p>}</section>
        </TabsContent>

        <TabsContent value="assignments">
          {teacher && <Button className="mb-4" onClick={() => setNewAsg(true)}><Plus /> New assignment</Button>}
          <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {myAsg.map((a) => {
              const st = teacher ? null : submissionStatus(a, subs.find((s) => s.assignment_id === a.id && s.student_id === app.user.id));
              const done = subs.filter((s) => s.assignment_id === a.id && s.status !== 'in_progress').length;
              const target = a.assignee_ids.length || members.length;
              return (
                <Link key={a.id} to={`/app/assignments/${a.id}`} className="flex items-center gap-3 p-4 hover:bg-muted/50">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-secondary"><ClipboardCheck className="size-4" /></span>
                  <div className="min-w-0 flex-1"><div className="truncate font-medium">{a.title}</div><div className="text-xs text-muted-foreground">Due {fmtDateTime(a.due_at)}{a.assignee_ids.length ? ` · ${a.assignee_ids.length} selected student${a.assignee_ids.length > 1 ? 's' : ''}` : ''}</div></div>
                  {a.max_points ? <span className="hidden text-xs text-muted-foreground sm:block">{a.max_points} pts</span> : null}{st ? <Badge tone={STATUS_TONE[st]}>{st === 'assigned' ? `Due ${fmtDate(a.due_at)}` : STATUS_LABEL[st]}</Badge> : <span className="text-xs text-muted-foreground">{done}/{target} submitted</span>}
                </Link>
              );
            })}
            {!myAsg.length && <p className="p-8 text-center text-sm text-muted-foreground">No assignments yet.</p>}
          </div>
        </TabsContent>

        <TabsContent value="feedback" className="space-y-3">
          {classFb.map((f) => {
            const s = classSubs.find((x) => x.id === f.submission_id)!; const a = asg.find((x) => x.id === s.assignment_id);
            if (!teacher && !['returned', 'completed'].includes(s.status)) return null;
            return (
              <div key={f.id} className="rounded-2xl border border-border bg-card p-5">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-sm"><Link to={`/app/assignments/${a?.id}`} className="font-medium hover:underline">{a?.title}</Link>{teacher && <span className="text-xs text-muted-foreground">· {app.profile(s.student_id)?.full_name}</span>}<span className="text-xs text-muted-foreground">· {timeAgo(f.created_at)}</span>{f.points != null && <Badge className="ml-auto" tone="sage">{f.points}{a?.max_points ? ` / ${a.max_points}` : ''}</Badge>}</div>
                <Html html={f.body_html} />{f.audio_path && <div className="mt-2"><AudioChip bucket="audio" path={f.audio_path} label="Audio feedback" /></div>}
              </div>
            );
          })}
          {!classFb.length && <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Feedback on assignments appears here.</div>}
        </TabsContent>

        <TabsContent value="calendar">
          {teacher && <Button className="mb-4" onClick={() => setNewEvent(true)}><Plus /> Schedule class session</Button>}
          <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {events.map((e) => (
              <div key={e.id} className={cn('flex items-center gap-3 p-4', new Date(e.ends_at) < new Date() && 'opacity-60')}>
                <div className="flex h-11 w-11 flex-col items-center justify-center rounded-xl text-charcoal" style={{ background: e.color }}><span className="text-[9px] font-semibold uppercase">{new Date(e.starts_at).toLocaleDateString('en-GB', { month: 'short' })}</span><span className="font-bold leading-none">{new Date(e.starts_at).getDate()}</span></div>
                <div className="flex-1"><div className="font-medium">{e.title}</div><div className="text-xs text-muted-foreground">{fmtDate(e.starts_at)} · {fmtTime(e.starts_at)}–{fmtTime(e.ends_at)}</div>{e.notes && <div className="mt-0.5 text-xs text-muted-foreground">{e.notes}</div>}</div>
                {teacher && <button aria-label="Delete session" className="text-muted-foreground hover:text-red-600" onClick={() => db.remove('calendar_events', e.id)}><Trash2 className="size-4" /></button>}
              </div>
            ))}
            {!events.length && <p className="p-8 text-center text-sm text-muted-foreground">No sessions scheduled.</p>}
          </div>
        </TabsContent>

        <TabsContent value="people">
          {teacher ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2"><Button onClick={() => setInvite(true)}><UserPlus /> Invite students</Button></div>
              <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                {members.map((m) => {
                  const p = app.profile(m.user_id);
                  const mySubs = classSubs.filter((s) => s.student_id === m.user_id);
                  return (
                    <div key={m.id} className="flex flex-wrap items-center gap-3 p-4">
                      <Avatar name={p?.full_name || 'Student'} color={p?.avatar_color} size={36} />
                      <div className="min-w-[160px] flex-1"><div className="text-sm font-medium">{p?.full_name || 'Student'}</div><div className="text-xs text-muted-foreground">{p?.email} · {mySubs.filter((s) => s.status !== 'in_progress').length}/{asg.length} submitted</div></div>
                      <div className="flex w-56 items-center gap-2"><input type="range" aria-label={`Progress for ${p?.full_name}`} min={0} max={100} step={5} defaultValue={m.progress} className="flex-1 accent-primary" onPointerUp={(e) => db.update('classroom_members', m.id, { progress: +(e.target as HTMLInputElement).value })} onKeyUp={(e) => db.update('classroom_members', m.id, { progress: +(e.target as HTMLInputElement).value })} /><span className="w-9 text-right text-xs tabular-nums">{m.progress}%</span></div>
                      <button aria-label="Remove from classroom" className="text-muted-foreground hover:text-red-600" onClick={async () => { if (await ask.confirm('Remove student?', `${p?.full_name || 'This student'} will lose access to this classroom’s materials.`, 'Remove')) db.remove('classroom_members', m.id); }}><Trash2 className="size-4" /></button>
                    </div>
                  );
                })}
                {!members.length && <p className="p-8 text-center text-sm text-muted-foreground">No students yet — invite them with a link, email or the class code.</p>}
              </div>
              {invites.filter((i) => !i.accepted).length > 0 && <div className="rounded-2xl border border-border bg-card p-4"><div className="mb-2 text-sm font-semibold">Pending invitations</div>{invites.filter((i) => !i.accepted).map((i) => <div key={i.id} className="flex items-center gap-2 py-1.5 text-sm"><Mail className="size-4 text-lavender-deep" /><span className="flex-1">{i.email}</span><span className="text-xs text-muted-foreground">{timeAgo(i.created_at)}</span><button aria-label="Cancel invitation" onClick={() => db.remove('invitations', i.id)}><Trash2 className="size-4 text-muted-foreground" /></button></div>)}</div>}
            </div>
          ) : (
            <div className="max-w-xl rounded-2xl border border-border bg-card p-6">
              <div className="mb-2 flex items-center gap-2 font-semibold"><BarChart3 className="size-4 text-lavender-deep" /> Your progress</div>
              <Progress value={me?.progress || 0} className="h-3" /><div className="mt-2 text-sm text-muted-foreground">{me?.progress || 0}% · {classSubs.filter((s) => s.status !== 'in_progress').length} of {myAsg.length} assignments submitted</div>
              <Button variant="ghost" className="mt-4 text-red-600" onClick={async () => { if (me && (await ask.confirm('Leave classroom?', 'You’ll lose access to its materials. Your own notes are kept.', 'Leave'))) { await db.remove('classroom_members', me.id); nav('/app/classes'); } }}><Archive /> Leave classroom</Button>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ResourcePicker open={pick} onOpenChange={setPick} onPick={sharePicked} title="Share with this class" mineOnly />
      {newAsg && <AssignmentDialog classroomId={c.id} onClose={() => setNewAsg(false)} />}
      {newEvent && <EventDialog initial={{ kind: 'class', classroom_id: c.id, title: `${c.name} session`, color: c.cover_color }} onClose={() => setNewEvent(false)} />}
      {edit && <ClassroomDialog initial={c} onClose={() => setEdit(false)} />}
      {invite && <InviteDialog c={c} onClose={() => setInvite(false)} />}
    </div>
  );
}

function InviteDialog({ c, onClose }: { c: Classroom; onClose: () => void }) {
  const app = useApp();
  const [email, setEmail] = useState('');
  const [link, setLink] = useState('');
  const [err, setErr] = useState('');
  const base = import.meta.env.VITE_HASH_ROUTER === 'true' ? `${location.origin}${location.pathname}#` : location.origin;
  const create = async () => {
    setErr('');
    const e = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(e)) return setErr('Enter a valid email address.');
    const token = Array.from(crypto.getRandomValues(new Uint8Array(20))).map((b) => b.toString(16).padStart(2, '0')).join('');
    await db.insert('invitations', { classroom_id: c.id, email: e, token, created_by: app.user.id, accepted: false });
    setLink(`${base}/invite/${token}`);
  };
  const mail = `mailto:${email}?subject=${encodeURIComponent(`Join ${c.name} on Notevia`)}&body=${encodeURIComponent(`Hello,\n\nYou're invited to join "${c.name}" on Notevia.\n\nJoin with this private link:\n${link}\n\nOr sign up and enter the class code: ${c.join_code}\n\n${app.user.full_name}`)}`;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="lg">
        <DialogHeader><DialogTitle>Invite students to {c.name}</DialogTitle><DialogDescription>Choose any method. Only people you invite — or who have the code — can join.</DialogDescription></DialogHeader>
        <DialogBody className="space-y-5">
          <div className="rounded-xl bg-muted p-4">
            <div className="text-xs font-medium text-muted-foreground">1 · Classroom code</div>
            <div className="mt-1 flex items-center gap-3"><span className="font-mono text-2xl font-bold tracking-[.3em]">{c.join_code}</span>
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard?.writeText(c.join_code); app.toast('Code copied'); }}><Copy /> Copy</Button>
              <Button size="sm" variant="ghost" onClick={async () => { if (await ask.confirm('Generate a new code?', 'The old code will stop working. Existing members are not affected.', 'Generate', false)) await db.update('classrooms', c.id, { join_code: code() }); }}><RefreshCw /> New code</Button></div>
            <p className="mt-1 text-xs text-muted-foreground">Students enter it under My Classes → Join with code, or when they sign up.</p>
          </div>
          <div>
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">2 · Personal invitation link (single use, tied to an email)</div>
            <div className="flex gap-2"><Input type="email" placeholder="student@example.com" value={email} onChange={(e) => { setEmail(e.target.value); setLink(''); }} /><Button onClick={create}>Create link</Button></div>
            {err && <p className="mt-1 text-sm text-red-600">{err}</p>}
            {link && <div className="mt-3 space-y-2">
              <div className="flex gap-2"><Input readOnly value={link} onFocus={(e) => e.target.select()} /><Button variant="outline" onClick={() => { navigator.clipboard?.writeText(link); app.toast('Link copied'); }}><Copy /></Button></div>
              <Button asChild variant="secondary" className="w-full"><a href={mail}><Mail /> 3 · Send by email (opens your mail app)</a></Button>
              <p className="text-xs text-muted-foreground">Automatic invitation emails need an email provider configured on the server (Phase 2).</p>
            </div>}
          </div>
        </DialogBody>
        <DialogFooter><Button onClick={onClose}>Done</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
