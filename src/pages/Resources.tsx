import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Link2, Plus, ExternalLink, MoreHorizontal, Pencil, Trash2, Share2, Star, PlayCircle, FolderPlus, Folder as FolderIcon, X, Search } from 'lucide-react';
import { useApp, ask } from '@/lib/app';
import { useLocalState, useTable } from '@/lib/hooks';
import { db } from '@/lib/backend';
import type { Folder, ResourceLink } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input, Label, NativeSelect, Textarea } from '@/components/ui/input';
import { Badge, BadgeTone } from '@/components/ui/badge';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Empty, PageHeader, ViewToggle } from '@/components/common';
import { ShareDialog } from '@/components/ShareDialog';
import { Viewer } from '@/components/Viewer';
import { createFolder } from '@/lib/actions';
import { cn, detectProvider, embedUrl, linkThumb } from '@/lib/utils';

export const PROVIDERS = ['YouTube', 'Quizlet', 'Kahoot', 'Wordwall', 'Coursera', 'Google Forms', 'GitHub', 'Google Colab', 'Research article', 'Online textbook', 'Website'];
const PROVIDER_STYLE: Record<string, [string, string]> = {
  YouTube: ['#F6DADF', '#A63A51'], Quizlet: ['#D9E4F5', '#3561A6'], Kahoot: ['#E4DDFB', '#5B3F99'], Wordwall: ['#FDE3D6', '#9A5A2B'], Coursera: ['#D6E7F8', '#2C4E86'],
  'Google Forms': ['#E4DDF5', '#5A46A8'], GitHub: ['#E3E4E8', '#2F2B45'], 'Google Colab': ['#F6E7C9', '#8A6516'], 'Research article': ['#D4E9DC', '#2F7650'], 'Online textbook': ['#F9D9E6', '#874358'], Website: ['#E4DDFB', '#5B4A8F'],
};
const CAT_TONES: BadgeTone[] = ['lavender', 'sage', 'pink', 'blue', 'peach'];
const catTone = (c: string) => CAT_TONES[Array.from(c).reduce((s, ch) => s + ch.charCodeAt(0), 0) % CAT_TONES.length];

export function LinkThumb({ l }: { l: Pick<ResourceLink, 'thumbnail_url' | 'provider' | 'url' | 'title'> }) {
  const [bad, setBad] = useState(false);
  const src = l.thumbnail_url || linkThumb(l.url, l.provider);
  const [bg, fg] = PROVIDER_STYLE[l.provider] || PROVIDER_STYLE.Website;
  let host = ''; try { host = new URL(l.url).hostname.replace(/^www\./, ''); } catch { /* invalid */ }
  if (src && !bad) return <img src={src} alt="" onError={() => setBad(true)} className="aspect-video w-full rounded-xl bg-muted object-cover" />;
  return (
    <div className="relative grid aspect-video w-full place-items-center overflow-hidden rounded-xl" style={{ background: bg }}>
      <div className="absolute -bottom-8 -right-8 h-24 w-24 rounded-full bg-white/40" />
      <div className="text-center"><div className="text-lg font-bold" style={{ color: fg }}>{l.provider}</div><div className="max-w-[160px] truncate text-[11px] text-charcoal/60">{host}</div></div>
    </div>
  );
}

export default function Resources() {
  const app = useApp();
  const [params, setParams] = useSearchParams();
  const { rows } = useTable<ResourceLink>('resource_links');
  const { rows: folders } = useTable<Folder>('folders', { kind: 'resources' }, { col: 'created_at', asc: true });
  const [folder, setFolder] = useState<string | null>(null);
  const [cat, setCat] = useState('All');
  const [q, setQ] = useState(params.get('q') || '');
  const [view, setView] = useLocalState<'grid' | 'list'>('nv-res-view', 'grid');
  const [edit, setEdit] = useState<Partial<ResourceLink> | null>(null);
  const [share, setShare] = useState<ResourceLink | null>(null);
  const [embed, setEmbed] = useState<ResourceLink | null>(null);
  useEffect(() => { if (params.get('new')) { setEdit({}); params.delete('new'); setParams(params, { replace: true }); } }, [params]);
  const vis = rows.filter((l) => app.can('link', l));
  const myFolders = folders.filter((f) => !f.deleted_at && app.can('folder', f));
  const cats = ['All', ...Array.from(new Set(vis.map((l) => l.category))).sort()];
  const list = useMemo(() => vis.filter((l) => (!folder || l.folder_id === folder) && (cat === 'All' || l.category === cat) && (l.title + l.description + l.provider + l.tags.join(' ')).toLowerCase().includes(q.toLowerCase())), [vis, folder, cat, q]);

  const menu = (l: ResourceLink) => {
    const own = l.owner_id === app.user.id;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild><button aria-label={`Actions for ${l.title}`} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-muted"><MoreHorizontal className="size-4" /></button></DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => app.toggleFav('link', l.id)}><Star /> {app.isFav('link', l.id) ? 'Remove favourite' : 'Favourite'}</DropdownMenuItem>
          {own && <><DropdownMenuItem onSelect={() => setEdit(l)}><Pencil /> Edit</DropdownMenuItem><DropdownMenuItem onSelect={() => setShare(l)}><Share2 /> Share</DropdownMenuItem><DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={async () => { if (await ask.confirm('Remove resource?', l.title, 'Remove')) db.remove('resource_links', l.id); }}><Trash2 /> Remove</DropdownMenuItem></>}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };
  return (
    <div className="animate-fade-up">
      <PageHeader icon={<Link2 />} title="Learning Resources" subtitle="Bookmark and organise YouTube, Quizlet, Kahoot, Coursera, GitHub, research articles and more."
        actions={<><Button variant="outline" onClick={async () => { const n = await ask.prompt('New resource folder', '', 'Folder name', 'Create'); if (n) await createFolder(app.user, n, null, 'resources'); }}><FolderPlus /> New folder</Button><Button onClick={() => setEdit({})}><Plus /> Add resource</Button></>} />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[220px_1fr]">
        <aside className="space-y-1">
          <button onClick={() => setFolder(null)} className={cn('flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm', !folder ? 'bg-secondary font-medium' : 'hover:bg-muted')}><Link2 className="size-4" /> All resources <span className="ml-auto text-xs text-muted-foreground">{vis.length}</span></button>
          {myFolders.map((f) => (
            <div key={f.id} className="group flex items-center">
              <button onClick={() => setFolder(f.id)} className={cn('flex flex-1 items-center gap-2 rounded-xl px-3 py-2 text-sm', folder === f.id ? 'bg-secondary font-medium' : 'hover:bg-muted')}><FolderIcon className="size-4" style={{ color: f.color, fill: f.color }} />{f.name}<span className="ml-auto text-xs text-muted-foreground">{vis.filter((l) => l.folder_id === f.id).length}</span></button>
              {f.owner_id === app.user.id && <button aria-label="Delete folder" className="p-1 opacity-0 group-hover:opacity-60" onClick={async () => { if (await ask.confirm('Delete folder?', 'Links inside are kept and moved to “All resources”.')) { for (const l of vis.filter((x) => x.folder_id === f.id)) await db.update('resource_links', l.id, { folder_id: null }); await db.remove('folders', f.id); } }}><X className="size-3.5" /></button>}
            </div>
          ))}
        </aside>
        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] max-w-xs flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search resources" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search resources…" className="pl-9" /></div>
            <div className="flex flex-wrap gap-1">{cats.map((c) => <button key={c} onClick={() => setCat(c)} className={cn('rounded-full px-3 py-1 text-xs transition', cat === c ? 'bg-primary font-medium text-primary-foreground' : 'bg-muted hover:bg-secondary')}>{c}</button>)}</div>
            <div className="ml-auto"><ViewToggle value={view} onChange={setView} /></div>
          </div>
          {list.length ? (
            <div className={view === 'grid' ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3' : 'divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card'}>
              {list.map((l) => {
                const emb = l.embeddable && embedUrl(l.url, l.provider);
                if (view === 'list') return (
                  <div key={l.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-20 shrink-0"><LinkThumb l={l} /></div>
                    <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{l.title}</div><div className="truncate text-xs text-muted-foreground">{l.url}</div></div>
                    <Badge tone={catTone(l.category)}>{l.category}</Badge>{app.isFav('link', l.id) && <Star className="size-3.5 fill-amber-400 text-amber-400" />}
                    <Button asChild size="sm" variant="secondary"><a href={l.url} target="_blank" rel="noopener noreferrer"><ExternalLink /> Open</a></Button>{menu(l)}
                  </div>
                );
                return (
                  <div key={l.id} className="flex flex-col rounded-2xl border border-border bg-card p-3 shadow-soft transition hover:shadow-lift">
                    <div className="relative"><LinkThumb l={l} />{emb && <button aria-label="Preview inside Notevia" onClick={() => setEmbed(l)} className="absolute inset-0 grid place-items-center rounded-xl bg-black/20 opacity-0 transition hover:opacity-100"><PlayCircle className="size-10 text-white drop-shadow" /></button>}</div>
                    <div className="mt-3 flex items-start gap-1">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1.5 flex flex-wrap gap-1"><Badge tone={catTone(l.category)}>{l.category}</Badge><Badge tone="neutral">{l.provider}</Badge>{app.isFav('link', l.id) && <Star className="size-3.5 fill-amber-400 text-amber-400" />}</div>
                        <div className="text-sm font-semibold leading-snug">{l.title}</div>
                      </div>{menu(l)}
                    </div>
                    <p className="mt-1 line-clamp-2 flex-1 text-xs text-muted-foreground">{l.description}</p>
                    <div className="mt-2 truncate text-[11px] text-lavender-ink dark:text-lavender">{l.url}</div>
                    {l.tags.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1">{l.tags.slice(0, 4).map((t) => <span key={t} className="text-[11px] text-muted-foreground">#{t}</span>)}</div>}
                    <div className="mt-3 flex gap-2">
                      <Button asChild size="sm" className="flex-1"><a href={l.url} target="_blank" rel="noopener noreferrer"><ExternalLink /> Open website</a></Button>
                      {emb && <Button size="sm" variant="secondary" onClick={() => setEmbed(l)}>Embed</Button>}
                    </div>
                    {l.owner_id !== app.user.id && <div className="mt-2 text-[11px] text-muted-foreground">Shared by {app.profile(l.owner_id)?.full_name || 'a collaborator'}</div>}
                  </div>
                );
              })}
            </div>
          ) : <Empty icon={<Link2 />} title="No resources here" action={<Button onClick={() => setEdit({ folder_id: folder })}><Plus /> Add a resource</Button>} />}
        </div>
      </div>
      {edit && <LinkDialog initial={edit} folders={myFolders.filter((f) => f.owner_id === app.user.id)} onClose={() => setEdit(null)} />}
      {share && <ShareDialog open onOpenChange={(o) => !o && setShare(null)} type="link" id={share.id} name={share.title} />}
      <Dialog open={!!embed} onOpenChange={(o) => !o && setEmbed(null)}><DialogContent size="xl"><DialogHeader><DialogTitle className="truncate pr-8">{embed?.title}</DialogTitle></DialogHeader><DialogBody><div className="h-[65vh]"><Viewer link={embed} /></div></DialogBody></DialogContent></Dialog>
    </div>
  );
}

function LinkDialog({ initial, folders, onClose }: { initial: Partial<ResourceLink>; folders: Folder[]; onClose: () => void }) {
  const app = useApp();
  const [v, setV] = useState<Partial<ResourceLink>>({ title: '', description: '', url: '', category: 'General', tags: [], provider: 'Website', embeddable: false, thumbnail_url: null, folder_id: null, ...initial });
  const [tags, setTags] = useState((initial.tags || []).join(', '));
  const set = (p: Partial<ResourceLink>) => setV((s) => ({ ...s, ...p }));
  const onUrl = (url: string) => { const provider = detectProvider(url); set({ url, provider, embeddable: !!embedUrl(url, provider), thumbnail_url: v.thumbnail_url && !v.thumbnail_url.includes('ytimg') ? v.thumbnail_url : linkThumb(url, provider) }); };
  const valid = /^https?:\/\/[^\s]+\.[^\s]+/i.test(v.url || '') && !!v.title?.trim();
  const save = async () => {
    const row = { title: v.title!.trim().slice(0, 200), description: (v.description || '').slice(0, 1000), url: v.url!.trim(), provider: v.provider || 'Website', category: (v.category || 'General').trim().slice(0, 60), tags: tags.split(',').map((t) => t.trim().toLowerCase().replace(/^#/, '')).filter(Boolean).slice(0, 12), thumbnail_url: v.thumbnail_url && /^https:\/\//.test(v.thumbnail_url) ? v.thumbnail_url : null, embeddable: !!v.embeddable, folder_id: v.folder_id || null };
    if (initial.id) await db.update('resource_links', initial.id, row);
    else { const l = await db.insert<ResourceLink>('resource_links', { ...row, owner_id: app.user.id }); app.log('added resource', 'link', l.id, l.title); }
    onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="lg">
        <DialogHeader><DialogTitle>{initial.id ? 'Edit resource' : 'Add learning resource'}</DialogTitle></DialogHeader>
        <DialogBody>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-[1fr_200px]">
            <div className="space-y-4">
              <div><Label>Website URL</Label><Input autoFocus value={v.url} onChange={(e) => onUrl(e.target.value)} placeholder="https://…" /></div>
              <div><Label>Title</Label><Input maxLength={200} value={v.title} onChange={(e) => set({ title: e.target.value })} /></div>
              <div><Label>Short description</Label><Textarea rows={2} value={v.description} onChange={(e) => set({ description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Category</Label><Input list="res-cats" maxLength={60} value={v.category} onChange={(e) => set({ category: e.target.value })} /><datalist id="res-cats">{['Videos', 'Quizzes & games', 'Flashcards', 'Courses', 'Code', 'Research', 'Textbooks', 'Forms', 'Tools', 'General'].map((c) => <option key={c} value={c} />)}</datalist></div>
                <div><Label>Source</Label><NativeSelect value={v.provider} onChange={(e) => set({ provider: e.target.value })}>{PROVIDERS.map((p) => <option key={p}>{p}</option>)}</NativeSelect></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label hint="comma separated">Tags</Label><Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="sql, week-3" /></div>
                <div><Label>Folder</Label><NativeSelect value={v.folder_id || ''} onChange={(e) => set({ folder_id: e.target.value || null })}><option value="">No folder</option>{folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</NativeSelect></div>
              </div>
              <div><Label hint="optional, https only">Thumbnail image URL</Label><Input value={v.thumbnail_url || ''} onChange={(e) => set({ thumbnail_url: e.target.value || null })} placeholder="Automatic for YouTube" /></div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[#6D60C2]" checked={!!v.embeddable} onChange={(e) => set({ embeddable: e.target.checked })} /> Embed inside Notevia when the site allows it</label>
            </div>
            <div><Label>Preview</Label><LinkThumb l={{ thumbnail_url: v.thumbnail_url || null, provider: v.provider || 'Website', url: v.url || 'https://example.com', title: v.title || '' }} /><div className="mt-2 text-sm font-medium">{v.title || 'Title'}</div><div className="text-xs text-muted-foreground">{v.description}</div></div>
          </div>
        </DialogBody>
        <DialogFooter><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={!valid} onClick={save}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
