/**
 * Accent-colour theming.
 *
 * The app is styled with CSS variables (see styles/index.css). Picking an accent in Settings → Appearance
 * rewrites those variables on <html>, so every screen follows without a rebuild. The chosen accent is stored
 * per device in localStorage (same as dark mode).
 */

export const DEFAULT_ACCENT = '#7C6FD1';
const KEY = 'nv-accent';

export interface AccentPreset { id: string; label: string; hex: string }
export const ACCENT_PRESETS: AccentPreset[] = [
  { id: 'lavender', label: 'Lavender', hex: DEFAULT_ACCENT },
  { id: 'ocean', label: 'Ocean', hex: '#3D7FC4' },
  { id: 'teal', label: 'Teal', hex: '#2F9E8F' },
  { id: 'forest', label: 'Forest', hex: '#3F9A5E' },
  { id: 'amber', label: 'Amber', hex: '#D98324' },
  { id: 'coral', label: 'Coral', hex: '#E0654F' },
  { id: 'rose', label: 'Rose', hex: '#D0507F' },
  { id: 'graphite', label: 'Graphite', hex: '#5C6270' },
];

const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
export const isHex = (s: string) => /^#[0-9a-f]{6}$/i.test(s);

export function getStoredAccent(): string {
  try { const v = localStorage.getItem(KEY); if (v && isHex(v)) return v; } catch { /* storage blocked */ }
  return DEFAULT_ACCENT;
}

type HSL = { h: number; s: number; l: number };

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHsl([r, g, b]: [number, number, number]): HSL {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  let h = 0, s = 0;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6; else if (max === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return { h, s: s * 100, l: l * 100 };
}
function hslToRgb({ h, s, l }: HSL): [number, number, number] {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}
function luminance([r, g, b]: [number, number, number]) {
  const c = [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const contrast = (a: [number, number, number], b: [number, number, number]) => {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

/** Darken (light mode) until white text on it is readable (WCAG AA, 4.5:1). */
function readableOnWhite(c: HSL): HSL {
  let l = c.l;
  while (l > 18 && contrast(hslToRgb({ ...c, l }), [255, 255, 255]) < 4.5) l -= 1;
  return { ...c, l };
}

const hsl = (h: number, s: number, l: number) => `${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%`;
const rgbTriplet = (c: HSL) => hslToRgb(c).join(' ');

/** Rewrite the theme variables for `hex` in light or dark mode. */
export function applyAccent(hex: string, dark: boolean) {
  const base = rgbToHsl(hexToRgb(isHex(hex) ? hex : DEFAULT_ACCENT));
  const h = base.h;
  const s = clamp(base.s, 8, 90);          // keep a hint of colour even for very grey picks
  const root = document.documentElement.style;
  const set = (k: string, v: string) => root.setProperty(k, v);
  // neutral surfaces take a faint tint of the accent hue (capped, so vivid picks don't colour the whole UI)
  const t = (cap: number) => Math.min(cap, s);

  if (!dark) {
    const primary = readableOnWhite({ h, s, l: clamp(base.l, 30, 60) });
    set('--primary', hsl(h, primary.s, primary.l));
    set('--primary-foreground', '0 0% 100%');
    set('--ring', hsl(h, primary.s, primary.l));
    set('--secondary', hsl(h, t(79), 93));
    set('--secondary-foreground', hsl(h, t(43), 36));
    set('--accent', hsl(h, t(79), 93));
    set('--accent-foreground', hsl(h, t(23), 22));
    set('--background', hsl(h, t(50), 98));
    set('--foreground', hsl(h, t(23), 22));
    set('--card-foreground', hsl(h, t(23), 22));
    set('--popover-foreground', hsl(h, t(23), 22));
    set('--muted', hsl(h, t(52), 96));
    set('--muted-foreground', hsl(h, t(13), 44));
    set('--border', hsl(h, t(37), 92));
    set('--input', hsl(h, t(34), 87));
    set('--nv-lav', rgbTriplet({ h, s: primary.s, l: primary.l }));
    set('--nv-lav-deep', rgbTriplet({ h, s: primary.s, l: Math.max(20, primary.l - 7) }));
    set('--nv-lav-ink', rgbTriplet({ h, s: Math.min(primary.s, 55), l: Math.max(18, primary.l - 17) }));
    set('--nv-lilac', rgbTriplet({ h, s: t(79), l: 93 }));
  } else {
    const l = clamp(base.l + 12, 62, 78);
    set('--primary', hsl(h, clamp(s, 20, 75), l));
    set('--primary-foreground', '228 16% 14%');
    set('--ring', hsl(h, clamp(s, 20, 75), l + 3));
    set('--secondary', hsl(h, t(20), 24));
    set('--secondary-foreground', hsl(h, t(60), 88));
    set('--accent', hsl(h, t(20), 24));
    set('--accent-foreground', '240 20% 95%');
    set('--background', hsl(h, t(14), 10));
    set('--foreground', '240 20% 95%');
    set('--card-foreground', '240 20% 95%');
    set('--popover-foreground', '240 20% 95%');
    set('--muted', hsl(h, t(12), 19));
    set('--muted-foreground', hsl(h, t(10), 68));
    set('--border', hsl(h, t(11), 23));
    set('--input', hsl(h, t(11), 27));
    set('--nv-lav', rgbTriplet({ h, s: clamp(s, 20, 75), l }));
    set('--nv-lav-deep', rgbTriplet({ h, s: clamp(s, 20, 75), l: l - 6 }));
    set('--nv-lav-ink', rgbTriplet({ h, s: clamp(s, 20, 75), l: Math.min(90, l + 14) }));
    set('--nv-lilac', rgbTriplet({ h, s: t(20), l: 24 }));
  }
  // card / popover surfaces stay as defined in index.css (white / near-black) for readability
  set('--nv-accent-hex', hex);
}

/** Apply the stored accent for the current mode. The default accent just uses the stylesheet values. */
export function syncAccent(dark: boolean) {
  const style = document.documentElement.style;
  const hex = getStoredAccent();
  if (hex.toLowerCase() === DEFAULT_ACCENT.toLowerCase()) {
    [...style].filter((k) => k.startsWith('--')).forEach((k) => style.removeProperty(k));
  } else applyAccent(hex, dark);
}

export function setStoredAccent(hex: string, dark: boolean) {
  try { localStorage.setItem(KEY, hex); } catch { /* storage blocked */ }
  syncAccent(dark);
}

export function resetAccent(dark: boolean) {
  try { localStorage.removeItem(KEY); } catch { /* storage blocked */ }
  syncAccent(dark);
}

/** Colours canvas code can use (Konva draws in JS, so it can't read Tailwind classes). */
export function accentColors() {
  const hex = getStoredAccent();
  const base = rgbToHsl(hexToRgb(hex));
  const main = readableOnWhite({ h: base.h, s: clamp(base.s, 8, 90), l: clamp(base.l, 30, 60) });
  const toHex = (c: HSL) => '#' + hslToRgb(c).map((v) => v.toString(16).padStart(2, '0')).join('');
  return { main: toHex(main), ink: toHex({ ...main, s: Math.min(main.s, 55), l: Math.max(18, main.l - 17) }) };
}

/** Run once before first paint so there is no flash of the default colour. */
export function bootTheme() {
  let dark = false;
  try { dark = localStorage.getItem('nv-theme') === 'dark'; } catch { /* storage blocked */ }
  syncAccent(dark);
}
