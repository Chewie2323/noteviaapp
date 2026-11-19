import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { MATH_SNIPPETS, renderMathHtml } from '@/canvas/math';

export function MathDialog({ open, initial, onClose, onSave }: { open: boolean; initial?: string; onClose: () => void; onSave: (latex: string) => void }) {
  const [tex, setTex] = useState(initial || '');
  useEffect(() => { if (open) setTex(initial || ''); }, [open, initial]);
  const html = useMemo(() => renderMathHtml(tex || '\\text{Preview}'), [tex]);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="lg">
        <DialogHeader><DialogTitle>{initial ? 'Edit equation' : 'Insert equation'}</DialogTitle><DialogDescription>Write LaTeX — rendered with KaTeX. Example: <code>E = mc^2</code></DialogDescription></DialogHeader>
        <DialogBody className="space-y-3">
          <div className="flex flex-wrap gap-1.5">{MATH_SNIPPETS.map((s) => <button key={s.label} className="rounded-lg border border-border px-2.5 py-1 text-xs hover:bg-muted" onClick={() => setTex((t) => (t ? t + ' ' : '') + s.tex)}>{s.label}</button>)}</div>
          <Textarea autoFocus rows={3} className="font-mono" value={tex} onChange={(e) => setTex(e.target.value)} placeholder="\frac{a}{b} + \sqrt{x^2 + y^2}" />
          <div className="grid min-h-[90px] place-items-center overflow-x-auto rounded-xl bg-muted/60 p-4 text-xl" dangerouslySetInnerHTML={{ __html: html }} />
        </DialogBody>
        <DialogFooter><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={!tex.trim()} onClick={() => onSave(tex.trim())}>{initial ? 'Update' : 'Insert'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
