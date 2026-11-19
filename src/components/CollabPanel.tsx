import { useState } from 'react';
import { MessageSquare, History, Check, RotateCcw, Trash2, Activity } from 'lucide-react';
import { useApp, ask } from '@/lib/app';
import { useTable } from '@/lib/hooks';
import { db } from '@/lib/backend';
import type { ActivityLog, Comment, ResourceType, Version } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/misc';
import { Avatar } from './common';
import { timeAgo } from '@/lib/utils';
import type { Access } from '@/lib/access';
import { atLeast } from '@/lib/access';

/** Comments, version history and activity for any resource. */
export function CollabPanel({ type, id, name, access, onRestore, snapshot }: {
  type: ResourceType; id: string; name: string; access: Access | null;
  onRestore?: (snapshot: any) => Promise<void>; snapshot?: () => any;
}) {
  const app = useApp();
  const { rows: comments } = useTable<Comment>('comments', { resource_type: type, resource_id: id }, { col: 'created_at', asc: true });
  const { rows: versions } = useTable<Version>('versions', type === 'notebook' || type === 'document' ? { resource_type: type, resource_id: id } : null);
  const { rows: activity } = useTable<ActivityLog>('activity_logs', { resource_id: id });
  const [text, setText] = useState('');
  const canComment = atLeast(access, 'comment');
  const canEdit = atLeast(access, 'edit');
  const post = async () => {
    if (!text.trim()) return;
    await db.insert('comments', { resource_type: type, resource_id: id, author_id: app.user.id, body: text.trim().slice(0, 5000), resolved: false });
    app.log('commented', type, id, name); setText('');
  };
  return (
    <Tabs defaultValue="comments" className="flex h-full flex-col">
      <TabsList className="mx-3 mt-3 grid grid-cols-3"><TabsTrigger value="comments"><MessageSquare className="size-3.5" /> Comments</TabsTrigger><TabsTrigger value="versions"><History className="size-3.5" /> Versions</TabsTrigger><TabsTrigger value="activity"><Activity className="size-3.5" /> Activity</TabsTrigger></TabsList>
      <TabsContent value="comments" className="mt-3 flex-1 space-y-3 overflow-auto px-3 pb-3">
        {comments.map((c) => {
          const a = app.profile(c.author_id);
          return (
            <div key={c.id} className={`rounded-xl border border-border p-3 ${c.resolved ? 'opacity-55' : ''}`}>
              <div className="mb-1.5 flex items-center gap-2"><Avatar name={a?.full_name || 'User'} color={a?.avatar_color} size={24} /><span className="text-xs font-medium">{a?.full_name || 'Collaborator'}</span><span className="text-[11px] text-muted-foreground">{timeAgo(c.created_at)}</span></div>
              <p className="whitespace-pre-wrap text-sm">{c.body}</p>
              <div className="mt-2 flex gap-2 text-[11px]">
                {(canEdit || c.author_id === app.user.id) && <button className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground" onClick={() => db.update('comments', c.id, { resolved: !c.resolved })}><Check className="size-3" /> {c.resolved ? 'Reopen' : 'Resolve'}</button>}
                {(c.author_id === app.user.id || access === 'owner') && <button className="inline-flex items-center gap-1 text-muted-foreground hover:text-red-600" onClick={() => db.remove('comments', c.id)}><Trash2 className="size-3" /> Delete</button>}
              </div>
            </div>
          );
        })}
        {!comments.length && <p className="py-6 text-center text-sm text-muted-foreground">No comments yet.</p>}
        {canComment ? (
          <div className="space-y-2"><Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment…" /><Button size="sm" className="w-full" disabled={!text.trim()} onClick={post}>Post comment</Button></div>
        ) : <p className="text-xs text-muted-foreground">You have view-only access.</p>}
      </TabsContent>
      <TabsContent value="versions" className="mt-3 flex-1 space-y-2 overflow-auto px-3 pb-3">
        {canEdit && snapshot && <Button size="sm" variant="secondary" className="w-full" onClick={async () => {
          const label = await ask.prompt('Name this version', `Version ${versions.length + 1}`, undefined, 'Save version');
          if (label) { await db.insert('versions', { resource_type: type, resource_id: id, author_id: app.user.id, label, snapshot: snapshot() }); app.toast('Version saved'); }
        }}><History /> Save current version</Button>}
        {versions.map((v) => (
          <div key={v.id} className="flex items-center gap-2 rounded-xl border border-border p-3">
            <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{v.label || 'Version'}</div><div className="text-[11px] text-muted-foreground">{app.profile(v.author_id)?.full_name || 'Collaborator'} · {timeAgo(v.created_at)}</div></div>
            {canEdit && onRestore && <Button size="sm" variant="ghost" onClick={async () => { if (await ask.confirm('Restore this version?', 'The current content is saved as a version first, so you can undo this.', 'Restore', false)) { if (snapshot) await db.insert('versions', { resource_type: type, resource_id: id, author_id: app.user.id, label: 'Before restore', snapshot: snapshot() }); await onRestore(v.snapshot); app.toast('Version restored'); } }}><RotateCcw /> Restore</Button>}
          </div>
        ))}
        {!versions.length && <p className="py-6 text-center text-sm text-muted-foreground">No saved versions. Versions are snapshots you can return to.</p>}
      </TabsContent>
      <TabsContent value="activity" className="mt-3 flex-1 space-y-2 overflow-auto px-3 pb-3">
        {activity.slice(0, 50).map((a) => <div key={a.id} className="text-sm"><b className="font-medium">{a.actor_id === app.user.id ? 'You' : app.profile(a.actor_id)?.full_name || 'Someone'}</b> {a.action} <span className="text-xs text-muted-foreground">· {timeAgo(a.created_at)}</span></div>)}
        {!activity.length && <p className="py-6 text-center text-sm text-muted-foreground">No activity recorded yet.</p>}
      </TabsContent>
    </Tabs>
  );
}
