import { useState } from 'react';
import { Sparkles, ShieldCheck, Loader2, Copy, CornerDownLeft, X, Info } from 'lucide-react';
import { useApp } from '@/lib/app';
import { AI_ENABLED, MODE, db, fn } from '@/lib/backend';
import { Button } from '@/components/ui/button';
import { Input, Textarea, NativeSelect } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { keyTerms, lessonPlan, quiz, revisionNotes, summarise } from '@/lib/localAI';

/** Tasks the built-in offline helper can do without a server (text never leaves the device). */
const LOCAL_TASKS = ['summarise', 'revision', 'quiz', 'flashcards', 'extract', 'lesson'];
function runLocal(task: string, text: string): string {
  if (task === 'summarise') return summarise(text, 5) || 'Add a few more sentences to summarise.';
  if (task === 'revision') return revisionNotes(text);
  if (task === 'quiz') {
    const q = quiz(text, 6);
    return q.length ? q.map((it, i) => `${i + 1}. ${it.q}\n${(it.options || []).map((o, k) => `   ${'ABCD'[k]}) ${o}`).join('\n')}\n   Answer: ${it.a}`).join('\n\n') : 'Not enough material to build questions. Try a longer passage.';
  }
  if (task === 'flashcards') {
    const q = quiz(text, 8);
    return q.length ? q.map((it) => `Q: ${it.q}\nA: ${it.a}`).join('\n\n') : 'Not enough material to build flashcards.';
  }
  if (task === 'extract') return `Key terms: ${keyTerms(text, 10).join(', ')}\n\nKey points:\n${summarise(text, 4)}`;
  if (task === 'lesson') return lessonPlan(keyTerms(text, 3).join(', ') || 'this topic', 'Mixed level', 60, '');
  return '';
}

export const AI_TASKS: { id: string; label: string; needs?: 'question' | 'target' }[] = [
  { id: 'summarise', label: 'Summarise' }, { id: 'explain', label: 'Explain a concept' }, { id: 'revision', label: 'Revision notes' },
  { id: 'flashcards', label: 'Flashcards' }, { id: 'quiz', label: 'Quiz' }, { id: 'mindmap', label: 'Mind map outline' },
  { id: 'lesson', label: 'Lesson plan' }, { id: 'practice', label: 'Practice questions' }, { id: 'translate', label: 'Translate', needs: 'target' },
  { id: 'improve', label: 'Improve writing' }, { id: 'extract', label: 'Extract key information' }, { id: 'ask', label: 'Ask about this material', needs: 'question' },
];

/** Minimal Markdown → HTML for AI output (headings, lists, bold/italic, paragraphs). */
export function mdToHtml(md: string) {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/(^|\W)\*(.+?)\*(?=\W|$)/g, '$1<em>$2</em>').replace(/`(.+?)`/g, '<code>$1</code>');
  const out: string[] = []; let list: 'ul' | 'ol' | null = null;
  const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const raw of md.split('\n')) {
    const l = raw.trimEnd();
    let m;
    if ((m = l.match(/^(#{1,3})\s+(.*)/))) { close(); out.push(`<h${m[1].length + 1}>${inline(m[2])}</h${m[1].length + 1}>`); }
    else if ((m = l.match(/^\s*[-*•]\s+(.*)/))) { if (list !== 'ul') { close(); out.push('<ul>'); list = 'ul'; } out.push(`<li>${inline(m[1])}</li>`); }
    else if ((m = l.match(/^\s*\d+[.)]\s+(.*)/))) { if (list !== 'ol') { close(); out.push('<ol>'); list = 'ol'; } out.push(`<li>${inline(m[1])}</li>`); }
    else if (!l.trim()) close();
    else { close(); out.push(`<p>${inline(l)}</p>`); }
  }
  close();
  return out.join('');
}

export function AIPanel({ getText, onInsert, onClose, contextLabel }: { getText: () => Promise<string> | string; onInsert?: (text: string, html: string) => void; onClose: () => void; contextLabel: string }) {
  const app = useApp();
  const [task, setTask] = useState('summarise');
  const [question, setQuestion] = useState('');
  const [target, setTarget] = useState('French');
  const [out, setOut] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const consent = !!app.user.settings?.ai_consent;
  const meta = AI_TASKS.find((t) => t.id === task)!;
  const offline = !AI_ENABLED;
  const tasks = offline ? AI_TASKS.filter((t) => LOCAL_TASKS.includes(t.id)) : AI_TASKS;

  const run = async () => {
    setErr(''); setBusy(true); setOut('');
    try {
      const text = await getText();
      if (!text.trim() && task !== 'ask') throw new Error('There’s no text here yet for Notevia AI to work with. (Handwriting needs converting to text first.)');
      if (offline) { setOut(runLocal(task, text)); return; }
      const r = await fn.call<{ text: string }>('notevia-ai', { task, text, question, target });
      setOut(r.text);
    } catch (e: any) { setErr(e.message || 'Notevia AI request failed'); } finally { setBusy(false); }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-secondary text-lavender-ink dark:text-lavender"><Sparkles className="size-4" /></span>
        <div className="flex-1"><div className="text-sm font-semibold">Notevia AI</div><div className="text-[11px] text-muted-foreground">Working on: {contextLabel}</div></div>
        <button aria-label="Close Notevia AI" className="rounded-lg p-1.5 hover:bg-muted" onClick={onClose}><X className="size-4" /></button>
      </div>
      <div className="flex-1 space-y-4 overflow-auto p-4">
        {!offline && !consent ? (
          <div className="space-y-3 rounded-xl bg-secondary/60 p-4 text-sm">
            <div className="flex items-center gap-2 font-medium"><ShieldCheck className="size-4" /> Before you use Notevia AI</div>
            <p className="text-muted-foreground">When you run an AI action, the text of the item you have open is sent to Notevia’s AI provider through our server to generate a response. It is not used to train models by Notevia, and nothing is sent until you press <b>Run</b>. You can withdraw permission at any time in Settings → Privacy.</p>
            <Button size="sm" onClick={async () => { await db.update('profiles', app.user.id, { settings: { ...(app.user.settings || {}), ai_consent: true } }); await app.refreshUser(); }}>I understand — allow Notevia AI</Button>
          </div>
        ) : (
          <>
            {offline && <div className="flex gap-2 rounded-xl bg-secondary/60 p-3 text-xs text-muted-foreground"><Info className="mt-0.5 size-4 shrink-0 text-lavender-deep" /><span><b className="text-foreground">Basic mode.</b> These helpers run on your device with simple text analysis, so nothing is sent anywhere. Results are basic. Connect the Notevia AI server function for full-strength answers.</span></div>}
            <div className="grid grid-cols-2 gap-1.5">
              {tasks.map((t) => <button key={t.id} onClick={() => setTask(t.id)} className={`rounded-lg border px-2.5 py-2 text-left text-xs transition ${task === t.id ? 'border-lavender-deep bg-secondary font-medium' : 'border-border hover:bg-muted'}`}>{t.label}</button>)}
            </div>
            {meta.needs === 'question' && <Input placeholder="Your question about this material…" value={question} onChange={(e) => setQuestion(e.target.value)} />}
            {meta.needs === 'target' && <NativeSelect value={target} onChange={(e) => setTarget(e.target.value)}>{['English', 'French', 'Spanish', 'German', 'Italian', 'Portuguese', 'Arabic', 'Chinese (Simplified)', 'Japanese', 'Thai', 'Hindi', 'Polish', 'Welsh'].map((l) => <option key={l}>{l}</option>)}</NativeSelect>}
            <Button className="w-full" onClick={run} disabled={busy || (meta.needs === 'question' && !question.trim())}>{busy ? <><Loader2 className="animate-spin" /> Working…</> : <><Sparkles /> Run</>}</Button>
            {err && <p className="text-sm text-red-600">{err}</p>}
            {out && (
              <div className="space-y-2">
                <div className="flex items-center gap-2"><Badge>✦ AI-generated</Badge><span className="text-[11px] text-muted-foreground">Check before relying on it · you can edit below</span></div>
                <Textarea rows={14} value={out} onChange={(e) => setOut(e.target.value)} className="text-[13px]" />
                <div className="flex gap-2">
                  {onInsert && <Button size="sm" className="flex-1" onClick={() => onInsert(out, `<div class="ai-block"><p><em>✦ AI-generated with Notevia AI — review before use</em></p>${mdToHtml(out)}</div>`)}><CornerDownLeft /> Insert</Button>}
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard?.writeText(out); app.toast('Copied'); }}><Copy /> Copy</Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
