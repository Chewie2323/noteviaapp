export type Role = 'educator' | 'student' | 'individual' | 'admin';
export type Permission = 'view' | 'comment' | 'edit';
export type ResourceType = 'document' | 'notebook' | 'folder' | 'link';

export interface UserSettings {
  retention_days?: number;       // recycle-bin auto-purge
  ai_consent?: boolean;          // permission to send content to the configured AI provider
  tap_undo?: boolean;            // two-finger tap = undo, three-finger tap = redo (default on)
  pencil_only?: boolean;         // palm rejection: only stylus draws
  email_notifications?: boolean; // email reminders (default on)
  default_view?: 'grid' | 'list';
}
export interface Profile {
  id: string; email: string; full_name: string; role: Role;
  avatar_color?: string | null; organisation?: string | null; bio?: string | null; job_title?: string | null;
  settings?: UserSettings | null; disabled?: boolean | null;
  created_at: string;
}
export interface Workspace { id: string; owner_id: string; name: string; description?: string | null; color: string; icon?: string | null; created_at: string }
export interface Folder {
  id: string; owner_id: string; workspace_id?: string | null; parent_id: string | null; name: string; color: string;
  kind: 'documents' | 'resources'; deleted_at?: string | null; created_at: string;
}
export interface DocumentRow {
  id: string; owner_id: string; workspace_id?: string | null; folder_id: string | null; name: string;
  mime_type: string; size: number; storage_path: string | null; content_html?: string | null;
  tags: string[]; category?: string | null; annotated_from?: string | null;
  deleted_at?: string | null; created_at: string; updated_at: string;
}
export type PaperSize = 'A4' | 'A5' | 'Letter';
export type Orientation = 'portrait' | 'landscape';
export type TemplateId =
  | 'blank' | 'lined' | 'grid' | 'dotted' | 'cornell' | 'lecture' | 'meeting' | 'research' | 'maths'
  | 'daily' | 'weekly' | 'monthly' | 'revision' | 'todo' | 'project' | 'mindmap' | 'lesson' | 'assignment' | `custom:${string}`;
export interface Notebook {
  id: string; owner_id: string; workspace_id?: string | null; folder_id?: string | null; title: string;
  kind: 'notebook' | 'whiteboard'; cover_color: string; template: TemplateId; paper_size: PaperSize; orientation: Orientation;
  background?: { color: string; pattern: 'none' | 'grid' | 'dots' } | null;
  tags: string[]; notes_html?: string | null; deleted_at?: string | null; created_at: string; updated_at: string;
}
export interface AudioClip { id: string; storage_path: string; label: string; duration: number; created_at: string; transcript?: string | null }
export interface NotebookPage {
  id: string; notebook_id: string; position: number; template: TemplateId; paper_size: PaperSize; orientation: Orientation;
  objects: CanvasObject[]; audio: AudioClip[]; updated_at: string; created_at: string;
}
export interface CustomTemplate { id: string; owner_id: string; name: string; storage_path: string; width: number; height: number; created_at: string }
export interface AnnotationPage { key: string; source: 'pdf' | 'blank'; pdf_page?: number; rotation: number; template?: TemplateId; objects: CanvasObject[] }
export interface Annotation { id: string; document_id: string; owner_id: string; pages: AnnotationPage[]; updated_at: string; created_at: string }

export interface Classroom {
  id: string; owner_id: string; name: string; description?: string | null; subject: string; cover_color: string; cover_path?: string | null;
  join_code: string; archived?: boolean; created_at: string;
}
export interface ClassroomMember { id: string; classroom_id: string; user_id: string; role: 'student' | 'co_teacher'; progress: number; created_at: string }
export interface Announcement { id: string; classroom_id: string; author_id: string; body_html: string; created_at: string }
export interface Invitation { id: string; classroom_id: string; email: string; token: string; created_by: string; accepted: boolean; created_at: string }
export interface ResourceLink {
  id: string; owner_id: string; folder_id?: string | null; title: string; description: string; url: string; provider: string;
  category: string; tags: string[]; thumbnail_url?: string | null; embeddable: boolean; created_at: string;
}
export interface Attachment { type: 'document' | 'notebook'; id: string }
export interface Assignment {
  id: string; classroom_id: string; created_by: string; title: string; instructions_html: string; due_at: string;
  attachments: Attachment[]; assignee_ids: string[]; max_points: number | null; created_at: string;
}
export type SubmissionStatus = 'in_progress' | 'submitted' | 'under_review' | 'returned' | 'completed';
export interface Submission {
  id: string; assignment_id: string; student_id: string; status: SubmissionStatus; text_html: string;
  files: { path: string; name: string; mime: string; size: number }[]; notebook_ids: string[];
  annotations?: Record<string, CanvasObject[]> | null; submitted_at?: string | null; updated_at: string; created_at: string;
}
export interface Feedback { id: string; submission_id: string; author_id: string; body_html: string; audio_path?: string | null; points?: number | null; created_at: string }
export type EventKind = 'class' | 'meeting' | 'study' | 'reminder' | 'personal' | 'deadline';
export interface CalendarEvent {
  id: string; owner_id: string; title: string; kind: EventKind; starts_at: string; ends_at: string; all_day: boolean; color: string;
  classroom_id?: string | null; links: { type: 'document' | 'notebook' | 'classroom'; id: string }[]; notes?: string | null; created_at: string;
}
export interface Task { id: string; owner_id: string; title: string; done: boolean; due_at?: string | null; created_at: string }
export interface Notification { id: string; user_id: string; kind: string; title: string; body?: string | null; link?: string | null; read: boolean; created_at: string }
export interface Share {
  id: string; resource_type: ResourceType; resource_id: string; owner_id: string;
  grantee_type: 'user' | 'classroom'; grantee_id: string; permission: Permission; created_at: string;
}
export interface Comment { id: string; resource_type: ResourceType; resource_id: string; author_id: string; body: string; resolved: boolean; created_at: string }
export interface ActivityLog { id: string; actor_id: string; action: string; resource_type: string; resource_id: string; resource_name: string; classroom_id?: string | null; created_at: string }
export interface Version { id: string; resource_type: 'notebook' | 'document'; resource_id: string; author_id: string; label: string; snapshot: any; created_at: string }
export interface Favourite { id: string; user_id: string; resource_type: ResourceType; resource_id: string; created_at: string }
export interface RecentItem { id: string; user_id: string; resource_type: 'document' | 'notebook'; resource_id: string; opened_at: string; created_at: string }
export interface DownloadLog { id: string; user_id: string; resource_type: string; resource_id: string; name: string; kind: 'original' | 'annotated' | 'export'; created_at: string }
export interface PlatformSettings { id: string; allow_registration: boolean; default_quota_mb: number; ai_enabled: boolean; notice?: string | null; created_at: string }

// ---- Canvas objects ----
export interface BaseObj { id: string; x: number; y: number; rotation?: number; scaleX?: number; scaleY?: number; opacity?: number }
export type PenKind = 'ballpoint' | 'fountain' | 'pencil' | 'highlighter';
/** points: flat [x, y, pressure, x, y, pressure, ...] */
export interface StrokeObj extends BaseObj { type: 'stroke'; pen: PenKind; points: number[]; color: string; size: number; rec?: { clip: string; ms: number } }
export interface TextObj extends BaseObj { type: 'text'; text: string; fontSize: number; color: string; width: number; bold?: boolean; italic?: boolean; underline?: boolean; highlight?: string | null; align?: 'left' | 'center' | 'right' }
export type ShapeKind = 'rect' | 'ellipse' | 'diamond' | 'triangle' | 'rounded' | 'parallelogram' | 'line' | 'arrow';
export interface ShapeObj extends BaseObj { type: 'shape'; shape: ShapeKind; w: number; h: number; stroke: string; fill: string | null; size: number; dash?: boolean; label?: string }
export interface StickyObj extends BaseObj { type: 'sticky'; w: number; h: number; text: string; color: string }
export interface ImageObj extends BaseObj { type: 'image'; w: number; h: number; src: string }
export interface TableObj extends BaseObj { type: 'table'; colWidths: number[]; rowHeight: number; cells: string[][]; header: boolean; color: string }
export interface MathObj extends BaseObj { type: 'math'; latex: string; fontSize: number; color: string; w: number; h: number }
export interface ConnectorObj extends BaseObj { type: 'connector'; from: string; to: string; stroke: string; size: number; arrow: boolean; curved?: boolean }
export interface NodeObj extends BaseObj { type: 'node'; w: number; h: number; text: string; color: string; parent?: string | null } // mind-map node
export type CanvasObject = StrokeObj | TextObj | ShapeObj | StickyObj | ImageObj | TableObj | MathObj | ConnectorObj | NodeObj;

export type TableName =
  | 'profiles' | 'workspaces' | 'folders' | 'documents' | 'notebooks' | 'notebook_pages' | 'templates' | 'annotations'
  | 'classrooms' | 'classroom_members' | 'announcements' | 'invitations' | 'resource_links' | 'assignments' | 'submissions'
  | 'feedback' | 'calendar_events' | 'tasks' | 'notifications' | 'shares' | 'comments' | 'activity_logs' | 'versions'
  | 'favourites' | 'recent_items' | 'downloads' | 'platform_settings' | 'flashcard_decks' | 'flashcards';

export interface FlashcardDeck { id: string; owner_id: string; title: string; color: string; notebook_id?: string | null; created_at: string }
export interface Flashcard {
  id: string; deck_id: string; owner_id: string; front: string; back: string; ease: number; interval_days: number; repetitions: number;
  due_at: string; last_reviewed_at?: string | null; created_at: string;
}
