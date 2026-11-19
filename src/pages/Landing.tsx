import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, PenTool, FileText, GraduationCap, Columns2, Sparkles, ShieldCheck, Share2, CalendarDays, NotebookPen, Highlighter,
  Eraser, Undo2, Users, BriefcaseBusiness, BookOpenCheck, Moon, Sun, Check, Lock, Shapes, Folder, Home, Search, Bell,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/misc';
import { FullLogo, Lockup, Mark, FolderArt } from '@/components/common';
import { InkCanvas, DEFAULT_TOOLS, ToolState } from '@/canvas/InkCanvas';
import type { CanvasObject } from '@/lib/types';
import { useTheme } from '@/lib/app';
import { cn, INK } from '@/lib/utils';
import { SUPPORT_EMAIL } from '@/lib/config';

const PREVIEW: CanvasObject[] = [
  { id: 'h', type: 'text', x: 26, y: 22, width: 330, fontSize: 22, color: '#2F2B45', bold: true, text: 'Lecture 4 · Data pipelines' },
  { id: 'k', type: 'text', x: 26, y: 66, width: 300, fontSize: 15, color: '#2F2B45', text: 'Extract → Transform → Load', highlight: '#FFE88A' },
  { id: 'a', type: 'node', x: 40, y: 120, w: 110, h: 40, color: '#E4DDFB', text: 'Sources' },
  { id: 'b', type: 'node', x: 210, y: 120, w: 110, h: 40, color: '#D5ECE3', text: 'Warehouse' },
  { id: 'c', type: 'connector', x: 0, y: 0, from: 'a', to: 'b', stroke: '#6D60C2', size: 2, arrow: true },
  { id: 's', type: 'sticky', x: 230, y: 190, w: 140, h: 92, color: '#FFF2B3', text: 'Try writing here ✍️', rotation: 2 },
];

export default function Landing() {
  const [dark, setDark] = useTheme();
  const [objs, setObjs] = useState<CanvasObject[]>(PREVIEW);
  const [sel, setSel] = useState<string[]>([]);
  const [tools, setTools] = useState<ToolState>({ ...DEFAULT_TOOLS, tool: 'pen', pen: 'fountain' });
  const pen = (pen: ToolState['pen']) => setTools({ ...tools, tool: 'pen', pen });

  const FEATURES = [
    { icon: PenTool, t: 'Natural handwriting', d: 'Ballpoint, fountain pen, pencil and highlighter with pressure sensitivity and palm rejection on iPad and stylus devices.' },
    { icon: FileText, t: 'Annotate any PDF', d: 'Highlight text, write in the margins, add comments, insert pages and export a clean annotated copy — the original stays untouched.' },
    { icon: Folder, t: 'Organised by you', d: 'Workspaces, colour-coded folders, tags and categories for any subject, project or client. Nothing is predefined.' },
    { icon: GraduationCap, t: 'Classrooms that flow', d: 'Invite by link, email or code. Share materials, set assignments, mark work and give audio feedback in one place.' },
    { icon: Columns2, t: 'Split-screen learning', d: 'Open slides beside your notes, a PDF beside a notebook, or a submission beside your feedback — and resize freely.' },
    { icon: Shapes, t: 'Infinite whiteboard', d: 'Mind maps, flowcharts, sticky notes and diagrams on an endless canvas you can share and export.' },
    { icon: Share2, t: 'Granular sharing', d: 'Private, view, comment or edit — for one person or a whole class — with comments, activity and version history.' },
    { icon: CalendarDays, t: 'Plan your time', d: 'Daily, weekly and monthly calendar linking classes, deadlines, meetings and study sessions to your work.' },
    { icon: Sparkles, t: 'Notevia AI (optional)', d: 'Summaries, flashcards, quizzes and explanations — only when switched on, with clear consent and labelled results.' },
  ];
  const BENEFITS = [
    { icon: BookOpenCheck, who: 'Educators', color: '#E4DDFB', points: ['Teach live in full-screen presentation mode', 'One library for lectures, worksheets and links', 'Review, annotate and grade submissions', 'Private classrooms for individuals or groups'] },
    { icon: NotebookPen, who: 'Students', color: '#D5ECE3', points: ['Annotate your own copy of every handout', 'Cornell, revision and assignment templates', 'Track deadlines and feedback in one place', 'Your notes stay private unless you share'] },
    { icon: BriefcaseBusiness, who: 'Professionals', color: '#D6E7F8', points: ['Meeting, project and research templates', 'Mark up contracts, reports and slide decks', 'Whiteboards for workshops and planning', 'Share with clients at exactly the right access level'] },
  ];
  const FAQ = [
    ['Who is Notevia for?', 'Anyone who learns, teaches or thinks on paper — lecturers, teachers, tutors, students, researchers, trainers and professionals. It isn’t tied to any subject or level.'],
    ['Does it work with Apple Pencil?', 'Yes. Notevia supports Apple Pencil and other styluses with pressure sensitivity where your browser reports it, plus a stylus-only mode for palm rejection. It also works with a mouse or finger.'],
    ['Will annotating change my original PDF?', 'Never. Annotations are stored as a separate layer. You can download the original at any time, or export an annotated copy.'],
    ['Can I edit Word and PowerPoint files?', 'Notevia previews DOCX, PPTX and XLSX in the browser and can convert DOCX into an editable Notevia page. Direct editing of Office files requires a Microsoft 365 or Google Workspace integration.'],
    ['Who can see my notes?', 'Only you, unless you share them. You choose view, comment or edit access for each person or classroom. Platform administrators can manage accounts but cannot open your content.'],
    ['Is my data protected?', 'Notevia is designed around UK GDPR principles: private-by-default storage, row-level access controls, data export, account deletion and configurable data retention.'],
    ['Does Notevia AI read my documents?', 'Only when AI is enabled for your organisation, you have given permission, and you press Run on a specific item. Results are labelled as AI-generated and are always editable.'],
  ];

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-5">
          <Link to="/" aria-label="Notevia"><Lockup size={32} /></Link>
          <nav className="ml-6 hidden gap-6 text-sm text-muted-foreground md:flex"><a href="#features" className="hover:text-foreground">Features</a><a href="#benefits" className="hover:text-foreground">Who it’s for</a><a href="#faq" className="hover:text-foreground">FAQ</a></nav>
          <div className="flex-1" />
          <Button size="icon" variant="ghost" aria-label="Toggle dark mode" onClick={() => setDark(!dark)}>{dark ? <Sun /> : <Moon />}</Button>
          <Button asChild variant="ghost" className="hidden sm:inline-flex"><Link to="/login">Sign in</Link></Button>
          <Button asChild><Link to="/register">Get started</Link></Button>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-lilac/70 blur-3xl dark:bg-lavender/10" />
        <div className="pointer-events-none absolute -left-40 top-60 h-[420px] w-[420px] rounded-full bg-sage/40 blur-3xl dark:bg-sage/5" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-14 lg:grid-cols-[1fr_1.15fr] lg:pt-20">
          <div className="animate-fade-up">
            <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground"><Mark size={16} /> The digital workspace for learning and teaching</span>
            <h1 className="text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">One space.<br /><span className="text-lavender-deep">Endless learning.</span></h1>
            <p className="mt-5 max-w-lg text-lg text-muted-foreground">Bring your notes, documents, teaching materials and ideas together in one beautifully designed digital workspace.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg"><Link to="/register">Get started — it’s free <ArrowRight /></Link></Button>
              <Button asChild size="lg" variant="outline"><Link to="/login">Sign in</Link></Button>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {['Private by default', 'Works on iPad & stylus', 'Any subject, any level'].map((s) => <span key={s} className="flex items-center gap-1.5"><Check className="size-4 text-[#3F9A72]" />{s}</span>)}
            </div>
          </div>

          {/* interactive product preview */}
          <div className="relative animate-fade-up [animation-delay:120ms]">
            <div className="overflow-hidden rounded-[22px] border border-border bg-card shadow-lift">
              <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-dusty" /><span className="h-2.5 w-2.5 rounded-full bg-peach" /><span className="h-2.5 w-2.5 rounded-full bg-sage" />
                <div className="ml-3 flex h-7 flex-1 items-center gap-2 rounded-lg bg-muted px-3 text-[11px] text-muted-foreground"><Search className="size-3" /> Search your workspace</div>
                <Bell className="size-4 text-muted-foreground" />
              </div>
              <div className="flex">
                <div className="hidden w-[150px] shrink-0 border-r border-border p-3 sm:block">
                  <Lockup size={20} />
                  <div className="mt-4 space-y-1 text-[11px]">
                    {[[Home, 'Home'], [NotebookPen, 'My Notebooks'], [FileText, 'Documents'], [GraduationCap, 'My Classes'], [CalendarDays, 'Calendar']].map(([I, t]: any, i) => (
                      <div key={t} className={cn('flex items-center gap-2 rounded-lg px-2 py-1.5', i === 1 ? 'bg-secondary font-medium' : 'text-muted-foreground')}><I className="size-3.5" />{t}</div>
                    ))}
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-1.5">{['#E4DDFB', '#D5ECE3', '#F9D9E6', '#D6E7F8'].map((c) => <FolderArt key={c} color={c} />)}</div>
                </div>
                <div className="min-w-0 flex-1 bg-ivory p-3 dark:bg-background">
                  <div className="mb-2 flex items-center gap-1 rounded-xl border border-border bg-card p-1">
                    {(['ballpoint', 'fountain', 'highlighter'] as const).map((p) => (
                      <button key={p} aria-label={p} onClick={() => pen(p)} className={cn('grid h-8 w-8 place-items-center rounded-lg', tools.tool === 'pen' && tools.pen === p ? 'bg-primary' : 'hover:bg-muted')}>{p === 'highlighter' ? <Highlighter className="size-4" /> : <PenTool className="size-4" />}</button>
                    ))}
                    <button aria-label="Eraser" onClick={() => setTools({ ...tools, tool: 'eraser' })} className={cn('grid h-8 w-8 place-items-center rounded-lg', tools.tool === 'eraser' ? 'bg-primary' : 'hover:bg-muted')}><Eraser className="size-4" /></button>
                    <span className="mx-1 h-5 w-px bg-border" />
                    {INK.slice(0, 5).map((c) => <button key={c} aria-label={`Colour ${c}`} onClick={() => setTools({ ...tools, colors: { ...tools.colors, [tools.pen]: c } })} className={cn('h-5 w-5 rounded-full', tools.colors[tools.pen] === c && 'ring-2 ring-lavender-deep ring-offset-1')} style={{ background: c }} />)}
                    <div className="flex-1" />
                    <button aria-label="Reset preview" onClick={() => setObjs(PREVIEW)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-muted"><Undo2 className="size-4" /></button>
                  </div>
                  <div className="overflow-hidden rounded-lg shadow-soft ring-1 ring-black/5">
                    <InkCanvas width={400} height={300} zoom={1} objects={objs} onCommit={setObjs} selected={sel} onSelect={setSel} tools={tools} background={{ kind: 'template', template: 'dotted' }} />
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-5 -left-5 hidden rounded-2xl border border-border bg-card px-4 py-3 shadow-lift sm:block">
              <div className="flex items-center gap-2 text-xs"><Lock className="size-3.5 text-lavender-deep" /> Private by default · shared on your terms</div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-5 py-20">
        <div className="mx-auto max-w-2xl text-center"><h2 className="text-3xl font-bold tracking-tight">Everything you write, read and teach — together</h2><p className="mt-3 text-muted-foreground">The best of a digital notebook, a document library and a classroom, designed as one calm workspace.</p></div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.t} className="rounded-2xl border border-border bg-card p-6 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift">
              <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-secondary text-[#4E3F80] dark:text-lavender"><f.icon className="size-5" /></div>
              <h3 className="font-semibold">{f.t}</h3><p className="mt-1.5 text-sm text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="benefits" className="border-y border-border bg-card/60">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <h2 className="text-center text-3xl font-bold tracking-tight">Made for the way you work</h2>
          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {BENEFITS.map((b) => (
              <div key={b.who} className="rounded-2xl border border-border bg-background p-7">
                <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl" style={{ background: b.color }}><b.icon className="size-5 text-charcoal" /></div>
                <h3 className="text-lg font-semibold">For {b.who.toLowerCase()}</h3>
                <ul className="mt-4 space-y-2.5">{b.points.map((p) => <li key={p} className="flex gap-2 text-sm"><Check className="mt-0.5 size-4 shrink-0 text-[#3F9A72]" />{p}</li>)}</ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="grid items-center gap-10 rounded-[28px] bg-lilac/70 p-8 sm:p-12 lg:grid-cols-2 dark:bg-lavender/10">
          <div>
            <ShieldCheck className="mb-4 size-9 text-lavender-deep" />
            <h2 className="text-3xl font-bold tracking-tight">Private by design</h2>
            <p className="mt-3 text-muted-foreground">Built with UK GDPR principles from day one. Your files live in private storage, every row of data is protected by access rules, and you can export or delete your account whenever you like.</p>
          </div>
          <ul className="grid gap-3 text-sm sm:grid-cols-2">{['Row-level security on every table', 'Private, signed file links', 'Admins can’t read your content', 'One-click data export', 'Account deletion', 'Configurable data retention'].map((x) => <li key={x} className="flex items-center gap-2 rounded-xl bg-card px-4 py-3 shadow-soft"><Check className="size-4 text-[#3F9A72]" />{x}</li>)}</ul>
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-3xl px-5 pb-20">
        <h2 className="mb-6 text-center text-3xl font-bold tracking-tight">Frequently asked questions</h2>
        <Accordion type="single" collapsible>{FAQ.map(([q, a]) => <AccordionItem key={q} value={q}><AccordionTrigger>{q}</AccordionTrigger><AccordionContent>{a}</AccordionContent></AccordionItem>)}</Accordion>
        <div className="mt-12 text-center"><Button asChild size="lg"><Link to="/register">Create your free workspace <ArrowRight /></Link></Button></div>
      </section>

      <SiteFooter />
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:grid-cols-[1.5fr_1fr_1fr]">
        <div><FullLogo width={150} /><p className="mt-3 max-w-xs text-sm text-muted-foreground">A professional digital workspace for teaching, learning, note-taking and collaboration.</p></div>
        <div><h4 className="mb-3 text-sm font-semibold">Product</h4><ul className="space-y-2 text-sm text-muted-foreground"><li><a href="/#features" className="hover:text-foreground">Features</a></li><li><Link to="/register" className="hover:text-foreground">Get started</Link></li><li><Link to="/login" className="hover:text-foreground">Sign in</Link></li></ul></div>
        <div><h4 className="mb-3 text-sm font-semibold">Company</h4><ul className="space-y-2 text-sm text-muted-foreground"><li><Link to="/contact" className="hover:text-foreground">Contact</Link></li><li><Link to="/privacy" className="hover:text-foreground">Privacy policy</Link></li><li><Link to="/terms" className="hover:text-foreground">Terms of service</Link></li><li className="text-xs">{SUPPORT_EMAIL}</li></ul></div>
      </div>
      <div className="border-t border-border py-5 text-center text-xs text-muted-foreground">© {new Date().getFullYear()} Notevia · One space. Endless learning.</div>
    </footer>
  );
}
