// Notevia AI — Supabase Edge Function (Deno).
// Keeps the AI provider key server-side. Deploy with:
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...   (optional: AI_MODEL=claude-sonnet-4-5)
//   supabase functions deploy notevia-ai
// The browser only ever sends content after the user has given consent in Notevia.
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const TASKS: Record<string, string> = {
  summarise: 'Summarise the material below into clear, well-structured notes with headings and bullet points.',
  explain: 'Explain the concept(s) below simply and accurately, with a short example. Assume an intelligent beginner.',
  revision: 'Turn the material below into concise revision notes: key terms, definitions, and the 5–10 most important points.',
  flashcards: 'Create 8–12 flashcards from the material below. Format each as "Q: …" then "A: …" on the next line.',
  quiz: 'Write a 6-question multiple-choice quiz on the material below. Give four options (A–D) per question and list the answers at the end.',
  mindmap: 'Produce a mind map of the material below as a nested bullet list (central topic, then branches, then sub-branches). Max 4 levels.',
  lesson: 'Draft a lesson plan from the material below: objectives, prior knowledge, timed activities, assessment, and differentiation.',
  practice: 'Write 6 practice questions of increasing difficulty on the material below, followed by worked answers.',
  translate: 'Translate the text below into {target}. Keep formatting. Output only the translation.',
  improve: 'Improve the clarity, grammar and flow of the text below while keeping the author\'s meaning and voice. Output only the revised text.',
  extract: 'Extract the key information from the material below: people, dates, figures, definitions, decisions and action items.',
  ask: 'Answer the question using ONLY the provided material. If the answer is not in the material, say so.',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return json({ error: 'Not signed in' }, 401);

    const { task, text, question, target } = await req.json();
    if (!TASKS[task]) return json({ error: 'Unknown task' }, 400);
    const material = String(text ?? '').slice(0, 60000);
    if (!material.trim() && task !== 'ask') return json({ error: 'No content provided' }, 400);

    const key = Deno.env.get('ANTHROPIC_API_KEY');
    if (!key) return json({ error: 'AI provider is not configured on the server' }, 503);
    const instruction = TASKS[task].replace('{target}', String(target || 'English'));
    const prompt = task === 'ask' ? `${instruction}\n\nQuestion: ${question}\n\nMaterial:\n${material}` : `${instruction}\n\n---\n${material}`;

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: Deno.env.get('AI_MODEL') ?? 'claude-sonnet-4-5', max_tokens: 2000,
        system: 'You are Notevia AI, a careful study and teaching assistant. Use British English. Format with Markdown.',
        messages: [{ role: 'user', content: prompt }] }),
    });
    if (!r.ok) return json({ error: `AI provider error (${r.status})` }, 502);
    const out = await r.json();
    const textOut = (out.content ?? []).map((c: any) => c.text ?? '').join('\n').trim();
    return json({ text: textOut, model: out.model });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, 'content-type': 'application/json' } });
