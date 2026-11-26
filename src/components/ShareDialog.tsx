import { useMemo, useState } from 'react';
import { Lock, Users, UserPlus, Trash2, Globe2, Link2 } from 'lucide-react';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect } from '@/components/ui/input';
import { Avatar } from './common';
import { useApp } from '@/lib/app';
import { useTable } from '@/lib/hooks';
import { db, supabase } from '@/lib/backend';
import type { Classroom, Permission, Profile, ResourceType, Share } from '@/lib/types';

const PERMS: { id: Permission; label: string }[] = [{ id: 'view', label: 'View only' }, { id: 'comment', label: 'Can comment' }, { id: 'edit', label: 'Can edit' }];

export function ShareDialog({ open, onOpenChange, type, id, name }: { open: boolean; onOpenChange: (o: boolean) => void; type: ResourceType; id: string; name: string }) {
  const app = useApp();
  const { rows: shares } = useTable<Share>('shares', open ? { resource_type: type, resource_id: id } : null);
  const { rows: classes } = useTable<Classroom>('classrooms');
  const myClasses = classes.filter((c) => app.classIds.has(c.id));
  const [email, setEmail] = useState('');
  const [perm, setPerm] = useState<Permission>('view');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const label = useMemo(() => ({ document: 'document', notebook: 'notebook', folder: 'folder', link: 'resource' })[type], [type]);

  const add = async (grantee_type: 'user' | 'classroom', grantee_id: string) => {
    if (shares.some((s) => s.grantee_type === grantee_type && s.grantee_id === grantee_id)) return;
    await db.insert<Share>('shares', { resource_type: type, resource_id: id, owner_id: app.user.id, grantee_type, grantee_id, permission: perm });
    app.log('shared', type, id, name);
    if (grantee_type === 'user') await app.notify([grantee_id], { kind: 'share', title: `${app.user.full_name} shared “${name}” with you`, link: '/app/shared' });
    else { const members = await db.list<any>('classroom_members', { classroom_id: grantee_id }); await app.notify(members.map((m) => m.user_id), { kind: 'share', title: `New in your classroom: “${name}”`, link: `/app/classes/${grantee_id}` }); }
  };
  const addEmail = async () => {
    setErr(''); setBusy(true);
    try {
      const e = email.trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(e)) throw new Error('Enter a valid email address.');
      let target: { id: string; full_name: string } | null = null;
      if (supabase) { const r = await db.rpc<{ id: string; full_name: string }[]>('find_profile', { p_email: e }); target = r?.[0] || null; }
      else target = (await db.list<Profile>('profiles')).find((p) => p.email.toLowerCase() === e) || null;
      if (!target) throw new Error('No Notevia account uses that email. Ask them to sign up first, or invite them to a classroom.');
      if (target.id === app.user.id) throw new Error('That’s you — you already own this.');
      await add('user', target.id); setEmail('');
    } catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  };
  const nameOf = (s: Share) => s.grantee_type === 'classroom' ? classes.find((c) => c.id === s.grantee_id)?.name || 'Classroom' : app.profile(s.grantee_id)?.full_name || 'Shared user';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader><DialogTitle>Share “{name}”</DialogTitle><DialogDescription>Only people and classrooms listed below can open this {label}. Everyone else — including administrators — cannot.</DialogDescription></DialogHeader>
        <DialogBody className="space-y-5">
          <div>
            <div className="mb-2 text-xs font-medium text-muted-foreground">Or add people</div>
            <Input className="h-12 rounded-2xl" type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addEmail()} />
            <div className="mt-3 text-xs font-medium text-muted-foreground">They can</div>
            <div className="mt-2 flex gap-2" role="radiogroup" aria-label="Permission">
              {PERMS.map((p) => <button key={p.id} role="radio" aria-checked={perm === p.id} onClick={() => setPerm(p.id)} className={`h-10 flex-1 rounded-full text-sm font-medium transition ${perm === p.id ? 'bg-[#E6DFF5] text-[#4E3F80] ring-1 ring-[#B9A5E8]' : 'bg-muted text-foreground/70'}`}>{p.label.replace('View only', 'View').replace('Can comment', 'Comment').replace('Can edit', 'Edit')}</button>)}
            </div>
            <Button size="lg" className="mt-3 w-full" onClick={addEmail} disabled={busy || !email}><UserPlus /> Share</Button>
            {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
          </div>
          {myClasses.length > 0 && (
            <div>
              <div className="mb-2 text-xs font-medium text-muted-foreground">Share with a classroom</div>
              <div className="flex flex-wrap gap-2">
                {myClasses.map((c) => {
                  const on = shares.some((s) => s.grantee_type === 'classroom' && s.grantee_id === c.id);
                  return <button key={c.id} disabled={on} onClick={() => add('classroom', c.id)} className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"><span className="h-3 w-3 rounded-full" style={{ background: c.cover_color }} />{c.name}{on && ' ✓'}</button>;
                })}
              </div>
            </div>
          )}
          <div>
            <div className="mb-2 text-xs font-medium text-muted-foreground">Who has access</div>
            <div className="divide-y divide-border rounded-xl border border-border">
              <div className="flex items-center gap-3 px-3 py-2.5"><Avatar name={app.user.full_name} color={app.user.avatar_color} size={30} /><span className="flex-1 text-sm">{app.user.full_name} (you)</span><span className="text-xs text-muted-foreground">Owner</span></div>
              {shares.map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-3 py-2.5">
                  {s.grantee_type === 'classroom' ? <span className="grid h-[30px] w-[30px] place-items-center rounded-full bg-sage/60"><Users className="size-4" /></span> : <Avatar name={nameOf(s)} size={30} />}
                  <span className="flex-1 truncate text-sm">{nameOf(s)}</span>
                  <NativeSelect className="h-8 w-36 text-xs" value={s.permission} aria-label="Change permission" onChange={(e) => db.update('shares', s.id, { permission: e.target.value })}>{PERMS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</NativeSelect>
                  <button aria-label="Remove access" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-red-600" onClick={() => db.remove('shares', s.id)}><Trash2 className="size-4" /></button>
                </div>
              ))}
              {!shares.length && <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground"><Lock className="size-4" /> Private — only you can see this.</div>}
            </div>
          </div>
          <p className="flex items-start gap-2 text-xs text-muted-foreground"><Globe2 className="mt-0.5 size-3.5 shrink-0" /> Notevia never creates public links. Folder access also applies to everything inside the folder.</p>
        </DialogBody>
        <DialogFooter className="justify-between">
          {(type === 'notebook' || type === 'document') ? <Button variant="outline" onClick={async () => { const path = type === 'notebook' ? `/app/notebooks/${id}` : `/app/documents?open=${id}`; const base = import.meta.env.VITE_HASH_ROUTER === 'true' ? `${location.origin}${location.pathname}#` : location.origin; try { await navigator.clipboard.writeText(base + path); app.toast('Link copied — only people you share with can open it'); } catch { app.toast('Could not copy the link', 'err'); } }}><Link2 /> Copy link</Button> : <span />}
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
