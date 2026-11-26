import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Home, LayoutGrid, NotebookPen, FileText, GraduationCap, Link2, ClipboardCheck, Users, CalendarDays, Star, Download, Trash2, Settings,
  Search, Bell, PenTool, Layers, HelpCircle, Moon, Sun, ChevronsLeft, ChevronsRight, Menu, LogOut, UserRound, ShieldCheck, X, Plus, PenLine, Keyboard, BookOpen, Mail,
} from 'lucide-react';
import { useApp } from '@/lib/app';
import { auth, db, MODE } from '@/lib/backend';
import { useTable, useLocalState, useMediaQuery } from '@/lib/hooks';
import type { DocumentRow, Notebook, Notification, ResourceLink, Classroom, Profile } from '@/lib/types';
import { Avatar, FileBadge, Lockup, Mark } from './common';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger, Tooltip } from '@/components/ui/misc';
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/misc';
import { Button } from '@/components/ui/button';
import { cn, timeAgo } from '@/lib/utils';
import { SUPPORT_EMAIL } from '@/lib/config';
import { joinByCode } from '@/lib/actions';

export const NAV = [
  { to: '/app', label: 'Home', icon: Home, end: true },
  { to: '/app/workspace', label: 'My Workspace', icon: LayoutGrid },
  { to: '/app/notebooks', label: 'My Notebooks', icon: NotebookPen },
  { to: '/app/whiteboards', label: 'Whiteboards', icon: PenTool },
  { to: '/app/documents', label: 'Documents', icon: FileText },
  { to: '/app/classes', label: 'My Classes', icon: GraduationCap },
  { to: '/app/resources', label: 'Learning Resources', icon: Link2 },
  { to: '/app/assignments', label: 'Assignments', icon: ClipboardCheck },
  { to: '/app/shared', label: 'Shared with Me', icon: Users },
  { to: '/app/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/app/study', label: 'Study', icon: Layers },
  { to: '/app/favourites', label: 'Favourites', icon: Star },
  { to: '/app/downloads', label: 'Downloads', icon: Download },
  { to: '/app/bin', label: 'Recycle Bin', icon: Trash2 },
  { to: '/app/settings', label: 'Settings', icon: Settings },
];
const ROLE_LABEL: Record<Profile['role'], string> = { educator: 'Educator', student: 'Student', individual: 'Individual', admin: 'Administrator' };

export function Layout() {
  const app = useApp();
  const loc = useLocation();
  const [collapsed, setCollapsed] = useLocalState('nv-sidebar-collapsed', false);
  const [drawer, setDrawer] = useState(false);
  const [help, setHelp] = useState(false);
  useEffect(() => setDrawer(false), [loc.pathname]);
  const navTo = useNavigate();
  useEffect(() => {
    let code = ''; try { code = localStorage.getItem('nv-pending-code') || ''; } catch {}
    if (!code) return;
    try { localStorage.removeItem('nv-pending-code'); } catch {}
    joinByCode(app.user, code).then((cid) => { app.toast('You’ve joined the classroom'); navTo(`/app/classes/${cid}`); }).catch(() => {});
  }, [app.user.id]);
  const { rows: ps } = useTable<any>('platform_settings');
  const notice = ps[0]?.notice as string | undefined;
  const isSplit = /^\/app\/split/.test(loc.pathname);
  const immersive = /^\/app\/(notebooks|whiteboards|pdf|pages)\/[^/]+|^\/app\/split/.test(loc.pathname);

  const Side = ({ mini }: { mini: boolean }) => (
    <div className="flex h-full flex-col">
      <Link to="/app" className={cn('flex h-16 items-center px-4', mini && 'justify-center px-0')} aria-label="Notevia home"><Lockup compact={mini} size={30} /></Link>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2" aria-label="Main">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} title={mini ? n.label : undefined}
            className={({ isActive }) => cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition', mini && 'justify-center px-0',
              isActive ? 'bg-secondary font-medium text-[#4E3F80] dark:text-lavender' : 'text-foreground/65 hover:bg-muted hover:text-foreground')}>
            <n.icon className="size-[18px] shrink-0" strokeWidth={1.8} />{!mini && <span className="truncate">{n.label}</span>}
          </NavLink>
        ))}
        {app.user.role === 'admin' && (
          <NavLink to="/app/admin" title={mini ? 'Administration' : undefined} className={({ isActive }) => cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm', mini && 'justify-center px-0', isActive ? 'bg-secondary font-medium' : 'text-foreground/65 hover:bg-muted')}>
            <ShieldCheck className="size-[18px]" strokeWidth={1.8} />{!mini && 'Administration'}
          </NavLink>
        )}
      </nav>
      <div className="border-t border-border p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn('flex w-full items-center gap-2.5 rounded-xl p-2 text-left hover:bg-muted', mini && 'justify-center')} aria-label="Account menu">
              <Avatar name={app.user.full_name} color={app.user.avatar_color} size={32} />
              {!mini && <div className="min-w-0 flex-1 leading-tight"><div className="truncate text-sm font-medium">{app.user.full_name}</div><div className="truncate text-[11px] text-muted-foreground">{ROLE_LABEL[app.user.role]} · {app.user.email}</div></div>}
            </button>
          </DropdownMenuTrigger>
          <AccountMenu side="top" />
        </DropdownMenu>
        <button onClick={() => setCollapsed(!collapsed)} className="mt-1 hidden h-9 w-full items-center justify-center gap-2 rounded-lg text-xs text-muted-foreground hover:text-foreground lg:flex" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {collapsed ? <ChevronsRight className="size-4" /> : <><ChevronsLeft className="size-4" /> Collapse</>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-background text-foreground">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[300] focus:rounded-lg focus:bg-card focus:px-3 focus:py-2">Skip to content</a>
      <aside className={cn('hidden shrink-0 border-r border-border bg-card transition-[width] duration-200', isSplit ? 'md:block' : 'lg:block', collapsed || (isSplit && !window.matchMedia?.('(min-width:1024px)').matches) ? 'w-[76px]' : 'w-[252px]')}><Side mini={collapsed || (isSplit && !window.matchMedia?.('(min-width:1024px)').matches)} /></aside>
      {drawer && (
        <div className="fixed inset-0 z-[80] bg-charcoal/30 lg:hidden" onClick={() => setDrawer(false)}>
          <aside className="h-full w-[272px] animate-fade-up bg-card shadow-lift" onClick={(e) => e.stopPropagation()}><Side mini={false} /></aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        {!immersive && <Topbar onMenu={() => setDrawer(true)} onHelp={() => setHelp(true)} />}
        {notice && !immersive && <div className="mx-4 mb-1 rounded-xl bg-peach/70 px-3 py-1.5 text-[12px] text-charcoal sm:mx-6" role="status">{notice}</div>}
        {MODE === 'demo' && !immersive && (
          <div className="mx-4 mb-1 flex items-center gap-2 rounded-xl bg-secondary/70 px-3 py-1.5 text-[11px] text-[#4E3F80] sm:mx-6 dark:text-lavender">
            <b className="shrink-0">Demo mode</b><span className="truncate">Data stays in this browser<span className="hidden md:inline"> · connect Supabase for accounts, cloud storage and sharing between people</span>.</span>
          </div>
        )}
        <main id="main" className={cn('min-h-0 flex-1', immersive ? 'overflow-hidden' : 'overflow-y-auto pb-20 lg:pb-0')}>
          {immersive ? <Outlet /> : <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6"><Outlet /></div>}
        </main>
        {!immersive && <MobileNav onMore={() => setDrawer(true)} />}
        {immersive && <button className={cn('fixed bottom-3 left-3 z-30 grid h-10 w-10 place-items-center rounded-full bg-card shadow-lift lg:hidden', isSplit && 'md:hidden')} onClick={() => setDrawer(true)} aria-label="Open navigation"><Menu className="size-4" /></button>}
      </div>
      <HelpCentre open={help} onOpenChange={setHelp} />
    </div>
  );
}

function AccountMenu({ side = 'bottom' }: { side?: 'top' | 'bottom' }) {
  const app = useApp();
  const nav = useNavigate();
  return (
    <DropdownMenuContent side={side} align={side === 'top' ? 'start' : 'end'} className="w-60">
      <DropdownMenuLabel>{app.user.full_name}</DropdownMenuLabel>
      <DropdownMenuItem onSelect={() => nav('/app/settings')}><UserRound /> Profile & account</DropdownMenuItem>
      <DropdownMenuItem onSelect={() => nav('/app/settings?tab=privacy')}><ShieldCheck /> Privacy & data</DropdownMenuItem>
      {MODE === 'demo' && <>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Demo: switch account</DropdownMenuLabel>
        <DemoSwitch />
      </>}
      <DropdownMenuSeparator />
      <DropdownMenuItem destructive onSelect={async () => { await auth.signOut(); nav('/'); }}><LogOut /> Sign out</DropdownMenuItem>
    </DropdownMenuContent>
  );
}
function DemoSwitch() {
  const [ps, setPs] = useState<Profile[]>([]);
  const nav = useNavigate();
  useEffect(() => { db.list<Profile>('profiles').then((r) => setPs(r.filter((p) => p.email.endsWith('@notevia.demo')))); }, []);
  return <>{ps.map((p) => <DropdownMenuItem key={p.id} onSelect={async () => { await auth.demoAs(p.id); nav('/app'); }}><Avatar name={p.full_name} color={p.avatar_color} size={20} /> {p.full_name} <span className="ml-auto text-[10px] text-muted-foreground">{ROLE_LABEL[p.role]}</span></DropdownMenuItem>)}</>;
}

function Topbar({ onMenu, onHelp }: { onMenu: () => void; onHelp: () => void }) {
  const app = useApp();
  return (
    <header className="flex h-16 shrink-0 items-center gap-1.5 px-3 sm:gap-2 sm:px-6">
      <button className="grid h-10 w-10 place-items-center rounded-xl hover:bg-muted lg:hidden" onClick={onMenu} aria-label="Open menu"><Menu className="size-5" /></button>
      <Link to="/app" className="lg:hidden" aria-label="Home"><Mark size={28} /></Link>
      <GlobalSearch />
      <div className="hidden flex-1 sm:block" />
      <Tooltip content="Help centre"><Button size="icon" variant="ghost" aria-label="Help centre" onClick={onHelp}><HelpCircle /></Button></Tooltip>
      <Tooltip content={app.dark ? 'Light mode' : 'Dark mode'}><Button size="icon" variant="ghost" aria-label="Toggle dark mode" onClick={() => app.setDark(!app.dark)}>{app.dark ? <Sun /> : <Moon />}</Button></Tooltip>
      <Notifications />
      <DropdownMenu>
        <DropdownMenuTrigger asChild><button className="rounded-full" aria-label="Profile"><Avatar name={app.user.full_name} color={app.user.avatar_color} size={34} /></button></DropdownMenuTrigger>
        <AccountMenu />
      </DropdownMenu>
    </header>
  );
}

function MobileNav({ onMore: _onMore }: { onMore: () => void }) {
  const items = [
    { to: '/app/notes', label: 'Notes', icon: NotebookPen },
    { to: '/app/classes', label: 'Classes', icon: GraduationCap },
    { to: '/app/search', label: 'Search', icon: Search },
    { to: '/app/me', label: 'Me', icon: UserRound },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Mobile">
      {items.map((n) => (
        <NavLink key={n.to} to={n.to} className={({ isActive }) => cn('flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium', isActive ? 'text-[#7C6FD1]' : 'text-muted-foreground')}>
          <n.icon className="size-5" strokeWidth={1.8} />{n.label}
        </NavLink>
      ))}
    </nav>
  );
}

function GlobalSearch() {
  const wide = useMediaQuery("(min-width: 640px)");
  const app = useApp();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { rows: docs } = useTable<DocumentRow>('documents', open ? {} : null);
  const { rows: nbs } = useTable<Notebook>('notebooks', open ? {} : null);
  const { rows: links } = useTable<ResourceLink>('resource_links', open ? {} : null);
  const { rows: classes } = useTable<Classroom>('classrooms', open ? {} : null);
  useEffect(() => {
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); ref.current?.querySelector('input')?.focus(); setOpen(true); } };
    document.addEventListener('mousedown', h); window.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', h); window.removeEventListener('keydown', k); };
  }, []);
  const res = useMemo(() => {
    const s = q.trim().toLowerCase(); if (!s) return [];
    const has = (...v: (string | null | undefined)[]) => v.some((x) => x?.toLowerCase().includes(s));
    const out: { label: string; sub: string; go: string; icon: React.ReactNode }[] = [];
    docs.filter((d) => !d.deleted_at && app.can('document', d) && has(d.name, d.category, ...(d.tags || []))).slice(0, 6)
      .forEach((d) => out.push({ label: d.name, sub: 'Document', go: d.mime_type === 'application/pdf' ? `/app/pdf/${d.id}` : d.mime_type === 'text/x-notevia-page' ? `/app/pages/${d.id}` : `/app/documents?open=${d.id}`, icon: <FileBadge mime={d.mime_type} name={d.name} size={20} /> }));
    nbs.filter((n) => !n.deleted_at && app.can('notebook', n) && has(n.title, ...(n.tags || []))).slice(0, 5)
      .forEach((n) => out.push({ label: n.title, sub: n.kind === 'whiteboard' ? 'Whiteboard' : 'Notebook', go: `/app/${n.kind === 'whiteboard' ? 'whiteboards' : 'notebooks'}/${n.id}`, icon: n.kind === 'whiteboard' ? <PenLine className="size-4 text-lavender-deep" /> : <NotebookPen className="size-4 text-lavender-deep" /> }));
    links.filter((l) => app.can('link', l) && has(l.title, l.description, l.category, ...(l.tags || []))).slice(0, 4).forEach((l) => out.push({ label: l.title, sub: `Resource · ${l.provider}`, go: `/app/resources?q=${encodeURIComponent(l.title)}`, icon: <Link2 className="size-4 text-lavender-deep" /> }));
    classes.filter((c) => app.classIds.has(c.id) && has(c.name, c.subject)).slice(0, 4).forEach((c) => out.push({ label: c.name, sub: `Classroom · ${c.subject}`, go: `/app/classes/${c.id}`, icon: <GraduationCap className="size-4 text-lavender-deep" /> }));
    return out;
  }, [q, docs, nbs, links, classes, app]);
  return (
    <div ref={ref} className="relative min-w-0 max-w-md flex-1" role="search">
      <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} aria-label="Search Notevia"
        placeholder={wide ? "Search notebooks, documents, classes…" : "Search"} className="h-10 w-full rounded-xl border border-border bg-card pl-10 pr-12 text-sm shadow-soft outline-none focus:border-ring focus:ring-2 focus:ring-ring/30" />
      <kbd className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-border px-1.5 text-[10px] text-muted-foreground md:block">⌘K</kbd>
      {open && q && (
        <div className="absolute left-0 right-0 top-12 z-50 max-h-96 animate-fade-up overflow-auto rounded-xl border border-border bg-popover p-1.5 shadow-lift">
          {res.map((r, i) => (
            <button key={i} onClick={() => { nav(r.go); setOpen(false); setQ(''); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-muted">
              <span className="grid w-5 place-items-center">{r.icon}</span><span className="flex-1 truncate text-sm">{r.label}</span><span className="text-[11px] text-muted-foreground">{r.sub}</span>
            </button>
          ))}
          {!res.length && <div className="px-3 py-4 text-sm text-muted-foreground">No results for “{q}”</div>}
        </div>
      )}
    </div>
  );
}

function Notifications() {
  const app = useApp();
  const nav = useNavigate();
  const { rows } = useTable<Notification>('notifications', { user_id: app.user.id });
  const unread = rows.filter((n) => !n.read).length;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="relative grid h-9 w-9 place-items-center rounded-xl hover:bg-muted" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
          <Bell className="size-[18px]" />{unread > 0 && <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-[#D06A8C] px-1 text-[9px] font-semibold text-white">{unread}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] max-w-[92vw] p-0">
        <div className="flex items-center border-b border-border px-4 py-3"><span className="flex-1 text-sm font-semibold">Notifications</span>
          {unread > 0 && <button className="text-xs text-lavender-ink dark:text-lavender" onClick={() => rows.filter((n) => !n.read).forEach((n) => db.update('notifications', n.id, { read: true }))}>Mark all read</button>}</div>
        <div className="max-h-[420px] overflow-auto p-1.5">
          {rows.slice(0, 40).map((n) => (
            <div key={n.id} className="group flex gap-3 rounded-lg px-3 py-2.5 hover:bg-muted">
              <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.read ? 'bg-border' : 'bg-[#D06A8C]')} />
              <button className="min-w-0 flex-1 text-left" onClick={() => { db.update('notifications', n.id, { read: true }); if (n.link) nav(n.link); }}>
                <span className="block text-sm">{n.title}</span>{n.body && <span className="block truncate text-xs text-muted-foreground">{n.body}</span>}<span className="text-[11px] text-muted-foreground">{timeAgo(n.created_at)}</span>
              </button>
              <button aria-label="Dismiss" className="opacity-0 group-hover:opacity-60" onClick={() => db.remove('notifications', n.id)}><X className="size-3.5" /></button>
            </div>
          ))}
          {!rows.length && <p className="py-10 text-center text-sm text-muted-foreground">You’re all caught up.</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}

const SHORTCUTS: [string, string][] = [['P', 'Ballpoint pen'], ['E', 'Eraser'], ['V', 'Select'], ['L', 'Lasso'], ['T', 'Text'], ['H', 'Pan'], ['Ctrl/⌘ Z', 'Undo'], ['Ctrl/⌘ Shift Z', 'Redo'], ['Two-finger tap', 'Undo (touch screens)'], ['Three-finger tap', 'Redo (touch screens)'], ['Ctrl/⌘ D', 'Duplicate'], ['Delete', 'Delete selection'], ['Tab / Enter', 'Mind map: add branch / sibling'], ['← →', 'Previous / next page'], ['Ctrl/⌘ K', 'Search']];
export function HelpCentre({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><BookOpen className="size-5 text-lavender-deep" /> Help centre</DialogTitle></DialogHeader>
        <DialogBody className="space-y-5">
          <Accordion type="single" collapsible defaultValue="start">
            <AccordionItem value="start"><AccordionTrigger>Getting started</AccordionTrigger><AccordionContent>Use <b>New Notebook</b> to write by hand or type, <b>Upload Document</b> to add PDFs, Office files, images, audio or video, and <b>Create Folder</b> to organise everything. Folders can be nested and coloured, and anything can be tagged.</AccordionContent></AccordionItem>
            <AccordionItem value="pen"><AccordionTrigger>Writing with Apple Pencil or a stylus</AccordionTrigger><AccordionContent>Pens respond to pressure where your device reports it. Turn on <b>Stylus-only drawing</b> in Settings for palm rejection: your fingers then scroll and pinch while only the pencil writes.</AccordionContent></AccordionItem>
            <AccordionItem value="pdf"><AccordionTrigger>Annotating PDFs</AccordionTrigger><AccordionContent>Open any PDF to annotate it. Your marks are saved as your own private layer — the original file never changes. Use <b>Highlight text</b> to highlight selected words, the pens to write, and <b>Save / export</b> to download an annotated copy.</AccordionContent></AccordionItem>
            <AccordionItem value="share"><AccordionTrigger>Sharing and permissions</AccordionTrigger><AccordionContent>Everything is private until you share it. Choose <b>View only</b>, <b>Can comment</b> or <b>Can edit</b> for a person or a whole classroom. Sharing a folder shares its contents.</AccordionContent></AccordionItem>
            <AccordionItem value="class"><AccordionTrigger>Classrooms and assignments</AccordionTrigger><AccordionContent>Educators create classrooms and invite students by link, email or class code. Assignments can go to a whole class or chosen students; students submit files or notebooks and receive written or audio feedback and marks.</AccordionContent></AccordionItem>
            <AccordionItem value="office"><AccordionTrigger>Word and PowerPoint files</AccordionTrigger><AccordionContent>Notevia previews DOCX, PPTX and XLSX in the browser. <b>Annotation</b> (drawing on top) works on PDFs; to <b>edit</b> an Office file’s contents, convert a DOCX to an editable Notevia page, or open the original in Microsoft 365 / Google Workspace. Native Office editing is a Phase 2 integration.</AccordionContent></AccordionItem>
          </Accordion>
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Keyboard className="size-4" /> Keyboard shortcuts</div>
            <div className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">{SHORTCUTS.map(([k, v]) => <div key={k} className="flex justify-between gap-3"><span className="text-muted-foreground">{v}</span><kbd className="rounded border border-border px-1.5 text-xs">{k}</kbd></div>)}</div>
          </div>
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Mail className="size-4" /> Still stuck? Email <span className="font-medium text-foreground">{SUPPORT_EMAIL}</span></p>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
