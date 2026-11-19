import { db, now, uid, supabase, STORAGE_LIMIT_BYTES } from './backend';
import type { Flashcard, FlashcardDeck, Classroom, ClassroomMember, DocumentRow, Folder, Notebook, NotebookPage, Orientation, PaperSize, Profile, TemplateId } from './types';
import { PASTELS, guessMime, safeName } from './utils';
import { quiz } from './localAI';

export async function createNotebook(user: Profile, o: Partial<Notebook> & { title?: string } = {}) {
  const nb = await db.insert<Notebook>('notebooks', {
    owner_id: user.id, title: o.title || 'Untitled notebook', kind: 'notebook', cover_color: PASTELS[Math.floor(Math.random() * 6)],
    template: 'lined', paper_size: 'A4', orientation: 'portrait', tags: [], notes_html: '', background: null, folder_id: null, workspace_id: null,
    updated_at: now(), ...o,
  });
  if (nb.kind === 'notebook') await db.insert<NotebookPage>('notebook_pages', { notebook_id: nb.id, position: 0, template: nb.template, paper_size: nb.paper_size, orientation: nb.orientation, objects: [], audio: [], updated_at: now() });
  else await db.insert<NotebookPage>('notebook_pages', { notebook_id: nb.id, position: 0, template: 'blank', paper_size: 'A4', orientation: 'landscape', objects: [], audio: [], updated_at: now() });
  return nb;
}
export const createWhiteboard = (user: Profile, title = 'Untitled whiteboard', extra: Partial<Notebook> = {}) =>
  createNotebook(user, { title, kind: 'whiteboard', background: { color: '#FBFAF7', pattern: 'dots' }, cover_color: '#D6E7F8', ...extra });

export async function addPage(nb: Notebook, after: number, pages: NotebookPage[], t?: { template?: TemplateId; paper_size?: PaperSize; orientation?: Orientation }) {
  const ref = pages[after] || pages[pages.length - 1];
  const pg = await db.insert<NotebookPage>('notebook_pages', {
    notebook_id: nb.id, position: after + 1, template: t?.template || ref?.template || nb.template,
    paper_size: t?.paper_size || ref?.paper_size || nb.paper_size, orientation: t?.orientation || ref?.orientation || nb.orientation, objects: [], audio: [], updated_at: now(),
  });
  const list = [...pages]; list.splice(after + 1, 0, pg);
  await reposition(list);
  return list.map((p, i) => ({ ...p, position: i }));
}
export async function reposition(list: NotebookPage[]) {
  await Promise.all(list.map((p, i) => (p.position !== i ? db.update('notebook_pages', p.id, { position: i }, true) : null)));
}

export async function storageUsed(ownerId: string) {
  const all = await db.list<DocumentRow>('documents', { owner_id: ownerId });
  return all.reduce((s, d) => s + (d.size || 0), 0);
}

export async function uploadDocuments(user: Profile, files: File[], folderId: string | null, workspaceId: string | null, onProgress?: (d: number, t: number) => void) {
  const MAX = 100 * 1024 * 1024;
  for (const f of files) if (f.size > MAX) throw new Error(`“${f.name}” is larger than 100 MB.`);
  const used = await storageUsed(user.id);
  if (used + files.reduce((s, f) => s + f.size, 0) > STORAGE_LIMIT_BYTES) throw new Error('Storage limit reached — empty the recycle bin or remove large files.');
  const out: DocumentRow[] = [];
  let i = 0;
  for (const f of files) {
    const path = `${user.id}/${uid()}-${safeName(f.name)}`;
    const mime = f.type || guessMime(f.name);
    await db.upload('documents', path, f.type ? f : new File([f], f.name, { type: mime }));
    out.push(await db.insert<DocumentRow>('documents', { owner_id: user.id, folder_id: folderId, workspace_id: workspaceId, name: f.name, mime_type: mime, size: f.size, storage_path: path, tags: [], category: null, updated_at: now() }));
    onProgress?.(++i, files.length);
  }
  return out;
}

export async function createPage(user: Profile, name: string, html: string, folderId: string | null = null, extra: Partial<DocumentRow> = {}) {
  return db.insert<DocumentRow>('documents', { owner_id: user.id, folder_id: folderId, name, mime_type: 'text/x-notevia-page', size: html.length, storage_path: null, content_html: html, tags: [], updated_at: now(), ...extra });
}

export async function duplicateDocument(user: Profile, d: DocumentRow) {
  const { id: _i, created_at: _c, ...rest } = d;
  const name = d.name.replace(/(\.[^.]+)?$/, ' (copy)$1');
  let storage_path = d.storage_path;
  if (d.storage_path) {
    const blob = await db.download('documents', d.storage_path);
    storage_path = `${user.id}/${uid()}-${safeName(name)}`;
    await db.upload('documents', storage_path, blob);
  }
  return db.insert<DocumentRow>('documents', { ...rest, owner_id: user.id, name, storage_path, updated_at: now() });
}

export async function duplicateNotebook(user: Profile, n: Notebook, title?: string) {
  const { id: _i, created_at: _c, ...rest } = n;
  const copy = await db.insert<Notebook>('notebooks', { ...rest, owner_id: user.id, title: title || `${n.title} (copy)`, folder_id: n.owner_id === user.id ? n.folder_id : null, updated_at: now() });
  const pages = await db.list<NotebookPage>('notebook_pages', { notebook_id: n.id }, { col: 'position', asc: true });
  for (const p of pages) await db.insert('notebook_pages', { notebook_id: copy.id, position: p.position, template: p.template, paper_size: p.paper_size, orientation: p.orientation, objects: p.objects, audio: n.owner_id === user.id ? p.audio : [], updated_at: now() });
  return copy;
}

export async function createFolder(user: Profile, name: string, parent: string | null, kind: Folder['kind'] = 'documents', workspace: string | null = null, color?: string) {
  return db.insert<Folder>('folders', { owner_id: user.id, name, parent_id: parent, kind, workspace_id: workspace, color: color || PASTELS[Math.floor(Math.random() * PASTELS.length)] });
}

export const trash = (table: 'documents' | 'folders' | 'notebooks', id: string) => db.update(table, id, { deleted_at: now() });
export const restore = (table: 'documents' | 'folders' | 'notebooks', id: string) => db.update(table, id, { deleted_at: null });
export async function purge(table: 'documents' | 'folders' | 'notebooks', row: any) {
  if (table === 'documents' && row.storage_path) await db.removeFile('documents', row.storage_path).catch(() => {});
  if (table === 'notebooks') for (const p of await db.list<any>('notebook_pages', { notebook_id: row.id })) await db.remove('notebook_pages', p.id);
  await db.remove(table, row.id);
}

/** UK GDPR data portability: everything the user can read about themselves, as JSON. */
export async function exportMyData(user: Profile) {
  const mine = async (t: any, col = 'owner_id') => db.list(t, { [col]: user.id });
  const data = {
    exported_at: now(), profile: await db.get('profiles', user.id),
    workspaces: await mine('workspaces'), folders: await mine('folders'), documents: await mine('documents'), notebooks: await mine('notebooks'),
    resource_links: await mine('resource_links'), calendar_events: await mine('calendar_events'), tasks: await mine('tasks'),
    classrooms_taught: await mine('classrooms'), memberships: await mine('classroom_members', 'user_id'), submissions: await mine('submissions', 'student_id'),
    comments: await mine('comments', 'author_id'), shares_created: await mine('shares'), favourites: await mine('favourites', 'user_id'),
    notifications: await mine('notifications', 'user_id'), activity: await mine('activity_logs', 'actor_id'),
  } as any;
  data.notebook_pages = [];
  for (const n of data.notebooks) data.notebook_pages.push(...(await db.list('notebook_pages', { notebook_id: n.id })));
  data.note = 'Uploaded files are listed in "documents" (storage_path). Download them individually from Documents.';
  return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
}

/** Join a classroom by its code (Supabase RPC, or local demo store). Returns the classroom id. */
export async function joinByCode(user: Profile, raw: string): Promise<string> {
  const c = raw.trim().toUpperCase();
  if (supabase) return db.rpc<string>('join_classroom', { p_code: c });
  const cls = (await db.list<Classroom>('classrooms')).find((x) => x.join_code === c && !x.archived);
  if (!cls) throw new Error('Classroom code not recognised');
  if (cls.owner_id !== user.id && !(await db.list<ClassroomMember>('classroom_members', { classroom_id: cls.id, user_id: user.id })).length)
    await db.insert('classroom_members', { classroom_id: cls.id, user_id: user.id, role: 'student', progress: 0 });
  return cls.id;
}

/** Spaced repetition (simplified SM-2). grade: 0 again · 1 hard · 2 good · 3 easy. */
export function schedule(c: Pick<Flashcard, 'ease' | 'interval_days' | 'repetitions'>, grade: 0 | 1 | 2 | 3) {
  let { ease, interval_days: iv, repetitions: reps } = c;
  const due = new Date();
  if (grade === 0) { reps = 0; iv = 0; ease = Math.max(1.3, ease - 0.2); due.setMinutes(due.getMinutes() + 10); }
  else {
    if (grade === 1) { iv = Math.max(1, Math.round(iv * 1.2)); ease = Math.max(1.3, ease - 0.15); }
    else if (reps === 0) iv = grade === 3 ? 4 : 1;
    else if (reps === 1) iv = grade === 3 ? 7 : 3;
    else iv = Math.max(iv + 1, Math.round(iv * ease * (grade === 3 ? 1.3 : 1)));
    if (grade === 3) ease += 0.15;
    reps += 1;
    due.setDate(due.getDate() + iv);
  }
  return { ease: Math.round(ease * 100) / 100, interval_days: iv, repetitions: reps, due_at: due.toISOString(), last_reviewed_at: now() };
}

export async function createDeck(user: Profile, title: string, cards: { front: string; back: string }[] = [], extra: Partial<FlashcardDeck> = {}) {
  const deck = await db.insert<FlashcardDeck>('flashcard_decks', { owner_id: user.id, title: title.trim().slice(0, 200) || 'Untitled deck', color: PASTELS[Math.floor(Math.random() * 6)], ...extra });
  for (const c of cards) await addCard(user, deck.id, c.front, c.back);
  return deck;
}
export const addCard = (user: Profile, deckId: string, front: string, back: string) =>
  db.insert<Flashcard>('flashcards', { deck_id: deckId, owner_id: user.id, front: front.trim().slice(0, 2000), back: back.trim().slice(0, 4000), ease: 2.5, interval_days: 0, repetitions: 0, due_at: now() });

/** Draft flashcards from study text with the on-device helper (the student edits them afterwards). */
export const cardsFromText = (text: string, count = 10) => quiz(text, count).map((q) => ({ front: q.q, back: q.a }));
