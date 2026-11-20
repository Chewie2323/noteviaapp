import { isNative, nativeSave } from '@/lib/native';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

export const PASTELS = ['#E4DDFB', '#D5ECE3', '#F9D9E6', '#D6E7F8', '#FDE3D6', '#DCD2EF', '#D8E8DF', '#F1E3E8', '#DDE6F3', '#F6EADF', '#E4E0EA', '#CFE3E6'];
export const INK = ['#2F2B45', '#6D60C2', '#D06A8C', '#4A7BC8', '#3F9A72', '#E0894D', '#D04C4C', '#7B7692'];
export const HIGHLIGHTS = ['#FFE88A', '#C6EBD3', '#F7C6D7', '#C9DBF5', '#E2D3F7', '#F8D5B8'];

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}
export function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 0) { const f = -s; if (f < 3600) return `in ${Math.max(1, Math.round(f / 60))} min`; if (f < 86400) return `in ${Math.round(f / 3600)} h`; return `in ${Math.round(f / 86400)} d`; }
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
export const fmtDateTime = (iso: string) => `${fmtDate(iso)}, ${fmtTime(iso)}`;
export const toLocalInput = (iso: string) => { const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
export function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?'; }
export function safeName(n: string) { return n.replace(/[^\w.\- ()]+/g, '_').slice(0, 140); }
export function firstName(full?: string | null) { const parts = (full || '').trim().split(/\s+/).filter(Boolean); const titles = /^(dr|prof|professor|mr|mrs|ms|miss|mx|sir|dame)\.?$/i; if (parts.length > 1 && titles.test(parts[0])) parts.shift(); return parts[0] || ''; }
export function greeting() { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; }

export type FileKind = 'pdf' | 'docx' | 'pptx' | 'xlsx' | 'csv' | 'txt' | 'image' | 'svg' | 'audio' | 'video' | 'page' | 'other';
export function fileKind(mime: string, name = ''): FileKind {
  const n = name.toLowerCase();
  const ext = n.split('.').pop() || '';
  if (mime === 'text/x-notevia-page') return 'page';
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (ext === 'docx' || ext === 'doc' || mime.includes('wordprocessingml') || mime === 'application/msword') return 'docx';
  if (ext === 'pptx' || ext === 'ppt' || mime.includes('presentation')) return 'pptx';
  if (ext === 'xlsx' || ext === 'xls' || mime.includes('spreadsheet') || mime.includes('excel')) return 'xlsx';
  if (ext === 'csv' || mime === 'text/csv') return 'csv';
  if (ext === 'svg' || mime === 'image/svg+xml') return 'svg';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/') || ['mp3', 'wav', 'm4a'].includes(ext)) return 'audio';
  if (mime.startsWith('video/') || ['mp4', 'mov', 'webm'].includes(ext)) return 'video';
  if (ext === 'txt' || ext === 'md' || mime.startsWith('text/')) return 'txt';
  return 'other';
}
export const ACCEPTED = '.pdf,.docx,.doc,.pptx,.ppt,.xlsx,.xls,.csv,.txt,.md,.png,.jpg,.jpeg,.gif,.webp,.svg,.mp3,.wav,.m4a,.mp4,.mov,.webm';
export const KIND_STYLE: Record<FileKind, { label: string; bg: string; fg: string }> = {
  pdf: { label: 'PDF', bg: '#F6DADF', fg: '#B0445C' }, docx: { label: 'DOCX', bg: '#D9E4F5', fg: '#3561A6' },
  pptx: { label: 'PPTX', bg: '#F5E0D0', fg: '#B3622C' }, xlsx: { label: 'XLSX', bg: '#D4E9DC', fg: '#2F7650' },
  csv: { label: 'CSV', bg: '#DCEDE3', fg: '#2F7650' }, txt: { label: 'TXT', bg: '#E8E7EC', fg: '#5C5E6B' },
  image: { label: 'IMG', bg: '#E4DDFB', fg: '#4B3F9E' }, svg: { label: 'SVG', bg: '#E4DDFB', fg: '#4B3F9E' },
  audio: { label: 'AUDIO', bg: '#F9D9E6', fg: '#8A4A60' }, video: { label: 'VIDEO', bg: '#D6E7F8', fg: '#3A5788' },
  page: { label: 'PAGE', bg: '#E4DDFB', fg: '#4B3F9E' }, other: { label: 'FILE', bg: '#ECECEF', fg: '#5C5E6B' },
};
export function guessMime(n: string) {
  const e = n.split('.').pop()?.toLowerCase() || '';
  return ({
    pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', csv: 'text/csv', txt: 'text/plain', md: 'text/markdown',
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
    mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
  } as Record<string, string>)[e] || 'application/octet-stream';
}
function anchorSave(blob: Blob, name: string) {
  if (isNative()) { nativeSave(blob, name).catch(() => {}); return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
/** Saves a generated file. Inside a hosted Claude artifact this goes through the viewer's download prompt; elsewhere it is a normal browser download. */
export function saveBlob(blob: Blob, name: string) {
  const host = (window as any).claude;
  if (!host?.use) return anchorSave(blob, name);
  Promise.resolve(host.use('downloads')).then((dl: any) => {
    if (!dl) return anchorSave(blob, name);
    return dl.save({ filename: name, data: blob }).catch((e: any) => { if (e?.code !== 'declined' && e?.code !== 'rate_limited') anchorSave(blob, name); });
  }).catch(() => anchorSave(blob, name));
}

// learning-resource providers
export function youtubeId(url: string) { const m = url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/); return m ? m[1] : null; }
export function detectProvider(url: string): string {
  const u = url.toLowerCase();
  const map: [string, string][] = [['youtu', 'YouTube'], ['quizlet', 'Quizlet'], ['kahoot', 'Kahoot'], ['wordwall', 'Wordwall'], ['coursera', 'Coursera'],
    ['docs.google.com/forms', 'Google Forms'], ['forms.gle', 'Google Forms'], ['colab.research.google', 'Google Colab'], ['github.com', 'GitHub'],
    ['doi.org', 'Research article'], ['arxiv.org', 'Research article'], ['scholar.google', 'Research article'], ['openstax', 'Online textbook'], ['wikibooks', 'Online textbook']];
  return map.find(([k]) => u.includes(k))?.[1] || 'Website';
}
export function embedUrl(url: string, provider: string): string | null {
  if (provider === 'YouTube') { const id = youtubeId(url); return id ? `https://www.youtube-nocookie.com/embed/${id}` : null; }
  if (provider === 'Wordwall') { const m = url.match(/wordwall\.net\/(?:[\w-]+\/)?resource\/(\d+)/); return m ? `https://wordwall.net/embed/resource/${m[1]}` : null; }
  if (provider === 'Quizlet') { const m = url.match(/quizlet\.com\/(?:[\w-]+\/)?(\d{5,})/); return m ? `https://quizlet.com/${m[1]}/flashcards/embed` : null; }
  if (provider === 'Google Forms' && url.includes('docs.google.com/forms')) return url.includes('embedded=true') ? url : url + (url.includes('?') ? '&' : '?') + 'embedded=true';
  return null;
}
export function linkThumb(url: string, provider: string) { const id = provider === 'YouTube' ? youtubeId(url) : null; return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null; }
