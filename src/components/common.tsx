import { useEffect, useState } from 'react';
import { Check, CloudOff, Loader2, LayoutGrid, List } from 'lucide-react';
import markUrl from '@/assets/brand/notevia-mark.png';
import wordUrl from '@/assets/brand/notevia-wordmark.png';
import wordDarkUrl from '@/assets/brand/notevia-wordmark-dark.png';
import logoUrl from '@/assets/brand/notevia-logo.png';
import logoDarkUrl from '@/assets/brand/notevia-logo-dark.png';
import { cn, initials, KIND_STYLE, fileKind } from '@/lib/utils';
import type { SaveState } from '@/canvas/useInk';

function useDark() {
  const [d, setD] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => { const o = new MutationObserver(() => setD(document.documentElement.classList.contains('dark'))); o.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] }); return () => o.disconnect(); }, []);
  return d;
}
/** Official Notevia brand assets (from the supplied logo; not redrawn). */
export function Mark({ size = 32, className }: { size?: number; className?: string }) {
  return <img src={markUrl} alt="Notevia" width={size} height={size} className={cn('shrink-0 object-contain', className)} style={{ width: size, height: size }} draggable={false} />;
}
export function Wordmark({ height = 22, className }: { height?: number; className?: string }) {
  const dark = useDark();
  return <img src={dark ? wordDarkUrl : wordUrl} alt="notevia." style={{ height }} className={cn('w-auto object-contain', className)} draggable={false} />;
}
export function Lockup({ compact, size = 34 }: { compact?: boolean; size?: number }) {
  return <div className="flex items-center gap-2.5"><Mark size={size} />{!compact && <Wordmark height={size * 0.58} />}</div>;
}
export function FullLogo({ width = 220, className }: { width?: number; className?: string }) {
  const dark = useDark();
  return <img src={dark ? logoDarkUrl : logoUrl} alt="Notevia — One space. Endless learning." style={{ width }} className={cn('h-auto', className)} draggable={false} />;
}

export function Avatar({ name, color, size = 34 }: { name: string; color?: string | null; size?: number }) {
  return <div className="grid shrink-0 place-items-center rounded-full font-semibold text-[#4E3F80]" style={{ width: size, height: size, background: color || '#E4DDFB', fontSize: size * 0.38 }} aria-hidden>{initials(name)}</div>;
}

export function FileBadge({ mime, name, size = 40 }: { mime: string; name: string; size?: number }) {
  const s = KIND_STYLE[fileKind(mime, name)];
  return <div className="grid shrink-0 place-items-center rounded-lg font-bold tracking-wide" style={{ width: size, height: size * 1.2, background: s.bg, color: s.fg, fontSize: Math.max(8, size * 0.2) }} aria-label={s.label}>{s.label}</div>;
}

export function Empty({ icon, title, body, action, className }: { icon: React.ReactNode; title: string; body?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-14 text-center', className)}>
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-lavender-ink dark:text-lavender [&_svg]:size-6">{icon}</div>
      <h4 className="font-semibold">{title}</h4>
      {body && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, icon }: { title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="flex items-start gap-3">
        {icon && <div className="mt-0.5 hidden h-10 w-10 place-items-center rounded-xl bg-secondary text-lavender-ink sm:grid dark:text-lavender [&_svg]:size-5">{icon}</div>}
        <div><h1 className="text-2xl font-semibold tracking-tight">{title}</h1>{subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}</div>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function ViewToggle({ value, onChange }: { value: 'grid' | 'list'; onChange: (v: 'grid' | 'list') => void }) {
  return (
    <div className="flex rounded-xl border border-border bg-card p-0.5" role="group" aria-label="View">
      {(['grid', 'list'] as const).map((v) => (
        <button key={v} aria-pressed={value === v} aria-label={`${v} view`} onClick={() => onChange(v)} className={cn('grid h-8 w-8 place-items-center rounded-lg', value === v ? 'bg-secondary text-lavender-ink dark:text-lavender' : 'text-muted-foreground hover:text-foreground')}>
          {v === 'grid' ? <LayoutGrid className="size-4" /> : <List className="size-4" />}
        </button>
      ))}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) { return <div className={cn('h-6 w-6 animate-spin rounded-full border-[3px] border-lavender/25 border-t-lavender-deep', className)} role="status" aria-label="Loading" />; }
export function FullSpinner({ label }: { label?: string }) {
  return <div className="grid h-full min-h-[40vh] place-items-center"><div className="flex flex-col items-center gap-3"><Spinner />{label && <span className="text-sm text-muted-foreground">{label}</span>}</div></div>;
}

export function SaveBadge({ state, readOnly }: { state: SaveState; readOnly?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs', state === 'error' ? 'bg-red-50 text-red-600 dark:bg-red-500/10' : 'bg-muted text-muted-foreground')} role="status">
      {readOnly ? 'View only' : state === 'saving' ? <><Loader2 className="size-3 animate-spin" /> Saving…</> : state === 'error' ? <><CloudOff className="size-3" /> Offline — retrying</> : <><Check className="size-3" /> Saved</>}
    </span>
  );
}

export function Progress({ value, className }: { value: number; className?: string }) {
  return <div className={cn('h-2 overflow-hidden rounded-full bg-muted', className)} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-lavender transition-all" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
}

export function ColorDots({ colors, value, onChange, size = 28 }: { colors: string[]; value: string; onChange: (c: string) => void; size?: number }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup">
      {colors.map((c) => <button key={c} type="button" role="radio" aria-checked={value === c} aria-label={c} onClick={() => onChange(c)} className={cn('rounded-lg border border-black/5 transition', value === c && 'ring-2 ring-primary ring-offset-2 ring-offset-card')} style={{ width: size, height: size, background: c }} />)}
    </div>
  );
}

export function FolderArt({ color, className }: { color: string; className?: string }) {
  return (
    <svg viewBox="0 0 120 92" className={cn('w-full', className)} aria-hidden>
      <path d="M8 18a10 10 0 0 1 10-10h26c4 0 6 2 8 5l4 5h46a10 10 0 0 1 10 10v54a10 10 0 0 1-10 10H18A10 10 0 0 1 8 82Z" fill={color} />
      <path d="M8 30a8 8 0 0 1 8-8h88a8 8 0 0 1 8 8v52a10 10 0 0 1-10 10H18A10 10 0 0 1 8 82Z" fill="#fff" opacity=".35" />
    </svg>
  );
}
