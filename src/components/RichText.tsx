import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Link from '@tiptap/extension-link';
import { Bold, Italic, Underline as U, Highlighter, List, ListOrdered, ListChecks, Heading1, Heading2, Quote, Code, Table2, Link2, Undo2, Redo2, Minus } from 'lucide-react';
import { useEffect } from 'react';
import { cn, HIGHLIGHTS } from '@/lib/utils';
import type { Editor } from '@tiptap/react';

export function useRichEditor(value: string, onChange?: (html: string) => void, opts: { placeholder?: string; editable?: boolean } = {}) {
  const editor = useEditor({
    extensions: [
      StarterKit, Underline, TextStyle, Color, Highlight.configure({ multicolor: true }), TaskList, TaskItem.configure({ nested: true }),
      Table.configure({ resizable: false }), TableRow, TableHeader, TableCell, Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder: opts.placeholder || 'Start writing…' }),
    ],
    content: value || '', editable: opts.editable !== false,
    onUpdate: ({ editor }) => onChange?.(editor.getHTML()),
  });
  useEffect(() => { editor?.setEditable(opts.editable !== false); }, [opts.editable, editor]);
  useEffect(() => { if (editor && !editor.isFocused && value !== editor.getHTML()) editor.commands.setContent(value || '', false); }, [value, editor]);
  return editor;
}

export function RichToolbar({ editor, compact }: { editor: Editor; compact?: boolean }) {
  const B = ({ on, active, children, title }: any) => (
    <button type="button" title={title} aria-label={title} onMouseDown={(e) => { e.preventDefault(); on(); }}
      className={cn('grid h-8 w-8 place-items-center rounded-lg text-foreground/70 hover:bg-muted [&_svg]:size-4', active && 'bg-secondary text-lavender-ink dark:text-lavender')}>{children}</button>
  );
  const c = () => editor.chain().focus();
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/40 px-2 py-1.5">
      {!compact && <B title="Heading 1" on={() => c().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })}><Heading1 /></B>}
      <B title="Heading" on={() => c().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })}><Heading2 /></B>
      <B title="Bold" on={() => c().toggleBold().run()} active={editor.isActive('bold')}><Bold /></B>
      <B title="Italic" on={() => c().toggleItalic().run()} active={editor.isActive('italic')}><Italic /></B>
      <B title="Underline" on={() => c().toggleUnderline().run()} active={editor.isActive('underline')}><U /></B>
      <span className="mx-1 h-5 w-px bg-border" />
      <B title="Bullet list" on={() => c().toggleBulletList().run()} active={editor.isActive('bulletList')}><List /></B>
      <B title="Numbered list" on={() => c().toggleOrderedList().run()} active={editor.isActive('orderedList')}><ListOrdered /></B>
      <B title="Checklist" on={() => c().toggleTaskList().run()} active={editor.isActive('taskList')}><ListChecks /></B>
      {!compact && <>
        <B title="Quote" on={() => c().toggleBlockquote().run()} active={editor.isActive('blockquote')}><Quote /></B>
        <B title="Code" on={() => c().toggleCodeBlock().run()} active={editor.isActive('codeBlock')}><Code /></B>
        <B title="Table" on={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><Table2 /></B>
        <B title="Divider" on={() => c().setHorizontalRule().run()}><Minus /></B>
        <B title="Link" on={() => { const u = window.prompt('Link URL'); if (u && /^https?:\/\//i.test(u)) c().setLink({ href: u }).run(); }} active={editor.isActive('link')}><Link2 /></B>
      </>}
      <span className="mx-1 h-5 w-px bg-border" />
      {HIGHLIGHTS.slice(0, compact ? 2 : 4).map((col) => (
        <button key={col} type="button" title="Highlight" aria-label="Highlight" onMouseDown={(e) => { e.preventDefault(); c().toggleHighlight({ color: col }).run(); }} className="mx-0.5 grid h-6 w-6 place-items-center rounded-md" style={{ background: col }}><Highlighter className="size-3 text-charcoal/60" /></button>
      ))}
      {!compact && <>
        <span className="mx-1 h-5 w-px bg-border" />
        <B title="Undo" on={() => c().undo().run()}><Undo2 /></B>
        <B title="Redo" on={() => c().redo().run()}><Redo2 /></B>
      </>}
    </div>
  );
}

export function RichText({ value, onChange, placeholder, editable = true, minHeight = 140, compact, className }: { value: string; onChange?: (html: string) => void; placeholder?: string; editable?: boolean; minHeight?: number; compact?: boolean; className?: string }) {
  const editor = useRichEditor(value, onChange, { placeholder, editable });
  if (!editor) return null;
  return (
    <div className={cn('overflow-hidden rounded-xl border border-border bg-card', !editable && 'border-transparent bg-transparent', className)}>
      {editable && <RichToolbar editor={editor} compact={compact} />}
      <EditorContent editor={editor} className="prose-nv px-4 py-3" style={{ minHeight: editable ? minHeight : undefined }} />
    </div>
  );
}
export function Html({ html, className }: { html: string; className?: string }) {
  return <div className={cn('prose-nv text-sm', className)} dangerouslySetInnerHTML={{ __html: sanitize(html) }} />;
}
/** Minimal sanitiser for stored rich text: strips scripts, event handlers and javascript: URLs. */
export function sanitize(html: string) {
  const d = new DOMParser().parseFromString(`<div>${html || ''}</div>`, 'text/html');
  d.querySelectorAll('script,style,iframe,object,embed,link,meta').forEach((n) => n.remove());
  d.querySelectorAll('*').forEach((el) => {
    for (const a of Array.from(el.attributes)) {
      if (/^on/i.test(a.name) || ((a.name === 'href' || a.name === 'src') && /^\s*javascript:/i.test(a.value))) el.removeAttribute(a.name);
    }
  });
  return d.body.firstElementChild?.innerHTML || '';
}
