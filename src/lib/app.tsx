import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { auth, db, startRealtime } from './backend';
import { useTable } from './hooks';
import type { Assignment, Classroom, ClassroomMember, Favourite, Folder, Profile, RecentItem, ResourceType, Share, Submission } from './types';
import { AccessContext, accessFor, memberClassroomIds } from './access';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// ---------------- toasts ----------------
interface Toast { id: number; text: string; tone: 'ok' | 'err' | 'info'; action?: { label: string; run: () => void } }
const ToastCtx = createContext<(t: string, tone?: Toast['tone'], action?: Toast['action']) => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastHost({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toast = useCallback((text: string, tone: Toast['tone'] = 'ok', action?: Toast['action']) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone, action }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), action ? 6000 : 3400);
  }, []);
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="fixed bottom-5 left-1/2 z-[200] flex -translate-x-1/2 flex-col items-center gap-2 pointer-events-none" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`pointer-events-auto flex items-center gap-3 rounded-full px-5 py-2.5 text-sm shadow-lift animate-fade-up ${t.tone === 'err' ? 'bg-red-600 text-white' : 'bg-charcoal text-white dark:bg-white dark:text-charcoal'}`}>
            {t.text}
            {t.action && <button className="font-semibold underline underline-offset-2" onClick={() => { t.action!.run(); setToasts((x) => x.filter((y) => y.id !== t.id)); }}>{t.action.label}</button>}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// ---------------- imperative dialogs ----------------
function mount<T>(render: (done: (v: T) => void) => React.ReactNode): Promise<T> {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const root = createRoot(el);
    const done = (v: T) => { root.unmount(); el.remove(); resolve(v); };
    root.render(<>{render(done)}</>);
  });
}
function Prompt({ title, label, initial, ok, done }: { title: string; label?: string; initial?: string; ok?: string; done: (v: string | null) => void }) {
  const [v, setV] = useState(initial || '');
  return (
    <Dialog open onOpenChange={(o) => !o && done(null)}>
      <DialogContent size="sm" onOpenAutoFocus={(e) => { e.preventDefault(); setTimeout(() => (document.getElementById('nv-prompt') as HTMLInputElement)?.select(), 20); }}>
        <DialogHeader><DialogTitle>{title}</DialogTitle>{label && <DialogDescription>{label}</DialogDescription>}</DialogHeader>
        <DialogBody><Input id="nv-prompt" autoFocus value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && v.trim() && done(v.trim())} /></DialogBody>
        <DialogFooter><Button variant="ghost" onClick={() => done(null)}>Cancel</Button><Button disabled={!v.trim()} onClick={() => done(v.trim())}>{ok || 'Save'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
export const ask = {
  prompt: (title: string, initial = '', label?: string, ok?: string) => mount<string | null>((done) => <Prompt title={title} initial={initial} label={label} ok={ok} done={done} />),
  confirm: (title: string, body: string, ok = 'Delete', danger = true) => mount<boolean>((done) => (
    <Dialog open onOpenChange={(o) => !o && done(false)}>
      <DialogContent size="sm">
        <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{body}</DialogDescription></DialogHeader>
        <DialogFooter><Button variant="ghost" onClick={() => done(false)}>Cancel</Button><Button variant={danger ? 'destructive' : 'default'} onClick={() => done(true)}>{ok}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )),
};

// ---------------- theme ----------------
export function useTheme() {
  const [dark, setDark] = useState(() => localStorage.getItem('nv-theme') === 'dark');
  useEffect(() => { document.documentElement.classList.toggle('dark', dark); localStorage.setItem('nv-theme', dark ? 'dark' : 'light'); }, [dark]);
  return [dark, setDark] as const;
}

// ---------------- app context ----------------
interface AppCtx {
  user: Profile;
  refreshUser: () => Promise<void>;
  profiles: Profile[];
  profile: (id: string) => Profile | undefined;
  access: AccessContext;
  classIds: Set<string>;
  can: (type: ResourceType, item: { id: string; owner_id: string; folder_id?: string | null; deleted_at?: string | null }) => ReturnType<typeof accessFor>;
  favourites: Favourite[];
  isFav: (type: ResourceType, id: string) => boolean;
  toggleFav: (type: ResourceType, id: string) => Promise<void>;
  touchRecent: (type: 'document' | 'notebook', id: string) => Promise<void>;
  log: (action: string, type: string, id: string, name: string, classroom_id?: string | null) => void;
  notify: (userIds: string[], n: { kind: string; title: string; body?: string; link?: string }) => Promise<void>;
  toast: ReturnType<typeof useToast>;
  dark: boolean; setDark: (d: boolean) => void;
}
const Ctx = createContext<AppCtx | null>(null);
export const useApp = () => useContext(Ctx)!;

export function AppProvider({ user: initialUser, children }: { user: Profile; children: React.ReactNode }) {
  const toast = useToast();
  const [dark, setDark] = useTheme();
  const [user, setUser] = useState(initialUser);
  useEffect(() => setUser(initialUser), [initialUser]);
  useEffect(() => { startRealtime(); }, []);
  const { rows: profiles } = useTable<Profile>('profiles', undefined, { col: 'full_name', asc: true });
  const { rows: shares } = useTable<Share>('shares');
  const { rows: members } = useTable<ClassroomMember>('classroom_members');
  const { rows: classrooms } = useTable<Classroom>('classrooms');
  const { rows: folders } = useTable<Folder>('folders', undefined, { col: 'created_at', asc: true });
  const { rows: assignments } = useTable<Assignment>('assignments');
  const { rows: submissions } = useTable<Submission>('submissions');
  const { rows: favourites } = useTable<Favourite>('favourites', { user_id: user.id });

  const value = useMemo<AppCtx>(() => {
    const ownedClassrooms = classrooms.filter((c) => c.owner_id === user.id);
    const access: AccessContext = { user, shares, memberships: members, ownedClassrooms, folders, assignments, submissions };
    const classIds = memberClassroomIds(access);
    // people I'm connected with (mirrors the profiles RLS policy)
    const myClassMembers = new Set(members.filter((m) => ownedClassrooms.some((c) => c.id === m.classroom_id)).map((m) => m.user_id));
    const myTeachers = new Set(classrooms.filter((c) => members.some((m) => m.user_id === user.id && m.classroom_id === c.id)).map((c) => c.owner_id));
    const sharePeople = new Set(shares.filter((s) => s.grantee_type === 'user' && (s.owner_id === user.id || s.grantee_id === user.id)).flatMap((s) => [s.owner_id, s.grantee_id]));
    const visible = profiles.filter((p) => p.id === user.id || user.role === 'admin' || myClassMembers.has(p.id) || myTeachers.has(p.id) || sharePeople.has(p.id));
    const byId = new Map(visible.map((p) => [p.id, p]));
    return {
      user,
      refreshUser: async () => { const p = await db.get<Profile>('profiles', user.id); if (p) setUser(p); },
      profiles: visible,
      profile: (id) => byId.get(id),
      access, classIds,
      can: (type, item) => accessFor(access, type, item),
      favourites,
      isFav: (type, id) => favourites.some((f) => f.resource_type === type && f.resource_id === id),
      toggleFav: async (type, id) => {
        const f = favourites.find((x) => x.resource_type === type && x.resource_id === id);
        if (f) { await db.remove('favourites', f.id); toast('Removed from favourites'); }
        else { await db.insert('favourites', { user_id: user.id, resource_type: type, resource_id: id }); toast('Added to favourites'); }
      },
      touchRecent: async (type, id) => {
        try {
          const r = await db.list<RecentItem>('recent_items', { user_id: user.id, resource_id: id });
          if (r[0]) await db.update('recent_items', r[0].id, { opened_at: new Date().toISOString() });
          else await db.insert('recent_items', { user_id: user.id, resource_type: type, resource_id: id, opened_at: new Date().toISOString() });
        } catch { /* non-critical */ }
      },
      log: (action, resource_type, resource_id, resource_name, classroom_id = null) => {
        db.insert('activity_logs', { actor_id: user.id, action, resource_type, resource_id, resource_name, classroom_id }).catch(() => {});
      },
      notify: async (ids, n) => {
        for (const id of Array.from(new Set(ids)).filter((x) => x !== user.id)) await db.insert('notifications', { user_id: id, read: false, ...n }).catch(() => {});
      },
      toast,
      dark, setDark,
    };
  }, [user, profiles, shares, members, classrooms, folders, assignments, submissions, favourites, dark, toast]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuthState() {
  const [user, setUser] = useState<Profile | null | undefined>(undefined);
  useEffect(() => { auth.current().then(setUser).catch(() => setUser(null)); return auth.onChange(setUser); }, []);
  return user;
}
