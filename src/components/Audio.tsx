import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Play, Pause } from 'lucide-react';
import { db, Bucket } from '@/lib/backend';
import { cn } from '@/lib/utils';

/** MediaRecorder wrapper — needs HTTPS (or localhost) and microphone permission. */
export function AudioRecorder({ onDone, label = 'Record' }: { onDone: (blob: Blob, seconds: number) => void; label?: string }) {
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const [secs, setSecs] = useState(0);
  const [err, setErr] = useState('');
  const chunks = useRef<Blob[]>([]); const timer = useRef<any>();
  const start = async () => {
    setErr('');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error(), { name: 'NotSupported' });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((m) => (window as any).MediaRecorder?.isTypeSupported?.(m)) || '';
      const r = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunks.current = []; r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      const t0 = Date.now();
      r.onstop = () => { stream.getTracks().forEach((t) => t.stop()); clearInterval(timer.current); onDone(new Blob(chunks.current, { type: r.mimeType || 'audio/webm' }), Math.max(1, Math.round((Date.now() - t0) / 1000))); setRec(null); setSecs(0); };
      r.start(); setRec(r); timer.current = setInterval(() => setSecs((s) => s + 1), 1000);
    } catch (e: any) { setErr(e?.name === 'NotAllowedError' ? 'Microphone permission was blocked.' : 'Recording isn’t available in this browser or context.'); }
  };
  useEffect(() => () => clearInterval(timer.current), []);
  return (
    <div className="inline-flex flex-col">
      {rec ? (
        <button onClick={() => rec.stop()} className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-3.5 py-2 text-sm font-medium text-white">
          <Square className="size-3.5" fill="currentColor" /> Stop · {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')} <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
        </button>
      ) : (
        <button onClick={start} className="inline-flex items-center gap-2 rounded-xl bg-dusty px-3.5 py-2 text-sm font-medium text-[#7A3B52] hover:brightness-95"><Mic className="size-4" /> {label}</button>
      )}
      {err && <span className="mt-1 text-xs text-red-600">{err}</span>}
    </div>
  );
}

export function AudioChip({ bucket, path, label, duration }: { bucket: Bucket; path: string; label: string; duration?: number }) {
  const [playing, setPlaying] = useState(false);
  const a = useRef<HTMLAudioElement | null>(null);
  const toggle = async () => {
    try {
      if (!a.current) { a.current = new Audio(await db.fileUrl(bucket, path)); a.current.onended = () => setPlaying(false); }
      if (playing) { a.current.pause(); setPlaying(false); } else { await a.current.play(); setPlaying(true); }
    } catch { setPlaying(false); }
  };
  useEffect(() => () => a.current?.pause(), []);
  return (
    <button onClick={toggle} className={cn('inline-flex items-center gap-2 rounded-full bg-secondary py-1 pl-1.5 pr-3 text-xs font-medium text-lavender-ink dark:text-lavender hover:brightness-95')}>
      <span className="grid h-6 w-6 place-items-center rounded-full bg-lavender text-charcoal">{playing ? <Pause className="size-3" /> : <Play className="ml-0.5 size-3" />}</span>
      <span className="max-w-[160px] truncate">{label}</span>{duration != null && <span className="opacity-60">{duration}s</span>}
    </button>
  );
}
