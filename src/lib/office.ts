/** Client-side previews for Office & data files (no server needed). */
import JSZip from 'jszip';

export async function docxToHtml(blob: Blob) {
  const mammoth: any = await import('mammoth');
  const r = await mammoth.convertToHtml({ arrayBuffer: await blob.arrayBuffer() });
  return r.value as string;
}

export interface Slide { index: number; title: string; lines: string[]; notes?: string }
/** Reads slide text (titles, bullets, speaker notes) straight from the PPTX package. */
export async function pptxSlides(blob: Blob): Promise<Slide[]> {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const names = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => +a.match(/\d+/g)!.pop()! - +b.match(/\d+/g)!.pop()!);
  const parser = new DOMParser();
  const out: Slide[] = [];
  for (const [i, n] of names.entries()) {
    const xml = parser.parseFromString(await zip.file(n)!.async('string'), 'application/xml');
    const paras = Array.from(xml.getElementsByTagName('a:p')).map((p) => Array.from(p.getElementsByTagName('a:t')).map((t) => t.textContent || '').join('')).filter((s) => s.trim());
    const notesName = `ppt/notesSlides/notesSlide${n.match(/\d+/g)!.pop()}.xml`;
    let notes = '';
    if (zip.file(notesName)) {
      const nx = parser.parseFromString(await zip.file(notesName)!.async('string'), 'application/xml');
      notes = Array.from(nx.getElementsByTagName('a:t')).map((t) => t.textContent).join(' ').replace(/\s+\d+\s*$/, '').trim();
    }
    out.push({ index: i + 1, title: paras[0] || `Slide ${i + 1}`, lines: paras.slice(1), notes });
  }
  return out;
}

export async function sheetPreview(blob: Blob, maxRows = 200) {
  const XLSX: any = await import('xlsx');
  const wb = XLSX.read(await blob.arrayBuffer(), { type: 'array' });
  return wb.SheetNames.map((name: string) => ({ name, rows: (XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, blankrows: false }) as any[][]).slice(0, maxRows) }));
}

export function parseCsv(text: string, maxRows = 500): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length && rows.length < maxRows; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

/** Plain text from a stored document, for search and Notevia AI. */
export async function extractText(blob: Blob, kind: string): Promise<string> {
  if (kind === 'txt' || kind === 'csv') return (await blob.text()).slice(0, 200000);
  if (kind === 'docx') { const h = await docxToHtml(blob); const d = document.createElement('div'); d.innerHTML = h; return d.innerText; }
  if (kind === 'pptx') return (await pptxSlides(blob)).map((s) => [s.title, ...s.lines, s.notes].join('\n')).join('\n\n');
  if (kind === 'xlsx') return (await sheetPreview(blob, 300)).map((s: any) => `# ${s.name}\n` + s.rows.map((r: any[]) => r.join('\t')).join('\n')).join('\n\n');
  if (kind === 'pdf') {
    const { openPdf } = await import('./pdf');
    const doc = await openPdf(blob); const parts: string[] = [];
    for (let i = 1; i <= Math.min(doc.numPages, 60); i++) parts.push(((await (await doc.getPage(i)).getTextContent()).items as any[]).map((t) => t.str).join(' '));
    return parts.join('\n\n');
  }
  return '';
}
