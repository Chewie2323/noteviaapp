/**
 * KaTeX equations on the canvas: the formula is laid out by KaTeX, then wrapped in an SVG <foreignObject>
 * with the KaTeX fonts embedded, so it can be drawn by Konva and exported to PDF/PNG like any image.
 */
import katex from 'katex';
import katexCss from 'katex/dist/katex.min.css?raw';

const fontUrls = import.meta.glob('../../node_modules/katex/dist/fonts/KaTeX_{Main-Regular,Main-Bold,Main-Italic,Math-Italic,AMS-Regular,Size1-Regular,Size2-Regular,Size3-Regular,Size4-Regular}.woff2', { query: '?url', import: 'default', eager: true }) as Record<string, string>;

let cssPromise: Promise<string> | null = null;
async function toDataUrl(u: string) {
  if (u.startsWith('data:')) return u;
  const b = await (await fetch(u)).blob();
  return new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(b); });
}
function embeddedCss(): Promise<string> {
  if (!cssPromise) cssPromise = (async () => {
    const map: Record<string, string> = {};
    for (const [k, u] of Object.entries(fontUrls)) map[k.split('/').pop()!] = await toDataUrl(u);
    // keep only the woff2 sources we embed; drop all other font urls
    return katexCss.replace(/src:([^;}]+)/g, (_m, srcs: string) => {
      const m = srcs.match(/url\(fonts\/(KaTeX_[\w-]+\.woff2)\)/);
      return m && map[m[1]] ? `src:url(${map[m[1]]}) format("woff2")` : 'src:local("Times New Roman")';
    });
  })();
  return cssPromise;
}

export function renderMathHtml(latex: string, display = true) {
  try { return katex.renderToString(latex, { displayMode: display, throwOnError: false, output: 'html', strict: 'ignore' }); }
  catch (e: any) { return `<span style="color:#D04C4C">${String(e?.message || 'Invalid equation')}</span>`; }
}

/** Measures the equation at the given font size. Requires katex.min.css to be loaded in the page. */
export function measureMath(latex: string, fontSize: number) {
  const el = document.createElement('div');
  el.style.cssText = `position:absolute;left:-9999px;top:0;font-size:${fontSize}px;display:inline-block;white-space:nowrap;padding:4px 6px`;
  el.innerHTML = renderMathHtml(latex);
  const inner = el.firstElementChild as HTMLElement | null;
  if (inner) inner.style.margin = '0';
  document.body.appendChild(el);
  const r = el.getBoundingClientRect();
  el.remove();
  return { w: Math.ceil(r.width) + 2, h: Math.ceil(r.height) + 2 };
}

const imgCache = new Map<string, Promise<HTMLImageElement>>();
export function mathImage(latex: string, fontSize: number, color: string): Promise<HTMLImageElement> {
  const key = `${latex}|${fontSize}|${color}`;
  if (!imgCache.has(key)) imgCache.set(key, (async () => {
    const css = await embeddedCss();
    const { w, h } = measureMath(latex, fontSize);
    const html = renderMathHtml(latex).replace(/<br>/g, '<br/>');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="font-size:${fontSize}px;color:${color};padding:4px 6px;white-space:nowrap"><style>${css}.katex-display{margin:0!important}</style>${html}</div></foreignObject></svg>`;
    const img = new Image();
    img.width = w; img.height = h;
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
    return img;
  })());
  return imgCache.get(key)!;
}

export const MATH_SNIPPETS: { label: string; tex: string }[] = [
  { label: 'Fraction', tex: '\\frac{a}{b}' }, { label: 'Power', tex: 'x^{2}' }, { label: 'Root', tex: '\\sqrt{x}' },
  { label: 'Sum', tex: '\\sum_{i=1}^{n} x_i' }, { label: 'Integral', tex: '\\int_{a}^{b} f(x)\\,dx' }, { label: 'Limit', tex: '\\lim_{x \\to \\infty}' },
  { label: 'Matrix', tex: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}' }, { label: 'Quadratic', tex: 'x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}' },
  { label: 'Greek', tex: '\\alpha \\beta \\gamma \\theta \\pi \\sigma' }, { label: '≤ ≥ ≠', tex: '\\leq \\geq \\neq \\approx' },
];
