import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, ShieldCheck, Settings } from 'lucide-react';
import { useApp } from '@/lib/app';
import { auth, db } from '@/lib/backend';
import { storageUsed } from '@/lib/actions';
import { formatBytes, initials } from '@/lib/utils';
import { Switch } from '@/components/ui/misc';

const QUOTA = 1024 ** 3; // 1 GB free tier shown in the design

/** Tutor design: "Me" — profile card, storage, quick toggles, privacy, sign out. */
export default function Me() {
  const app = useApp();
  const nav = useNavigate();
  const u = app.user;
  const settings = u.settings || {};
  const [used, setUsed] = useState(0);
  useEffect(() => { storageUsed(u.id).then(setUsed).catch(() => {}); }, [u.id]);
  const setSetting = async (patch: Record<string, any>) => { await db.update('profiles', u.id, { settings: { ...settings, ...patch } }); await app.refreshUser(); };
  const role = u.role === 'educator' ? 'Educator' : u.role === 'student' ? 'Student' : u.role === 'admin' ? 'Administrator' : 'Individual';
  return (
    <div className="animate-fade-up pb-24">
      <h1 className="text-[28px] font-bold tracking-tight">Me</h1>
      <div className="mt-4 flex items-center gap-4 rounded-3xl bg-card p-4 ring-1 ring-border">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-lilac text-lg font-semibold text-[#4E3F80]">{initials(u.full_name)}</div>
        <div className="min-w-0"><div className="truncate text-base font-semibold">{u.full_name}</div><div className="text-sm text-muted-foreground">{role} · Free plan</div></div>
      </div>

      <div className="mt-4 rounded-3xl bg-card p-5 ring-1 ring-border">
        <div className="flex items-baseline justify-between text-sm"><span className="font-semibold">Storage</span><span className="text-muted-foreground">{formatBytes(used)} of 1 GB</span></div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-[#7C6FD1]" style={{ width: `${Math.min(100, (used / QUOTA) * 100)}%` }} /></div>
      </div>

      <div className="mt-4 overflow-hidden rounded-3xl bg-card ring-1 ring-border">
        <Toggle label="Draw with stylus only" checked={!!settings.pencil_only} onChange={(v) => setSetting({ pencil_only: v })} />
        <Toggle label="Dark mode" checked={app.dark} onChange={app.setDark} />
      </div>

      <div className="mt-4 overflow-hidden rounded-3xl bg-card ring-1 ring-border">
        <Link to="/app/settings" className="flex items-center gap-3 border-b border-border px-5 py-4 text-sm font-medium"><Settings className="size-5 text-foreground/60" />All settings<ChevronRight className="ml-auto size-4 text-muted-foreground" /></Link>
        <Link to="/privacy" className="flex items-center gap-3 px-5 py-4 text-sm font-medium"><ShieldCheck className="size-5 text-foreground/60" />Privacy and your data<ChevronRight className="ml-auto size-4 text-muted-foreground" /></Link>
      </div>

      <button onClick={async () => { await auth.signOut(); nav('/'); }} className="mt-6 w-full rounded-2xl bg-card py-4 text-sm font-semibold text-red-600 ring-1 ring-border">Sign out</button>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <div className="flex items-center justify-between border-b border-border px-5 py-4 text-sm font-medium last:border-0">{label}<Switch checked={checked} onCheckedChange={onChange} aria-label={label} /></div>;
}
