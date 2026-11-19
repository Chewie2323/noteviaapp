import { Link } from 'react-router-dom';
import { ArrowLeft, Mail } from 'lucide-react';
import { useState } from 'react';
import { Lockup } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/input';
import { SiteFooter } from './Landing';
import { COMPANY_NAME, COMPANY_ADDRESS, SUPPORT_EMAIL } from '@/lib/config';

function Shell({ title, children, updated }: { title: string; children: React.ReactNode; updated?: string }) {
  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="border-b border-border"><div className="mx-auto flex h-16 max-w-4xl items-center gap-4 px-5"><Link to="/"><Lockup size={30} /></Link><div className="flex-1" /><Button asChild variant="ghost"><Link to="/"><ArrowLeft /> Back</Link></Button></div></header>
      <main className="mx-auto max-w-3xl px-5 py-12">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {updated && <p className="mt-1 text-sm text-muted-foreground">Last updated {updated}</p>}
        <div className="prose-nv mt-8">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}
const Note = () => <p className="rounded-xl bg-peach/50 p-4 text-sm text-charcoal">Template notice: this text is a starting point written around UK GDPR principles. Replace the bracketed details and have it reviewed by a qualified adviser before launch.</p>;

export function Privacy() {
  return (
    <Shell title="Privacy policy" updated="[date]">
      <Note />
      <h2>Who we are</h2><p>{COMPANY_NAME} [legal entity name, company number{COMPANY_ADDRESS ? `, ${COMPANY_ADDRESS}` : ', registered address'}] is the controller for account data. Where an educational organisation provides Notevia to its staff and students, that organisation is usually the controller for classroom data and we act as its processor.</p>
      <h2>What we collect</h2><ul><li>Account details: name, email, account type, organisation (optional).</li><li>Content you create or upload: notebooks, documents, annotations, recordings, comments, assignments and feedback.</li><li>Usage data needed to run the service, such as activity history shown inside the app.</li></ul>
      <h2>How we use it</h2><p>To provide the service (contract), to keep it secure (legitimate interests), and — only if you switch it on — to run Notevia AI on content you choose (consent). We do not sell personal data or use your content for advertising.</p>
      <h2>Who can see your content</h2><p>Content is private to you unless you share it. Sharing is limited to the people or classrooms you choose, at view, comment or edit level. Platform administrators manage accounts but cannot open your content.</p>
      <h2>Notevia AI</h2><p>AI features are optional. When enabled and you press Run, the text of the item you selected is sent to our AI provider [name] to generate a response. Results are labelled as AI-generated.</p>
      <h2>Where data is stored</h2><p>[Hosting provider and region, e.g. Supabase, EU/UK region]. International transfers, if any, use appropriate safeguards.</p>
      <h2>How long we keep it</h2><p>Items in the recycle bin are deleted after your chosen retention period (default 30 days). Deleting your account removes your content and files.</p>
      <h2>Your rights</h2><p>You can access, correct, export (Settings → Privacy → Export my data) and delete your data (Settings → Privacy → Delete account), object to or restrict processing, and complain to the Information Commissioner’s Office (ico.org.uk). Contact us at {SUPPORT_EMAIL}.</p>
      <h2>Children</h2><p>Where students under 13 use Notevia, it must be provided by their school or organisation, which is responsible for the appropriate permissions.</p>
    </Shell>
  );
}

export function Terms() {
  return (
    <Shell title="Terms of service" updated="[date]">
      <Note />
      <h2>Using Notevia</h2><p>You must provide accurate account information and keep your password secure. You are responsible for activity on your account.</p>
      <h2>Your content</h2><p>You keep ownership of everything you create or upload. You grant us the limited permission needed to store, process and display it to you and to the people you share it with.</p>
      <h2>Acceptable use</h2><ul><li>Don’t upload content you don’t have the right to share.</li><li>Don’t attempt to access other users’ data or interfere with the service.</li><li>Don’t use Notevia to harass, harm or deceive others.</li></ul>
      <h2>Educational organisations</h2><p>Organisations that provide Notevia to students are responsible for having an appropriate lawful basis and for managing their classrooms.</p>
      <h2>Availability and changes</h2><p>We work to keep Notevia available but can’t guarantee uninterrupted service. We may update these terms and will tell you about significant changes.</p>
      <h2>Liability</h2><p>[Limitation of liability clause appropriate to your jurisdiction.]</p>
      <h2>Contact</h2><p>{SUPPORT_EMAIL}</p>
    </Shell>
  );
}

export function Contact() {
  const [v, setV] = useState({ name: '', email: '', message: '' });
  const href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Notevia enquiry from ' + (v.name || 'website'))}&body=${encodeURIComponent(`${v.message}\n\n— ${v.name} <${v.email}>`)}`;
  return (
    <Shell title="Contact us">
      <p>Questions, feedback or an organisation-wide enquiry? We’d love to hear from you.</p>
      <p className="flex items-center gap-2 not-prose"><Mail className="size-4 text-lavender-deep" /> <b>{SUPPORT_EMAIL}</b></p>
      <form className="not-prose mt-6 space-y-4 rounded-2xl border border-border bg-card p-6" onSubmit={(e) => { e.preventDefault(); window.location.href = href; }}>
        <div className="grid gap-4 sm:grid-cols-2"><div><Label>Your name</Label><Input required value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></div><div><Label>Email</Label><Input required type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></div></div>
        <div><Label>Message</Label><Textarea required rows={5} value={v.message} onChange={(e) => setV({ ...v, message: e.target.value })} /></div>
        <Button type="submit"><Mail /> Open in my email app</Button>
        <p className="text-xs text-muted-foreground">This opens a pre-filled email in your mail app — nothing is sent until you press send there.</p>
      </form>
    </Shell>
  );
}
