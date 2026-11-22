/**
 * Tiny global tracker of "is the user writing right now?". Autosave consults it so a save (JSON serialisation, network
 * request, Realtime echo) never lands in the middle of a pen stroke or in the short gap between two strokes.
 */
let down = 0;
let last = 0;
let installed = false;
const now = () => performance.now();

function install() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const opt = { capture: true, passive: true } as const;
  window.addEventListener('pointerdown', () => { down++; last = now(); }, opt);
  window.addEventListener('pointermove', () => { if (down > 0) last = now(); }, opt);
  const up = () => { down = Math.max(0, down - 1); last = now(); };
  window.addEventListener('pointerup', up, opt);
  window.addEventListener('pointercancel', up, opt);
  window.addEventListener('blur', () => { down = 0; });
}

/** True when nothing has been touching the screen for at least `ms`. */
export function inkIdle(ms: number) {
  install();
  return down === 0 && now() - last >= ms;
}
export function watchInkActivity() { install(); }
