// Local "demo mode" AI helpers. They run entirely in the browser so the prototype works offline.
// In production, replace `runAI` with a call to your server (e.g. a serverless function that calls the Claude API).
// Keep API keys on the server, never in the browser.

const STOP = new Set("a an the and or but if then of to in on at for with from by as is are was were be been being it its this that these those i you he she we they them his her our your their not no do does did have has had will would can could should may might about into over under than so such very more most also just".split(" "));

const sentences = (t: string) =>
  t.replace(/\s+/g, " ").match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g)?.map((s) => s.trim()).filter((s) => s.split(" ").length >= 4) ?? [];

const words = (t: string) => t.toLowerCase().match(/[a-z][a-z'-]{2,}/g) ?? [];

function freq(t: string) {
  const f = new Map<string, number>();
  for (const w of words(t)) if (!STOP.has(w)) f.set(w, (f.get(w) ?? 0) + 1);
  return f;
}

export function summarise(text: string, n = 4): string {
  const ss = sentences(text);
  if (ss.length <= n) return ss.join(" ");
  const f = freq(text);
  const scored = ss.map((s, i) => ({ s, i, score: words(s).reduce((a, w) => a + (f.get(w) ?? 0), 0) / Math.sqrt(words(s).length + 1) }));
  return scored.sort((a, b) => b.score - a.score).slice(0, n).sort((a, b) => a.i - b.i).map((x) => x.s).join(" ");
}

export function keyTerms(text: string, n = 8): string[] {
  return [...freq(text).entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([w]) => w);
}

export function revisionNotes(text: string): string {
  const ss = sentences(text);
  const terms = keyTerms(text, 6);
  const key = summarise(text, Math.min(6, Math.max(3, Math.ceil(ss.length / 4)))).match(/[^.!?]+[.!?]+/g) ?? [];
  return [
    "REVISION NOTES",
    "",
    "Key terms: " + (terms.join(", ") || "—"),
    "",
    "Main points:",
    ...key.map((k) => "• " + k.trim()),
    "",
    "Self-check: can you explain each key term in one sentence without looking?",
  ].join("\n");
}

export interface QuizItem { q: string; a: string; options?: string[] }

export function quiz(text: string, count = 5): QuizItem[] {
  const ss = sentences(text);
  const terms = keyTerms(text, 20);
  const items: QuizItem[] = [];
  const f = freq(text);
  const ranked = [...ss].sort((a, b) => words(b).reduce((x, w) => x + (f.get(w) ?? 0), 0) - words(a).reduce((x, w) => x + (f.get(w) ?? 0), 0));
  for (const s of ranked) {
    if (items.length >= count) break;
    const target = words(s).filter((w) => terms.includes(w)).sort((a, b) => (f.get(b) ?? 0) - (f.get(a) ?? 0))[0];
    if (!target) continue;
    const re = new RegExp("\\b" + target + "\\b", "i");
    const distract = terms.filter((t) => t !== target).sort(() => Math.random() - 0.5).slice(0, 3);
    const options = [target, ...distract].sort(() => Math.random() - 0.5);
    items.push({ q: s.replace(re, "_____"), a: target, options });
  }
  return items;
}

export function lessonPlan(topic: string, level: string, minutes: number, goals: string): string {
  const m = Math.max(20, minutes);
  const t = (pct: number) => Math.round((m * pct) / 5) * 5 || 5;
  const g = goals.trim() ? goals.split(/\n|;/).map((x) => x.trim()).filter(Boolean) : [`Understand the core ideas of ${topic}`, `Apply ${topic} to a short problem`];
  return [
    `LESSON PLAN — ${topic}`,
    `Level: ${level}   |   Duration: ${m} min`,
    "",
    "Learning goals",
    ...g.map((x) => "• By the end, students can: " + x),
    "",
    "Structure",
    `1. Hook & prior knowledge (${t(0.1)} min) — one question or image that surfaces what students already think about ${topic}.`,
    `2. Teach (${t(0.3)} min) — model the key idea with a worked example on the board; invite predictions before revealing steps.`,
    `3. Guided practice (${t(0.25)} min) — pairs attempt a similar problem; circulate and give ink feedback.`,
    `4. Independent task (${t(0.25)} min) — individual problem set, 3 levels of challenge.`,
    `5. Exit check (${t(0.1)} min) — 2 questions; collect to plan the next session.`,
    "",
    "Assessment",
    "• Formative: exit check + feedback on the independent task.",
    "• Differentiation: sentence starters for support; extension question for fast finishers.",
    "",
    "Resources to attach in Notevia: lesson notebook, practice sheet, 1–2 reference links.",
  ].join("\n");
}
