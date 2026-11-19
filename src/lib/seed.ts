/** Demonstration content for demo mode. Everything here is generated in the browser — no external downloads. */
import { nanoid } from 'nanoid';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { db, markSeeded, now, uid } from './backend';
import type { CanvasObject, Classroom, DocumentRow, Folder, Notebook, Profile, StrokeObj } from './types';
import { measureMath } from '@/canvas/math';

const H = 3600000, D = 86400000;
const at = (offset: number, h?: number, m = 0) => { const d = new Date(Date.now() + offset); if (h != null) d.setHours(h, m, 0, 0); return d.toISOString(); };
const id8 = () => nanoid(8);

// ------------------------------------------------------------------ hand-lettering
type Poly = [number, number][];
const ell = (cx: number, cy: number, rx: number, ry: number, a0 = 0, a1 = Math.PI * 2, n = 18): Poly => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / n; return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry] as [number, number]; });
const GLYPHS: Record<string, Poly[]> = {
  A: [[[0, 1], [0.3, 0], [0.6, 1]], [[0.12, 0.62], [0.48, 0.62]]],
  B: [[[0, 1], [0, 0], [0.38, 0], [0.54, 0.12], [0.54, 0.34], [0.38, 0.48], [0, 0.48]], [[0.38, 0.48], [0.6, 0.62], [0.6, 0.86], [0.42, 1], [0, 1]]],
  C: [ell(0.32, 0.5, 0.3, 0.5, -0.6, -Math.PI * 2 + 0.6, 16)],
  D: [[[0, 0], [0, 1], [0.32, 1], [0.56, 0.76], [0.58, 0.26], [0.34, 0], [0, 0]]],
  E: [[[0.55, 0], [0, 0], [0, 1], [0.55, 1]], [[0, 0.5], [0.42, 0.5]]],
  F: [[[0.55, 0], [0, 0], [0, 1]], [[0, 0.5], [0.42, 0.5]]],
  G: [[...ell(0.32, 0.5, 0.3, 0.5, -0.6, -Math.PI * 2 + 0.2, 16), [0.62, 0.55], [0.38, 0.55]]],
  H: [[[0, 0], [0, 1]], [[0.55, 0], [0.55, 1]], [[0, 0.5], [0.55, 0.5]]],
  I: [[[0.15, 0], [0.15, 1]]],
  K: [[[0, 0], [0, 1]], [[0.55, 0], [0, 0.6]], [[0.18, 0.45], [0.58, 1]]],
  L: [[[0, 0], [0, 1], [0.5, 1]]],
  M: [[[0, 1], [0, 0], [0.32, 0.58], [0.64, 0], [0.64, 1]]],
  N: [[[0, 1], [0, 0], [0.55, 1], [0.55, 0]]],
  O: [ell(0.32, 0.5, 0.31, 0.5)],
  P: [[[0, 1], [0, 0], [0.42, 0], [0.58, 0.14], [0.58, 0.34], [0.42, 0.5], [0, 0.5]]],
  R: [[[0, 1], [0, 0], [0.42, 0], [0.58, 0.14], [0.58, 0.34], [0.42, 0.5], [0, 0.5]], [[0.26, 0.5], [0.6, 1]]],
  S: [[[0.56, 0.1], [0.36, 0], [0.12, 0.04], [0.04, 0.24], [0.22, 0.44], [0.46, 0.56], [0.6, 0.76], [0.5, 0.95], [0.26, 1], [0.02, 0.9]]],
  T: [[[0, 0], [0.62, 0]], [[0.31, 0], [0.31, 1]]],
  U: [[[0, 0], [0, 0.72], [0.12, 0.95], [0.3, 1], [0.48, 0.95], [0.58, 0.72], [0.58, 0]]],
  V: [[[0, 0], [0.3, 1], [0.6, 0]]],
  W: [[[0, 0], [0.18, 1], [0.36, 0.35], [0.54, 1], [0.72, 0]]],
  Y: [[[0, 0], [0.3, 0.5], [0.6, 0]], [[0.3, 0.5], [0.3, 1]]],
  '!': [[[0.12, 0], [0.12, 0.68]], [[0.12, 0.92], [0.13, 0.95]]],
  '?': [[[0.04, 0.2], [0.14, 0.04], [0.34, 0], [0.52, 0.1], [0.52, 0.3], [0.3, 0.48], [0.28, 0.68]], [[0.28, 0.92], [0.29, 0.95]]],
  '→': [[[0, 0.5], [0.9, 0.5]], [[0.66, 0.28], [0.9, 0.5], [0.66, 0.72]]],
  '+': [[[0.3, 0.2], [0.3, 0.8]], [[0, 0.5], [0.6, 0.5]]],
  '=': [[[0, 0.38], [0.55, 0.38]], [[0, 0.64], [0.55, 0.64]]],
  '1': [[[0.08, 0.2], [0.28, 0], [0.28, 1]]],
  '2': [[[0.04, 0.2], [0.2, 0.02], [0.44, 0.04], [0.55, 0.24], [0.4, 0.5], [0, 1], [0.6, 1]]],
  '3': [[[0.04, 0.08], [0.3, 0], [0.52, 0.12], [0.5, 0.36], [0.24, 0.48], [0.52, 0.6], [0.56, 0.86], [0.3, 1], [0.02, 0.92]]],
};
const wob = (n: number, a = 1) => ((Math.sin(n * 12.9898 + 4.1) * 43758.5453) % 1) * a;

function polyStroke(pts: Poly, ox: number, oy: number, sx: number, sy: number, color: string, size: number, pen: StrokeObj['pen'] = 'ballpoint', seed = 0): StrokeObj {
  const out: number[] = [];
  const dense: [number, number][] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    const len = Math.hypot((x1 - x0) * sx, (y1 - y0) * sy), steps = Math.max(2, Math.ceil(len / 4));
    for (let k = 0; k < steps; k++) dense.push([x0 + ((x1 - x0) * k) / steps, y0 + ((y1 - y0) * k) / steps]);
  }
  dense.push(pts[pts.length - 1]);
  dense.forEach(([x, y], i) => {
    const t = i / Math.max(1, dense.length - 1);
    out.push(+(ox + x * sx + wob(i + seed, 0.9)).toFixed(2), +(oy + y * sy + wob(i * 1.7 + seed, 0.9)).toFixed(2), +(0.35 + Math.sin(Math.PI * Math.min(1, t * 1.15)) * 0.45).toFixed(2));
  });
  return { id: id8(), type: 'stroke', pen, x: 0, y: 0, points: out, color, size };
}
/** Writes text as genuine pen strokes (simple hand-lettering), slightly slanted. */
function handwrite(text: string, x: number, y: number, size: number, color = '#2F2B45', pen: StrokeObj['pen'] = 'ballpoint', width = 2.6): StrokeObj[] {
  const out: StrokeObj[] = [];
  let cx = x, i = 0;
  for (const ch of text.toUpperCase()) {
    if (ch === ' ') { cx += size * 0.45; continue; }
    const g = GLYPHS[ch]; if (!g) { cx += size * 0.5; continue; }
    const gw = Math.max(...g.flat().map((p) => p[0]));
    g.forEach((poly, k) => out.push(polyStroke(poly.map(([px, py]) => [px - (1 - py) * 0.08, py] as [number, number]), cx, y + wob(i, 2), size, size, color, width, pen, i * 7 + k)));
    cx += (gw + 0.28) * size; i++;
  }
  return out;
}
const circle = (cx: number, cy: number, rx: number, ry: number, color: string, seed = 1) => polyStroke(ell(0, 0, 1, 1, -0.5, Math.PI * 2 + 0.35, 30).map(([a, b]) => [a + wob(seed + a * 9, 0.03), b + wob(seed + b * 7, 0.04)] as [number, number]), cx, cy, rx, ry, color, 2.6, 'ballpoint', seed);
const underline = (x1: number, x2: number, y: number, color: string) => polyStroke(Array.from({ length: 12 }, (_, i) => [i / 11, Math.sin(i * 0.9) * 0.15] as [number, number]), x1, y, x2 - x1, 10, color, 2.4, 'fountain', x1);
const hl = (x1: number, x2: number, y: number, color: string, h = 22) => ({ ...polyStroke([[0, 0], [1, 0.02]], x1, y, x2 - x1, 1, color, h, 'highlighter', y), opacity: 0.42 });
const arrowStroke = (pts: Poly, color: string) => { const s = polyStroke(pts, 0, 0, 1, 1, color, 2.4, 'ballpoint', pts[0][0]); const [ax, ay] = pts[pts.length - 2], [bx, by] = pts[pts.length - 1]; const a = Math.atan2(by - ay, bx - ax); return [s, polyStroke([[bx - 12 * Math.cos(a - 0.5), by - 12 * Math.sin(a - 0.5)], [bx, by], [bx - 12 * Math.cos(a + 0.5), by - 12 * Math.sin(a + 0.5)]], 0, 0, 1, 1, color, 2.4)]; };
const tick = (x: number, y: number, c = '#3F9A72') => polyStroke([[0, 0.5], [0.35, 1], [1, 0]], x, y, 26, 22, c, 3, 'fountain');
const T = (x: number, y: number, text: string, fontSize: number, extra: any = {}): CanvasObject => ({ id: id8(), type: 'text', x, y, text, fontSize, color: '#2F2B45', width: 560, ...extra });
const math = (x: number, y: number, latex: string, fontSize = 22): CanvasObject => { let w = 200, h = 50; try { ({ w, h } = measureMath(latex, fontSize)); } catch { /* */ } return { id: id8(), type: 'math', x, y, latex, fontSize, color: '#2F2B45', w, h }; };

// ------------------------------------------------------------------ sample files
async function textPdf(title: string, subtitle: string, sections: { h: string; p: string[] }[]) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(title); pdf.setAuthor('Notevia demo'); pdf.setProducer('Notevia');
  const font = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 595, Hh = 842, M = 56;
  let page = pdf.addPage([W, Hh]), y = Hh - 60;
  const header = (first: boolean) => {
    page.drawRectangle({ x: 0, y: Hh - (first ? 150 : 40), width: W, height: first ? 150 : 40, color: rgb(0.91, 0.875, 0.96) });
    if (first) { page.drawText(title, { x: M, y: Hh - 86, size: 24, font: bold, color: rgb(0.19, 0.2, 0.26) }); page.drawText(subtitle, { x: M, y: Hh - 112, size: 12, font, color: rgb(0.47, 0.47, 0.53) }); y = Hh - 190; }
    else y = Hh - 80;
  };
  header(true);
  const wrap = (s: string, size: number, f = font, maxW = W - 2 * M) => { const words = s.split(' '); const lines: string[] = []; let l = ''; for (const w of words) { const t = l ? l + ' ' + w : w; if (f.widthOfTextAtSize(t, size) > maxW) { lines.push(l); l = w; } else l = t; } if (l) lines.push(l); return lines; };
  for (const s of sections) {
    if (y < 140) { page = pdf.addPage([W, Hh]); header(false); }
    page.drawText(s.h, { x: M, y, size: 15, font: bold, color: rgb(0.43, 0.35, 0.66) }); y -= 24;
    for (const para of s.p) {
      const bullet = para.startsWith('• ');
      for (const [i, ln] of wrap(bullet ? para.slice(2) : para, 11, font, W - 2 * M - (bullet ? 14 : 0)).entries()) {
        if (y < 70) { page = pdf.addPage([W, Hh]); header(false); }
        if (bullet && i === 0) page.drawText('•', { x: M, y, size: 11, font, color: rgb(0.6, 0.51, 0.77) });
        page.drawText(ln, { x: M + (bullet ? 14 : 0), y, size: 11, font, color: rgb(0.19, 0.2, 0.26) }); y -= 16;
      }
      y -= 6;
    }
    y -= 10;
  }
  pdf.getPages().forEach((p, i) => p.drawText(`Notevia demo material · page ${i + 1}`, { x: M, y: 30, size: 8, font, color: rgb(0.6, 0.6, 0.65) }));
  return new Blob([await pdf.save()], { type: 'application/pdf' });
}
async function pptx() {
  const { default: PptxGenJS } = await import('pptxgenjs');
  const p = new PptxGenJS(); p.layout = 'LAYOUT_WIDE'; p.title = 'Introduction to Programming';
  const slides: [string, string[], string][] = [
    ['Introduction to Programming', ['Week 1 · Thinking like a programmer', 'Computer Science 101'], 'Welcome everyone. Today we look at what a program is.'],
    ['What is a program?', ['A precise set of instructions a computer can follow', 'Input → processing → output', 'Written in a programming language such as Python'], 'Ask students for everyday examples of algorithms.'],
    ['Variables and types', ['A variable is a named value: total = 42', 'Common types: int, float, str, bool', 'Types decide which operations make sense'], ''],
    ['Making decisions', ['if / elif / else choose between paths', 'Comparisons return True or False', 'Indentation shows which lines belong together'], 'Live-code a grade calculator.'],
    ['Repeating work', ['for loops walk over a sequence', 'while loops repeat until a condition changes', 'Avoid infinite loops — always change the condition'], ''],
    ['This week’s practice', ['Install Python and an editor', 'Write “Hello, World”', 'Complete the variables worksheet in Notevia'], 'Point to the assignment in the classroom.'],
  ];
  slides.forEach(([t, bullets, notes], i) => {
    const s = p.addSlide(); s.background = { color: i === 0 ? 'E8DFF5' : 'FFFFFF' };
    s.addText(t, { x: 0.6, y: i === 0 ? 2.2 : 0.5, w: 12, h: 1, fontSize: i === 0 ? 40 : 30, bold: true, color: '303442', fontFace: 'Arial' });
    s.addText(bullets.map((b) => ({ text: b, options: { bullet: i !== 0, breakLine: true } })), { x: 0.8, y: i === 0 ? 3.3 : 1.7, w: 11.5, h: 4, fontSize: i === 0 ? 20 : 22, color: '555869', fontFace: 'Arial', valign: 'top' });
    if (notes) s.addNotes(notes);
  });
  return (await p.write({ outputType: 'blob' })) as Blob;
}
async function xlsx() {
  const XLSX: any = await import('xlsx');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  const rows = [['Month', 'Region', 'Revenue (£)', 'Orders', 'Avg order (£)'], ...months.flatMap((m, i) => ['North', 'South', 'Midlands'].map((r, j) => { const rev = 12000 + i * 1400 + j * 2600; const o = 140 + i * 9 + j * 22; return [m, r, rev, o, Math.round(rev / o)]; }))];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Sales');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['KPI', 'Value'], ['Total revenue', rows.slice(1).reduce((s, r: any) => s + r[2], 0)], ['Total orders', rows.slice(1).reduce((s, r: any) => s + r[3], 0)]]), 'Summary');
  return new Blob([XLSX.write(wb, { type: 'array', bookType: 'xlsx' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// ------------------------------------------------------------------ notebooks
function examplePage1(): CanvasObject[] {
  const ink = '#2F2B45', purple = '#7A63B8', pink = '#D06A8C';
  return [
    T(60, 40, 'Lecture 4 — Business Intelligence pipelines', 26, { bold: true, color: '#5B4A8F', width: 640 }),
    T(62, 84, 'Thursday · Module BI201', 14, { color: '#7B7692' }),
    hl(58, 236, 148, '#FFE88A'),
    T(60, 132, 'Key idea: data → decisions', 18, { bold: true }),
    T(60, 170, 'BI turns raw operational data into information people can act on. The pipeline is usually called ETL:', 15, { width: 620 }),
    ...handwrite('ETL', 70, 228, 34, purple, 'fountain', 3.4),
    ...arrowStroke([[160, 248], [200, 246], [236, 248]], ink),
    T(250, 236, 'Extract → Transform → Load', 16, { highlight: '#C6EBD3', width: 230 }),
    // hand-drawn diagram
    { id: 'srcbox', type: 'shape', shape: 'rounded', x: 70, y: 320, w: 150, h: 56, stroke: '#6D60C2', fill: '#E4DDFB', size: 2, label: 'Source systems' },
    { id: 'whbox', type: 'shape', shape: 'rounded', x: 310, y: 320, w: 150, h: 56, stroke: '#3F9A72', fill: '#D6EEDF', size: 2, label: 'Data warehouse' },
    { id: 'dashbox', type: 'shape', shape: 'rounded', x: 550, y: 320, w: 150, h: 56, stroke: '#4A7BC8', fill: '#DCE7F7', size: 2, label: 'Dashboards' },
    { id: id8(), type: 'connector', x: 0, y: 0, from: 'srcbox', to: 'whbox', stroke: '#7B7692', size: 2, arrow: true },
    { id: id8(), type: 'connector', x: 0, y: 0, from: 'whbox', to: 'dashbox', stroke: '#7B7692', size: 2, arrow: true },
    ...handwrite('KPIS!', 560, 400, 22, pink, 'ballpoint', 2.6),
    circle(612, 412, 62, 24, pink, 3),
    T(60, 450, 'Good KPIs are specific, measurable and linked to a decision. Avoid “vanity metrics”.', 15, { width: 620 }),
    underline(206, 330, 472, purple),
    T(60, 500, 'Example metric', 16, { bold: true }),
    math(60, 528, '\\text{Conversion rate} = \\frac{\\text{orders}}{\\text{visits}} \\times 100\\%', 20),
    { id: id8(), type: 'table', x: 60, y: 610, colWidths: [190, 150, 150], rowHeight: 34, header: true, color: '#E4DDFB', cells: [['Layer', 'Owner', 'Refresh'], ['Staging', 'Data eng.', 'Hourly'], ['Warehouse', 'BI team', 'Daily'], ['Dashboards', 'Analysts', 'Live']] },
    { id: id8(), type: 'sticky', x: 590, y: 600, w: 170, h: 150, color: '#FFF2B3', text: 'Ask: who makes a decision with this dashboard — and how often?', rotation: 2 },
    tick(40, 640), tick(40, 674),
    ...handwrite('WHY?', 600, 790, 22, ink, 'pencil', 2.2),
    ...arrowStroke([[640, 830], [600, 880], [520, 900]], ink),
    T(60, 860, 'Next week: dimensional modelling (star schema) — read chapter 3 before class.', 15, { width: 450, italic: true, color: '#5B4A8F' }),
  ] as CanvasObject[];
}
function examplePage2(): CanvasObject[] {
  const node = (id: string, x: number, y: number, text: string, color: string, parent: string | null = null, w = 150): CanvasObject => ({ id, type: 'node', x, y, w, h: 46, text, color, parent });
  const c = (from: string, to: string): CanvasObject => ({ id: id8(), type: 'connector', x: 0, y: 0, from, to, stroke: '#6D60C2', size: 2, arrow: false, curved: true });
  return [
    T(60, 40, 'Mind map — what makes a good dashboard?', 24, { bold: true, color: '#5B4A8F', width: 640 }),
    node('root', 300, 470, 'Good dashboard', '#E4DDFB', null, 190),
    node('n1', 560, 300, 'Clear purpose', '#D5ECE3', 'root'), node('n2', 580, 470, 'Right KPIs', '#F9D9E6', 'root'), node('n3', 560, 640, 'Trustworthy data', '#D6E7F8', 'root'),
    node('n4', 70, 300, 'Simple visuals', '#FDE3D6', 'root'), node('n5', 50, 470, 'Accessible colour', '#D5ECE3', 'root'), node('n6', 70, 640, 'Fast to load', '#F9D9E6', 'root'),
    node('n7', 560, 200, 'One audience', '#FFFFFF', 'n1', 130), node('n8', 580, 760, 'Data lineage', '#FFFFFF', 'n3', 130),
    c('root', 'n1'), c('root', 'n2'), c('root', 'n3'), c('root', 'n4'), c('root', 'n5'), c('root', 'n6'), c('n1', 'n7'), c('n3', 'n8'),
    { id: id8(), type: 'sticky', x: 260, y: 820, w: 260, h: 120, color: '#E4DDFB', text: 'Tip: select a node and press Tab to add a branch, Enter for a sibling.', rotation: -1 },
    circle(395, 493, 120, 46, '#D06A8C', 9),
  ] as CanvasObject[];
}
function weeklyPlanner(): CanvasObject[] {
  const purple = '#7A63B8';
  return [
    ...handwrite('READ CH 3', 60, 168, 16, purple, 'ballpoint', 2.2), tick(330, 166),
    ...handwrite('BI QUIZ', 410, 168, 16, '#D06A8C', 'ballpoint', 2.2),
    ...handwrite('LAB 2', 60, 410, 16, '#3F9A72', 'ballpoint', 2.2),
    ...handwrite('GYM', 410, 410, 16, '#4A7BC8', 'ballpoint', 2.2),
    hl(56, 200, 186, '#FFE88A', 20),
    { id: id8(), type: 'sticky', x: 520, y: 900, w: 200, h: 120, color: '#D6EEDF', text: 'Dashboard critique due Friday', rotation: 2 },
  ] as CanvasObject[];
}
function mathsPage(): CanvasObject[] {
  return [
    T(60, 130, 'Q1. Solve the quadratic', 16, { bold: true }),
    math(80, 160, 'x^2 - 5x + 6 = 0', 24),
    math(80, 210, 'x = \\frac{5 \\pm \\sqrt{25 - 24}}{2}', 24),
    ...handwrite('X = 2 OR 3', 90, 290, 24, '#7A63B8', 'fountain', 3),
    tick(330, 292),
    T(60, 380, 'Q2. Differentiate', 16, { bold: true }),
    math(80, 410, 'f(x) = 3x^3 - 2x + 1', 24),
    math(80, 460, "f'(x) = 9x^2 - 2", 24),
    T(60, 560, 'Q3. Evaluate the integral', 16, { bold: true }),
    math(80, 590, '\\int_0^2 (2x + 1)\\,dx', 24),
    ...handwrite('= 6', 100, 660, 24, '#7A63B8', 'fountain', 3),
    { id: id8(), type: 'sticky', x: 520, y: 380, w: 200, h: 120, color: '#FFF2B3', text: 'Remember: power rule — bring the power down, subtract one.', rotation: 1.5 },
  ] as CanvasObject[];
}

// ------------------------------------------------------------------ seed
export async function seedDemo() {
  try { await document.fonts.ready; } catch { /* */ }
  const P = (p: Partial<Profile>) => db.insert<Profile>('profiles', { avatar_color: '#E4DDFB', settings: { retention_days: 30 }, created_at: at(-60 * D), ...p });
  const alex = await P({ email: 'alex.morgan@notevia.demo', full_name: 'Dr Alex Morgan', role: 'educator', organisation: 'Northbridge University', job_title: 'Senior Lecturer, Business Analytics', avatar_color: '#E4DDFB' });
  const sam = await P({ email: 'sam.patel@notevia.demo', full_name: 'Sam Patel', role: 'student', organisation: 'Northbridge University', avatar_color: '#D5ECE3' });
  const mia = await P({ email: 'mia.chen@notevia.demo', full_name: 'Mia Chen', role: 'student', organisation: 'Northbridge University', avatar_color: '#F9D9E6' });
  const jordan = await P({ email: 'jordan.blake@notevia.demo', full_name: 'Jordan Blake', role: 'individual', organisation: 'Freelance product consultant', avatar_color: '#D6E7F8' });
  await P({ email: 'riley.shaw@notevia.demo', full_name: 'Riley Shaw', role: 'admin', organisation: 'Northbridge University IT', avatar_color: '#FDE3D6' });
  await db.insert('platform_settings', { id: 'global', allow_registration: true, default_quota_mb: 2048, ai_enabled: false, notice: null });

  const wsTeach = await db.insert<any>('workspaces', { owner_id: alex.id, name: 'Teaching', color: '#E4DDFB', description: 'Modules, lectures and classroom materials' });
  await db.insert('workspaces', { owner_id: alex.id, name: 'Research', color: '#D5ECE3', description: 'Papers, literature notes and data' });
  for (const u of [sam, mia, jordan]) await db.insert('workspaces', { owner_id: u.id, name: 'My Workspace', color: '#E4DDFB', description: 'Your personal space' });

  const FOLDERS: [string, string][] = [['Computer Science', '#D6E7F8'], ['Business and Management', '#E4DDFB'], ['Mathematics', '#FDE3D6'], ['Language Learning', '#F9D9E6'], ['Science', '#D5ECE3'], ['Research', '#DCD2EF'], ['Personal Projects', '#F6EADF'], ['Professional Development', '#D8E8DF']];
  const f: Record<string, Folder> = {};
  let t = Date.now() - 30 * D;
  for (const [name, color] of FOLDERS) f[name] = await db.insert<Folder>('folders', { owner_id: alex.id, name, color, parent_id: null, kind: 'documents', workspace_id: name === 'Research' ? null : wsTeach.id, created_at: new Date(t += 1000).toISOString() });
  const biFolder = await db.insert<Folder>('folders', { owner_id: alex.id, name: 'BI201 — Lecture materials', color: '#F1E3E8', parent_id: f['Business and Management'].id, kind: 'documents', workspace_id: wsTeach.id });

  const upload = async (owner: Profile, name: string, blob: Blob, folder: Folder | null, extra: Partial<DocumentRow> = {}, ageDays = 3) => {
    const path = `${owner.id}/${uid()}-${name.replace(/[^\w.\- ()]+/g, '_')}`;
    await db.upload('documents', path, blob);
    return db.insert<DocumentRow>('documents', { owner_id: owner.id, folder_id: folder?.id || null, workspace_id: folder?.workspace_id || null, name, mime_type: blob.type, size: blob.size, storage_path: path, tags: [], category: null, created_at: at(-ageDays * D), updated_at: at(-ageDays * D), ...extra });
  };
  const biPdf = await upload(alex, 'Introduction to Business Intelligence.pdf', await textPdf('Introduction to Business Intelligence', 'BI201 · Lecture 1 · Northbridge University (demo material)', [
    { h: 'What is Business Intelligence?', p: ['Business Intelligence (BI) is the set of processes, technologies and skills used to turn raw data into information that supports better decisions. A BI capability typically combines data integration, storage, analysis and presentation.', '• Descriptive: what happened? (reports, dashboards)', '• Diagnostic: why did it happen? (drill-down, segmentation)', '• Predictive: what is likely to happen? (forecasting models)', '• Prescriptive: what should we do? (optimisation, recommendations)'] },
    { h: 'The BI pipeline', p: ['Most BI architectures follow an Extract, Transform, Load (ETL) pattern. Data is extracted from operational systems, transformed into consistent and trustworthy structures, and loaded into a data warehouse where it can be queried efficiently.', '• Extract: pull data from CRM, finance, web analytics and spreadsheets', '• Transform: clean, de-duplicate, join and conform dimensions', '• Load: write to a warehouse optimised for analysis'] },
    { h: 'Key performance indicators', p: ['A key performance indicator (KPI) is a measurable value that shows how effectively an organisation is achieving an objective. Good KPIs are specific, measurable, owned by someone and connected to a decision.', 'Avoid vanity metrics — numbers that look impressive but do not change what anyone does.'] },
    { h: 'Designing dashboards', p: ['Effective dashboards answer a small number of questions for a clearly defined audience. Use consistent scales, label units, highlight exceptions and make sure colour is never the only way information is conveyed.', '• Start with the decision, then choose the metric, then the chart', '• Show trends over time alongside current values', '• Provide context such as targets and previous periods'] },
    { h: 'Reading for next week', p: ['Chapter 3: Dimensional modelling and the star schema. Come prepared to sketch a fact table and two dimension tables for a retail scenario.'] },
  ]), biFolder, { tags: ['bi201', 'lecture'], category: 'Lecture notes' }, 6);
  const rmPdf = await upload(alex, 'Research Methodology.pdf', await textPdf('Research Methodology', 'Research methods handbook · demo material', [
    { h: 'Choosing an approach', p: ['Research questions determine method. Quantitative designs test hypotheses with measurable variables; qualitative designs explore meaning, experience and context; mixed methods combine the two to strengthen inferences.'] },
    { h: 'Sampling', p: ['• Probability sampling: random, stratified, cluster', '• Non-probability sampling: purposive, convenience, snowball', 'State how the sample was selected, its size, and the limitations this introduces.'] },
    { h: 'Validity and reliability', p: ['Validity concerns whether you are measuring what you intend to measure. Reliability concerns whether the measurement is consistent. Report both, and explain the steps taken to protect them.'] },
    { h: 'Ethics', p: ['Obtain informed consent, minimise harm, protect personal data in line with UK GDPR, and secure ethical approval before collecting data from people.'] },
  ]), f['Research'], { tags: ['methods'], category: 'Handbook' }, 12);
  const progPptx = await upload(alex, 'Introduction to Programming.pptx', await pptx(), f['Computer Science'], { tags: ['cs101', 'slides'], category: 'Lecture slides' }, 4);
  await upload(alex, 'BI201 sample sales data.xlsx', await xlsx(), biFolder, { tags: ['bi201', 'dataset'], category: 'Dataset' }, 5);
  await upload(alex, 'Weekly KPIs.csv', new Blob(['week,revenue,orders,conversion_rate\n1,48200,512,2.9\n2,50110,540,3.1\n3,47690,498,2.8\n4,53320,577,3.3\n'], { type: 'text/csv' }), biFolder, { tags: ['bi201'] }, 2);
  await upload(alex, 'Reading list.txt', new Blob(['BI201 reading list\n\n1. Chapter 1 — What is BI?\n2. Chapter 3 — Dimensional modelling\n3. Chapter 5 — Dashboard design principles\n'], { type: 'text/plain' }), f['Business and Management'], {}, 9);
  const pmPage = await db.insert<DocumentRow>('documents', { owner_id: alex.id, folder_id: f['Professional Development'].id, workspace_id: wsTeach.id, name: 'Project Management Notes', mime_type: 'text/x-notevia-page', size: 900, storage_path: null, tags: ['planning'], category: 'Notes', updated_at: at(-1 * D),
    content_html: '<h1>Project Management Notes</h1><p>Course redesign for BI201 — spring term.</p><h2>Goals</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked><span></span></label><div><p>Agree learning outcomes with the module team</p></div></li><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Rebuild the dashboard lab in Notevia</p></div></li><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Pilot audio feedback with Group A</p></div></li></ul><h2>Milestones</h2><table><tbody><tr><th><p>Milestone</p></th><th><p>Owner</p></th><th><p>Due</p></th></tr><tr><td><p>Outline approved</p></td><td><p>Alex</p></td><td><p>Week 2</p></td></tr><tr><td><p>Materials uploaded</p></td><td><p>Alex</p></td><td><p>Week 4</p></td></tr><tr><td><p>Student survey</p></td><td><p>Module team</p></td><td><p>Week 10</p></td></tr></tbody></table><h2>Risks</h2><blockquote><p>Timetable clashes with the analytics lab — book rooms early.</p></blockquote>' });

  const NB = async (owner: Profile, n: Partial<Notebook>, pages: { template: any; objects: CanvasObject[]; paper_size?: any; orientation?: any }[]) => {
    const nb = await db.insert<Notebook>('notebooks', { owner_id: owner.id, kind: 'notebook', cover_color: '#E4DDFB', template: pages[0].template, paper_size: 'A4', orientation: 'portrait', tags: [], notes_html: '', folder_id: null, workspace_id: null, updated_at: now(), ...n });
    for (let i = 0; i < pages.length; i++) await db.insert('notebook_pages', { notebook_id: nb.id, position: i, template: pages[i].template, paper_size: pages[i].paper_size || 'A4', orientation: pages[i].orientation || 'portrait', objects: pages[i].objects, audio: [], updated_at: now() });
    return nb;
  };
  const example = await NB(alex, { title: 'Lecture 4 — BI pipelines (example notebook)', cover_color: '#E4DDFB', folder_id: biFolder.id, workspace_id: wsTeach.id, tags: ['bi201'],
    notes_html: '<h2>Teaching notes</h2><ul><li>Start with the retail case study</li><li>Live-draw the ETL diagram</li><li>Pair activity: pick three KPIs</li></ul>' },
    [{ template: 'dotted', objects: examplePage1() }, { template: 'blank', objects: examplePage2() }, { template: 'cornell', objects: [T(70, 22, 'Lecture 4 — summary', 16, { bold: true })] }]);
  const planner = await NB(sam, { title: 'Weekly Study Planner', cover_color: '#D5ECE3' }, [{ template: 'weekly', objects: weeklyPlanner() }]);
  await NB(sam, { title: 'Mathematics Practice', cover_color: '#FDE3D6' }, [{ template: 'maths', objects: mathsPage() }]);
  await NB(alex, { title: 'Mathematics Practice — worked answers', cover_color: '#FDE3D6', folder_id: f['Mathematics'].id }, [{ template: 'maths', objects: mathsPage() }]);
  await NB(jordan, { title: 'Client kickoff — meeting notes', cover_color: '#D6E7F8' }, [{ template: 'meeting', objects: [...handwrite('LAUNCH IN Q3', 60, 160, 18, '#4A7BC8'), { id: id8(), type: 'sticky', x: 520, y: 150, w: 200, h: 120, color: '#FFF2B3', text: 'Send proposal by Friday', rotation: 2 }] }]);
  const board = await db.insert<Notebook>('notebooks', { owner_id: alex.id, kind: 'whiteboard', title: 'BI201 brainstorm board', cover_color: '#D6E7F8', template: 'blank', paper_size: 'A4', orientation: 'landscape', background: { color: '#FBFAF7', pattern: 'dots' }, tags: [], folder_id: null, workspace_id: wsTeach.id, updated_at: now() });
  await db.insert('notebook_pages', { notebook_id: board.id, position: 0, template: 'blank', paper_size: 'A4', orientation: 'landscape', audio: [], updated_at: now(), objects: [
    { id: 'q', type: 'node', x: 300, y: 260, w: 210, h: 52, text: 'Why do dashboards fail?', color: '#E4DDFB', parent: null },
    { id: 'a1', type: 'node', x: 640, y: 160, w: 160, h: 44, text: 'No clear owner', color: '#F9D9E6', parent: 'q' },
    { id: 'a2', type: 'node', x: 640, y: 290, w: 160, h: 44, text: 'Too many charts', color: '#D5ECE3', parent: 'q' },
    { id: 'a3', type: 'node', x: 640, y: 410, w: 160, h: 44, text: 'Stale data', color: '#D6E7F8', parent: 'q' },
    ...['a1', 'a2', 'a3'].map((x) => ({ id: id8(), type: 'connector', x: 0, y: 0, from: 'q', to: x, stroke: '#6D60C2', size: 2, arrow: false, curved: true })),
    { id: 'd1', type: 'shape', shape: 'diamond', x: 70, y: 380, w: 150, h: 100, stroke: '#6D60C2', fill: '#F3EEFB', size: 2, label: 'Used weekly?' },
    { id: 's1', type: 'sticky', x: 60, y: 120, w: 180, h: 140, color: '#FFF2B3', text: 'Group A: add your ideas here ✍️', rotation: -2 },
    { id: id8(), type: 'connector', x: 0, y: 0, from: 'd1', to: 'q', stroke: '#7B7692', size: 2, arrow: true },
  ] as CanvasObject[] });

  // classrooms
  const C = (c: Partial<Classroom>) => db.insert<Classroom>('classrooms', { owner_id: alex.id, archived: false, ...c });
  const bi = await C({ name: 'Business Intelligence — Year 2', subject: 'Business Intelligence', description: 'Data warehousing, KPIs, dashboards and decision-making with data.', cover_color: '#E4DDFB', join_code: 'BI7K2QX' });
  const cs = await C({ name: 'Computer Science 101', subject: 'Computer Science', description: 'Programming fundamentals in Python for first-year students.', cover_color: '#D6E7F8', join_code: 'CS4PYTH' });
  const pd = await C({ name: 'Professional Development Circle', subject: 'Professional Development', description: 'Small-group coaching on presenting, writing and leading projects.', cover_color: '#D5ECE3', join_code: 'PDGROW1' });
  const M = (classroom_id: string, user_id: string, progress: number) => db.insert('classroom_members', { classroom_id, user_id, role: 'student', progress });
  await M(bi.id, sam.id, 45); await M(bi.id, mia.id, 30); await M(cs.id, sam.id, 20); await M(pd.id, jordan.id, 60);
  const S = (resource_type: string, resource_id: string, owner_id: string, grantee_type: string, grantee_id: string, permission = 'view') => db.insert('shares', { resource_type, resource_id, owner_id, grantee_type, grantee_id, permission });
  await S('document', biPdf.id, alex.id, 'classroom', bi.id); await S('notebook', example.id, alex.id, 'classroom', bi.id); await S('notebook', board.id, alex.id, 'classroom', bi.id, 'edit');
  await S('document', progPptx.id, alex.id, 'classroom', cs.id); await S('document', pmPage.id, alex.id, 'user', jordan.id, 'comment');
  await S('folder', f['Research'].id, alex.id, 'user', mia.id, 'comment');
  await S('notebook', planner.id, sam.id, 'user', alex.id, 'comment');
  await db.insert('announcements', { classroom_id: bi.id, author_id: alex.id, body_html: '<p><strong>Welcome to BI201!</strong> 👋 The lecture 4 notebook and slides are now in Materials. Bring a laptop on Thursday for the dashboard lab.</p>', created_at: at(-2 * D) });
  await db.insert('announcements', { classroom_id: cs.id, author_id: alex.id, body_html: '<p>Install Python before the first lab — instructions are on slide 6 of “Introduction to Programming”.</p>', created_at: at(-1 * D) });

  // resources
  const L = (owner: Profile, l: any) => db.insert<any>('resource_links', { owner_id: owner.id, folder_id: null, tags: [], thumbnail_url: null, embeddable: false, ...l });
  const resFolder = await db.insert<Folder>('folders', { owner_id: alex.id, name: 'BI201 reading & tools', color: '#E4DDFB', parent_id: null, kind: 'resources' });
  const links = [
    await L(alex, { title: 'BI dashboard tutorials on YouTube', description: 'Search results for introductory Power BI and Tableau walkthroughs.', url: 'https://www.youtube.com/results?search_query=business+intelligence+dashboard+tutorial', provider: 'YouTube', category: 'Videos', tags: ['bi201'], folder_id: resFolder.id }),
    await L(alex, { title: 'Coursera — data analytics courses', description: 'Structured courses for deeper study alongside the module.', url: 'https://www.coursera.org/search?query=business%20intelligence', provider: 'Coursera', category: 'Courses', folder_id: resFolder.id }),
    await L(alex, { title: 'Quizlet — statistics flashcards', description: 'Community flashcard sets for revision.', url: 'https://quizlet.com/search?query=statistics&type=sets', provider: 'Quizlet', category: 'Flashcards' }),
    await L(alex, { title: 'Kahoot! — join a live quiz', description: 'Enter the game PIN shown in class.', url: 'https://kahoot.it/', provider: 'Kahoot', category: 'Quizzes & games' }),
    await L(alex, { title: 'Wordwall community activities', description: 'Matching games and quizzes made by teachers.', url: 'https://wordwall.net/en-us/community', provider: 'Wordwall', category: 'Quizzes & games' }),
    await L(alex, { title: 'GitHub topic: business intelligence', description: 'Open-source BI projects to explore.', url: 'https://github.com/topics/business-intelligence', provider: 'GitHub', category: 'Code', folder_id: resFolder.id }),
    await L(alex, { title: 'Google Colab', description: 'Run Python notebooks in the browser — used in CS101 labs.', url: 'https://colab.research.google.com/', provider: 'Google Colab', category: 'Tools' }),
    await L(alex, { title: 'Google Scholar search: dashboard design', description: 'Peer-reviewed research for your literature review.', url: 'https://scholar.google.com/scholar?q=dashboard+design+evaluation', provider: 'Research article', category: 'Research', folder_id: resFolder.id }),
    await L(alex, { title: 'OpenStax — free textbooks', description: 'Open, peer-reviewed textbooks including statistics and business.', url: 'https://openstax.org/subjects', provider: 'Online textbook', category: 'Textbooks' }),
    await L(alex, { title: 'Google Forms — module feedback (replace with your form)', description: 'Point this at your own end-of-week feedback form.', url: 'https://www.google.com/forms/about/', provider: 'Website', category: 'Forms' }),
  ];
  for (const l of links.slice(0, 6)) await S('link', l.id, alex.id, 'classroom', bi.id);
  await S('link', links[6].id, alex.id, 'classroom', cs.id);
  await L(jordan, { title: 'Khan Academy', description: 'Free lessons in maths, science and more.', url: 'https://www.khanacademy.org/', provider: 'Website', category: 'Courses' });

  // assignments
  const A = (a: any) => db.insert<any>('assignments', { created_by: alex.id, attachments: [], assignee_ids: [], max_points: null, ...a });
  const a1 = await A({ classroom_id: bi.id, title: 'Dashboard critique', due_at: at(5 * D, 17), max_points: 20, attachments: [{ type: 'document', id: biPdf.id }, { type: 'notebook', id: example.id }],
    instructions_html: '<p>Choose a public dashboard and critique it against the principles in Lecture 1.</p><ul><li>Who is the audience and what decision does it support?</li><li>Are the KPIs well chosen?</li><li>One improvement you would make, with a sketch</li></ul><p>Submit a PDF or a Notevia notebook.</p>' });
  const a2 = await A({ classroom_id: bi.id, title: 'Normalise a sales table', due_at: at(-2 * D, 17), max_points: 10, instructions_html: '<p>Using the sample sales data, design a star schema with one fact table and at least two dimensions.</p>' });
  await A({ classroom_id: cs.id, title: 'Hello, World in Python', due_at: at(9 * D, 12), max_points: 5, attachments: [{ type: 'document', id: progPptx.id }], instructions_html: '<p>Write and run your first Python program. Submit a screenshot or paste your code.</p>' });
  await A({ classroom_id: bi.id, title: 'Reflection: KPIs at work (Mia only)', due_at: at(3 * D, 17), assignee_ids: [mia.id], instructions_html: '<p>Write 300 words on a KPI from your placement.</p>' });
  await db.insert('submissions', { assignment_id: a1.id, student_id: sam.id, status: 'submitted', text_html: '<p>I chose the ONS COVID-19 dashboard. Clear audience, but the colour scale isn’t colour-blind safe. My redesign sketch is in the attached notebook.</p>', files: [], notebook_ids: [planner.id], submitted_at: at(-3 * H), updated_at: at(-3 * H) });
  await db.insert('submissions', { assignment_id: a1.id, student_id: mia.id, status: 'in_progress', text_html: '<p>Draft: comparing two retail dashboards…</p>', files: [], notebook_ids: [], updated_at: at(-1 * D) });
  const s2 = await db.insert<any>('submissions', { assignment_id: a2.id, student_id: sam.id, status: 'completed', text_html: '<p>Fact table: Sales(order_id, date_key, product_key, store_key, qty, revenue). Dimensions: Date, Product, Store.</p>', files: [], notebook_ids: [], submitted_at: at(-3 * D), updated_at: at(-1 * D) });
  await db.insert('feedback', { submission_id: s2.id, author_id: alex.id, body_html: '<p>Clear, well-structured schema — nice use of surrogate keys. Next time, add a <strong>Customer</strong> dimension so you can segment revenue.</p>', points: 8, created_at: at(-1 * D) });

  // calendar & tasks
  for (let w = 0; w < 4; w++) await db.insert('calendar_events', { owner_id: alex.id, title: 'BI201 lecture', kind: 'class', starts_at: at(w * 7 * D + D, 10), ends_at: at(w * 7 * D + D, 11, 30), all_day: false, color: '#E4DDFB', classroom_id: bi.id, links: [{ type: 'notebook', id: example.id }], notes: 'Room 2.14' });
  await db.insert('calendar_events', { owner_id: alex.id, title: 'CS101 lab', kind: 'class', starts_at: at(2 * D, 14), ends_at: at(2 * D, 16), all_day: false, color: '#D6E7F8', classroom_id: cs.id, links: [{ type: 'document', id: progPptx.id }], notes: null });
  await db.insert('calendar_events', { owner_id: alex.id, title: 'Module team meeting', kind: 'meeting', starts_at: at(3 * D, 13), ends_at: at(3 * D, 14), all_day: false, color: '#D6E7F8', classroom_id: null, links: [{ type: 'document', id: pmPage.id }], notes: null });
  await db.insert('calendar_events', { owner_id: sam.id, title: 'Study session: KPIs', kind: 'study', starts_at: at(D, 18), ends_at: at(D, 19, 30), all_day: false, color: '#D5ECE3', classroom_id: null, links: [{ type: 'notebook', id: planner.id }], notes: null });
  for (const [o, tt, d] of [[alex, 'Mark normalisation submissions', 1], [alex, 'Upload lecture 5 slides', 4], [sam, 'Finish dashboard critique', 4], [sam, 'Install Python', 2]] as const) await db.insert('tasks', { owner_id: o.id, title: tt, done: false, due_at: at(d * D, 9) });

  // social signals
  await db.insert('comments', { resource_type: 'notebook', resource_id: example.id, author_id: sam.id, body: 'Could we get an example of a vanity metric in class?', resolved: false, created_at: at(-5 * H) });
  await db.insert('comments', { resource_type: 'notebook', resource_id: planner.id, author_id: alex.id, body: 'Great planning, Sam — leave time on Thursday for the reading.', resolved: false, created_at: at(-2 * H) });
  const N = (u: Profile, title: string, link: string, ago: number, read = false) => db.insert('notifications', { user_id: u.id, kind: 'info', title, link, read, created_at: at(-ago) });
  await N(alex, 'Sam Patel submitted “Dashboard critique”', `/app/assignments/${a1.id}`, 3 * H);
  await N(alex, 'Sam Patel shared “Weekly Study Planner” with you', '/app/shared', 5 * H);
  await N(sam, 'New assignment: Dashboard critique', `/app/assignments/${a1.id}`, 2 * D, true);
  await N(sam, 'Feedback returned on “Normalise a sales table”', `/app/assignments/${a2.id}`, D);
  await N(mia, 'Dr Alex Morgan shared “Research” with you', '/app/shared', 6 * H);
  const LG = (actor: Profile, action: string, type: string, rid: string, name: string, cid: string | null, ago: number) => db.insert('activity_logs', { actor_id: actor.id, action, resource_type: type, resource_id: rid, resource_name: name, classroom_id: cid, created_at: at(-ago) });
  await LG(alex, 'uploaded', 'document', biPdf.id, biPdf.name, null, 6 * D);
  await LG(alex, 'edited', 'notebook', example.id, example.title, null, 2 * H);
  await LG(sam, 'submitted “Dashboard critique” in', 'classroom', bi.id, bi.name, bi.id, 3 * H);
  await LG(alex, 'posted an announcement in', 'classroom', bi.id, bi.name, bi.id, 2 * D);
  for (const [u, type, rid, ago] of [[alex, 'notebook', example.id, H], [alex, 'document', biPdf.id, 2 * H], [alex, 'document', progPptx.id, D], [sam, 'notebook', planner.id, 2 * H], [sam, 'document', biPdf.id, 5 * H]] as const)
    await db.insert('recent_items', { user_id: u.id, resource_type: type, resource_id: rid, opened_at: at(-ago) });
  await db.insert('favourites', { user_id: alex.id, resource_type: 'notebook', resource_id: example.id });
  await db.insert('favourites', { user_id: alex.id, resource_type: 'document', resource_id: biPdf.id });
  await markSeeded();
  void rmPdf;
}
