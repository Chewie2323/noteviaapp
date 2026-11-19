import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { NotebookPen, Upload, FolderPlus, GraduationCap, Link2, PenLine, ArrowRight, CalendarClock, ClipboardCheck, Activity, KeyRound } from 'lucide-react';
import { useApp, ask } from '@/lib/app';
import { useLocalState, useTable } from '@/lib/hooks';
import { db } from '@/lib/backend';
import type { Flashcard, ActivityLog, Assignment, CalendarEvent, Classroom, DocumentRow, Folder, Notebook, RecentItem, ResourceLink, Submission } from '@/lib/types';
import { createFolder, createNotebook, createWhiteboard } from '@/lib/actions';
import { DocCard, FolderCard, NotebookCard } from '@/components/Cards';
import { Empty, ViewToggle } from '@/components/common';
import { NewNotebookDialog } from '@/components/NewNotebookDialog';
import { JoinClassDialog } from './Classes';
import { Badge } from '@/components/ui/badge';
import { cn, fmtDate, fmtTime, greeting, firstName, timeAgo } from '@/lib/utils';
import { submissionStatus, STATUS_TONE, STATUS_LABEL } from './Assignments';

export default function Home() {
  const app = useApp();
  const nav = useNavigate();
  const [view, setView] = useLocalState<'grid' | 'list'>('nv-home-view', 'grid');
  const [newNb, setNewNb] = useState(false);
  const [join, setJoin] = useState(false);
  const { rows: docs } = useTable<DocumentRow>('documents', undefined, { col: 'updated_at' });
  const { rows: nbs } = useTable<Notebook>('notebooks', undefined, { col: 'updated_at' });
  const { rows: folders } = useTable<Folder>('folders', { parent_id: null, kind: 'documents' }, { col: 'created_at', asc: true });
  const { rows: recent } = useTable<RecentItem>('recent_items', { user_id: app.user.id }, { col: 'opened_at' });
  const { rows: assignments } = useTable<Assignment>('assignments', undefined, { col: 'due_at', asc: true });
  const { rows: subs } = useTable<Submission>('submissions');
  const { rows: events } = useTable<CalendarEvent>('calendar_events', undefined, { col: 'starts_at', asc: true });
  const { rows: classes } = useTable<Classroom>('classrooms');
  const { rows: links } = useTable<ResourceLink>('resource_links');
  const { rows: myCards } = useTable<Flashcard>('flashcards', { owner_id: app.user.id });
  const { rows: activity } = useTable<ActivityLog>('activity_logs', undefined, { col: 'created_at' });

  const visDocs = docs.filter((d) => !d.deleted_at && app.can('document', d));
  const visNbs = nbs.filter((n) => !n.deleted_at && app.can('notebook', n));
  const recentDocs = useMemo(() => {
    const ids = recent.filter((r) => r.resource_type === 'document').map((r) => r.resource_id);
    const byRecent = ids.map((id) => visDocs.find((d) => d.id === id)).filter(Boolean) as DocumentRow[];
    return [...byRecent, ...visDocs.filter((d) => !ids.includes(d.id))].slice(0, view === 'grid' ? 4 : 6);
  }, [recent, visDocs, view]);
  const recentNbs = visNbs.slice(0, view === 'grid' ? 4 : 6);
  const myFolders = folders.filter((f) => !f.deleted_at && f.owner_id === app.user.id).slice(0, 8);
  const isTeacher = app.user.role === 'educator';
  const upcomingAsg = assignments.filter((a) => app.classIds.has(a.classroom_id) && (isTeacher ? true : !a.assignee_ids.length || a.assignee_ids.includes(app.user.id)) && new Date(a.due_at).getTime() > Date.now() - 86400000 * 3).slice(0, 5);
  const sharedLinks = links.filter((l) => l.owner_id !== app.user.id && app.can('link', l)).slice(0, 4);
  const sharedDocs = visDocs.filter((d) => d.owner_id !== app.user.id).slice(0, 4);
  const upcomingClasses = events.filter((e) => (e.kind === 'class' || e.kind === 'meeting') && new Date(e.ends_at) > new Date() && (e.owner_id === app.user.id || (e.classroom_id && app.classIds.has(e.classroom_id)))).slice(0, 4);
  const mySubs = subs.filter((x) => x.student_id === app.user.id);
  const subFor = (aid: string) => mySubs.find((x) => x.assignment_id === aid);
  const dueNow = assignments.filter((a) => app.classIds.has(a.classroom_id) && (!a.assignee_ids.length || a.assignee_ids.includes(app.user.id)) && ['in_progress', undefined].includes(subFor(a.id)?.status as any))
    .sort((a, b) => +new Date(a.due_at) - +new Date(b.due_at)).slice(0, 4);
  const returned = mySubs.filter((x) => x.status === 'returned' || x.status === 'completed').sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at)).slice(0, 3)
    .map((x) => ({ x, a: assignments.find((a) => a.id === x.assignment_id) })).filter((r) => r.a);
  const nextUp = events.filter((e) => new Date(e.ends_at) > new Date() && new Date(e.starts_at).getTime() < Date.now() + 86400000 * 2 && (e.owner_id === app.user.id || (e.classroom_id && app.classIds.has(e.classroom_id)))).slice(0, 3);
  const cardsDue = myCards.filter((c) => new Date(c.due_at).getTime() <= Date.now()).length;
  const feed = activity.filter((a) => a.actor_id === app.user.id || (a.classroom_id && app.classIds.has(a.classroom_id))).slice(0, 8);

  const myClassCount = classes.filter((c) => app.classIds.has(c.id)).length;
  const asgIds = new Set(assignments.filter((a) => app.classIds.has(a.classroom_id)).map((a) => a.id));
  const toReview = subs.filter((x) => x.status === 'submitted' && asgIds.has(x.assignment_id)).length;
  const stats = [
    { label: 'Notebooks', value: visNbs.length, bg: '#E4DDFB', to: '/app/notebooks' },
    { label: 'Documents', value: visDocs.length, bg: '#D6E7F8', to: '/app/documents' },
    { label: 'Classrooms', value: myClassCount, bg: '#D5ECE3', to: '/app/classes' },
    isTeacher ? { label: 'To review', value: toReview, bg: '#FDE3D6', to: '/app/assignments' } : { label: 'Due soon', value: upcomingAsg.length, bg: '#FDE3D6', to: '/app/assignments' },
  ];

  const actions = [
    { label: 'New Notebook', icon: NotebookPen, bg: '#E4DDFB', on: () => setNewNb(true) },
    { label: 'Upload Document', icon: Upload, bg: '#D6E7F8', on: () => nav('/app/documents?upload=1') },
    { label: 'Create Folder', icon: FolderPlus, bg: '#FDE3D6', on: async () => { const n = await ask.prompt('New folder', '', 'Folder name', 'Create'); if (n) { const f = await createFolder(app.user, n, null); app.toast('Folder created'); nav(`/app/documents?folder=${f.id}`); } } },
    isTeacher ? { label: 'Create Classroom', icon: GraduationCap, bg: '#D5ECE3', on: () => nav('/app/classes?new=1') } : { label: 'Join Classroom', icon: KeyRound, bg: '#D5ECE3', on: () => setJoin(true) },
    { label: 'Add Resource Link', icon: Link2, bg: '#F9D9E6', on: () => nav('/app/resources?new=1') },
    { label: 'Open Whiteboard', icon: PenLine, bg: '#DCD2EF', on: async () => { const w = await createWhiteboard(app.user); nav(`/app/whiteboards/${w.id}`); } },
  ];
  const grid = view === 'grid' ? 'grid grid-cols-2 gap-3 md:grid-cols-4' : 'divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card';

  return (
    <div className="animate-fade-up space-y-8">
      <section className="relative overflow-hidden rounded-[26px] border border-border bg-card p-6 shadow-soft sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-lilac/80 blur-2xl dark:bg-lavender/10" />
        <div className="pointer-events-none absolute -bottom-24 right-40 h-56 w-56 rounded-full bg-sage/50 blur-2xl dark:bg-sage/5" />
        <div className="relative">
          <h1 className="text-3xl font-bold tracking-tight">{greeting()}{firstName(app.user.full_name) ? `, ${firstName(app.user.full_name)}` : ''}!</h1>
          <p className="mt-1 text-muted-foreground">What would you like to create today?</p>
          <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
            {actions.map((a) => (
              <button key={a.label} onClick={a.on} className="group flex flex-col items-start gap-3 rounded-2xl border border-border bg-background/70 p-4 text-left transition hover:-translate-y-0.5 hover:bg-card hover:shadow-lift">
                <span className="grid h-10 w-10 place-items-center rounded-xl text-charcoal" style={{ background: a.bg }}><a.icon className="size-[18px]" /></span>
                <span className="text-[13px] font-medium leading-tight">{a.label}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {!isTeacher && (
        <section aria-label="Today" className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-4">
          <TodayCard title="Due" tone="#FDE3D6" to="/app/assignments" empty="Nothing due — nice.">
            {dueNow.map((a) => { const late = new Date(a.due_at) < new Date(); return <div key={a.id} className="flex justify-between gap-2 text-sm"><Link to={`/app/assignments/${a.id}`} className="truncate hover:underline">{a.title}</Link><span className={cn('shrink-0 text-xs', late ? 'font-medium text-red-700' : 'text-charcoal/70')}>{late ? 'Overdue' : fmtDate(a.due_at)}</span></div>; })}
          </TodayCard>
          <TodayCard title="Next up" tone="#D6E7F8" to="/app/calendar" empty="No events in the next two days.">
            {nextUp.map((e) => <div key={e.id} className="flex justify-between gap-2 text-sm"><span className="truncate">{e.title}</span><span className="shrink-0 text-xs text-charcoal/70">{fmtDate(e.starts_at)} {e.all_day ? '' : fmtTime(e.starts_at)}</span></div>)}
          </TodayCard>
          <TodayCard title="Returned" tone="#D5ECE3" to="/app/assignments" empty="No marked work yet.">
            {returned.map(({ x, a }) => <div key={x.id} className="flex justify-between gap-2 text-sm"><Link to={`/app/assignments/${a!.id}`} className="truncate hover:underline">{a!.title}</Link><span className="shrink-0 text-xs text-charcoal/70">{STATUS_LABEL[x.status]}</span></div>)}
          </TodayCard>
          <TodayCard title="Study" tone="#E4DDFB" to="/app/study" empty="No cards yet — make a deck from your notes.">
            {myCards.length > 0 && <div><div className="text-3xl font-bold">{cardsDue}</div><div className="text-xs text-charcoal/70">card{cardsDue === 1 ? '' : 's'} to review today</div></div>}
          </TodayCard>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {stats.map((x) => (
          <Link key={x.label} to={x.to} className="rounded-2xl p-4 text-charcoal transition hover:-translate-y-0.5 hover:shadow-soft" style={{ background: x.bg }}>
            <div className="text-[28px] font-bold leading-none">{x.value}</div>
            <div className="mt-1.5 text-sm">{x.label}</div>
          </Link>
        ))}
      </div>

      <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Your work</h2><ViewToggle value={view} onChange={setView} /></div>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-8">
          <Section title="Recent documents" to="/app/documents">
            {recentDocs.length ? <div className={grid}>{recentDocs.map((d) => <DocCard key={d.id} d={d} view={view} fav={app.isFav('document', d.id)} />)}</div>
              : <Empty className="rounded-2xl border border-dashed border-border py-8" icon={<Upload />} title="No documents yet" body="Upload PDFs, slides, spreadsheets, images, audio or video." />}
          </Section>
          <Section title="Recent notebooks" to="/app/notebooks">
            {recentNbs.length ? <div className={grid}>{recentNbs.map((n) => <NotebookCard key={n.id} n={n} view={view} sub={n.owner_id !== app.user.id ? `From ${app.profile(n.owner_id)?.full_name || 'a collaborator'}` : undefined} />)}</div>
              : <Empty className="rounded-2xl border border-dashed border-border py-8" icon={<NotebookPen />} title="No notebooks yet" />}
          </Section>
          <Section title="My folders" to="/app/documents">
            {myFolders.length ? <div className={view === 'grid' ? 'grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-8' : grid}>{myFolders.map((f) => <FolderCard key={f.id} f={f} view={view} onOpen={() => nav(`/app/documents?folder=${f.id}`)} />)}</div>
              : <p className="text-sm text-muted-foreground">Create folders for any subject, project or client.</p>}
          </Section>
          {(sharedDocs.length > 0 || sharedLinks.length > 0) && (
            <Section title="Shared resources" to="/app/shared">
              <div className={grid}>
                {sharedDocs.map((d) => <DocCard key={d.id} d={d} view={view} />)}
                {sharedLinks.map((l) => view === 'grid'
                  ? <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer" className="rounded-2xl border border-border bg-card p-4 shadow-soft transition hover:shadow-lift"><Badge tone="sage">{l.provider}</Badge><div className="mt-2 line-clamp-2 text-[13px] font-medium">{l.title}</div><div className="mt-1 text-[11px] text-muted-foreground">from {app.profile(l.owner_id)?.full_name || 'your educator'}</div></a>
                  : <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50"><Link2 className="size-4 text-lavender-deep" /><span className="flex-1 truncate text-sm">{l.title}</span><Badge tone="sage">{l.provider}</Badge></a>)}
              </div>
            </Section>
          )}
        </div>

        <div className="space-y-8">
          <Section title="Upcoming assignments" to="/app/assignments">
            <div className="rounded-2xl border border-border bg-card p-2">
              {upcomingAsg.map((a) => {
                const c = classes.find((x) => x.id === a.classroom_id);
                const st = isTeacher ? null : submissionStatus(a, subs.find((s) => s.assignment_id === a.id && s.student_id === app.user.id));
                const pending = isTeacher ? subs.filter((s) => s.assignment_id === a.id && s.status === 'submitted').length : 0;
                return (
                  <Link key={a.id} to={`/app/assignments/${a.id}`} className="flex items-center gap-3 rounded-xl p-2.5 hover:bg-muted">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: c?.cover_color || '#E4DDFB' }}><ClipboardCheck className="size-4 text-charcoal" /></span>
                    <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{a.title}</div><div className="truncate text-[11px] text-muted-foreground">{c?.name} · due {fmtDate(a.due_at)}</div></div>
                    {st ? <Badge tone={STATUS_TONE[st]}>{STATUS_LABEL[st]}</Badge> : pending > 0 && <Badge tone="pink">{pending} to review</Badge>}
                  </Link>
                );
              })}
              {!upcomingAsg.length && <p className="p-4 text-center text-sm text-muted-foreground">Nothing due soon.</p>}
            </div>
          </Section>
          <Section title="Upcoming classes" to="/app/calendar">
            <div className="rounded-2xl border border-border bg-card p-2">
              {upcomingClasses.map((e) => (
                <Link key={e.id} to={e.classroom_id ? `/app/classes/${e.classroom_id}` : '/app/calendar'} className="flex items-center gap-3 rounded-xl p-2.5 hover:bg-muted">
                  <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl text-charcoal" style={{ background: e.color }}><span className="text-[9px] font-semibold uppercase">{new Date(e.starts_at).toLocaleDateString('en-GB', { month: 'short' })}</span><span className="text-base font-bold leading-none">{new Date(e.starts_at).getDate()}</span></div>
                  <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{e.title}</div><div className="text-[11px] text-muted-foreground">{fmtDate(e.starts_at)} · {fmtTime(e.starts_at)}–{fmtTime(e.ends_at)}</div></div>
                </Link>
              ))}
              {!upcomingClasses.length && <div className="flex flex-col items-center gap-2 p-5 text-center text-sm text-muted-foreground"><CalendarClock className="size-5 text-lavender-deep" />No classes scheduled.</div>}
            </div>
          </Section>
          <Section title="Recent activity">
            <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
              {feed.map((a) => (
                <div key={a.id} className="flex gap-3 text-sm">
                  <span className="mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-secondary"><Activity className="size-3 text-lavender-ink" /></span>
                  <div className="min-w-0"><span className="font-medium">{a.actor_id === app.user.id ? 'You' : app.profile(a.actor_id)?.full_name || 'Someone'}</span> {a.action} <span className="font-medium">{a.resource_name}</span><div className="text-[11px] text-muted-foreground">{timeAgo(a.created_at)}</div></div>
                </div>
              ))}
              {!feed.length && <p className="text-center text-sm text-muted-foreground">Your activity will appear here.</p>}
            </div>
          </Section>
        </div>
      </div>

      <NewNotebookDialog open={newNb} onOpenChange={setNewNb} onCreate={async (v) => { const n = await createNotebook(app.user, v); app.log('created', 'notebook', n.id, n.title); nav(`/app/notebooks/${n.id}`); }} />
      <JoinClassDialog open={join} onOpenChange={setJoin} />
    </div>
  );
}

export function Section({ title, to, children, action }: { title: string; to?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-2"><h3 className="font-semibold">{title}</h3>
        <div className="flex items-center gap-2">{action}{to && <Link to={to} className={cn('inline-flex items-center gap-1 text-xs font-medium text-lavender-ink transition-all hover:gap-1.5 dark:text-lavender')}>View all <ArrowRight className="size-3.5" /></Link>}</div></div>
      {children}
    </section>
  );
}

function TodayCard({ title, tone, to, empty, children }: { title: string; tone: string; to: string; empty: string; children?: React.ReactNode }) {
  const items = (Array.isArray(children) ? children : [children]).filter(Boolean).flat();
  return (
    <div className="flex min-h-[132px] flex-col rounded-2xl p-4 text-charcoal" style={{ background: tone }}>
      <Link to={to} className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide">{title}<ArrowRight className="size-3.5" /></Link>
      {items.length ? <div className="space-y-1.5">{items}</div> : <p className="text-sm text-charcoal/70">{empty}</p>}
    </div>
  );
}
