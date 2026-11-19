import { useCallback, useEffect, useRef, useState } from 'react';
import { db, subscribe } from './backend';
import type { TableName } from './types';

/** Live query that re-runs whenever the table changes (locally or via Realtime). Pass null to skip. */
export function useTable<T>(table: TableName, match?: Record<string, any> | null, order?: { col: string; asc?: boolean }) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const key = JSON.stringify([match, order]);
  const alive = useRef(true);
  const load = useCallback(async () => {
    if (match === null) { setRows([]); setLoading(false); return; }
    try { const r = await db.list<T>(table, match || undefined, order); if (alive.current) setRows(r); }
    catch (e) { console.error(table, e); }
    finally { if (alive.current) setLoading(false); }
  }, [table, key]);
  useEffect(() => { alive.current = true; load(); const un = subscribe(table, load); return () => { alive.current = false; un(); }; }, [load, table]);
  return { rows, loading, reload: load };
}

export function useRow<T>(table: TableName, id?: string | null) {
  const [row, setRow] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!id) { setRow(null); setLoading(false); return; }
    try { setRow(await db.get<T>(table, id)); } catch (e) { console.error(e); setRow(null); }
    setLoading(false);
  }, [table, id]);
  useEffect(() => { load(); return subscribe(table, load); }, [load, table]);
  return { row, loading, reload: load };
}

export function useMediaQuery(q: string) {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => { const mq = window.matchMedia(q); const h = () => setM(mq.matches); mq.addEventListener('change', h); return () => mq.removeEventListener('change', h); }, [q]);
  return m;
}

export function useLocalState<T>(key: string, initial: T) {
  const [v, setV] = useState<T>(() => { try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : initial; } catch { return initial; } });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* ignore */ } }, [key, v]);
  return [v, setV] as const;
}

/** Handlers may return false to let the browser handle the key normally. */
export function useKeyShortcuts(map: Record<string, () => void | boolean>, deps: any[]) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || el?.isContentEditable) return;
      const k = `${e.ctrlKey || e.metaKey ? 'mod+' : ''}${e.shiftKey ? 'shift+' : ''}${e.key.toLowerCase()}`;
      if (map[k]) { const r = map[k](); if (r !== false) e.preventDefault(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, deps);
}
