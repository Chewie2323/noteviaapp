// Permanently deletes the calling user's account, files and data (UK GDPR right to erasure).
// Deploy: supabase functions deploy delete-account   (uses the built-in SUPABASE_SERVICE_ROLE_KEY secret)
import { createClient } from 'npm:@supabase/supabase-js@2';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const BUCKETS = ['documents', 'notebooks', 'audio', 'submissions', 'templates', 'covers'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: 'Not signed in' }), { status: 401, headers: CORS });
  const { confirm } = await req.json().catch(() => ({}));
  if (confirm !== 'DELETE') return new Response(JSON.stringify({ error: 'Confirmation missing' }), { status: 400, headers: CORS });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  for (const b of BUCKETS) {
    // remove every object under {user.id}/ (paginated, recursive)
    const stack = [user.id];
    while (stack.length) {
      const prefix = stack.pop()!;
      const { data } = await admin.storage.from(b).list(prefix, { limit: 1000 });
      const files = (data ?? []).filter((f) => f.id).map((f) => `${prefix}/${f.name}`);
      (data ?? []).filter((f) => !f.id).forEach((d) => stack.push(`${prefix}/${d.name}`));
      if (files.length) await admin.storage.from(b).remove(files);
    }
  }
  const { error } = await admin.auth.admin.deleteUser(user.id); // cascades to every table via foreign keys
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: CORS });
  return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, 'content-type': 'application/json' } });
});
