import { Capacitor, registerPlugin } from '@capacitor/core';

/** True when running inside the iOS/Android app shell (not the browser or PWA). */
export const isNative = () => Capacitor.isNativePlatform();
export const nativePlatform = () => Capacitor.getPlatform();

export async function initNative() {
  if (!isNative()) return;
  document.documentElement.classList.add('native-app', `native-${nativePlatform()}`);
  try {
    const [{ StatusBar, Style }, { SplashScreen }, { App }] = await Promise.all([import('@capacitor/status-bar'), import('@capacitor/splash-screen'), import('@capacitor/app')]);
    StatusBar.setStyle({ style: Style.Light }).catch(() => {});
    if (nativePlatform() === 'android') StatusBar.setBackgroundColor({ color: '#F8F6FC' }).catch(() => {});
    SplashScreen.hide().catch(() => {});
    // Android hardware back button: go back in the app, exit only from the home screen
    App.addListener('backButton', ({ canGoBack }) => { if (canGoBack && !/^\/app\/?$/.test(location.pathname)) history.back(); else App.exitApp(); });
  } catch { /* plugins unavailable — web fallbacks apply */ }
}

export async function haptic(kind: 'light' | 'medium' = 'light') {
  if (!isNative()) return;
  try { const { Haptics, ImpactStyle } = await import('@capacitor/haptics'); await Haptics.impact({ style: kind === 'light' ? ImpactStyle.Light : ImpactStyle.Medium }); } catch { /* ignore */ }
}

/** Native apps can't use <a download>: write to the cache and open the share sheet (Save to Files, AirDrop, Drive…). */
export async function nativeSave(blob: Blob, name: string) {
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
  const data: string = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = rej; r.readAsDataURL(blob); });
  const safe = name.replace(/[\\/:*?"<>|]+/g, '_');
  const f = await Filesystem.writeFile({ path: safe, data, directory: Directory.Cache });
  await Share.share({ title: safe, url: f.uri, dialogTitle: 'Save or share' });
}

export type PencilAction = 'doubleTap' | 'squeeze';
const Pencil = registerPlugin<{ addListener: (e: 'pencilAction', cb: (d: { action: PencilAction }) => void) => Promise<{ remove: () => void }> }>('NvPencil');
/** Apple Pencil double-tap / squeeze (iOS app only). Returns an unsubscribe function. */
export function onPencilAction(cb: (a: PencilAction) => void) {
  if (!isNative() || nativePlatform() !== 'ios') return () => {};
  let h: { remove: () => void } | undefined; let dead = false;
  Pencil.addListener('pencilAction', (d) => cb(d.action)).then((x) => { if (dead) x.remove(); else h = x; }).catch(() => {});
  return () => { dead = true; h?.remove(); };
}
