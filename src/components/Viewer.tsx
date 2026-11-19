import { useEffect, useRef, useState } from 'react';
import { Download, ExternalLink, FileWarning, Presentation } from 'lucide-react';
import { db } from '@/lib/backend';
import type { DocumentRow, ResourceLink } from '@/lib/types';
import { embedUrl, fileKind, saveBlob } from '@/lib/utils';
import { openPdf, renderPdfPage, PDFDoc } from '@/lib/pdf';
import { docxToHtml, parseCsv, pptxSlides, sheetPreview, Slide } from '@/lib/office';
import { Button } from '@/components/ui/button';
import { Html, sanitize } from './RichText';
import { Spinner } from './common';
import { cn } from '@/lib/utils';

export function PdfScroll({ doc, width, onPage }: { doc: PDFDoc; width: number; onPage?: (n: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    const el = ref.current!; el.innerHTML = '';
    (async () => {
      for (let i = 1; i <= doc.numPages && !cancelled; i++) {
        const { canvas, height } = await renderPdfPage(doc, i, width);
        canvas.style.width = width + 'px'; canvas.style.height = height + 'px';
        canvas.className = 'mx-auto mb-4 block rounded-md bg-white shadow-soft';
        canvas.setAttribute('aria-label', `Page ${i}`);
        canvas.onclick = () => onPage?.(i);
        if (!cancelled) el.appendChild(canvas);
      }
    })();
    return () => { cancelled = true; };
  }, [doc, width]);
  return <div ref={ref} />;
}

function Table({ rows }: { rows: any[][] }) {
  return (
    <div className="overflow-auto rounded-xl border border-border bg-card">
      <table className="w-full text-sm">
        <tbody>{rows.map((r, i) => <tr key={i} className={i === 0 ? 'bg-muted font-medium' : 'border-t border-border'}>{r.map((c, j) => <td key={j} className="whitespace-nowrap px-3 py-1.5">{String(c ?? '')}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export function SlidesView({ slides }: { slides: Slide[] }) {
  return (
    <div className="space-y-4">
      {slides.map((s) => (
        <div key={s.index} className="mx-auto aspect-[16/9] w-full max-w-3xl overflow-hidden rounded-xl border border-border bg-white p-8 text-charcoal shadow-soft">
          <div className="mb-1 text-[11px] font-medium text-slate2">Slide {s.index}</div>
          <h3 className="mb-3 text-2xl font-semibold">{s.title}</h3>
          <ul className="list-disc space-y-1 pl-5 text-[15px]">{s.lines.slice(0, 12).map((l, i) => <li key={i}>{l}</li>)}</ul>
          {s.notes && <p className="mt-4 border-t pt-2 text-xs text-slate2">Speaker notes: {s.notes}</p>}
        </div>
      ))}
    </div>
  );
}

/** Read-only preview of any stored document or learning link. */
export function Viewer({ doc, link, width = 640, className }: { doc?: DocumentRow | null; link?: ResourceLink | null; width?: number; className?: string }) {
  const [state, setState] = useState<{ kind: string; data?: any; url?: string; err?: string } | null>(null);
  const kind = doc ? fileKind(doc.mime_type, doc.name) : null;
  useEffect(() => {
    setState(null);
    if (!doc) return;
    let alive = true;
    (async () => {
      try {
        if (kind === 'page') return alive && setState({ kind, data: doc.content_html || '' });
        const blob = await db.download('documents', doc.storage_path!);
        if (kind === 'pdf') return alive && setState({ kind, data: await openPdf(blob) });
        if (kind === 'docx' && doc.name.toLowerCase().endsWith('.docx')) return alive && setState({ kind, data: await docxToHtml(blob) });
        if (kind === 'pptx' && doc.name.toLowerCase().endsWith('.pptx')) return alive && setState({ kind, data: await pptxSlides(blob) });
        if (kind === 'xlsx') return alive && setState({ kind, data: await sheetPreview(blob) });
        if (kind === 'csv') return alive && setState({ kind, data: parseCsv(await blob.text()) });
        if (kind === 'txt') return alive && setState({ kind, data: (await blob.text()).slice(0, 300000) });
        if (kind === 'image' || kind === 'svg' || kind === 'audio' || kind === 'video') return alive && setState({ kind, url: URL.createObjectURL(blob) });
        setState({ kind: 'other', url: URL.createObjectURL(blob) });
      } catch (e: any) { alive && setState({ kind: 'error', err: e?.message || 'Could not open this file' }); }
    })();
    return () => { alive = false; };
  }, [doc?.id, doc?.updated_at]);
  const [sheet, setSheet] = useState(0);

  if (link) {
    const e = embedUrl(link.url, link.provider);
    if (link.embeddable && e) return <iframe src={e} className={cn('h-full min-h-[420px] w-full rounded-xl bg-white', className)} allow="autoplay; encrypted-media; fullscreen" allowFullScreen title={link.title} sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation" />;
    return (
      <div className="p-8 text-center text-sm">
        <p className="mb-4 text-muted-foreground">{link.provider} doesn’t allow its pages to be embedded in other sites, so it opens in a new tab.</p>
        <Button asChild><a href={link.url} target="_blank" rel="noopener noreferrer"><ExternalLink /> Open {link.title}</a></Button>
      </div>
    );
  }
  if (!doc) return null;
  if (!state) return <div className="grid place-items-center py-16"><Spinner /></div>;
  const s = state;
  switch (s.kind) {
    case 'error': return <div className="p-8 text-center text-sm text-red-600"><FileWarning className="mx-auto mb-2" />{s.err}</div>;
    case 'page': return <div className="mx-auto max-w-3xl rounded-xl bg-card p-8 shadow-soft"><h1 className="mb-4 text-2xl font-bold">{doc.name}</h1><Html html={s.data} /></div>;
    case 'pdf': return <PdfScroll doc={s.data} width={width} />;
    case 'docx': return <div className="prose-nv mx-auto max-w-3xl rounded-xl bg-white p-8 text-charcoal shadow-soft" dangerouslySetInnerHTML={{ __html: sanitize(s.data) }} />;
    case 'pptx': return (
      <div>
        <p className="mb-3 flex items-center gap-2 text-xs text-muted-foreground"><Presentation className="size-4" /> Slide text preview. Layout, images and animations need PowerPoint, Keynote or Google Slides — download to present the original.</p>
        <SlidesView slides={s.data} />
      </div>
    );
    case 'xlsx': return (
      <div>
        {s.data.length > 1 && <div className="mb-2 flex gap-1 overflow-x-auto">{s.data.map((sh: any, i: number) => <button key={sh.name} onClick={() => setSheet(i)} className={cn('rounded-lg px-3 py-1 text-xs', i === sheet ? 'bg-secondary font-medium' : 'hover:bg-muted')}>{sh.name}</button>)}</div>}
        <Table rows={s.data[sheet]?.rows || []} />
      </div>
    );
    case 'csv': return <Table rows={s.data} />;
    case 'txt': return <pre className="whitespace-pre-wrap rounded-xl bg-card p-6 font-mono text-[13px] leading-relaxed shadow-soft">{s.data}</pre>;
    case 'image': case 'svg': return <img src={s.url} alt={doc.name} className="mx-auto max-w-full rounded-xl bg-white shadow-soft" />;
    case 'audio': return <div className="p-6"><audio controls src={s.url} className="w-full" /></div>;
    case 'video': return <video controls src={s.url} className="w-full rounded-xl bg-black" />;
    default: return (
      <div className="p-10 text-center text-sm text-muted-foreground">
        <p className="mb-4">There’s no in-browser preview for this format{kind === 'docx' || kind === 'pptx' ? ' (legacy .doc / .ppt)' : ''}.</p>
        <Button variant="secondary" onClick={async () => { if (s.url) saveBlob(await (await fetch(s.url)).blob(), doc.name); }}><Download /> Download</Button>
      </div>
    );
  }
}
