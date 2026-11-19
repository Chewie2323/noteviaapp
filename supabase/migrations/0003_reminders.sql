-- Additive: due-soon reminders. Hourly job creates in-app notifications; send-reminders emails them.
alter table public.notifications add column if not exists emailed_at timestamptz;
create index if not exists notifications_pending_email on public.notifications (created_at) where emailed_at is null;

create or replace function public.generate_due_reminders() returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into notifications (user_id, kind, title, body, link)
  select m.user_id, 'due_soon', 'Due soon: ' || a.title,
         'Due ' || to_char(a.due_at at time zone 'utc', 'Dy DD Mon HH24:MI') || ' UTC', '/app/assignments/' || a.id
  from assignments a
  join classroom_members m on m.classroom_id = a.classroom_id and m.role = 'student'
  left join submissions s on s.assignment_id = a.id and s.student_id = m.user_id
  where a.due_at between now() and now() + interval '24 hours'
    and (cardinality(a.assignee_ids) = 0 or m.user_id = any(a.assignee_ids))
    and coalesce(s.status, 'in_progress') = 'in_progress'
    and not exists (select 1 from notifications x where x.user_id = m.user_id and x.kind = 'due_soon' and x.link = '/app/assignments/' || a.id);
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.generate_due_reminders() from public, anon, authenticated;

create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule('notevia-due-reminders', '5 * * * *', $$select public.generate_due_reminders()$$);

-- Email sender, 10 minutes after the reminders are generated (uses the public anon key; the function itself holds the secrets).
select cron.schedule('notevia-send-reminders', '15 * * * *', $$
  select net.http_post(
    url := 'https://sotapniguxsshqditkgw.supabase.co/functions/v1/send-reminders',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvdGFwbmlndXhzc2hxZGl0a2d3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUwODgzNTIsImV4cCI6MjExMDY2NDM1Mn0.2HUZet66yLVbq0sXXByqm8-j0rjYyUrYBz4wEtoxnKo"}'::jsonb,
    body := '{}'::jsonb)
$$);
