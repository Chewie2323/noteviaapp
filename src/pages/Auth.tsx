import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Loader2, GraduationCap, NotebookPen, BriefcaseBusiness, MailCheck, ShieldCheck } from 'lucide-react';
import { auth, db, GOOGLE_AUTH, MODE, supabase } from '@/lib/backend';
import type { Profile, Role } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Avatar, FullLogo, Lockup } from '@/components/common';
import { cn } from '@/lib/utils';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-[100dvh] bg-background lg:grid-cols-[1fr_1.05fr]">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-lilac p-12 lg:flex dark:bg-[#211d2e]">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-dusty/70 blur-2xl dark:bg-lavender/10" />
        <div className="absolute -bottom-32 left-10 h-80 w-80 rounded-full bg-sage/60 blur-2xl dark:bg-sage/10" />
        <Link to="/" className="relative"><Lockup size={34} /></Link>
        <div className="relative"><FullLogo width={340} /><p className="mt-6 max-w-sm text-muted-foreground">Bring your notes, documents, teaching materials and ideas together in one beautifully designed digital workspace.</p></div>
        <p className="relative flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4" /> Private by default · designed with UK GDPR principles</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm animate-fade-up">
          <Link to="/" className="mb-8 block lg:hidden"><Lockup size={34} /></Link>
          {children}
        </div>
      </div>
    </div>
  );
}
const GoogleIcon = () => <svg viewBox="0 0 24 24" className="size-4" aria-hidden><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z"/><path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z"/><path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9Z"/></svg>;
function GoogleButton({ label }: { label: string }) {
  const [err, setErr] = useState('');
  if (!GOOGLE_AUTH) return null;
  return <><Button variant="outline" className="w-full" onClick={() => auth.signInWithGoogle().catch((e) => setErr(e.message))}><GoogleIcon /> {label}</Button>{err && <p className="mt-1 text-xs text-red-600">{err}</p>}<div className="my-4 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div></>;
}

export function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState(''); const [pw, setPw] = useState('');
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [err, setErr] = useState(''); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState<Profile[]>([]);
  useEffect(() => { if (MODE === 'demo') db.list<Profile>('profiles').then((r) => setDemo(r.filter((p) => p.email.endsWith('@notevia.demo')))); }, []);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setMsg(''); setBusy(true);
    try {
      if (mode === 'login') { await auth.signIn(email, pw); nav('/app'); }
      else { await auth.resetPassword(email); setMsg(MODE === 'demo' ? 'Password reset emails are sent once Supabase is connected.' : 'If an account exists for that email, a reset link is on its way.'); }
    } catch (x: any) { setErr(x.message || 'Something went wrong'); } finally { setBusy(false); }
  };
  return (
    <Shell>
      <h1 className="text-2xl font-bold tracking-tight">{mode === 'login' ? 'Welcome back' : 'Reset your password'}</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">{mode === 'login' ? 'Sign in to your Notevia workspace.' : 'We’ll email you a secure link.'}</p>
      {mode === 'login' && <GoogleButton label="Continue with Google" />}
      <form onSubmit={submit} className="space-y-4">
        <div><Label htmlFor="email">Email</Label><Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        {mode === 'login' && <div><Label htmlFor="pw">Password</Label><Input id="pw" type="password" required={MODE === 'supabase'} autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} /></div>}
        {err && <p className="text-sm text-red-600" role="alert">{err}</p>}
        {msg && <p className="text-sm text-[#2F7650]" role="status">{msg}</p>}
        <Button className="w-full" disabled={busy}>{busy && <Loader2 className="animate-spin" />}{mode === 'login' ? 'Sign in' : 'Send reset link'}</Button>
      </form>
      <div className="mt-4 flex justify-between text-sm">
        <button className="text-lavender-ink hover:underline dark:text-lavender" onClick={() => { setMode(mode === 'login' ? 'forgot' : 'login'); setErr(''); setMsg(''); }}>{mode === 'login' ? 'Forgot password?' : '← Back to sign in'}</button>
        <Link to="/register" className="text-muted-foreground hover:text-foreground">Create account</Link>
      </div>
      {MODE === 'demo' && demo.length > 0 && (
        <div className="mt-8 border-t border-border pt-6">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Explore the demo as…</div>
          <div className="space-y-2">
            {demo.map((p) => (
              <button key={p.id} onClick={async () => { await auth.demoAs(p.id); nav('/app'); }} className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift">
                <Avatar name={p.full_name} color={p.avatar_color} size={36} />
                <div className="flex-1"><div className="text-sm font-medium">{p.full_name}</div><div className="text-[11px] capitalize text-muted-foreground">{p.role === 'admin' ? 'Administrator' : p.role}{p.organisation ? ` · ${p.organisation}` : ''}</div></div>
              </button>
            ))}
          </div>
        </div>
      )}
    </Shell>
  );
}

const ROLES: { id: Exclude<Role, 'admin'>; label: string; desc: string; icon: any }[] = [
  { id: 'educator', label: 'Educator', desc: 'Teach classes, share materials, set and mark work', icon: GraduationCap },
  { id: 'student', label: 'Student', desc: 'Join classrooms, take notes, submit assignments', icon: NotebookPen },
  { id: 'individual', label: 'Individual', desc: 'Personal notes, research and professional work', icon: BriefcaseBusiness },
];

export function Register() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const invite = params.get('invite') || undefined;
  const [v, setV] = useState({ full_name: '', email: params.get('email') || '', password: '', role: (params.get('role') as any) || (invite ? 'student' : 'educator'), organisation: '', code: params.get('code') || '' });
  const [agree, setAgree] = useState(false);
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [verify, setVerify] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('');
    if (!agree) return setErr('Please accept the terms and privacy policy.');
    setBusy(true);
    try {
      if (supabase && !(await db.rpc<boolean>('registration_open', {}).catch(() => true))) throw new Error('Registration is currently closed. Contact your administrator.');
      const r = await auth.register({ ...v, invite, code: v.code.trim() || undefined });
      if (r === 'verify') setVerify(true);
      else {
        if (MODE === 'demo' && invite) {
          const me = await auth.current();
          const inv = (await db.list<any>('invitations')).find((i) => i.token === invite && !i.accepted && i.email.toLowerCase() === v.email.toLowerCase());
          if (inv && me) { await db.insert('classroom_members', { classroom_id: inv.classroom_id, user_id: me.id, role: 'student', progress: 0 }); await db.update('invitations', inv.id, { accepted: true }); }
        }
        if (MODE === 'demo' && v.code.trim()) {
          const cls = (await db.list<any>('classrooms')).find((c) => c.join_code === v.code.trim().toUpperCase());
          const me = await auth.current();
          if (cls && me) await db.insert('classroom_members', { classroom_id: cls.id, user_id: me.id, role: 'student', progress: 0 });
        }
        nav('/app');
      }
    } catch (x: any) { setErr(x.message || 'Registration failed'); } finally { setBusy(false); }
  };
  if (verify) return (
    <Shell>
      <MailCheck className="mb-4 size-10 text-lavender-deep" />
      <h1 className="text-2xl font-bold">Check your inbox</h1>
      <p className="mt-2 text-sm text-muted-foreground">We sent a verification link to <b className="text-foreground">{v.email}</b>. Confirm your email, then sign in.</p>
      <div className="mt-6 flex gap-2"><Button onClick={() => nav('/login')}>Go to sign in</Button><Button variant="ghost" onClick={() => auth.resendVerification(v.email).then(() => setErr('Sent again.')).catch((e) => setErr(e.message))}>Resend email</Button></div>
      {err && <p className="mt-3 text-sm text-muted-foreground">{err}</p>}
    </Shell>
  );
  return (
    <Shell>
      <h1 className="text-2xl font-bold tracking-tight">Create your workspace</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">{invite ? 'You’ve been invited to a classroom.' : 'Free to start. Private by default.'}</p>
      <GoogleButton label="Sign up with Google" />
      <form onSubmit={submit} className="space-y-4">
        <fieldset>
          <legend className="mb-1.5 text-xs font-medium text-muted-foreground">I’m using Notevia as…</legend>
          <div className="grid gap-2">
            {ROLES.map((r) => (
              <label key={r.id} className={cn('flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition', v.role === r.id ? 'border-lavender-deep bg-secondary/60' : 'border-border hover:bg-muted')}>
                <input type="radio" name="role" className="sr-only" checked={v.role === r.id} onChange={() => setV({ ...v, role: r.id })} />
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-card"><r.icon className="size-4 text-lavender-deep" /></span>
                <span><span className="block text-sm font-medium">{r.label}</span><span className="text-xs text-muted-foreground">{r.desc}</span></span>
              </label>
            ))}
          </div>
        </fieldset>
        <div><Label htmlFor="name">Full name</Label><Input id="name" required maxLength={120} autoComplete="name" value={v.full_name} onChange={(e) => setV({ ...v, full_name: e.target.value })} /></div>
        <div><Label htmlFor="email">Email</Label><Input id="email" type="email" required autoComplete="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></div>
        <div><Label htmlFor="pw" hint="at least 8 characters">Password</Label><Input id="pw" type="password" required minLength={8} autoComplete="new-password" value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} /></div>
        {v.role !== 'student' && <div><Label htmlFor="org" hint="optional">Organisation</Label><Input id="org" maxLength={120} value={v.organisation} onChange={(e) => setV({ ...v, organisation: e.target.value })} /></div>}
        {v.role === 'student' && !invite && <div><Label htmlFor="code" hint="optional">Classroom code</Label><Input id="code" className="uppercase" maxLength={10} value={v.code} onChange={(e) => setV({ ...v, code: e.target.value })} placeholder="e.g. 7K2Q9XA" /></div>}
        <label className="flex items-start gap-2 text-xs text-muted-foreground"><input type="checkbox" className="mt-0.5 accent-[#6D60C2]" checked={agree} onChange={(e) => setAgree(e.target.checked)} /> I agree to the <Link to="/terms" className="underline">Terms of service</Link> and <Link to="/privacy" className="underline">Privacy policy</Link>.</label>
        {err && <p className="text-sm text-red-600" role="alert">{err}</p>}
        <Button className="w-full" disabled={busy}>{busy && <Loader2 className="animate-spin" />} Create account</Button>
      </form>
      <p className="mt-4 text-center text-sm text-muted-foreground">Already have an account? <Link to="/login" className="text-lavender-ink hover:underline dark:text-lavender">Sign in</Link></p>
    </Shell>
  );
}

export function ResetPassword() {
  const nav = useNavigate();
  const [pw, setPw] = useState(''); const [err, setErr] = useState('');
  return (
    <Shell>
      <h1 className="text-2xl font-bold">Choose a new password</h1>
      <form className="mt-6 space-y-4" onSubmit={async (e) => { e.preventDefault(); try { await auth.updatePassword(pw); nav('/app'); } catch (x: any) { setErr(x.message); } }}>
        <div><Label htmlFor="np">New password</Label><Input id="np" type="password" minLength={8} required value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /></div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <Button className="w-full">Update password</Button>
      </form>
    </Shell>
  );
}

/** /invite/:token — shows the classroom and routes to sign-up (or joins straight away when signed in). */
export function AcceptInvite({ signedIn }: { signedIn?: boolean }) {
  const { token } = useParams();
  const nav = useNavigate();
  const [info, setInfo] = useState<{ email: string; classroom: string; subject: string } | null | undefined>(undefined);
  const [err, setErr] = useState('');
  useEffect(() => {
    (async () => {
      if (supabase) setInfo((await db.rpc<any>('invitation_info', { p_token: token }).catch(() => null)) || null);
      else {
        const inv = (await db.list<any>('invitations')).find((i) => i.token === token && !i.accepted);
        const c = inv && (await db.get<any>('classrooms', inv.classroom_id));
        setInfo(inv && c ? { email: inv.email, classroom: c.name, subject: c.subject } : null);
      }
    })();
  }, [token]);
  const join = async () => {
    try {
      if (supabase) { const cid = await db.rpc<string>('accept_invitation', { p_token: token }); nav(`/app/classes/${cid}`); return; }
      const inv = (await db.list<any>('invitations')).find((i) => i.token === token && !i.accepted);
      const me = await auth.current();
      if (!inv || !me) throw new Error('Invitation not found');
      if (inv.email.toLowerCase() !== me.email.toLowerCase()) throw new Error(`This invitation was sent to ${inv.email}. Sign in with that account.`);
      await db.insert('classroom_members', { classroom_id: inv.classroom_id, user_id: me.id, role: 'student', progress: 0 });
      await db.update('invitations', inv.id, { accepted: true });
      nav(`/app/classes/${inv.classroom_id}`);
    } catch (e: any) { setErr(e.message); }
  };
  return (
    <Shell>
      {info === undefined ? <Loader2 className="animate-spin text-lavender-deep" /> : !info ? (
        <><h1 className="text-xl font-bold">Invitation not found</h1><p className="mt-2 text-sm text-muted-foreground">This link is invalid or has already been used. Ask your educator for a new invitation or a classroom code.</p><Button className="mt-6" onClick={() => nav('/')}>Go home</Button></>
      ) : (
        <>
          <GraduationCap className="mb-4 size-10 text-lavender-deep" />
          <h1 className="text-2xl font-bold">Join {info.classroom}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{info.subject} · invitation for <b className="text-foreground">{info.email}</b></p>
          <div className="mt-6 flex flex-wrap gap-2">
            {signedIn ? <Button onClick={join}>Join classroom</Button> : <>
              <Button asChild><Link to={`/register?invite=${token}&email=${encodeURIComponent(info.email)}&role=student`}>Create account & join</Link></Button>
              <Button asChild variant="outline"><Link to={`/login`}>I already have an account</Link></Button>
            </>}
          </div>
          {!signedIn && <p className="mt-4 text-xs text-muted-foreground">Already registered? Sign in, then open this link again to join.</p>}
          {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
        </>
      )}
    </Shell>
  );
}
