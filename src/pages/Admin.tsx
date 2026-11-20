import { useEffect, useState } from 'react';
import { ShieldCheck, Users, Settings2, Lock, Search } from 'lucide-react';
import { useApp, ask } from '@/lib/app';
import { useTable } from '@/lib/hooks';
import { db, MODE } from '@/lib/backend';
import type { PlatformSettings, Profile, Role } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input, Label, NativeSelect, Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/misc';
import { Avatar, Empty, PageHeader } from '@/components/common';
import { timeAgo } from '@/lib/utils';

/** Platform administration: accounts and settings only. Administrators cannot open users' content (enforced by RLS). */
export default function Admin() {
  const app = useApp();
  const { rows: users } = useTable<Profile>('profiles', app.user.role === 'admin' ? {} : null, { col: 'created_at' });
  const { rows: settingsRows } = useTable<PlatformSettings>('platform_settings', app.user.role === 'admin' ? {} : null);
  const [q, setQ] = useState('');
  const s = settingsRows[0];
  const [notice, setNotice] = useState('');
  useEffect(() => setNotice(s?.notice || ''), [s?.id]);
  if (app.user.role !== 'admin') return <Empty icon={<Lock />} title="Administrators only" />;
  const list = users.filter((u) => (u.full_name + u.email).toLowerCase().includes(q.toLowerCase()));
  const counts = (['educator', 'student', 'individual', 'admin'] as Role[]).map((r) => [r, users.filter((u) => u.role === r).length] as const);
  return (
    <div className="animate-fade-up">
      <PageHeader icon={<ShieldCheck />} title="Administration" subtitle="Manage accounts, roles and platform settings. Content stays private to its owners — administrators can’t open it." />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">{counts.map(([r, n]) => <div key={r} className="rounded-2xl border border-border bg-card p-4"><div className="text-2xl font-bold">{n}</div><div className="text-xs capitalize text-muted-foreground">{r === 'admin' ? 'administrators' : r + 's'}</div></div>)}</div>
      <Tabs defaultValue="users">
        <TabsList><TabsTrigger value="users"><Users className="size-3.5" /> Users</TabsTrigger><TabsTrigger value="platform"><Settings2 className="size-3.5" /> Platform</TabsTrigger></TabsList>
        <TabsContent value="users">
          <div className="relative mb-3 max-w-sm"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search users" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or email" /></div>
          <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {list.map((u) => (
              <div key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Avatar name={u.full_name} color={u.avatar_color} size={34} />
                <div className="min-w-[180px] flex-1"><div className="text-sm font-medium">{u.full_name} {u.disabled && <Badge tone="danger">Suspended</Badge>}</div><div className="text-xs text-muted-foreground">{u.email} · joined {timeAgo(u.created_at)}</div></div>
                <NativeSelect className="h-8 w-36 text-xs" aria-label={`Role for ${u.full_name}`} value={u.role} disabled={u.id === app.user.id} onChange={async (e) => { if (await ask.confirm('Change account type?', `${u.full_name} will become ${e.target.value === 'admin' ? 'an administrator' : 'a ' + e.target.value}.`, 'Change', false)) await db.update('profiles', u.id, { role: e.target.value }); }}>
                  <option value="educator">Educator</option><option value="student">Student</option><option value="individual">Individual</option><option value="admin">Administrator</option>
                </NativeSelect>
                <Button size="sm" variant={u.disabled ? 'secondary' : 'ghost'} disabled={u.id === app.user.id} onClick={async () => { if (await ask.confirm(u.disabled ? 'Reactivate account?' : 'Suspend account?', u.disabled ? 'They will be able to use Notevia again.' : 'They keep their data but lose access until reactivated.', u.disabled ? 'Reactivate' : 'Suspend', !u.disabled)) await db.update('profiles', u.id, { disabled: !u.disabled }); }}>{u.disabled ? 'Reactivate' : 'Suspend'}</Button>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Account deletion is done by the user (Settings → Privacy) or, on request, from the Supabase dashboard (Authentication → Users), which removes all their data.</p>
        </TabsContent>
        <TabsContent value="platform">
          {s ? (
            <div className="max-w-2xl space-y-5 rounded-2xl border border-border bg-card p-6">
              <div className="flex items-center justify-between gap-4"><div><div className="text-sm font-medium">Allow new registrations</div><div className="text-xs text-muted-foreground">When off, only existing users can sign in</div></div><Switch checked={s.allow_registration} onCheckedChange={(v) => db.update('platform_settings', s.id, { allow_registration: v })} aria-label="Allow registration" /></div>
              <div className="flex items-center justify-between gap-4"><div><div className="text-sm font-medium">Default storage quota</div><div className="text-xs text-muted-foreground">Enforced per user in the app (VITE_STORAGE_LIMIT_MB) and by bucket size limits</div></div><Input type="number" className="w-28" defaultValue={s.default_quota_mb} onBlur={(e) => db.update('platform_settings', s.id, { default_quota_mb: Number(e.target.value) || 2048 })} aria-label="Quota in MB" /></div>
              <div><Label>Platform notice</Label><Textarea rows={2} value={notice} onChange={(e) => setNotice(e.target.value)} placeholder="Optional message for all users, e.g. planned maintenance" /><div className="mt-2 flex justify-end"><Button size="sm" onClick={() => db.update('platform_settings', s.id, { notice: notice || null })}>Save notice</Button></div></div>
              {MODE === 'demo' && <p className="text-xs text-muted-foreground">Demo mode: settings are stored in this browser only.</p>}
            </div>
          ) : <Empty icon={<Settings2 />} title="Platform settings not found" body="Run the database migration to create them." />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
