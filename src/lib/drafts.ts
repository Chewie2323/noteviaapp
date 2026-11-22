import { get, set, del } from 'idb-keyval';
import type { NotebookPage } from './types';

/**
 * Safety net for handwriting: if an autosave fails (no signal, server hiccup) the page is parked on this device, and put back
 * the next time the notebook is opened, so strokes are never lost just because the connection dropped.
 */
export type PageDraft = { at: number; patch: Pick<NotebookPage, 'objects' | 'audio' | 'template' | 'paper_size' | 'orientation'> };
const key = (pageId: string) => `nv:draft:page:${pageId}`;
export const saveDraft = (pageId: string, patch: PageDraft['patch']) => set(key(pageId), { at: Date.now(), patch } as PageDraft).catch(() => {});
export const loadDraft = (pageId: string) => get<PageDraft>(key(pageId)).catch(() => undefined);
export const clearDraft = (pageId: string) => del(key(pageId)).catch(() => {});
