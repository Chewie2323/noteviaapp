/**
 * Backend adapter.
 *  - "supabase": Supabase Auth, Postgres with Row Level Security, private Storage, Realtime change feed, Edge Functions.
 *  - "demo": everything kept in this browser (IndexedDB) so the whole app runs without configuration.
 * UI code only talks to `db`, `auth` and `fn`.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';
import { nanoid } from 'nanoid';
import type { Profile, Role, TableName } from './types';

export type Bucket = 'documents' | 'notebooks' | 'audio' | 'submissions' | 'templates' | 'covers';

const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const FORCE_DEMO = import.meta.env.VITE_FORCE_DEMO === 'true';

export const MODE: 'supabase' | 'demo' = !FORCE_DEMO && URL_ && KEY ? 'supabase' : 'demo';
export const supabase: SupabaseClient | null = MODE === 'supabase' ? createClient(URL_!, KEY!, { auth: { persistSession: true, detectSessionInUrl: true } }) : null;
export const STORAGE_LIMIT_BYTES = Number(import.meta.env.VITE_STORAGE_LIMIT_MB || 10240) * 1024 * 1024;
/**
 * Account sync with an on-device copy (iOS / Android app): everything you save is written to the app's private storage first
 * (instant, works offline) and then uploaded to your Notevia account in the background, so signing in on another iPad or laptop
 * shows the same files. Files are downloaded on demand and kept on the device afterwards. Browsers read and write the cloud directly.
 */
export const LOCAL_FIRST = MODE === 'supabase' && Capacitor.isNativePlatform();
const LOCAL_BUCKETS = new Set<Bucket>(['documents', 'notebooks', 'audio', 'templates']);
const isLocal = (b: Bucket) => LOCAL_FIRST && LOCAL_BUCKETS.has(b);
const localPath = (b: Bucket, p: string) => `nv-files/${b}/${p}`;
async function fsMod() { return import('@capacitor/filesystem'); }
async function localWrite(bucket: Bucket, path: string, blob: Blob) {
  const { Filesystem, Directory } = await fsMod();
  const data: string = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
  await Filesystem.writeFile({ path: localPath(bucket, path), data, directory: Directory.Data, recursive: true });
}
async function localRead(bucket: Bucket, path: string): Promise<Blob | null> {
  try {
    const { Filesystem, Directory } = await fsMod();
    const { uri } = await Filesystem.getUri({ path: localPath(bucket, path), directory: Directory.Data });
    await Filesystem.stat({ path: localPath(bucket, path), directory: Directory.Data });
    const r = await fetch(Capacitor.convertFileSrc(uri));
    if (!r.ok) return null;
    const blob = await r.blob();
    return blob.size ? blob : null;
  } catch { return null; }
}
async function localDelete(bucket: Bucket, path: string) {
  try { const { Filesystem, Directory } = await fsMod(); await Filesystem.deleteFile({ path: localPath(bucket, path), directory: Directory.Data }); } catch { /* not on this device */ }
}
// uploads waiting for a connection survive app restarts
const PENDING_KEY = 'nv:pending-sync';
const pendingList = (): { b: Bucket; p: string }[] => { try { return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]'); } catch { return []; } };
const setPending = (l: { b: Bucket; p: string }[]) => { try { localStorage.setItem(PENDING_KEY, JSON.stringify(l)); } catch { /* ignore */ } };
const addPending = (b: Bucket, p: string) => { const l = pendingList(); if (!l.some((x) => x.b === b && x.p === p)) setPending([...l, { b, p }]); };
const dropPending = (b: Bucket, p: string) => setPending(pendingList().filter((x) => !(x.b === b && x.p === p)));
let flushing = false;
async function syncUp(b: Bucket, p: string): Promise<boolean> {
  if (!supabase) return true;
  const blob = await localRead(b, p);
  if (!blob) { dropPending(b, p); return true; }
  const { error } = await supabase.storage.from(b).upload(p, blob, { upsert: true, contentType: blob.type || undefined });
  if (error) { console.warn('sync upload failed', b, p, error.message); return false; }
  dropPending(b, p); return true;
}
/** Upload anything still waiting (called on start-up, when the connection returns, and after each save). */
export async function flushPendingSync() {
  if (!LOCAL_FIRST || flushing || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;
  flushing = true;
  try { for (const x of pendingList()) await syncUp(x.b, x.p); } finally { flushing = false; }
}
if (LOCAL_FIRST && typeof window !== 'undefined') { window.addEventListener('online', () => { flushPendingSync(); }); setTimeout(() => { flushPendingSync(); }, 4000); }
export const AI_ENABLED = MODE === 'supabase' && import.meta.env.VITE_AI_ENABLED === 'true';
export const GOOGLE_AUTH = MODE === 'supabase' && import.meta.env.VITE_GOOGLE_AUTH === 'true';

export const uid = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : nanoid());
export const now = () => new Date().toISOString();

// ---------- change notifications ----------
type Listener = () => void;
const listeners = new Map<string, Set<Listener>>();
export function subscribe(table: string, fn: Listener) {
  if (!listeners.has(table)) listeners.set(table, new Set());
  listeners.get(table)!.add(fn);
  return () => { listeners.get(table)!.delete(fn); };
}
export function emit(table: string) {
  listeners.get(table)?.forEach((f) => f());
  listeners.get('*')?.forEach((f) => f());
}

/** Supabase Realtime: refresh any open view when rows change elsewhere (other users / devices). */
let realtimeStarted = false;
export function startRealtime() {
  if (!supabase || realtimeStarted) return;
  realtimeStarted = true;
  const pending = new Set<string>();
  let t: any;
  supabase.channel('nv-changes')
    .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
      pending.add(payload.table);
      clearTimeout(t);
      t = setTimeout(() => { pending.forEach(emit); pending.clear(); }, 250);
    })
    .subscribe();
}

type Row = Record<string, any> & { id: string };
type Match = Record<string, any>;

// ---------- demo storage ----------
const cache = new Map<string, Row[]>();
async function loadTable(t: string): Promise<Row[]> {
  if (cache.has(t)) return cache.get(t)!;
  const rows = ((await idbGet(`nv:table:${t}`)) as Row[] | undefined) || [];
  cache.set(t, rows);
  return rows;
}
const timers: Record<string, any> = {};
function persist(t: string) { clearTimeout(timers[t]); timers[t] = setTimeout(() => idbSet(`nv:table:${t}`, cache.get(t) || []), 100); }
const matches = (r: Row, m?: Match) => !m || Object.entries(m).every(([k, v]) => (v === null ? r[k] == null : Array.isArray(v) ? v.includes(r[k]) : r[k] === v));

export const db = {
  mode: MODE,
  /** match values: scalar = equals, null = IS NULL, array = IN (...) */
  async list<T = Row>(table: TableName, match?: Match, order: { col: string; asc?: boolean } = { col: 'created_at', asc: false }, limit?: number): Promise<T[]> {
    if (supabase) {
      let q = supabase.from(table).select('*');
      for (const [k, v] of Object.entries(match || {})) q = v === null ? q.is(k, null) : Array.isArray(v) ? q.in(k, v) : q.eq(k, v);
      q = q.order(order.col, { ascending: !!order.asc });
      if (limit) q = q.limit(limit);
      const { data, error } = await q;
      if (error) throw error;
      return data as T[];
    }
    const rows = (await loadTable(table)).filter((r) => matches(r, match));
    const c = order.col;
    rows.sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * (order.asc ? 1 : -1));
    return (limit ? rows.slice(0, limit) : rows).map((r) => structuredClone(r)) as T[];
  },
  async get<T = Row>(table: TableName, id: string): Promise<T | null> {
    if (supabase) {
      const { data, error } = await supabase.from(table).select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data as T | null;
    }
    const r = (await loadTable(table)).find((x) => x.id === id);
    return r ? (structuredClone(r) as T) : null;
  },
  async insert<T = Row>(table: TableName, row: Partial<T> & Match): Promise<T> {
    const full: Row = { id: uid(), created_at: now(), ...row } as Row;
    if (supabase) {
      const { data, error } = await supabase.from(table).insert(full).select().single();
      if (error) throw error;
      emit(table);
      return data as T;
    }
    (await loadTable(table)).push(full);
    persist(table); emit(table);
    return structuredClone(full) as T;
  },
  async update<T = Row>(table: TableName, id: string, patch: Partial<T> & Match, silent = false): Promise<void> {
    if (supabase) {
      const { error } = await supabase.from(table).update(patch as any).eq('id', id);
      if (error) throw error;
    } else {
      const rows = await loadTable(table);
      const i = rows.findIndex((r) => r.id === id);
      if (i >= 0) rows[i] = { ...rows[i], ...structuredClone(patch) };
      persist(table);
    }
    if (!silent) emit(table);
  },
  async remove(table: TableName, id: string): Promise<void> {
    if (supabase) {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
    } else {
      cache.set(table, (await loadTable(table)).filter((r) => r.id !== id));
      persist(table);
    }
    emit(table);
  },
  async rpc<T = any>(name: string, args: Record<string, any>): Promise<T> {
    if (!supabase) throw new Error('Not available in demo mode');
    const { data, error } = await supabase.rpc(name, args);
    if (error) throw error;
    return data as T;
  },

  // ----- private storage -----
  async upload(bucket: Bucket, path: string, blob: Blob): Promise<string> {
    if (isLocal(bucket)) { await localWrite(bucket, path, blob); urlCache.delete(`${bucket}/${path}`); addPending(bucket, path); flushPendingSync(); return path; }
    if (supabase) {
      const { error } = await supabase.storage.from(bucket).upload(path, blob, { upsert: true, contentType: blob.type || undefined });
      if (error) throw error;
      return path;
    }
    await idbSet(`nv:file:${bucket}/${path}`, blob);
    urlCache.delete(`${bucket}/${path}`);
    return path;
  },
  async download(bucket: Bucket, path: string): Promise<Blob> {
    if (isLocal(bucket)) {
      const local = await localRead(bucket, path);
      if (local) return local;
    }
    if (supabase) {
      const { data, error } = await supabase.storage.from(bucket).download(path);
      if (error) throw new Error(isLocal(bucket) ? 'This file hasn’t finished syncing from your other device yet. Open Notevia there while online, then try again.' : error.message);
      if (isLocal(bucket)) localWrite(bucket, path, data).catch(() => {});   // keep a copy on this device for next time / offline
      return data;
    }
    const b = (await idbGet(`nv:file:${bucket}/${path}`)) as Blob | undefined;
    if (!b) throw new Error('File not found');
    return b;
  },
  /** Short-lived signed URL (Supabase) or object URL (demo) for a private file. */
  async fileUrl(bucket: Bucket, path: string): Promise<string> {
    const k = `${bucket}/${path}`;
    const c = urlCache.get(k);
    if (c && c.exp > Date.now()) return c.url;
    let url: string;
    if (isLocal(bucket)) url = URL.createObjectURL(await this.download(bucket, path));
    else if (supabase) {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
      if (error) throw error;
      url = data.signedUrl;
    } else url = URL.createObjectURL(await this.download(bucket, path));
    urlCache.set(k, { url, exp: Date.now() + 50 * 60 * 1000 });
    return url;
  },
  async removeFile(bucket: Bucket, path: string) {
    if (isLocal(bucket)) { await localDelete(bucket, path); dropPending(bucket, path); }
    if (supabase) await supabase.storage.from(bucket).remove([path]);
    else await idbDel(`nv:file:${bucket}/${path}`);
    urlCache.delete(`${bucket}/${path}`);
  },
};
const urlCache = new Map<string, { url: string; exp: number }>();

/** Edge Functions (server-side code that may hold secrets such as AI keys). */
export const fn = {
  async call<T = any>(name: string, body: any): Promise<T> {
    if (!supabase) throw new Error('This feature needs the Supabase backend.');
    const { data, error } = await supabase.functions.invoke(name, { body });
    if (error) throw new Error((error as any).context?.error || error.message);
    return data as T;
  },
};

// ---------- auth ----------
const DEMO_USER = 'nv-demo-user';
type AuthListener = (p: Profile | null) => void;
const authListeners = new Set<AuthListener>();
async function sha(s: string) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join('');
}
const announce = async (id: string | null) => { const p = id ? await db.get<Profile>('profiles', id) : null; authListeners.forEach((f) => f(p)); };

export const auth = {
  async current(): Promise<Profile | null> {
    if (supabase) {
      const { data } = await supabase.auth.getSession();
      const u = data.session?.user;
      if (!u) return null;
      return db.get<Profile>('profiles', u.id);
    }
    const id = localStorage.getItem(DEMO_USER);
    return id ? db.get<Profile>('profiles', id) : null;
  },
  async session() { return supabase ? (await supabase.auth.getSession()).data.session : null; },
  onChange(fn: AuthListener) {
    authListeners.add(fn);
    let un = () => {};
    if (supabase) {
      const { data } = supabase.auth.onAuthStateChange(async (_e, s) => fn(s?.user ? await db.get<Profile>('profiles', s.user.id) : null));
      un = () => data.subscription.unsubscribe();
    }
    return () => { authListeners.delete(fn); un(); };
  },
  async signIn(email: string, password: string) {
    if (supabase) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message === 'Email not confirmed' ? 'Please confirm your email address first — check your inbox for the verification link.' : error.message);
      return;
    }
    const p = (await db.list<any>('profiles')).find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
    if (!p) throw new Error('No account found with that email.');
    if (p._pw && p._pw !== (await sha(password))) throw new Error('Incorrect password.');
    localStorage.setItem(DEMO_USER, p.id); await announce(p.id);
  },
  async signInWithGoogle(redirect = location.origin + '/app') {
    if (!supabase) throw new Error('Google sign-in needs Supabase with the Google provider enabled.');
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirect } });
    if (error) throw error;
  },
  /** Returns 'verify' when the user must confirm their email before signing in. */
  async register(v: { email: string; password: string; full_name: string; role: Exclude<Role, 'admin'>; organisation?: string; invite?: string; code?: string }): Promise<'verify' | 'ok'> {
    if (v.password.length < 8) throw new Error('Use at least 8 characters for your password.');
    if (supabase) {
      const { data, error } = await supabase.auth.signUp({
        email: v.email, password: v.password,
        options: { data: { full_name: v.full_name, role: v.role, organisation: v.organisation || null, invite_token: v.invite || null, class_code: v.code || null }, emailRedirectTo: `${location.origin}/app` },
      });
      if (error) throw error;
      return data.session ? 'ok' : 'verify';
    }
    const all = await db.list<any>('profiles');
    if (all.some((x) => x.email.toLowerCase() === v.email.toLowerCase())) throw new Error('An account with this email already exists.');
    const p = await db.insert<any>('profiles', { email: v.email, full_name: v.full_name, role: v.role, organisation: v.organisation || null, avatar_color: '#E4DDFB', settings: { retention_days: 30 }, _pw: await sha(v.password) });
    await db.insert('workspaces', { owner_id: p.id, name: 'My Workspace', color: '#E4DDFB', description: 'Your personal space' });
    localStorage.setItem(DEMO_USER, p.id); await announce(p.id);
    return 'ok';
  },
  async resendVerification(email: string) { if (supabase) { const { error } = await supabase.auth.resend({ type: 'signup', email }); if (error) throw error; } },
  async resetPassword(email: string) {
    if (supabase) { const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/reset-password` }); if (error) throw error; }
  },
  async updatePassword(password: string) {
    if (password.length < 8) throw new Error('Use at least 8 characters.');
    if (supabase) { const { error } = await supabase.auth.updateUser({ password }); if (error) throw error; return; }
    const id = localStorage.getItem(DEMO_USER); if (id) await db.update('profiles', id, { _pw: await sha(password) } as any);
  },
  async demoAs(id: string) { localStorage.setItem(DEMO_USER, id); await announce(id); },
  async signOut() { if (supabase) await supabase.auth.signOut(); localStorage.removeItem(DEMO_USER); await announce(null); },
};

export async function isSeeded() { return supabase ? true : !!(await idbGet('nv:seeded:v1')); }
export async function markSeeded() { await idbSet('nv:seeded:v1', true); }
export async function resetDemo() { const { clear } = await import('idb-keyval'); await clear(); localStorage.removeItem(DEMO_USER); location.reload(); }
