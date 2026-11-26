import { useRef, useState } from 'react';
import {
  MousePointer2, Lasso, Hand, PenTool, Pen, Pencil, Highlighter, Eraser, Type, Square, Circle, Diamond, Triangle, RectangleHorizontal, MoveUpRight, Minus,
  Spline, StickyNote, Table2, Sigma, Network, Image as ImageIcon, Undo2, Redo2, ZoomIn, ZoomOut, Trash2, Copy, Bold, Italic, Underline,
  ArrowUpToLine, ArrowDownToLine, Plus, ChevronDown, Shapes, AlignLeft, AlignCenter, Rows3, Columns3, GitBranchPlus, Mic,
} from 'lucide-react';
import type { CanvasObject, PenKind, ShapeKind } from '@/lib/types';
import type { Tool, ToolState } from './InkCanvas';
import { PEN_DEFAULTS } from './strokes';
import { cn, HIGHLIGHTS, INK } from '@/lib/utils';
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger, Slider, Tooltip } from '@/components/ui/misc';

const STICKY = ['#FFF2B3', '#F8D7E2', '#D6EEDF', '#DCE7F7', '#E4DDFB', '#F6E0CF'];
const NODE = ['#E4DDFB', '#D5ECE3', '#F9D9E6', '#D6E7F8', '#FDE3D6', '#FFFFFF'];
const PENS: { id: PenKind; icon: any }[] = [{ id: 'ballpoint', icon: PenTool }, { id: 'fountain', icon: Pen }, { id: 'pencil', icon: Pencil }, { id: 'highlighter', icon: Highlighter }];
const SHAPES: { id: ShapeKind; icon: any; label: string }[] = [
  { id: 'rect', icon: Square, label: 'Rectangle' }, { id: 'rounded', icon: RectangleHorizontal, label: 'Rounded (process)' }, { id: 'ellipse', icon: Circle, label: 'Ellipse' },
  { id: 'diamond', icon: Diamond, label: 'Diamond (decision)' }, { id: 'triangle', icon: Triangle, label: 'Triangle' }, { id: 'parallelogram', icon: Shapes, label: 'Parallelogram (input/output)' },
  { id: 'arrow', icon: MoveUpRight, label: 'Arrow' }, { id: 'line', icon: Minus, label: 'Line' },
];

export interface ToolbarProps {
  tools: ToolState; setTools: (t: ToolState) => void;
  canUndo: boolean; canRedo: boolean; onUndo: () => void; onRedo: () => void;
  zoom?: number; setZoom?: (z: number) => void;
  onImage?: (f: File) => void; onAudio?: () => void;
  selection: CanvasObject[];
  onPatch: (fn: (o: CanvasObject) => CanvasObject) => void;
  onDelete: () => void; onDuplicate: () => void; onOrder: (front: boolean) => void;
  onAddChild?: (sibling: boolean) => void;
  compact?: boolean; extra?: React.ReactNode; hint?: string | null;
}

function TB({ active, title, onClick, children, disabled }: { active?: boolean; title: string; onClick?: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <Tooltip content={title}>
      <button type="button" aria-label={title} aria-pressed={active} onClick={onClick} disabled={disabled}
        className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl transition disabled:opacity-35 [&_svg]:size-[18px]',
          active ? 'bg-[#B9A5E8] text-charcoal shadow-sm' : 'text-white/75 hover:bg-white/10 hover:text-white')}>{children}</button>
    </Tooltip>
  );
}
const Sep = () => <span className="mx-1 h-6 w-px shrink-0 bg-white/20" />;

export function Toolbar(p: ToolbarProps) {
  const { tools, setTools } = p;
  const set = (patch: Partial<ToolState>) => setTools({ ...tools, ...patch });
  const fileRef = useRef<HTMLInputElement>(null);
  const [panel, setPanel] = useState<string | null>(null);
  const t = tools.tool;
  const pick = (tool: Tool) => set({ tool });
  const activeShape = SHAPES.find((s) => s.id === tools.shape) || SHAPES[0];
  const sel = p.selection;
  const texts = sel.filter((o) => o.type === 'text') as any[];
  const tables = sel.filter((o) => o.type === 'table') as any[];
  const nodes = sel.filter((o) => o.type === 'node');
  const conns = sel.filter((o) => o.type === 'connector') as any[];

  const applyColor = (c: string) => {
    if (t === 'pen') set({ colors: { ...tools.colors, [tools.pen]: c } });
    else if (t === 'sticky') set({ stickyColor: c });
    else if (t === 'node') set({ nodeColor: c });
    else if (t === 'text') set({ textColor: c });
    else set({ shapeColor: c, textColor: c });
    if (sel.length) p.onPatch((o) => {
      switch (o.type) {
        case 'stroke': return { ...o, color: c };
        case 'text': return { ...o, color: c };
        case 'shape': return { ...o, stroke: c };
        case 'connector': return { ...o, stroke: c };
        case 'sticky': return STICKY.includes(c) ? { ...o, color: c } : o;
        case 'node': return NODE.includes(c) || STICKY.includes(c) ? { ...o, color: c } : o;
        case 'table': return { ...o, color: c };
        case 'math': return { ...o, color: c };
        default: return o;
      }
    });
  };
  // Notability-style: colours stay hidden until you tap the tool that is already active.
  const tap = (key: string, active: boolean, activate: () => void) => {
    if (active) setPanel((x) => (x === key ? null : key));
    else { activate(); setPanel(null); }
  };
  const palFor = (kind: 'pen' | 'highlighter' | 'sticky' | 'node' | 'text') => (kind === 'highlighter' ? HIGHLIGHTS : kind === 'sticky' ? STICKY : kind === 'node' ? NODE : INK);
  const selPalette = sel.length && sel.every((o) => o.type === 'sticky') ? STICKY : sel.length && sel.every((o) => o.type === 'node') ? NODE : INK;
  const selColor = (sel[0] as any)?.color ?? (sel[0] as any)?.stroke ?? '#6D60C2';
  const patchTables = (fn: (o: any) => any) => p.onPatch((o) => (o.type === 'table' ? fn(o) : o));

  return (
    <div className="flex flex-col gap-1.5" role="toolbar" aria-label="Notebook tools">
      <div className="flex items-center gap-0.5 overflow-x-auto no-scrollbar rounded-[22px] bg-charcoal px-2 py-1.5 text-white shadow-lift">
        <TB title="Select & move (V)" active={t === 'select'} onClick={() => pick('select')}><MousePointer2 /></TB>
        <TB title="Lasso select (L)" active={t === 'lasso'} onClick={() => pick('lasso')}><Lasso /></TB>
        <TB title="Pan / scroll (H)" active={t === 'hand'} onClick={() => pick('hand')}><Hand /></TB>
        <Sep />
        {PENS.map(({ id, icon: Ic }) => {
          const active = t === 'pen' && tools.pen === id;
          return (
            <ToolPop key={id} open={panel === `pen-${id}`} onClose={() => setPanel(null)} trigger={
              <TB title={`${PEN_DEFAULTS[id].label}${id === 'ballpoint' ? ' (P)' : ''}${active ? ' – tap for colour & size' : ''}`} active={active} onClick={() => tap(`pen-${id}`, active, () => set({ tool: 'pen', pen: id }))}>
                <span className="relative"><Ic /><span className="absolute -bottom-1 left-1/2 h-1 w-3 -translate-x-1/2 rounded-full" style={{ background: tools.colors[id] }} /></span>
              </TB>}>
              <ColorPanel palette={palFor(id === 'highlighter' ? 'highlighter' : 'pen')} current={tools.colors[id]} onPick={applyColor}>
                <Range label="Thickness" min={id === 'highlighter' ? 8 : 1} max={id === 'highlighter' ? 44 : 24} step={0.5} value={tools.sizes[id]} onChange={(v) => set({ sizes: { ...tools.sizes, [id]: v } })} />
                {id !== 'highlighter' && <Range label="Opacity" min={10} max={100} value={Math.round(tools.opacity * 100)} onChange={(v) => set({ opacity: v / 100 })} suffix="%" />}
              </ColorPanel>
            </ToolPop>
          );
        })}
        <TB title="Eraser (E)" active={t === 'eraser'} onClick={() => pick('eraser')}><Eraser /></TB>
        <Sep />
        <ToolPop open={panel === 'text'} onClose={() => setPanel(null)} trigger={
          <TB title="Text (T)" active={t === 'text'} onClick={() => tap('text', t === 'text', () => pick('text'))}>
            <span className="relative"><Type /><span className="absolute -bottom-1 left-1/2 h-1 w-3 -translate-x-1/2 rounded-full" style={{ background: tools.textColor }} /></span>
          </TB>}>
          <ColorPanel palette={INK} current={tools.textColor} onPick={applyColor}>
            <Range label="Text size" min={10} max={72} value={tools.fontSize} onChange={(v) => set({ fontSize: v })} />
          </ColorPanel>
        </ToolPop>
        <Popover>
          <PopoverTrigger asChild>
            <button aria-label="Shapes" className={cn('flex h-9 shrink-0 items-center gap-0.5 rounded-xl px-2 [&_svg]:size-[18px]', t === 'shape' ? 'bg-[#B9A5E8] text-charcoal' : 'text-white/75 hover:bg-white/10')}>
              <activeShape.icon /><ChevronDown className="!size-3" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="grid w-64 grid-cols-4 gap-1 p-2">
            {SHAPES.map((s) => (
              <button key={s.id} title={s.label} aria-label={s.label} onClick={() => set({ tool: 'shape', shape: s.id })}
                className={cn('grid h-11 place-items-center rounded-lg hover:bg-white/10', tools.shape === s.id && t === 'shape' && 'bg-secondary')}><s.icon className="size-5" /></button>
            ))}
            <div className="col-span-4 mt-1 border-t border-border pt-2">
              <ColorPanel bare palette={INK} current={tools.shapeColor} onPick={(c) => (t === 'shape' ? applyColor(c) : set({ shapeColor: c, textColor: c }))}>
                <Range label="Line" min={1} max={12} value={tools.shapeSize} onChange={(v) => set({ shapeSize: v })} />
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" className="accent-primary" checked={!!tools.fill} onChange={(e) => set({ fill: e.target.checked ? '#E4DDFB' : null })} /> Fill</label>
                  <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" className="accent-primary" checked={tools.dash} onChange={(e) => set({ dash: e.target.checked })} /> Dashed</label>
                </div>
              </ColorPanel>
            </div>
            <p className="col-span-4 px-1 pt-1 text-[11px] text-muted-foreground">Hold Shift for squares & circles. Double-tap a shape to label it.</p>
          </PopoverContent>
        </Popover>
        <TB title="Connector: link two objects" active={t === 'connector'} onClick={() => pick('connector')}><Spline /></TB>
        <ToolPop open={panel === 'sticky'} onClose={() => setPanel(null)} trigger={<TB title="Sticky note" active={t === 'sticky'} onClick={() => tap('sticky', t === 'sticky', () => pick('sticky'))}><StickyNote /></TB>}>
          <ColorPanel palette={STICKY} current={tools.stickyColor} onPick={applyColor} noCustom />
        </ToolPop>
        <ToolPop open={panel === 'node'} onClose={() => setPanel(null)} trigger={<TB title="Mind-map node" active={t === 'node'} onClick={() => tap('node', t === 'node', () => pick('node'))}><Network /></TB>}>
          <ColorPanel palette={NODE} current={tools.nodeColor} onPick={applyColor} noCustom />
        </ToolPop>
        <TB title="Table" active={t === 'table'} onClick={() => pick('table')}><Table2 /></TB>
        <TB title="Equation (LaTeX)" active={t === 'math'} onClick={() => pick('math')}><Sigma /></TB>
        {p.onImage && <TB title="Insert image" onClick={() => fileRef.current?.click()}><ImageIcon /></TB>}
        {p.onAudio && <TB title="Audio recording" onClick={p.onAudio}><Mic /></TB>}
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) p.onImage?.(f); e.target.value = ''; }} />
        <Sep />
        <TB title="Undo (Ctrl+Z)" disabled={!p.canUndo} onClick={p.onUndo}><Undo2 /></TB>
        <TB title="Redo (Ctrl+Shift+Z)" disabled={!p.canRedo} onClick={p.onRedo}><Redo2 /></TB>
        {p.setZoom && <>
        <Sep />
        <TB title="Zoom out" onClick={() => p.setZoom!(Math.max(0.2, +((p.zoom ?? 1) - 0.1).toFixed(2)))}><ZoomOut /></TB>
        <button className="w-12 shrink-0 rounded-lg py-1 text-center text-xs tabular-nums hover:bg-white/10" title="Reset zoom" onClick={() => p.setZoom!(1)}>{Math.round((p.zoom ?? 1) * 100)}%</button>
        <TB title="Zoom in" onClick={() => p.setZoom!(Math.min(4, +((p.zoom ?? 1) + 0.1).toFixed(2)))}><ZoomIn /></TB>
        </>}
        <div className="flex-1" />
        {p.extra}
      </div>

      <div className="flex min-h-[46px] items-center gap-2 overflow-x-auto no-scrollbar rounded-2xl border border-border bg-card/80 px-3 py-1.5 backdrop-blur">
        {t === 'pen' && <span className="shrink-0 text-xs text-muted-foreground">{tools.pen === 'highlighter' ? 'Hold Shift for a straight line · ' : ''}Tap the pen again for colour &amp; thickness</span>}
        {t === 'text' && !sel.length && <span className="shrink-0 text-xs text-muted-foreground">Tap the Text tool again for colour &amp; size</span>}
        {t === 'shape' && <span className="shrink-0 text-xs text-muted-foreground">Open the Shapes menu for colour, line, fill &amp; dashes</span>}
        {t === 'eraser' && <><Range label="Eraser size" min={4} max={60} value={tools.eraserSize} onChange={(v) => set({ eraserSize: v })} /><span className="shrink-0 text-xs text-muted-foreground">Erases handwriting and highlights it touches</span></>}
        {(t === 'table' || t === 'math' || t === 'node' || t === 'sticky' || t === 'connector' || t === 'hand') && !sel.length && (
          <span className="shrink-0 text-xs text-muted-foreground">{p.hint || ({ table: 'Tap the page to place a table · double-tap a cell to type', math: 'Tap where the equation should go', node: 'Tap to add a central idea · select a node and press Tab to add a branch', sticky: 'Tap to place a sticky note', connector: 'Tap the first object, then the second', hand: 'Drag to move around · two fingers to pinch-zoom on boards' } as any)[t]}</span>
        )}
        {(t === 'select' || t === 'lasso') && !sel.length && <span className="shrink-0 text-xs text-muted-foreground">{t === 'lasso' ? 'Draw a loop around items, then drag, resize or rotate them' : 'Tap to select · drag empty space to box-select · double-tap text to edit'}</span>}

        {sel.length > 0 && (
          <div className="ml-auto flex shrink-0 items-center gap-0.5 border-l border-border pl-2">
            <span className="mr-1 text-xs text-muted-foreground">{sel.length} selected</span>
            {!sel.every((o) => o.type === 'table' || o.type === 'image') && (
              <ToolPop open={panel === 'sel'} onClose={() => setPanel(null)} align="end" trigger={
                <button type="button" aria-label="Colour of selection" title="Colour" onClick={() => setPanel((x) => (x === 'sel' ? null : 'sel'))} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl hover:bg-muted">
                  <span className="h-5 w-5 rounded-full border border-black/10" style={{ background: selColor }} />
                </button>}>
                <ColorPanel palette={selPalette} current={selColor} onPick={applyColor} noCustom={selPalette !== INK} />
              </ToolPop>
            )}
            {texts.length > 0 && <>
              <TB title="Bold" active={texts.every((x) => x.bold)} onClick={() => p.onPatch((o) => (o.type === 'text' ? { ...o, bold: !texts.every((x) => x.bold) } : o))}><Bold /></TB>
              <TB title="Italic" active={texts.every((x) => x.italic)} onClick={() => p.onPatch((o) => (o.type === 'text' ? { ...o, italic: !texts.every((x) => x.italic) } : o))}><Italic /></TB>
              <TB title="Underline" active={texts.every((x) => x.underline)} onClick={() => p.onPatch((o) => (o.type === 'text' ? { ...o, underline: !texts.every((x) => x.underline) } : o))}><Underline /></TB>
              <TB title="Align left" onClick={() => p.onPatch((o) => (o.type === 'text' ? { ...o, align: 'left' } : o))}><AlignLeft /></TB>
              <TB title="Centre" onClick={() => p.onPatch((o) => (o.type === 'text' ? { ...o, align: 'center' } : o))}><AlignCenter /></TB>
              {HIGHLIGHTS.slice(0, 3).map((c) => (
                <button key={c} aria-label="Highlight keyword" title="Highlight" className="grid h-7 w-7 place-items-center rounded-md" style={{ background: c }}
                  onClick={() => p.onPatch((o) => (o.type === 'text' ? { ...o, highlight: (o as any).highlight === c ? null : c } : o))}><Highlighter className="size-3.5" /></button>
              ))}
              <button className="rounded px-1.5 text-xs hover:bg-muted" onClick={() => p.onPatch((o) => (o.type === 'text' ? { ...o, fontSize: Math.max(8, (o as any).fontSize - 2) } : o))}>A−</button>
              <button className="rounded px-1.5 text-xs hover:bg-muted" onClick={() => p.onPatch((o) => (o.type === 'text' ? { ...o, fontSize: Math.min(120, (o as any).fontSize + 2) } : o))}>A+</button>
            </>}
            {tables.length > 0 && <>
              <TB title="Add row" onClick={() => patchTables((o) => ({ ...o, cells: [...o.cells, o.colWidths.map(() => '')] }))}><span className="flex items-center"><Plus className="!size-3" /><Rows3 /></span></TB>
              <TB title="Add column" onClick={() => patchTables((o) => ({ ...o, colWidths: [...o.colWidths, 120], cells: o.cells.map((r: string[]) => [...r, '']) }))}><span className="flex items-center"><Plus className="!size-3" /><Columns3 /></span></TB>
              <TB title="Remove last row" onClick={() => patchTables((o) => (o.cells.length > 1 ? { ...o, cells: o.cells.slice(0, -1) } : o))}><span className="flex items-center"><Minus className="!size-3" /><Rows3 /></span></TB>
              <TB title="Remove last column" onClick={() => patchTables((o) => (o.colWidths.length > 1 ? { ...o, colWidths: o.colWidths.slice(0, -1), cells: o.cells.map((r: string[]) => r.slice(0, -1)) } : o))}><span className="flex items-center"><Minus className="!size-3" /><Columns3 /></span></TB>
              <button className="rounded px-2 py-1 text-xs hover:bg-muted" onClick={() => patchTables((o) => ({ ...o, header: !o.header }))}>Header row</button>
            </>}
            {nodes.length === 1 && p.onAddChild && <>
              <TB title="Add branch (Tab)" onClick={() => p.onAddChild!(false)}><GitBranchPlus /></TB>
              <button className="rounded px-2 py-1 text-xs hover:bg-muted" onClick={() => p.onAddChild!(true)}>+ Sibling (Enter)</button>
            </>}
            {conns.length > 0 && <>
              <button className="rounded px-2 py-1 text-xs hover:bg-muted" onClick={() => p.onPatch((o) => (o.type === 'connector' ? { ...o, curved: !(o as any).curved } : o))}>Curved</button>
              <button className="rounded px-2 py-1 text-xs hover:bg-muted" onClick={() => p.onPatch((o) => (o.type === 'connector' ? { ...o, arrow: !(o as any).arrow } : o))}>Arrowhead</button>
            </>}
            <TB title="Bring to front" onClick={() => p.onOrder(true)}><ArrowUpToLine /></TB>
            <TB title="Send to back" onClick={() => p.onOrder(false)}><ArrowDownToLine /></TB>
            <TB title="Duplicate (Ctrl+D)" onClick={p.onDuplicate}><Copy /></TB>
            <TB title="Delete" onClick={p.onDelete}><Trash2 className="text-red-500" /></TB>
          </div>
        )}
      </div>
    </div>
  );
}

function Range({ label, min, max, value, onChange, suffix = '', step = 1 }: { label: string; min: number; max: number; value: number; onChange: (v: number) => void; suffix?: string; step?: number }) {
  return (
    <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
      {label}
      <Slider className="w-24" min={min} max={max} step={step} value={[value]} onValueChange={([v]) => onChange(v)} aria-label={label} />
      <span className="w-9 tabular-nums">{Math.round(value * 10) / 10}{suffix}</span>
    </div>
  );
}

function ToolPop({ open, onClose, trigger, children, align = 'start' }: { open: boolean; onClose: () => void; trigger: React.ReactNode; children: React.ReactNode; align?: 'start' | 'end' | 'center' }) {
  return (
    <Popover open={open} onOpenChange={(o) => !o && onClose()}>
      <PopoverAnchor asChild><span data-tool-anchor className="relative inline-flex shrink-0">{trigger}</span></PopoverAnchor>
      <PopoverContent align={align} className="w-72 p-3" onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => { if ((e.target as HTMLElement | null)?.closest?.('[data-tool-anchor]')) e.preventDefault(); }}>
        {children}
      </PopoverContent>
    </Popover>
  );
}

function ColorPanel({ palette, current, onPick, children, noCustom, bare }: { palette: string[]; current: string; onPick: (c: string) => void; children?: React.ReactNode; noCustom?: boolean; bare?: boolean }) {
  return (
    <div className={cn('flex flex-col gap-3', bare && 'px-0')}>
      <div className="flex flex-wrap items-center gap-2">
        {palette.map((c) => (
          <button key={c} type="button" aria-label={`Colour ${c}`} onClick={() => onPick(c)}
            className={cn('h-7 w-7 rounded-full border border-black/5 transition ring-offset-2 ring-offset-popover', current.toLowerCase() === c.toLowerCase() && 'scale-110 ring-2 ring-primary')} style={{ background: c }} />
        ))}
        {!noCustom && (
          <label className="relative h-7 w-7 cursor-pointer overflow-hidden rounded-full border border-border" title="Custom colour" style={{ background: 'conic-gradient(#f87171,#fbbf24,#a3e635,#22d3ee,#818cf8,#e879f9,#f87171)' }}>
            <input type="color" aria-label="Custom colour" className="absolute inset-0 opacity-0" value={/^#[0-9a-f]{6}$/i.test(current) ? current : '#000000'} onChange={(e) => onPick(e.target.value)} />
          </label>
        )}
      </div>
      {children}
    </div>
  );
}
