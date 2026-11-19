-- =====================================================================================
-- Notevia · schema, Row Level Security, storage policies, realtime
-- Run once in Supabase → SQL Editor (or `supabase db push`).
-- Privacy model: everything is private to its owner unless explicitly shared.
-- Administrators manage accounts & platform settings but cannot read users' content.
-- =====================================================================================
create extension if not exists pgcrypto;

-- ------------------------------------------------------------------ tables
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role text not null default 'individual' check (role in ('educator','student','individual','admin')),
  avatar_color text default '#E8DFF5',
  organisation text, job_title text, bio text,
  settings jsonb not null default '{"retention_days":30}',
  disabled boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text, color text not null default '#E8DFF5', icon text,
  created_at timestamptz not null default now()
);

create table public.folders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete set null,
  parent_id uuid references public.folders(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  color text not null default '#E8DFF5',
  kind text not null default 'documents' check (kind in ('documents','resources')),
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete set null,
  folder_id uuid references public.folders(id) on delete set null,
  name text not null check (char_length(name) between 1 and 200),
  mime_type text not null default 'application/octet-stream',
  size bigint not null default 0,
  storage_path text,                      -- null for Notevia rich-text pages
  content_html text,
  tags text[] not null default '{}',
  category text,
  annotated_from uuid references public.documents(id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notebooks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete set null,
  folder_id uuid references public.folders(id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  kind text not null default 'notebook' check (kind in ('notebook','whiteboard')),
  cover_color text not null default '#E8DFF5',
  template text not null default 'lined',
  paper_size text not null default 'A4' check (paper_size in ('A4','A5','Letter')),
  orientation text not null default 'portrait' check (orientation in ('portrait','landscape')),
  background jsonb,
  tags text[] not null default '{}',
  notes_html text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notebook_pages (
  id uuid primary key default gen_random_uuid(),
  notebook_id uuid not null references public.notebooks(id) on delete cascade,
  position int not null default 0,
  template text not null default 'lined',
  paper_size text not null default 'A4',
  orientation text not null default 'portrait',
  objects jsonb not null default '[]',
  audio jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null, storage_path text not null, width int not null, height int not null,
  created_at timestamptz not null default now()
);

create table public.annotations (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  pages jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_id, owner_id)
);

create table public.classrooms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text,
  subject text not null default 'General',
  cover_color text not null default '#E8DFF5',
  cover_path text,
  join_code text not null unique default upper(substr(encode(gen_random_bytes(6),'hex'),1,7)),
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.classroom_members (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'student' check (role in ('student','co_teacher')),
  progress int not null default 0 check (progress between 0 and 100),
  created_at timestamptz not null default now(),
  unique (classroom_id, user_id)
);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body_html text not null,
  created_at timestamptz not null default now()
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  email text not null,
  token text not null unique default encode(gen_random_bytes(20),'hex'),
  created_by uuid not null references public.profiles(id) on delete cascade,
  accepted boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.resource_links (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  folder_id uuid references public.folders(id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  description text not null default '',
  url text not null check (url ~* '^https?://'),
  provider text not null default 'Website',
  category text not null default 'General',
  tags text[] not null default '{}',
  thumbnail_url text,
  embeddable boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  instructions_html text not null default '',
  due_at timestamptz not null,
  attachments jsonb not null default '[]',      -- [{type:'document'|'notebook', id}]
  assignee_ids uuid[] not null default '{}',    -- empty = whole classroom
  max_points numeric,
  created_at timestamptz not null default now()
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'in_progress' check (status in ('in_progress','submitted','under_review','returned','completed')),
  text_html text not null default '',
  files jsonb not null default '[]',
  notebook_ids uuid[] not null default '{}',
  annotations jsonb,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, student_id)
);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body_html text not null default '',
  audio_path text,
  points numeric,
  created_at timestamptz not null default now()
);

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  kind text not null default 'personal' check (kind in ('class','meeting','study','reminder','personal','deadline')),
  starts_at timestamptz not null, ends_at timestamptz not null, all_day boolean not null default false,
  color text not null default '#E8DFF5',
  classroom_id uuid references public.classrooms(id) on delete cascade,
  links jsonb not null default '[]', notes text,
  created_at timestamptz not null default now(),
  check (ends_at >= starts_at)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null, done boolean not null default false, due_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null, title text not null, body text, link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.shares (
  id uuid primary key default gen_random_uuid(),
  resource_type text not null check (resource_type in ('document','notebook','folder','link')),
  resource_id uuid not null,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  grantee_type text not null check (grantee_type in ('user','classroom')),
  grantee_id uuid not null,
  permission text not null default 'view' check (permission in ('view','comment','edit')),
  created_at timestamptz not null default now(),
  unique (resource_type, resource_id, grantee_type, grantee_id)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  resource_type text not null, resource_id uuid not null,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id) on delete cascade,
  action text not null, resource_type text not null, resource_id uuid not null, resource_name text not null default '',
  classroom_id uuid references public.classrooms(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.versions (
  id uuid primary key default gen_random_uuid(),
  resource_type text not null check (resource_type in ('notebook','document')),
  resource_id uuid not null,
  author_id uuid not null references public.profiles(id) on delete cascade,
  label text not null default '',
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create table public.favourites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  resource_type text not null, resource_id uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, resource_type, resource_id)
);
create table public.recent_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  resource_type text not null, resource_id uuid not null,
  opened_at timestamptz not null default now(), created_at timestamptz not null default now()
);
create table public.downloads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  resource_type text not null, resource_id uuid not null, name text not null,
  kind text not null default 'original' check (kind in ('original','annotated','export')),
  created_at timestamptz not null default now()
);
create table public.platform_settings (
  id text primary key default 'global',
  allow_registration boolean not null default true,
  default_quota_mb int not null default 2048,
  ai_enabled boolean not null default false,
  notice text,
  created_at timestamptz not null default now()
);
insert into public.platform_settings (id) values ('global') on conflict do nothing;

create index on public.documents (owner_id, folder_id);
create index on public.notebooks (owner_id);
create index on public.notebook_pages (notebook_id, position);
create index on public.classroom_members (user_id);
create index on public.shares (resource_type, resource_id);
create index on public.shares (grantee_id);
create index on public.notifications (user_id, created_at desc);
create index on public.calendar_events (owner_id, starts_at);
create index on public.comments (resource_type, resource_id);
create index on public.activity_logs (actor_id, created_at desc);

-- ------------------------------------------------------------------ helper functions
-- SECURITY DEFINER so policies can call them without recursive RLS evaluation.
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin' and not disabled);
$$;

create or replace function public.my_classrooms() returns uuid[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(id), '{}') from (
    select classroom_id as id from classroom_members where user_id = auth.uid()
    union select id from classrooms where owner_id = auth.uid()
  ) s;
$$;

create or replace function public.owns_classroom(cid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from classrooms where id = cid and owner_id = auth.uid());
$$;

-- 0 none · 1 view · 2 comment · 3 edit · 4 owner
create or replace function public.share_rank(p_type text, p_id uuid) returns int language sql stable security definer set search_path = public as $$
  select coalesce(max(case permission when 'edit' then 3 when 'comment' then 2 else 1 end), 0)
  from shares where resource_type = p_type and resource_id = p_id
    and ((grantee_type = 'user' and grantee_id = auth.uid()) or (grantee_type = 'classroom' and grantee_id = any(public.my_classrooms())));
$$;

create or replace function public.folder_rank(fid uuid) returns int language sql stable security definer set search_path = public as $$
  with recursive chain as (
    select id, parent_id, owner_id, 0 as depth from folders where id = fid
    union all select f.id, f.parent_id, f.owner_id, c.depth + 1 from folders f join chain c on f.id = c.parent_id where c.depth < 30
  )
  select coalesce(max(case when owner_id = auth.uid() then 4 else public.share_rank('folder', id) end), 0) from chain;
$$;

create or replace function public.document_rank(did uuid) returns int language sql stable security definer set search_path = public as $$
  select case when d.owner_id = auth.uid() then 4 when d.deleted_at is not null then 0 else greatest(
    public.share_rank('document', d.id),
    case when d.folder_id is null then 0 else public.folder_rank(d.folder_id) end,
    case when exists (select 1 from assignments a where a.classroom_id = any(public.my_classrooms())
                      and a.attachments @> jsonb_build_array(jsonb_build_object('type','document','id', d.id::text))) then 1 else 0 end
  ) end from documents d where d.id = did;
$$;

create or replace function public.notebook_rank(nid uuid) returns int language sql stable security definer set search_path = public as $$
  select case when n.owner_id = auth.uid() then 4 when n.deleted_at is not null then 0 else greatest(
    public.share_rank('notebook', n.id),
    case when n.folder_id is null then 0 else public.folder_rank(n.folder_id) end,
    case when exists (select 1 from assignments a where a.classroom_id = any(public.my_classrooms())
                      and a.attachments @> jsonb_build_array(jsonb_build_object('type','notebook','id', n.id::text))) then 1 else 0 end,
    case when exists (select 1 from submissions s join assignments a on a.id = s.assignment_id
                      where n.id = any(s.notebook_ids) and s.status <> 'in_progress' and public.owns_classroom(a.classroom_id)) then 2 else 0 end
  ) end from notebooks n where n.id = nid;
$$;

create or replace function public.link_rank(lid uuid) returns int language sql stable security definer set search_path = public as $$
  select case when l.owner_id = auth.uid() then 4 else greatest(public.share_rank('link', l.id),
    case when l.folder_id is null then 0 else public.folder_rank(l.folder_id) end) end
  from resource_links l where l.id = lid;
$$;

create or replace function public.resource_rank(p_type text, p_id uuid) returns int language sql stable security definer set search_path = public as $$
  select case p_type when 'document' then public.document_rank(p_id) when 'notebook' then public.notebook_rank(p_id)
    when 'folder' then public.folder_rank(p_id) when 'link' then public.link_rank(p_id) else 0 end;
$$;

-- people you may see: yourself, your teachers, your students, people you share with
create or replace function public.is_connected(other uuid) returns boolean language sql stable security definer set search_path = public as $$
  select other = auth.uid()
    or exists (select 1 from classrooms c join classroom_members m on m.classroom_id = c.id
               where (c.owner_id = auth.uid() and m.user_id = other) or (c.owner_id = other and m.user_id = auth.uid()))
    or exists (select 1 from shares s where s.grantee_type = 'user'
               and ((s.owner_id = auth.uid() and s.grantee_id = other) or (s.owner_id = other and s.grantee_id = auth.uid())));
$$;

-- share-by-email lookup (returns only id + name)
create or replace function public.find_profile(p_email text) returns table (id uuid, full_name text) language sql stable security definer set search_path = public as $$
  select id, full_name from profiles where lower(email) = lower(trim(p_email)) and not disabled limit 1;
$$;
grant execute on function public.find_profile(text) to authenticated;

-- join a classroom with its code
create or replace function public.join_classroom(p_code text) returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  select id into cid from classrooms where join_code = upper(trim(p_code)) and not archived;
  if cid is null then raise exception 'Classroom code not recognised'; end if;
  insert into classroom_members (classroom_id, user_id) values (cid, auth.uid()) on conflict do nothing;
  return cid;
end $$;
grant execute on function public.join_classroom(text) to authenticated;

create or replace function public.accept_invitation(p_token text) returns uuid language plpgsql security definer set search_path = public as $$
declare inv invitations%rowtype; me text;
begin
  select email into me from profiles where id = auth.uid();
  select * into inv from invitations where token = p_token and not accepted;
  if inv.id is null then raise exception 'Invitation not found or already used'; end if;
  if lower(inv.email) <> lower(me) then raise exception 'This invitation was sent to a different email address'; end if;
  insert into classroom_members (classroom_id, user_id) values (inv.classroom_id, auth.uid()) on conflict do nothing;
  update invitations set accepted = true where id = inv.id;
  return inv.classroom_id;
end $$;
grant execute on function public.accept_invitation(text) to authenticated;

create or replace function public.invitation_info(p_token text) returns json language sql stable security definer set search_path = public as $$
  select json_build_object('email', i.email, 'classroom', c.name, 'subject', c.subject)
  from invitations i join classrooms c on c.id = i.classroom_id where i.token = p_token and not i.accepted;
$$;
grant execute on function public.invitation_info(text) to anon, authenticated;

create or replace function public.registration_open() returns boolean language sql stable security definer set search_path = public as $$
  select allow_registration from platform_settings where id = 'global';
$$;
grant execute on function public.registration_open() to anon, authenticated;

-- new auth user → profile + personal workspace (+ classroom from invite / code)
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare r text := coalesce(new.raw_user_meta_data->>'role', 'individual'); inv invitations%rowtype; cid uuid;
begin
  if not (select allow_registration from platform_settings where id = 'global') then raise exception 'Registration is currently closed'; end if;
  if r not in ('educator','student','individual') then r := 'individual'; end if;   -- admin is never self-assigned
  insert into profiles (id, email, full_name, role, organisation)
  values (new.id, new.email, coalesce(nullif(new.raw_user_meta_data->>'full_name',''), new.raw_user_meta_data->>'name', split_part(new.email,'@',1)), r, new.raw_user_meta_data->>'organisation');
  insert into workspaces (owner_id, name, description) values (new.id, 'My Workspace', 'Your personal space');
  if new.raw_user_meta_data->>'invite_token' is not null then
    select * into inv from invitations where token = new.raw_user_meta_data->>'invite_token' and not accepted and lower(email) = lower(new.email);
    if inv.id is not null then
      insert into classroom_members (classroom_id, user_id) values (inv.classroom_id, new.id) on conflict do nothing;
      update invitations set accepted = true where id = inv.id;
    end if;
  end if;
  if new.raw_user_meta_data->>'class_code' is not null then
    select id into cid from classrooms where join_code = upper(new.raw_user_meta_data->>'class_code');
    if cid is not null then insert into classroom_members (classroom_id, user_id) values (cid, new.id) on conflict do nothing; end if;
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- users cannot change their own role / disabled flag (admins can)
create or replace function public.protect_profile() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.role <> old.role or new.disabled <> old.disabled or new.email <> old.email) and not public.is_admin()
     and current_setting('role', true) <> 'service_role' and pg_trigger_depth() < 2 and coalesce(current_setting('nv.allow_role', true), '') <> 'on' then
    raise exception 'Not allowed to change role, status or email here';
  end if;
  return new;
end $$;
create trigger profiles_protect before update on public.profiles for each row execute function public.protect_profile();

-- ownership can never be transferred by an editor
create or replace function public.keep_owner() returns trigger language plpgsql as $$
begin new.owner_id := old.owner_id; return new; end $$;
create trigger documents_keep_owner before update on public.documents for each row execute function public.keep_owner();
create trigger notebooks_keep_owner before update on public.notebooks for each row execute function public.keep_owner();
create trigger folders_keep_owner before update on public.folders for each row execute function public.keep_owner();

-- recycle-bin retention (call from pg_cron daily: select public.purge_recycle_bin();)
create or replace function public.purge_recycle_bin() returns void language sql security definer set search_path = public as $$
  delete from documents d using profiles p where d.owner_id = p.id and d.deleted_at < now() - make_interval(days => coalesce((p.settings->>'retention_days')::int, 30));
  delete from notebooks n using profiles p where n.owner_id = p.id and n.deleted_at < now() - make_interval(days => coalesce((p.settings->>'retention_days')::int, 30));
  delete from folders f using profiles p where f.owner_id = p.id and f.deleted_at < now() - make_interval(days => coalesce((p.settings->>'retention_days')::int, 30));
$$;

-- ------------------------------------------------------------------ RLS
do $$ declare t text; begin
  foreach t in array array['profiles','workspaces','folders','documents','notebooks','notebook_pages','templates','annotations','classrooms',
    'classroom_members','announcements','invitations','resource_links','assignments','submissions','feedback','calendar_events','tasks',
    'notifications','shares','comments','activity_logs','versions','favourites','recent_items','downloads','platform_settings'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- profiles
create policy p_profiles_select on public.profiles for select using (public.is_connected(id) or public.is_admin());
create policy p_profiles_update on public.profiles for update using (id = auth.uid() or public.is_admin());

-- owner-only tables
create policy p_workspaces on public.workspaces for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy p_templates on public.templates for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy p_tasks on public.tasks for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy p_fav on public.favourites for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy p_recent on public.recent_items for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy p_downloads on public.downloads for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- folders / documents / notebooks / links: owner, or shared (directly, via folder, classroom or assignment)
create policy p_folders_owner on public.folders for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy p_folders_read on public.folders for select using (public.folder_rank(id) >= 1 and deleted_at is null);
create policy p_folders_edit on public.folders for update using (public.folder_rank(id) >= 3);

create policy p_documents_owner on public.documents for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy p_documents_read on public.documents for select using (public.document_rank(id) >= 1);
create policy p_documents_edit on public.documents for update using (public.document_rank(id) >= 3);

create policy p_notebooks_owner on public.notebooks for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy p_notebooks_read on public.notebooks for select using (public.notebook_rank(id) >= 1);
create policy p_notebooks_edit on public.notebooks for update using (public.notebook_rank(id) >= 3);
create policy p_pages_read on public.notebook_pages for select using (public.notebook_rank(notebook_id) >= 1);
create policy p_pages_write on public.notebook_pages for all using (public.notebook_rank(notebook_id) >= 3) with check (public.notebook_rank(notebook_id) >= 3);

create policy p_links_owner on public.resource_links for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy p_links_read on public.resource_links for select using (public.link_rank(id) >= 1);

-- personal annotation layers: each user annotates their own copy
create policy p_annotations on public.annotations for all using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and public.document_rank(document_id) >= 1);

-- classrooms
create policy p_class_owner on public.classrooms for all using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and exists (select 1 from profiles where id = auth.uid() and role = 'educator'));
create policy p_class_member on public.classrooms for select using (id = any(public.my_classrooms()));
create policy p_members_owner on public.classroom_members for all using (public.owns_classroom(classroom_id)) with check (public.owns_classroom(classroom_id));
create policy p_members_self on public.classroom_members for select using (user_id = auth.uid());
create policy p_members_leave on public.classroom_members for delete using (user_id = auth.uid());
create policy p_ann_owner on public.announcements for all using (public.owns_classroom(classroom_id)) with check (public.owns_classroom(classroom_id) and author_id = auth.uid());
create policy p_ann_member on public.announcements for select using (classroom_id = any(public.my_classrooms()));
create policy p_inv_owner on public.invitations for all using (public.owns_classroom(classroom_id)) with check (public.owns_classroom(classroom_id));

-- assignments: whole class, or only the listed students
create policy p_asg_owner on public.assignments for all using (public.owns_classroom(classroom_id)) with check (public.owns_classroom(classroom_id));
create policy p_asg_student on public.assignments for select using (
  classroom_id = any(public.my_classrooms()) and (cardinality(assignee_ids) = 0 or auth.uid() = any(assignee_ids)));

-- submissions: a student sees only their own; the classroom's educator sees all of that class
create policy p_sub_teacher on public.submissions for all using (
  exists (select 1 from assignments a where a.id = assignment_id and public.owns_classroom(a.classroom_id)));
create policy p_sub_student_read on public.submissions for select using (student_id = auth.uid());
create policy p_sub_student_insert on public.submissions for insert with check (
  student_id = auth.uid() and exists (select 1 from assignments a where a.id = assignment_id and a.classroom_id = any(public.my_classrooms())
    and (cardinality(a.assignee_ids) = 0 or auth.uid() = any(a.assignee_ids))));
create policy p_sub_student_update on public.submissions for update
  using (student_id = auth.uid() and status in ('in_progress','submitted','returned'))
  with check (student_id = auth.uid() and status in ('in_progress','submitted'));

create policy p_fb_teacher on public.feedback for all using (
  exists (select 1 from submissions s join assignments a on a.id = s.assignment_id where s.id = submission_id and public.owns_classroom(a.classroom_id)))
  with check (author_id = auth.uid());
create policy p_fb_student on public.feedback for select using (
  exists (select 1 from submissions s where s.id = submission_id and s.student_id = auth.uid() and s.status in ('returned','completed')));

-- calendar: own events + class events for members
create policy p_cal_owner on public.calendar_events for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy p_cal_class on public.calendar_events for select using (classroom_id is not null and classroom_id = any(public.my_classrooms()));

-- notifications: read your own; create only for people you're connected with
create policy p_notif_own on public.notifications for select using (user_id = auth.uid());
create policy p_notif_upd on public.notifications for update using (user_id = auth.uid());
create policy p_notif_del on public.notifications for delete using (user_id = auth.uid());
create policy p_notif_ins on public.notifications for insert with check (public.is_connected(user_id) or exists (
  select 1 from classrooms c join classroom_members m on m.classroom_id = c.id where m.user_id = notifications.user_id and c.id = any(public.my_classrooms())));

-- sharing: only the owner of a resource can share it
create policy p_shares_owner on public.shares for all using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and public.resource_rank(resource_type, resource_id) = 4);
create policy p_shares_grantee on public.shares for select using (
  (grantee_type = 'user' and grantee_id = auth.uid()) or (grantee_type = 'classroom' and grantee_id = any(public.my_classrooms())));

-- comments need comment permission; versions need edit permission to create
create policy p_comments_read on public.comments for select using (public.resource_rank(resource_type, resource_id) >= 1);
create policy p_comments_ins on public.comments for insert with check (author_id = auth.uid() and public.resource_rank(resource_type, resource_id) >= 2);
create policy p_comments_own on public.comments for update using (author_id = auth.uid() or public.resource_rank(resource_type, resource_id) = 4);
create policy p_comments_del on public.comments for delete using (author_id = auth.uid() or public.resource_rank(resource_type, resource_id) = 4);
create policy p_versions_read on public.versions for select using (public.resource_rank(resource_type, resource_id) >= 1);
create policy p_versions_ins on public.versions for insert with check (author_id = auth.uid() and public.resource_rank(resource_type, resource_id) >= 3);

create policy p_activity_ins on public.activity_logs for insert with check (actor_id = auth.uid());
create policy p_activity_read on public.activity_logs for select using (actor_id = auth.uid() or (classroom_id is not null and public.owns_classroom(classroom_id)));

create policy p_settings_read on public.platform_settings for select using (auth.uid() is not null);
create policy p_settings_admin on public.platform_settings for update using (public.is_admin());

-- ------------------------------------------------------------------ storage (all buckets private)
-- Paths always begin with the owner's user id:
--   documents/{owner}/{uuid}-{name}            notebooks/{owner}/{notebook_id}/{file}
--   audio/{owner}/nb/{notebook_id}/{file}      audio/{owner}/fb/{submission_id}/{file}
--   submissions/{student}/{assignment_id}/{f}  templates/{owner}/{file}   covers/{owner}/{classroom_id}/{file}
insert into storage.buckets (id, name, public, file_size_limit) values
  ('documents','documents',false, 104857600), ('notebooks','notebooks',false, 20971520), ('audio','audio',false, 52428800),
  ('submissions','submissions',false, 104857600), ('templates','templates',false, 20971520), ('covers','covers',false, 10485760)
on conflict (id) do nothing;

create or replace function public.can_read_object(bucket text, path text) returns boolean language plpgsql stable security definer set search_path = public as $$
declare s1 text := split_part(path,'/',1); s2 text := split_part(path,'/',2); s3 text := split_part(path,'/',3);
  uuid_re text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if s1 = auth.uid()::text then return true; end if;
  if bucket = 'documents' then
    return exists (select 1 from documents d where d.storage_path = path and public.document_rank(d.id) >= 1);
  elsif bucket = 'notebooks' then
    return s2 ~ uuid_re and public.notebook_rank(s2::uuid) >= 1;
  elsif bucket = 'audio' then
    if s2 = 'nb' and s3 ~ uuid_re then return public.notebook_rank(s3::uuid) >= 1; end if;
    if s2 = 'fb' and s3 ~ uuid_re then
      return exists (select 1 from submissions s join assignments a on a.id = s.assignment_id where s.id = s3::uuid
        and (s.student_id = auth.uid() or public.owns_classroom(a.classroom_id)));
    end if;
  elsif bucket = 'submissions' then
    return s2 ~ uuid_re and exists (select 1 from assignments a where a.id = s2::uuid and public.owns_classroom(a.classroom_id));
  elsif bucket = 'covers' then
    return s2 ~ uuid_re and s2::uuid = any(public.my_classrooms());
  end if;
  return false;
end $$;

create policy st_read on storage.objects for select to authenticated using (public.can_read_object(bucket_id, name));
create policy st_insert on storage.objects for insert to authenticated with check (split_part(name,'/',1) = auth.uid()::text);
create policy st_update on storage.objects for update to authenticated using (split_part(name,'/',1) = auth.uid()::text);
create policy st_delete on storage.objects for delete to authenticated using (split_part(name,'/',1) = auth.uid()::text);

-- ------------------------------------------------------------------ realtime change feed (respects RLS)
alter publication supabase_realtime add table
  public.documents, public.notebooks, public.notebook_pages, public.folders, public.shares, public.comments, public.notifications,
  public.classrooms, public.classroom_members, public.announcements, public.assignments, public.submissions, public.feedback,
  public.calendar_events, public.resource_links;

-- After creating your own account, make yourself platform administrator with:
--   update public.profiles set role = 'admin' where email = 'you@example.com';

-- Users may switch between the three self-service account types (e.g. after Google sign-in). Never to admin.
create or replace function public.set_my_role(p_role text) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_role not in ('educator','student','individual') then raise exception 'Invalid account type'; end if;
  if (select role from profiles where id = auth.uid()) = 'admin' then raise exception 'Administrators keep their role'; end if;
  perform set_config('nv.allow_role', 'on', true);
  update profiles set role = p_role where id = auth.uid();
end $$;
grant execute on function public.set_my_role(text) to authenticated;
