import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { EditorContent } from '@tiptap/react';
import { ArrowLeft, Share2, MessageSquare, Star, Download, X, Copy, PenLine } from 'lucide-react';
import { useApp } from '@/lib/app';
import { useRow } from '@/lib/hooks';
import { db, now } from '@/lib/backend';
import type { DocumentRow } from '@/lib/types';
import { atLeast } from '@/lib/access';
import { useSaver } from '@/canvas/useInk';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/misc';
import { Empty, FullSpinner, SaveBadge } from '@/components/common';
import { RichToolbar, useRichEditor } from '@/components/RichText';
import { ShareDialog } from '@/components/ShareDialog';
import { InkOverlay, useDocInk } from '@/components/InkLayer';
import { CollabPanel } from '@/components/CollabPanel';
import { duplicateDocument } from '@/lib/actions';
import { safeName, saveBlob } from '@/lib/utils';

/** Notevia pages: Notion-style rich-text documents (headings, checklists, tables, links). */
export default function PageEditor({ embeddedId, onClose }: { embeddedId?: string; onClose?: () => void }) {
  const params = useParams();
  const id = embeddedId || params.id;
  const nav = useNavigate();
  const app = useApp();
  const { row: d, loading } = useRow<DocumentRow>('documents', id);
  const access = d ? app.can('document', d) : null;
  const editable = atLeast(access, 'edit');
  const saver = useSaver();
  const [panel, setPanel] = useState<null | 'collab'>(null);
  const [share, setShare] = useState(false);
  const loaded = useRef(false);
  const ink = useDocInk(d && access ? d.id : undefined);
  const [writing, setWriting] = useState(false);
  const editor = useRichEditor(d?.content_html || '', (html) => d && saver.schedule('page', () => db.update('documents', d.id, { content_html: html, size: html.length, updated_at: now() }, true)), { editable, placeholder: 'Start writing — type freely, add headings, checklists or tables…' });
  useEffect(() => { if (d && editor && !loaded.current) { editor.commands.setContent(d.content_html || '', false); loaded.current = true; app.touchRecent('document', d.id); } }, [d?.id, editor]);
  if (loading) return <FullSpinner />;
  if (!d || !access) return <Empty icon={<X />} title="Page not available" action={<Button onClick={() => nav('/app/documents')}>Back</Button>} />;
  return (
    <div className="flex h-full flex-col bg-ivory dark:bg-background">
      <div className="flex items-center gap-1 px-3 pb-2 pt-3 sm:gap-2 sm:px-4">
        {!embeddedId ? <Button size="icon" variant="ghost" aria-label="Back" onClick={() => nav(-1)}><ArrowLeft /></Button> : onClose && <Button size="icon" variant="ghost" aria-label="Close pane" onClick={onClose}><X /></Button>}
        <input aria-label="Page title" className="min-w-0 flex-1 rounded-lg bg-transparent px-2 py-1 text-lg font-semibold outline-none focus:bg-card" defaultValue={d.name} key={d.name} disabled={!editable}
          onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== d.name) db.update('documents', d.id, { name: v, updated_at: now() }); }} />
        <SaveBadge state={saver.state} readOnly={!editable} />
        {!editable && <Button size="sm" variant="secondary" onClick={async () => { const c = await duplicateDocument(app.user, d); nav(`/app/pages/${c.id}`); }}><Copy /> Make my copy</Button>}
        <Tooltip content={writing ? 'Stop writing' : 'Write on this page with a pen'}><Button size="icon" variant={writing ? 'default' : 'ghost'} aria-label="Write on page" aria-pressed={writing} onClick={() => setWriting(!writing)}><PenLine /></Button></Tooltip>
        <Tooltip content="Favourite"><Button size="icon" variant="ghost" aria-label="Favourite" onClick={() => app.toggleFav('document', d.id)}><Star className={app.isFav('document', d.id) ? 'fill-amber-400 text-amber-400' : ''} /></Button></Tooltip>
        <Tooltip content="Download as HTML"><Button size="icon" variant="ghost" aria-label="Download" onClick={() => saveBlob(new Blob([`<!doctype html><meta charset="utf-8"><title>${d.name}</title><body style="font-family:system-ui;max-width:760px;margin:40px auto;line-height:1.6">${editor?.getHTML() || ''}</body>`], { type: 'text/html' }), `${safeName(d.name)}.html`)}><Download /></Button></Tooltip>
        <Tooltip content="Comments & versions"><Button size="icon" variant={panel === 'collab' ? 'secondary' : 'ghost'} aria-label="Comments" onClick={() => setPanel(panel === 'collab' ? null : 'collab')}><MessageSquare /></Button></Tooltip>
        {access === 'owner' && <Tooltip content="Share"><Button size="icon" variant="ghost" aria-label="Share" onClick={() => setShare(true)}><Share2 /></Button></Tooltip>}
      </div>
      <div className="flex min-h-0 flex-1 gap-3 px-3 pb-3 sm:px-4">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
          {writing ? <div className="border-b border-border p-2">{ink.toolbar}</div> : editable && editor && <RichToolbar editor={editor} />}
          <div data-scroll className="flex-1 overflow-auto"><InkOverlay ink={ink} writing={writing} className="mx-auto max-w-3xl"><div className="px-6 py-8 sm:px-10"><EditorContent editor={editor} className="prose-nv min-h-[60vh]" /></div></InkOverlay></div>
        </div>
        {panel && (
          <aside className="flex w-[340px] shrink-0 flex-col overflow-hidden rounded-2xl border border-border bg-card max-md:fixed max-md:inset-x-2 max-md:bottom-2 max-md:top-24 max-md:z-40 max-md:w-auto max-md:shadow-lift">
            {<><div className="flex items-center border-b border-border px-4 py-2.5"><span className="flex-1 text-sm font-semibold">Comments & history</span><Button size="icon" variant="ghost" aria-label="Close" onClick={() => setPanel(null)}><X /></Button></div>
                <div className="min-h-0 flex-1"><CollabPanel type="document" id={d.id} name={d.name} access={access} snapshot={() => ({ html: editor?.getHTML() })} onRestore={async (s) => { editor?.commands.setContent(s.html || ''); await db.update('documents', d.id, { content_html: s.html, updated_at: now() }); }} /></div></>}
          </aside>
        )}
      </div>
      {access === 'owner' && <ShareDialog open={share} onOpenChange={setShare} type="document" id={d.id} name={d.name} />}
    </div>
  );
}
