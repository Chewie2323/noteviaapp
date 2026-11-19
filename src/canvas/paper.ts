import type { Orientation, PaperSize, TemplateId } from '@/lib/types';

export const FONT = 'ui-rounded, "SF Pro Rounded", "Segoe UI", system-ui, -apple-system, Roboto, sans-serif';
const SIZES: Record<PaperSize, [number, number]> = { A4: [794, 1123], A5: [559, 794], Letter: [816, 1056] };
export function pageDims(size: PaperSize = 'A4', o: Orientation = 'portrait') {
  const [w, h] = SIZES[size] || SIZES.A4;
  return o === 'landscape' ? { w: h, h: w } : { w, h };
}

export const TEMPLATE_GROUPS: { group: string; items: { id: TemplateId; label: string }[] }[] = [
  { group: 'Paper', items: [{ id: 'blank', label: 'Blank' }, { id: 'lined', label: 'Lined' }, { id: 'grid', label: 'Grid' }, { id: 'dotted', label: 'Dotted' }] },
  { group: 'Notes', items: [{ id: 'cornell', label: 'Cornell notes' }, { id: 'lecture', label: 'Lecture notes' }, { id: 'meeting', label: 'Meeting notes' }, { id: 'research', label: 'Research notes' }, { id: 'maths', label: 'Mathematics worksheet' }, { id: 'mindmap', label: 'Mind map' }] },
  { group: 'Planning', items: [{ id: 'daily', label: 'Daily planner' }, { id: 'weekly', label: 'Weekly planner' }, { id: 'monthly', label: 'Monthly planner' }, { id: 'revision', label: 'Revision planner' }, { id: 'todo', label: 'To-do list' }, { id: 'project', label: 'Project planner' }] },
  { group: 'Teaching', items: [{ id: 'lesson', label: 'Lesson planner' }, { id: 'assignment', label: 'Assignment planner' }] },
];
export const templateLabel = (t: TemplateId) => (t.startsWith('custom:') ? 'Custom template' : TEMPLATE_GROUPS.flatMap((g) => g.items).find((i) => i.id === t)?.label || 'Blank');

const LINE = '#E4DEF0', SOFT = '#EEEAF5', ACCENT = '#7C6FD1', LABEL = '#8E8AA0', PINK = '#EBC4D1';

/** Draws a paper template into any 2D context (Konva sceneFunc, thumbnails, PDF export). */
export function drawTemplate(ctx: CanvasRenderingContext2D, w: number, h: number, t: TemplateId, opts: { paper?: string; customImage?: CanvasImageSource | null } = {}) {
  ctx.save();
  ctx.fillStyle = opts.paper || '#FFFEFB';
  ctx.fillRect(0, 0, w, h);
  if (t.startsWith('custom:')) {
    if (opts.customImage) ctx.drawImage(opts.customImage, 0, 0, w, h);
    ctx.restore();
    return;
  }
  const L = (x1: number, y1: number, x2: number, y2: number, c = LINE, lw = 1, dash: number[] = []) => {
    ctx.beginPath(); ctx.setLineDash(dash); ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.setLineDash([]);
  };
  const text = (s: string, x: number, y: number, size = 11, color = LABEL, weight = 600) => {
    ctx.fillStyle = color; ctx.font = `${weight} ${size}px ${FONT}`; ctx.textBaseline = 'alphabetic'; ctx.fillText(s, x, y);
  };
  const lines = (x: number, y: number, ww: number, hh: number, step = 30) => { for (let yy = y + step; yy < y + hh - 4; yy += step) L(x, yy, x + ww, yy); };
  const box = (title: string, x: number, y: number, ww: number, hh: number, lined = true) => {
    ctx.strokeStyle = LINE; ctx.lineWidth = 1.2; ctx.beginPath(); (ctx as any).roundRect ? (ctx as any).roundRect(x, y, ww, hh, 10) : ctx.rect(x, y, ww, hh); ctx.stroke();
    if (title) text(title.toUpperCase(), x + 12, y + 20, 10);
    if (lined) lines(x + 12, y + 24, ww - 24, hh - 24, 28);
  };
  const field = (label: string, x: number, y: number, ww: number) => { text(label.toUpperCase(), x, y - 4, 9.5); L(x, y + 18, x + ww, y + 18, '#D8D1E8'); };
  const header = (title: string, fields: string[]) => {
    ctx.fillStyle = '#F6F2FC'; ctx.fillRect(0, 0, w, 96);
    ctx.fillStyle = ACCENT; ctx.fillRect(0, 96, w, 2);
    text(title, 40, 40, 18, '#4B3F9E', 700);
    const fw = (w - 80 - (fields.length - 1) * 20) / fields.length;
    fields.forEach((f, i) => field(f, 40 + i * (fw + 20), 64, fw));
    return 120;
  };
  const checks = (x: number, y: number, ww: number, hh: number, step = 32) => {
    for (let yy = y; yy + step <= y + hh; yy += step) { ctx.strokeStyle = '#CFC6E3'; ctx.lineWidth = 1.3; ctx.strokeRect(x, yy + 8, 14, 14); L(x + 24, yy + 26, x + ww, yy + 26); }
  };
  const table = (x: number, y: number, ww: number, hh: number, cols: { label: string; f: number }[], rowH = 32) => {
    const tot = cols.reduce((s, c) => s + c.f, 0);
    ctx.fillStyle = '#F6F2FC'; ctx.fillRect(x, y, ww, rowH);
    let cx = x;
    cols.forEach((c, i) => { text(c.label.toUpperCase(), cx + 10, y + 21, 9.5); cx += (c.f / tot) * ww; if (i < cols.length - 1) L(cx, y, cx, y + hh); });
    for (let yy = y + rowH; yy <= y + hh; yy += rowH) L(x, yy, x + ww, yy);
    ctx.strokeStyle = LINE; ctx.strokeRect(x, y, ww, hh);
  };
  const P = 40;
  switch (t) {
    case 'lined': for (let y = 100; y < h - 40; y += 32) L(P, y, w - P, y); L(86, 40, 86, h - 40, PINK, 1.2); break;
    case 'grid': for (let x = 16; x < w; x += 24) L(x, 0, x, h, SOFT); for (let y = 16; y < h; y += 24) L(0, y, w, y, SOFT); break;
    case 'dotted': ctx.fillStyle = '#D3CBE6'; for (let x = 24; x < w; x += 24) for (let y = 24; y < h; y += 24) { ctx.beginPath(); ctx.arc(x, y, 1.3, 0, 7); ctx.fill(); } break;
    case 'cornell': {
      text('TITLE', P, 30); L(P, 58, w - P, 58, '#D8D1E8'); text('DATE', w - 200, 30);
      const cue = Math.min(200, w * 0.28), sumH = Math.min(180, h * 0.17);
      L(P + cue, 70, P + cue, h - sumH - 20, ACCENT, 1.4); L(P, h - sumH - 20, w - P, h - sumH - 20, ACCENT, 1.4);
      text('CUES / QUESTIONS', P, 92); text('NOTES', P + cue + 16, 92); text('SUMMARY', P, h - sumH + 4);
      lines(P + cue + 12, 96, w - 2 * P - cue - 12, h - sumH - 120, 30); lines(P, h - sumH + 8, w - 2 * P, sumH - 30, 30);
      break;
    }
    case 'lecture': {
      const y0 = header('Lecture notes', ['Module', 'Lecture / topic', 'Date']);
      const qh = Math.min(200, h * 0.18);
      lines(P, y0, w - 2 * P, h - y0 - qh - 40, 30);
      box('Key takeaways & questions', P, h - qh - 30, w - 2 * P, qh);
      break;
    }
    case 'meeting': {
      const y0 = header('Meeting notes', ['Meeting', 'Date', 'Attendees']);
      const ah = (h - y0) * 0.2, nh = (h - y0) * 0.45;
      box('Agenda', P, y0, w - 2 * P, ah);
      box('Notes', P, y0 + ah + 16, w - 2 * P, nh);
      table(P, y0 + ah + nh + 32, w - 2 * P, h - (y0 + ah + nh + 32) - 30, [{ label: 'Action', f: 3 }, { label: 'Owner', f: 1.2 }, { label: 'Due', f: 1 }]);
      break;
    }
    case 'research': {
      const y0 = header('Research notes', ['Topic', 'Source / citation', 'Date']);
      const rh = Math.min(170, h * 0.16), cw = (w - 2 * P - 16) * 0.6;
      box('Notes & evidence', P, y0, cw, h - y0 - rh - 46);
      box('Ideas, questions, links', P + cw + 16, y0, w - 2 * P - cw - 16, h - y0 - rh - 46);
      box('References', P, h - rh - 30, w - 2 * P, rh);
      break;
    }
    case 'maths': {
      const y0 = header('Mathematics', ['Name', 'Topic', 'Date']);
      for (let x = P; x <= w - P; x += 20) L(x, y0, x, h - 30, SOFT);
      for (let y = y0; y <= h - 30; y += 20) L(P, y, w - P, y, SOFT);
      for (let i = 0, y = y0 + 14; y < h - 60; i++, y += 160) text(`${i + 1}.`, P - 22, y + 4, 12, ACCENT, 700);
      break;
    }
    case 'daily': {
      const y0 = header('Daily planner', ['Date', 'Focus for today', 'Energy / mood']);
      const lw = (w - 2 * P) * 0.48;
      const hours = 15, step = (h - y0 - 40) / hours;
      for (let i = 0; i < hours; i++) { const y = y0 + i * step; text(`${String(7 + i).padStart(2, '0')}:00`, P, y + 16, 10); L(P + 44, y + step, P + lw, y + step); }
      const rx = P + lw + 20, rw = w - P - rx;
      box('Top 3 priorities', rx, y0, rw, 140, false);
      for (let i = 0; i < 3; i++) { text(`${i + 1}`, rx + 14, y0 + 52 + i * 32, 13, ACCENT, 700); L(rx + 32, y0 + 56 + i * 32, rx + rw - 14, y0 + 56 + i * 32); }
      box('To-do', rx, y0 + 156, rw, 280, false); checks(rx + 14, y0 + 184, rw - 28, 240);
      box('Notes', rx, y0 + 452, rw, h - y0 - 452 - 30);
      break;
    }
    case 'weekly': {
      const y0 = header('Weekly planner', ['Week of', 'Goals this week', 'Habit tracker']);
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'Notes'];
      const cols = w > h ? 4 : 2, rows = 8 / cols, gw = (w - 2 * P - (cols - 1) * 14) / cols, gh = (h - y0 - 30 - (rows - 1) * 14) / rows;
      days.forEach((d, i) => box(d, P + (i % cols) * (gw + 14), y0 + Math.floor(i / cols) * (gh + 14), gw, gh));
      break;
    }
    case 'monthly': {
      const y0 = header('Monthly planner', ['Month', 'Year', 'Focus']);
      const dn = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], cw = (w - 2 * P) / 7, ch = (h - y0 - 70) / 5;
      dn.forEach((d, i) => text(d.toUpperCase(), P + i * cw + 8, y0 + 14, 10));
      for (let r = 0; r <= 5; r++) L(P, y0 + 24 + r * ch, w - P, y0 + 24 + r * ch, LINE, 1.1);
      for (let c = 0; c <= 7; c++) L(P + c * cw, y0 + 24, P + c * cw, y0 + 24 + 5 * ch, LINE, 1.1);
      break;
    }
    case 'revision': {
      const y0 = header('Revision planner', ['Subject / module', 'Exam date', 'Target']);
      table(P, y0, w - 2 * P, h - y0 - 200, [{ label: 'Topic', f: 2.4 }, { label: 'Confidence', f: 1.1 }, { label: 'Revised on', f: 1.3 }, { label: 'Notes', f: 2 }], 36);
      box('Exam-day checklist', P, h - 180, w - 2 * P, 150, false); checks(P + 14, h - 156, w - 2 * P - 28, 120);
      break;
    }
    case 'todo': {
      text('TO-DO', P, 50, 18, '#4B3F9E', 700); L(P, 64, w - P, 64, ACCENT, 1.4);
      text('DATE', w - 180, 50, 10); checks(P, 80, w - 2 * P, h - 120, 34);
      break;
    }
    case 'project': {
      const y0 = header('Project planner', ['Project', 'Owner', 'Deadline']);
      const gh = 120;
      box('Goals & success criteria', P, y0, w - 2 * P, gh);
      table(P, y0 + gh + 16, w - 2 * P, 230, [{ label: 'Milestone', f: 3 }, { label: 'Due', f: 1 }, { label: 'Status', f: 1 }], 32);
      const ty = y0 + gh + 262, hw = (w - 2 * P - 16) / 2;
      box('Tasks', P, ty, hw, h - ty - 30, false); checks(P + 14, ty + 28, hw - 28, h - ty - 70);
      box('Risks & dependencies', P + hw + 16, ty, hw, h - ty - 30);
      break;
    }
    case 'mindmap': {
      ctx.fillStyle = '#DED7EC'; for (let x = 24; x < w; x += 24) for (let y = 24; y < h; y += 24) { ctx.beginPath(); ctx.arc(x, y, 1.1, 0, 7); ctx.fill(); }
      const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.32;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 2, x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R * 0.85;
        L(cx, cy, x, y, '#E2DAF0', 2, [6, 6]);
        ctx.strokeStyle = '#E2DAF0'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.ellipse(x, y, 62, 30, 0, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      }
      ctx.fillStyle = '#F3EEFB'; ctx.strokeStyle = ACCENT; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(cx, cy, 96, 46, 0, 0, 7); ctx.fill(); ctx.stroke();
      ctx.textAlign = 'center'; text('CENTRAL IDEA', cx, cy + 4, 11); ctx.textAlign = 'left';
      break;
    }
    case 'lesson': {
      const y0 = header('Lesson plan', ['Lesson / topic', 'Group', 'Date & duration']);
      const hw = (w - 2 * P - 16) / 2, rh = (h - y0 - 30 - 3 * 16) / 4;
      [['Learning objectives', 'Resources'], ['Starter', 'Main activities'], ['Plenary', 'Assessment'], ['Differentiation & support', 'Reflection']].forEach((pair, r) =>
        pair.forEach((t2, c) => box(t2, P + c * (hw + 16), y0 + r * (rh + 16), hw, rh)));
      break;
    }
    case 'assignment': {
      const y0 = header('Assignment planner', ['Assignment', 'Module / class', 'Due date']);
      box('Brief in my own words', P, y0, w - 2 * P, 150);
      const hw = (w - 2 * P - 16) / 2;
      box('Requirements', P, y0 + 166, hw, 220, false); checks(P + 14, y0 + 192, hw - 28, 180);
      table(P + hw + 16, y0 + 166, hw, 220, [{ label: 'Step', f: 2 }, { label: 'By', f: 1 }], 31);
      box('Notes & sources', P, y0 + 402, w - 2 * P, h - y0 - 402 - 160);
      box('Before I submit', P, h - 144, w - 2 * P, 114, false); checks(P + 14, h - 120, w - 2 * P - 28, 90, 30);
      break;
    }
  }
  ctx.restore();
}

/** Whiteboard background across the visible area. */
export function drawBoardBackground(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, bg: { color: string; pattern: 'none' | 'grid' | 'dots' }, scale: number) {
  ctx.save();
  ctx.fillStyle = bg.color; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  const step = 32;
  const sx = Math.floor(x0 / step) * step, sy = Math.floor(y0 / step) * step;
  if (bg.pattern === 'grid') {
    ctx.strokeStyle = 'rgba(109,96,194,.16)'; ctx.lineWidth = 1 / scale;
    ctx.beginPath();
    for (let x = sx; x < x1; x += step) { ctx.moveTo(x, y0); ctx.lineTo(x, y1); }
    for (let y = sy; y < y1; y += step) { ctx.moveTo(x0, y); ctx.lineTo(x1, y); }
    ctx.stroke();
  } else if (bg.pattern === 'dots' && scale > 0.25) {
    ctx.fillStyle = 'rgba(109,96,194,.35)';
    const r = 1.4 / Math.max(scale, 0.6);
    for (let x = sx; x < x1; x += step) for (let y = sy; y < y1; y += step) { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }
  }
  ctx.restore();
}
