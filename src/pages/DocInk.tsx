import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Columns2, PenLine, X } from 'lucide-react';
import { useRow } from '@/lib/hooks';
import { useApp } from '@/lib/app';
import type { DocumentRow } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/misc';
import { Empty, FullSpinner, SaveBadge } from '@/components/common';
import { Viewer } from '@/components/Viewer';
import { InkOverlay, useDocInk } from '@/components/InkLayer';
import { cn } from '@/lib/utils';

/** Word, slides, sheets, images and text files — previewed with a handwriting layer you can write on directly. */
export default function DocInk({ embeddedId, onClose }: { embeddedId?: string; onClose?: () => void }) {
  const params = useParams();
  const id = embeddedId || params.id;
  const nav = useNavigate();
  const app = useApp();
  const { row: d, loading } = useRow<DocumentRow>('documents', id);
  const access = d ? app.can('document', d) : null;
  const ink = useDocInk(d && access ? d.id : undefined);
  const [writing, setWriting] = useState(true);
  if (loading) return <FullSpinner />;
  if (!d || !access) return <Empty icon={<X />} title="Document not available" action={<Button onClick={() => nav('/app/documents')}>Back to documents</Button>} />;
  return (
    <div className="flex h-full flex-col bg-ivory dark:bg-background">
      <div className="flex items-center gap-1 px-3 pb-2 pt-3 sm:gap-2 sm:px-4">
        {!embeddedId ? <Button size="icon" variant="ghost" aria-label="Back" onClick={() => nav(-1)}><ArrowLeft /></Button> : onClose && <Button size="icon" variant="ghost" aria-label="Close pane" onClick={onClose}><X /></Button>}
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{d.name}</div>
          <div className="hidden text-[11px] text-muted-foreground sm:block">Your handwriting is a private layer — the original file is never modified</div>
        </div>
        <SaveBadge saver={ink.saver} />
        <Tooltip content={writing ? 'Stop writing (scroll & select)' : 'Write on this document'}>
          <Button size="sm" variant={writing ? 'default' : 'secondary'} aria-pressed={writing} onClick={() => setWriting(!writing)}><PenLine /><span className="hidden sm:inline">{writing ? 'Writing' : 'Write'}</span></Button>
        </Tooltip>
        {!embeddedId && <Tooltip content="Split screen"><Button size="icon" variant="ghost" aria-label="Split screen" onClick={() => nav(`/app/split?left=document:${d.id}`)}><Columns2 /></Button></Tooltip>}
      </div>
      {writing && <div className="px-3 pb-2 sm:px-4">{ink.toolbar}</div>}
      <div data-scroll className={cn('min-h-0 flex-1 overflow-auto px-3 pb-3 sm:px-4')}>
        <InkOverlay ink={ink} writing={writing} className="mx-auto w-full max-w-3xl pb-24">
          <Viewer doc={d} width={760} />
        </InkOverlay>
      </div>
    </div>
  );
}
