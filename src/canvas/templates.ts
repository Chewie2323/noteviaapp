import { db } from '@/lib/backend';
import type { CustomTemplate } from '@/lib/types';
const cache = new Map<string, Promise<HTMLImageElement | null>>();
/** Loads the background image for a `custom:<id>` template. */
export function customTemplateImage(template: string): Promise<HTMLImageElement | null> {
  if (!template.startsWith('custom:')) return Promise.resolve(null);
  const id = template.slice(7);
  if (!cache.has(id)) cache.set(id, (async () => {
    const t = await db.get<CustomTemplate>('templates', id);
    if (!t) return null;
    const url = await db.fileUrl('templates', t.storage_path);
    return new Promise<HTMLImageElement | null>((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = url; });
  })());
  return cache.get(id)!;
}
