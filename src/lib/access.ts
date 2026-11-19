/**
 * Permission rules (mirrored in Postgres RLS — see supabase/migrations).
 * owner > edit > comment > view. Administrators manage accounts and settings but do NOT get access to users' content.
 */
import type { Assignment, Classroom, ClassroomMember, Folder, Permission, Profile, ResourceType, Share, Submission } from './types';

export type Access = 'owner' | Permission;
const RANK: Record<Access, number> = { view: 1, comment: 2, edit: 3, owner: 4 };
export const atLeast = (a: Access | null | undefined, need: Access) => !!a && RANK[a] >= RANK[need];
const best = (a: Access | null, b: Access | null): Access | null => (!a ? b : !b ? a : RANK[a] >= RANK[b] ? a : b);

export interface AccessContext {
  user: Profile;
  shares: Share[];
  memberships: ClassroomMember[];   // my memberships
  ownedClassrooms: Classroom[];     // classrooms I teach
  folders: Folder[];
  assignments: Assignment[];
  submissions: Submission[];
}

export function memberClassroomIds(ctx: AccessContext) {
  return new Set([...ctx.memberships.filter((m) => m.user_id === ctx.user.id).map((m) => m.classroom_id), ...ctx.ownedClassrooms.map((c) => c.id)]);
}

function shareAccess(ctx: AccessContext, type: ResourceType, id: string, classIds: Set<string>): Access | null {
  let a: Access | null = null;
  for (const s of ctx.shares) {
    if (s.resource_type !== type || s.resource_id !== id) continue;
    if ((s.grantee_type === 'user' && s.grantee_id === ctx.user.id) || (s.grantee_type === 'classroom' && classIds.has(s.grantee_id))) a = best(a, s.permission);
  }
  return a;
}

export function folderAccess(ctx: AccessContext, folderId: string | null | undefined, classIds = memberClassroomIds(ctx)): Access | null {
  let a: Access | null = null;
  let f = folderId ? ctx.folders.find((x) => x.id === folderId) : undefined;
  let guard = 0;
  while (f && guard++ < 30) {
    if (f.owner_id === ctx.user.id) return 'owner';
    a = best(a, shareAccess(ctx, 'folder', f.id, classIds));
    f = f.parent_id ? ctx.folders.find((x) => x.id === f!.parent_id) : undefined;
  }
  return a;
}

export function accessFor(ctx: AccessContext, type: ResourceType, item: { id: string; owner_id: string; folder_id?: string | null; deleted_at?: string | null }): Access | null {
  if (item.owner_id === ctx.user.id) return 'owner';
  if (item.deleted_at) return null;
  const classIds = memberClassroomIds(ctx);
  let a = shareAccess(ctx, type, item.id, classIds);
  if (item.folder_id) a = best(a, folderAccess(ctx, item.folder_id, classIds));
  if (type === 'document' || type === 'notebook') {
    // attached to an assignment in one of my classrooms → view
    if (ctx.assignments.some((as) => classIds.has(as.classroom_id) && as.attachments.some((x) => x.type === type && x.id === item.id))) a = best(a, 'view');
    // educator reviewing a submitted notebook
    if (type === 'notebook') {
      const owned = new Set(ctx.ownedClassrooms.map((c) => c.id));
      if (ctx.submissions.some((s) => s.notebook_ids.includes(item.id) && s.status !== 'in_progress' && ctx.assignments.some((as) => as.id === s.assignment_id && owned.has(as.classroom_id)))) a = best(a, 'comment');
    }
  }
  return a;
}

export const canManageClassroom = (u: Profile, c: Classroom) => c.owner_id === u.id;
export const isEducator = (u: Profile) => u.role === 'educator' || u.role === 'individual';
