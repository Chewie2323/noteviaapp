import { useState } from 'react';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input, Label, NativeSelect } from '@/components/ui/input';
import { ColorDots } from './common';
import { TEMPLATE_GROUPS } from '@/canvas/paper';
import { TemplateCard } from '@/pages/NotebookEditor';
import type { Orientation, PaperSize, TemplateId } from '@/lib/types';
import { PASTELS } from '@/lib/utils';

export function NewNotebookDialog({ open, onOpenChange, onCreate }: { open: boolean; onOpenChange: (o: boolean) => void; onCreate: (v: { title: string; template: TemplateId; paper_size: PaperSize; orientation: Orientation; cover_color: string }) => void }) {
  const [title, setTitle] = useState('');
  const [template, setTemplate] = useState<TemplateId>('lined');
  const [size, setSize] = useState<PaperSize>('A4');
  const [o, setO] = useState<Orientation>('portrait');
  const [color, setColor] = useState(PASTELS[0]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl">
        <DialogHeader><DialogTitle>New notebook</DialogTitle></DialogHeader>
        <DialogBody className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-[1fr_140px_150px]">
            <div><Label htmlFor="nbt">Title</Label><Input id="nbt" autoFocus value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Research Methods — Week 3" /></div>
            <div><Label>Paper size</Label><NativeSelect value={size} onChange={(e) => setSize(e.target.value as PaperSize)}><option>A4</option><option>A5</option><option>Letter</option></NativeSelect></div>
            <div><Label>Orientation</Label><NativeSelect value={o} onChange={(e) => setO(e.target.value as Orientation)}><option value="portrait">Portrait</option><option value="landscape">Landscape</option></NativeSelect></div>
          </div>
          {TEMPLATE_GROUPS.map((g) => (
            <div key={g.group}><div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.group}</div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">{g.items.map((it) => <TemplateCard key={it.id} id={it.id} label={it.label} active={template === it.id} onClick={() => setTemplate(it.id)} />)}</div></div>
          ))}
          <div><Label>Cover colour</Label><ColorDots colors={PASTELS} value={color} onChange={setColor} /></div>
        </DialogBody>
        <DialogFooter><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={() => { onCreate({ title: title.trim() || 'Untitled notebook', template, paper_size: size, orientation: o, cover_color: color }); onOpenChange(false); setTitle(''); }}>Create notebook</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
