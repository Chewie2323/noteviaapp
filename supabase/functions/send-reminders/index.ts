// Emails pending Notevia notifications (due soon, new assignment, feedback) to their owners.
// Needs the RESEND_API_KEY secret; without it this function sends nothing and leaves notifications pending.
// Optional secrets: REMINDER_FROM (default "Notevia <onboarding@resend.dev>"), APP_URL (links in the email).
// Invoked hourly by pg_cron (see migration 0003). Sends at most 200 emails per run; each notification is emailed once.
import { createClient } from 'npm:@supabase/supabase-js@2';

const KINDS = ['due_soon', 'assignment', 'feedback'];
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

Deno.serve(async () => {
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key) return json({ sent: 0, reason: 'RESEND_API_KEY not set' });
  const from = Deno.env.get('REMINDER_FROM') ?? 'Notevia <onboarding@resend.dev>';
  const app = (Deno.env.get('APP_URL') ?? 'https://noteviaapp.vercel.app').replace(/\/$/, '');
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const since = new Date(Date.now() - 2 * 86400_000).toISOString();
  const { data: pending, error } = await admin.from('notifications').select('id,user_id,kind,title,body,link')
    .is('emailed_at', null).in('kind', KINDS).gte('created_at', since).limit(200);
  if (error) return json({ error: error.message }, 500);
  if (!pending?.length) return json({ sent: 0 });

  const ids = [...new Set(pending.map((n) => n.user_id))];
  const { data: profiles } = await admin.from('profiles').select('id,email,full_name,settings,disabled').in('id', ids);
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

  let sent = 0;
  for (const n of pending) {
    const p = byId.get(n.user_id);
    // Mark skipped ones too (opted out / disabled) so they aren't retried every hour.
    if (!p || p.disabled || p.settings?.email_notifications === false) { await admin.from('notifications').update({ emailed_at: new Date().toISOString() }).eq('id', n.id); continue; }
    const url = n.link ? `${app}${n.link}` : app;
    const html = `<div style="font-family:system-ui,sans-serif;max-width:480px"><h2 style="margin:0 0 8px">${esc(n.title)}</h2>${n.body ? `<p style="color:#555">${esc(n.body)}</p>` : ''}<p><a href="${url}" style="background:#7C6FD1;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none">Open in Notevia</a></p><p style="color:#999;font-size:12px">You can turn these emails off in Notevia → Settings.</p></div>`;
    const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to: [p.email], subject: n.title, html }) });
    if (r.ok) { await admin.from('notifications').update({ emailed_at: new Date().toISOString() }).eq('id', n.id); sent++; }
  }
  return json({ sent });
});
function json(b: unknown, status = 200) { return new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json' } }); }
