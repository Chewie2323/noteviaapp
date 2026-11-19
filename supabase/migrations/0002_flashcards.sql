-- Additive: spaced-repetition flashcards (owner-private, same pattern as the 0001 schema).
create table public.flashcard_decks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  color text not null default '#E4DDFB',
  notebook_id uuid references public.notebooks(id) on delete set null,
  created_at timestamptz not null default now()
);
create table public.flashcards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.flashcard_decks(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  front text not null check (char_length(front) between 1 and 2000),
  back text not null check (char_length(back) between 1 and 4000),
  ease numeric not null default 2.5 check (ease >= 1.3),
  interval_days int not null default 0 check (interval_days >= 0),
  repetitions int not null default 0 check (repetitions >= 0),
  due_at timestamptz not null default now(),
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.flashcard_decks (owner_id);
create index on public.flashcards (deck_id);
create index on public.flashcards (owner_id, due_at);
alter table public.flashcard_decks enable row level security;
alter table public.flashcards enable row level security;
create policy p_flashcard_decks on public.flashcard_decks for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy p_flashcards on public.flashcards for all using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and exists (select 1 from public.flashcard_decks d where d.id = deck_id and d.owner_id = auth.uid()));
