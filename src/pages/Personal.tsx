import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Users, Star, Download, Trash2, RotateCcw, Settings as SettingsIcon, ShieldCheck, Moon, Sun, PenTool, Database, FileJson, UserX, KeyRound, ExternalLink, Folder as FolderIcon, Link2, Timer, Bell, Palette, CreditCard, Check } from 'lucide-react';
import { useApp, ask } from '@/lib/app';
import { useTable } from '@/lib/hooks';
import { auth, db, fn, MODE, resetDemo } from '@/lib/backend';
import type { DocumentRow, DownloadLog, Folder, Notebook, ResourceLink, Share } from '@/lib/types';
import { exportMyData, purge, restore } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Input, Label, NativeSelect, Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/misc';
import { Avatar, ColorDots, Empty, FileBadge, PageHeader, ViewToggle } from '@/components/common';
import { DocCard, NotebookCard, FolderCard } from '@/components/Cards';
import { PASTELS, saveBlob, timeAgo } from '@/lib/utils';
import { useLocalState } from '@/lib/hooks';
import { ACCENT_PRESETS, DEFAULT_ACCENT, getStoredAccent, resetAccent, setStoredAccent } from '@/lib/theme';
import { PRESSURE_LEVELS, getPressureLevel, setPressureLevel, type PressureLevel } from '@/canvas/strokes';

export function SharedWithMe() {
  const app = useApp();
  const nav = useNavigate();
  const [view, setView] = useLocalState<'grid' | 'list'>('nv-shared-view', 'grid');
  const { rows: docs } = useTable<DocumentRow>('documents', undefined, { col: 'updated_at' });
  const { rows: nbs } = useTable<Notebook>('notebooks', undefined, { col: 'updated_at' });
  const { rows: links } = useTable<ResourceLink>('resource_links');
  const { rows: folders } = useTable<Folder>('folders');
  const theirs = <T extends { owner_id: string }>(x: T) => x.owner_id !== app.user.id;
  const d = docs.filter((x) => theirs(x) && !x.deleted_at && app.can('document', x));
  const n = nbs.filter((x) => theirs(x) && !x.deleted_at && app.can('notebook', x));
  const f = folders.filter((x) => theirs(x) && !x.deleted_at && app.can('folder', x) && !folders.some((p) => p.id === x.parent_id && app.can('folder', p)));
  const l = links.filter((x) => theirs(x) && app.can('link', x));
  const grid = view === 'grid' ? 'grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5' : 'divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card';
  const total = d.length + n.length + f.length + l.length;
  return (
    <div className="animate-fade-up">
      <PageHeader icon={<Users />} title="Shared with Me" subtitle="Everything people and classrooms have shared with you." actions={<ViewToggle value={view} onChange={setView} />} />
      {!total && <Empty icon={<Users />} title="Nothing shared with you yet" body="When someone shares a notebook, document, folder or resource with you, it appears here." />}
      <div className="space-y-8">
        {f.length > 0 && <section><h3 className="mb-3 font-semibold">Folders</h3><div className={view === 'grid' ? 'grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-8' : grid}>{f.map((x) => <FolderCard key={x.id} f={x} view={view} onOpen={() => nav(`/app/documents?folder=${x.id}`)} />)}</div></section>}
        {n.length > 0 && <section><h3 className="mb-3 font-semibold">Notebooks & whiteboards</h3><div className={grid}>{n.map((x) => <NotebookCard key={x.id} n={x} view={view} sub={`${app.can('notebook', x) === 'edit' ? 'Can edit' : app.can('notebook', x) === 'comment' ? 'Can comment' : 'View only'} · ${app.profile(x.owner_id)?.full_name || 'Collaborator'}`} />)}</div></section>}
        {d.length > 0 && <section><h3 className="mb-3 font-semibold">Documents</h3><div className={grid}>{d.map((x) => <DocCard key={x.id} d={x} view={view} />)}</div></section>}
        {l.length > 0 && <section><h3 className="mb-3 font-semibold">Learning resources</h3><div className="grid gap-2 sm:grid-cols-2">{l.map((x) => <a key={x.id} href={x.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 hover:shadow-soft"><Link2 className="size-4 text-lavender-deep" /><span className="flex-1 truncate text-sm">{x.title}</span><Badge tone="sage">{x.provider}</Badge><ExternalLink className="size-3.5 text-muted-foreground" /></a>)}</div></section>}
      </div>
    </div>
  );
}

export function Favourites() {
  const app = useApp();
  const nav = useNavigate();
  const { rows: docs } = useTable<DocumentRow>('documents');
  const { rows: nbs } = useTable<Notebook>('notebooks');
  const { rows: links } = useTable<ResourceLink>('resource_links');
  const { rows: folders } = useTable<Folder>('folders');
  const items = app.favourites.map((f) => {
    if (f.resource_type === 'document') { const d = docs.find((x) => x.id === f.resource_id); return d && !d.deleted_at && app.can('document', d) ? <DocCard key={f.id} d={d} view="grid" fav /> : null; }
    if (f.resource_type === 'notebook') { const n = nbs.find((x) => x.id === f.resource_id); return n && !n.deleted_at && app.can('notebook', n) ? <NotebookCard key={f.id} n={n} view="grid" /> : null; }
    if (f.resource_type === 'folder') { const x = folders.find((y) => y.id === f.resource_id); return x ? <FolderCard key={f.id} f={x} view="grid" onOpen={() => nav(`/app/documents?folder=${x.id}`)} /> : null; }
    const l = links.find((x) => x.id === f.resource_id);
    return l && app.can('link', l) ? <a key={f.id} href={l.url} target="_blank" rel="noopener noreferrer" className="rounded-2xl border border-border bg-card p-4 shadow-soft hover:shadow-lift"><Badge tone="sage">{l.provider}</Badge><div className="mt-2 line-clamp-2 text-sm font-medium">{l.title}</div><div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground"><ExternalLink className="size-3" /> Open website</div></a> : null;
  }).filter(Boolean);
  return (
    <div className="animate-fade-up">
      <PageHeader icon={<Star />} title="Favourites" subtitle="Starred notebooks, documents and resources." />
      {items.length ? <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">{items}</div> : <Empty icon={<Star />} title="No favourites yet" body="Use ★ Favourite on any notebook, document or resource." />}
    </div>
  );
}

export function Downloads() {
  const app = useApp();
  const nav = useNavigate();
  const { rows } = useTable<DownloadLog>('downloads', { user_id: app.user.id });
  const { rows: docs } = useTable<DocumentRow>('documents');
  return (
    <div className="animate-fade-up">
      <PageHeader icon={<Download />} title="Downloads" subtitle="Your download and export history — open the source again at any time."
        actions={rows.length > 0 && <Button variant="ghost" onClick={async () => { if (await ask.confirm('Clear download history?', 'This only clears the list. Your files are not affected.', 'Clear')) for (const r of rows) await db.remove('downloads', r.id); }}>Clear history</Button>} />
      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {rows.map((r) => {
          const d = r.resource_type === 'document' ? docs.find((x) => x.id === r.resource_id) : null;
          return (
            <div key={r.id} className="flex items-center gap-3 px-4 py-3">
              <FileBadge mime={r.name.endsWith('.png') ? 'image/png' : 'application/pdf'} name={r.name} size={28} />
              <div className="min-w-0 flex-1"><div className="truncate text-sm">{r.name}</div><div className="text-[11px] text-muted-foreground">{r.kind === 'annotated' ? 'Annotated copy' : r.kind === 'export' ? 'Exported' : 'Original'} · {timeAgo(r.created_at)}</div></div>
              {r.resource_type === 'notebook' ? <Button size="sm" variant="secondary" onClick={() => nav(`/app/notebooks/${r.resource_id}`)}>Open</Button>
                : d && !d.deleted_at && <Button size="sm" variant="secondary" onClick={async () => r.kind === 'annotated' ? nav(`/app/pdf/${d.id}`) : saveBlob(await db.download('documents', d.storage_path!), d.name)}>{r.kind === 'annotated' ? 'Open' : 'Download again'}</Button>}
            </div>
          );
        })}
        {!rows.length && <Empty icon={<Download />} title="No downloads yet" />}
      </div>
    </div>
  );
}

export function RecycleBin() {
  const app = useApp();
  const { rows: docs } = useTable<DocumentRow>('documents', { owner_id: app.user.id });
  const { rows: folders } = useTable<Folder>('folders', { owner_id: app.user.id });
  const { rows: nbs } = useTable<Notebook>('notebooks', { owner_id: app.user.id });
  const days = app.user.settings?.retention_days ?? 30;
  const items = [
    ...folders.filter((x) => x.deleted_at).map((r) => ({ table: 'folders' as const, r, name: r.name, when: r.deleted_at!, icon: <FolderIcon className="size-5" style={{ color: r.color, fill: r.color }} /> })),
    ...docs.filter((x) => x.deleted_at).map((r) => ({ table: 'documents' as const, r, name: r.name, when: r.deleted_at!, icon: <FileBadge mime={r.mime_type} name={r.name} size={26} /> })),
    ...nbs.filter((x) => x.deleted_at).map((r) => ({ table: 'notebooks' as const, r, name: r.title, when: r.deleted_at!, icon: <span className="grid h-8 w-7 place-items-center rounded-md" style={{ background: r.cover_color }} /> })),
  ].sort((a, b) => (a.when < b.when ? 1 : -1));
  const expires = (w: string) => Math.max(0, Math.ceil((new Date(w).getTime() + days * 86400000 - Date.now()) / 86400000));
  return (
    <div className="animate-fade-up">
      <PageHeader icon={<Trash2 />} title="Recycle Bin" subtitle={`Deleted items are kept for ${days} days, then removed permanently. Change this in Settings → Privacy.`}
        actions={items.length > 0 && <Button variant="destructive" onClick={async () => { if (await ask.confirm('Empty recycle bin?', 'Everything here will be deleted permanently. This can’t be undone.', 'Empty bin')) { for (const i of items) await purge(i.table, i.r); app.toast('Recycle bin emptied'); } }}><Trash2 /> Empty bin</Button>} />
      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {items.map((i) => (
          <div key={i.r.id} className="flex items-center gap-3 px-4 py-3">
            <span className="grid w-8 place-items-center">{i.icon}</span>
            <div className="min-w-0 flex-1"><div className="truncate text-sm">{i.name}</div><div className="text-[11px] text-muted-foreground">{i.table === 'folders' ? 'Folder' : i.table === 'documents' ? 'Document' : i.r.kind === 'whiteboard' ? 'Whiteboard' : 'Notebook'} · deleted {timeAgo(i.when)} · {expires(i.when)} days left</div></div>
            <Button size="sm" variant="secondary" onClick={async () => { await restore(i.table, i.r.id); app.toast('Restored'); }}><RotateCcw /> Restore</Button>
            <Button size="icon" variant="ghost" aria-label="Delete permanently" onClick={async () => { if (await ask.confirm('Delete permanently?', i.name)) { await purge(i.table, i.r); app.toast('Deleted permanently'); } }}><Trash2 /></Button>
          </div>
        ))}
        {!items.length && <Empty icon={<Trash2 />} title="Recycle bin is empty" />}
      </div>
    </div>
  );
}

export function SettingsPage() {
  const app = useApp();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { rows: docs } = useTable<DocumentRow>('documents', { owner_id: app.user.id });
  const u = app.user;
  const [p, setP] = useState({ full_name: u.full_name, organisation: u.organisation || '', job_title: u.job_title || '', bio: u.bio || '', avatar_color: u.avatar_color || PASTELS[0] });
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [accent, setAccent] = useState(getStoredAccent);
  const [pressure, setPressure] = useState<PressureLevel>(getPressureLevel);
  const billingUrl = (import.meta.env.VITE_BILLING_PORTAL_URL as string | undefined)?.trim();
  const settings = u.settings || {};
  const setSetting = async (patch: Record<string, any>) => { await db.update('profiles', u.id, { settings: { ...settings, ...patch } }); await app.refreshUser(); };
  const Row = ({ icon, title, desc, children }: any) => (
    <div className="flex flex-wrap items-center gap-4 border-b border-border py-4 last:border-0">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-lavender-ink dark:text-lavender [&_svg]:size-[18px]">{icon}</span>
      <div className="min-w-[200px] flex-1"><div className="text-sm font-medium">{title}</div><div className="text-xs text-muted-foreground">{desc}</div></div>{children}
    </div>
  );
  return (
    <div className="max-w-3xl animate-fade-up">
      <PageHeader icon={<SettingsIcon />} title="Settings" />
      <Tabs defaultValue={params.get('tab') || 'profile'}>
        <TabsList><TabsTrigger value="profile">Profile</TabsTrigger><TabsTrigger value="appearance">Appearance</TabsTrigger><TabsTrigger value="preferences">Preferences</TabsTrigger><TabsTrigger value="subscription">Subscription</TabsTrigger><TabsTrigger value="security">Security</TabsTrigger><TabsTrigger value="privacy">Privacy & data</TabsTrigger></TabsList>
        <TabsContent value="profile">
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="mb-5 flex items-center gap-4"><Avatar name={p.full_name} color={p.avatar_color} size={60} /><ColorDots colors={PASTELS.slice(0, 8)} value={p.avatar_color} onChange={(c) => setP({ ...p, avatar_color: c })} size={26} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label>Full name</Label><Input maxLength={120} value={p.full_name} onChange={(e) => setP({ ...p, full_name: e.target.value })} /></div>
              <div><Label>Email</Label><Input value={u.email} disabled /></div>
              <div><Label>Organisation</Label><Input maxLength={120} value={p.organisation} onChange={(e) => setP({ ...p, organisation: e.target.value })} /></div>
              <div><Label>Role / job title</Label><Input maxLength={120} value={p.job_title} onChange={(e) => setP({ ...p, job_title: e.target.value })} /></div>
              <div className="sm:col-span-2"><Label>About</Label><Textarea rows={2} maxLength={600} value={p.bio} onChange={(e) => setP({ ...p, bio: e.target.value })} /></div>
              <div><Label>Account type</Label>
                {u.role === 'admin' ? <Input value="Administrator" disabled /> : <NativeSelect value={u.role} onChange={async (e) => {
                  const r = e.target.value as any;
                  try { if (MODE === 'supabase') await db.rpc('set_my_role', { p_role: r }); else await db.update('profiles', u.id, { role: r }); await app.refreshUser(); app.toast('Account type updated'); } catch (x: any) { app.toast(x.message, 'err'); }
                }}><option value="educator">Educator</option><option value="student">Student</option><option value="individual">Individual</option></NativeSelect>}
              </div>
            </div>
            <div className="mt-5 flex justify-end"><Button disabled={!p.full_name.trim()} onClick={async () => { await db.update('profiles', u.id, { ...p, full_name: p.full_name.trim() }); await app.refreshUser(); app.toast('Profile saved'); }}>Save profile</Button></div>
          </div>
        </TabsContent>
        <TabsContent value="appearance">
          <div className="rounded-2xl border border-border bg-card px-6 py-2">
            <Row icon={app.dark ? <Moon /> : <Sun />} title="Dark mode" desc="Switch between light and dark appearance"><Switch checked={app.dark} onCheckedChange={app.setDark} aria-label="Dark mode" /></Row>
            <div className="py-4">
              <div className="mb-1 flex items-center gap-2 text-sm font-medium"><Palette className="size-4" /> Accent colour</div>
              <p className="mb-4 text-xs text-muted-foreground">Pick the colour used for buttons, highlights and selections. Saved on this device.</p>
              <div className="flex flex-wrap gap-3">
                {ACCENT_PRESETS.map((c) => (
                  <button key={c.id} type="button" onClick={() => { setStoredAccent(c.hex, app.dark); setAccent(c.hex); }} aria-label={c.label} aria-pressed={accent.toLowerCase() === c.hex.toLowerCase()}
                    className="group flex w-16 flex-col items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className={`grid h-10 w-10 place-items-center rounded-full ring-offset-2 ring-offset-card transition ${accent.toLowerCase() === c.hex.toLowerCase() ? 'ring-2 ring-primary' : 'group-hover:scale-105'}`} style={{ background: c.hex }}>
                      {accent.toLowerCase() === c.hex.toLowerCase() && <Check className="size-4 text-white" />}
                    </span>{c.label}
                  </button>
                ))}
                <label className="group flex w-16 cursor-pointer flex-col items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="relative h-10 w-10 overflow-hidden rounded-full border border-border transition group-hover:scale-105" style={{ background: 'conic-gradient(#f87171,#fbbf24,#a3e635,#22d3ee,#818cf8,#e879f9,#f87171)' }}>
                    <input type="color" aria-label="Custom accent colour" className="absolute inset-0 cursor-pointer opacity-0" value={accent} onChange={(e) => { setStoredAccent(e.target.value, app.dark); setAccent(e.target.value); }} />
                  </span>Custom
                </label>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <Button variant="outline" size="sm" disabled={accent.toLowerCase() === DEFAULT_ACCENT.toLowerCase()} onClick={() => { resetAccent(app.dark); setAccent(DEFAULT_ACCENT); }}>Reset to default</Button>
                <span className="inline-flex items-center gap-2 text-xs text-muted-foreground"><span className="h-3 w-3 rounded-full bg-primary" /> Preview</span>
              </div>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="preferences">
          <div className="rounded-2xl border border-border bg-card px-6 py-2">
            <Row icon={<PenTool />} title="Pen pressure sensitivity" desc="How strongly Apple Pencil pressure changes line thickness. Choose Off for an even line. Saved on this device.">
              <NativeSelect className="w-36" value={pressure} onChange={(e) => { const v = e.target.value as PressureLevel; setPressureLevel(v); setPressure(v); }} aria-label="Pen pressure sensitivity">{(Object.keys(PRESSURE_LEVELS) as PressureLevel[]).map((id) => <option key={id} value={id}>{PRESSURE_LEVELS[id].label}</option>)}</NativeSelect>
            </Row>
            <Row icon={<PenTool />} title="Two-finger tap to undo" desc="Tap the canvas with two fingers to undo, three to redo — like Notability"><Switch checked={settings.tap_undo !== false} onCheckedChange={(v) => setSetting({ tap_undo: v })} aria-label="Two-finger tap to undo" /></Row>
            <Row icon={<PenTool />} title="Stylus-only drawing (palm rejection)" desc="Only Apple Pencil or a stylus writes; fingers scroll and pinch"><Switch checked={!!settings.pencil_only} onCheckedChange={(v) => setSetting({ pencil_only: v })} aria-label="Stylus only" /></Row>
            <Row icon={<Bell />} title="Email reminders" desc="Due-soon and feedback emails (in-app notifications always stay on)"><Switch checked={settings.email_notifications !== false} onCheckedChange={(v) => setSetting({ email_notifications: v })} aria-label="Email reminders" /></Row>
          </div>
        </TabsContent>
        <TabsContent value="subscription">
          <div className="rounded-2xl border border-border bg-card px-6 py-2">
            <Row icon={<CreditCard />} title="Current plan" desc="Your Notevia plan and billing details"><Badge tone="lavender">Free</Badge></Row>
            <Row icon={<ExternalLink />} title="Manage Subscription" desc={billingUrl ? 'Update your plan, payment method or cancel in the secure billing portal' : 'Billing is not connected yet. Contact support to change your plan.'}>
              <Button variant="outline" onClick={() => {
                if (billingUrl) window.open(billingUrl, '_blank', 'noopener,noreferrer');
                else app.toast(`Billing isn't connected yet${import.meta.env.VITE_SUPPORT_EMAIL ? ` — email ${import.meta.env.VITE_SUPPORT_EMAIL}` : ''}`);
              }}>Manage Subscription</Button>
            </Row>
          </div>
        </TabsContent>
        <TabsContent value="security">
          <div className="rounded-2xl border border-border bg-card px-6 py-2">
            <Row icon={<KeyRound />} title="Change password" desc="At least 8 characters">
              <div className="flex gap-2"><Input type="password" autoComplete="new-password" className="w-44" placeholder="New password" value={pw} onChange={(e) => setPw(e.target.value)} /><Button disabled={pw.length < 8} onClick={async () => { try { await auth.updatePassword(pw); setPw(''); app.toast('Password updated'); } catch (e: any) { app.toast(e.message, 'err'); } }}>Update</Button></div>
            </Row>
            <Row icon={<ShieldCheck />} title="Sign out everywhere" desc="Ends this session; other sessions expire when their tokens refresh"><Button variant="outline" onClick={async () => { await auth.signOut(); nav('/'); }}>Sign out</Button></Row>
            <Row icon={<Database />} title="Backend" desc={MODE === 'supabase' ? 'Supabase Auth · Postgres with Row Level Security · private storage' : 'Demo mode — data is stored only in this browser'}><Badge tone={MODE === 'supabase' ? 'sage' : 'peach'}>{MODE === 'supabase' ? 'Cloud' : 'Demo'}</Badge></Row>
          </div>
        </TabsContent>
        <TabsContent value="privacy">
          <div className="space-y-5">
            <div className="rounded-2xl border border-border bg-card px-6 py-2">
              <Row icon={<Timer />} title="Recycle bin retention" desc="Deleted items are removed permanently after this period">
                <NativeSelect className="w-36" value={String(settings.retention_days ?? 30)} onChange={(e) => setSetting({ retention_days: Number(e.target.value) })}>{[7, 14, 30, 60, 90, 180].map((d) => <option key={d} value={d}>{d} days</option>)}</NativeSelect>
              </Row>
              <Row icon={<FileJson />} title="Export my data" desc="Download everything about you as a JSON file (UK GDPR data portability)">
                <Button variant="outline" disabled={busy === 'export'} onClick={async () => { setBusy('export'); try { saveBlob(await exportMyData(u), `notevia-export-${new Date().toISOString().slice(0, 10)}.json`); } finally { setBusy(''); } }}><Download /> Export</Button>
              </Row>
            </div>
            <div className="rounded-2xl border border-red-200 bg-red-50/50 p-6 dark:border-red-500/30 dark:bg-red-500/5">
              <div className="flex items-center gap-2 font-semibold text-red-700 dark:text-red-300"><UserX className="size-5" /> Delete account</div>
              <p className="mt-1 text-sm text-muted-foreground">Permanently deletes your account, notebooks, documents, files, submissions and classrooms you own. This cannot be undone. Export your data first if you need it.</p>
              <div className="mt-4 flex flex-wrap gap-2"><Input className="w-48" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder='Type "DELETE" to confirm' aria-label="Type DELETE to confirm" />
                <Button variant="destructive" disabled={confirmText !== 'DELETE' || busy === 'delete'} onClick={async () => {
                  setBusy('delete');
                  try {
                    if (MODE === 'supabase') { await fn.call('delete-account', { confirm: 'DELETE' }); await auth.signOut(); }
                    else { for (const t of ['documents', 'notebooks', 'folders', 'resource_links', 'calendar_events', 'tasks', 'workspaces', 'classrooms'] as const) for (const r of await db.list<any>(t, { owner_id: u.id })) await db.remove(t, r.id); await db.remove('profiles', u.id); await auth.signOut(); }
                    nav('/');
                  } catch (e: any) { app.toast(e.message || 'Deletion failed — the delete-account function may not be deployed yet', 'err'); setBusy(''); }
                }}>Delete my account</Button>
              </div>
            </div>
            {MODE === 'demo' && <div className="rounded-2xl border border-border bg-card p-6"><div className="text-sm font-medium">Reset demo</div><p className="mb-3 text-xs text-muted-foreground">Restore the sample workspace in this browser.</p><Button variant="outline" onClick={async () => { if (await ask.confirm('Reset demo data?', 'All changes in this browser will be lost.', 'Reset')) resetDemo(); }}>Reset demo data</Button></div>}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
