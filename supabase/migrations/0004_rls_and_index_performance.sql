-- Notevia 0004: faster row-level security and foreign-key indexes (no change to who can see or edit what).
-- 1) auth.uid()/is_admin()/my_classrooms() wrapped in (select ...) so they run once per query, not once per row.
-- 2) One permissive policy per command per table (OR of the previous ones), clearing the multiple_permissive_policies advisor.
-- 3) Indexes for foreign keys that had none.
create schema if not exists backup;
revoke all on schema backup from public, anon, authenticated;
create table if not exists backup.policies_0004 as select now() as taken_at, * from pg_policies where schemaname = 'public';

do $mig$
declare
  r record; t record; c text; q text; w text; sql text; parts text[]; usings text[]; checks text[]; idx_count int := 0;
begin
  -- ===== 1. evaluate auth.uid() / is_admin() / my_classrooms() once per query instead of once per row =====
  for r in select tablename, policyname, qual, with_check from pg_policies where schemaname = 'public' loop
    q := r.qual; w := r.with_check;
    foreach c in array array['auth.uid()', 'is_admin()', 'my_classrooms()'] loop
      if q is not null then q := replace(q, c, case when c = 'my_classrooms()' then '((select my_classrooms())::uuid[])' else '(select ' || c || ')' end); end if;
      if w is not null then w := replace(w, c, case when c = 'my_classrooms()' then '((select my_classrooms())::uuid[])' else '(select ' || c || ')' end); end if;
    end loop;
    if q is distinct from r.qual or w is distinct from r.with_check then
      parts := array[]::text[];
      if q is not null then parts := parts || format('using (%s)', q); end if;
      if w is not null then parts := parts || format('with check (%s)', w); end if;
      execute format('alter policy %I on public.%I %s', r.policyname, r.tablename, array_to_string(parts, ' '));
    end if;
  end loop;

  -- ===== 2. one permissive policy per command (the advisor's "multiple permissive policies") =====
  -- Permissive policies are OR-ed, so OR-ing their expressions into one policy per command is equivalent.
  for t in
    select tablename from (
      select p.tablename, cm.cmd, count(*) as n
      from pg_policies p
      join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) cm(cmd) on p.cmd = cm.cmd or p.cmd = 'ALL'
      where p.schemaname = 'public' and p.permissive = 'PERMISSIVE'
      group by 1, 2
    ) x group by tablename having max(n) > 1
  loop
    for c in select unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) loop
      select array_agg('(' || qual || ')' order by policyname) filter (where qual is not null),
             array_agg('(' || coalesce(with_check, qual) || ')' order by policyname)
        into usings, checks
        from pg_policies where schemaname = 'public' and tablename = t.tablename and permissive = 'PERMISSIVE' and (cmd = c or cmd = 'ALL');
      if checks is null then continue; end if;
      -- stash the new definition; created after the old policies are dropped
      create temp table if not exists _newpol (tbl text, cmd text, usings text, checks text) on commit drop;
      insert into _newpol values (t.tablename, c,
        case when c in ('SELECT', 'UPDATE', 'DELETE') then array_to_string(usings, ' or ') end,
        case when c in ('INSERT', 'UPDATE') then array_to_string(checks, ' or ') end);
    end loop;
    for r in select policyname from pg_policies where schemaname = 'public' and tablename = t.tablename loop
      execute format('drop policy %I on public.%I', r.policyname, t.tablename);
    end loop;
    for r in select * from _newpol where tbl = t.tablename loop
      sql := format('create policy %I on public.%I for %s', 'p_' || t.tablename || '_' || lower(r.cmd), t.tablename, r.cmd);
      if r.usings is not null then sql := sql || format(' using (%s)', r.usings); end if;
      if r.checks is not null then sql := sql || format(' with check (%s)', r.checks); end if;
      execute sql;
    end loop;
    delete from _newpol where tbl = t.tablename;
  end loop;

  -- ===== 3. index every foreign key that has no covering index =====
  for r in
    select con.conrelid::regclass::text as tbl, rel.relname, con.conname,
           (select string_agg(quote_ident(a.attname), ', ' order by k.ord) from unnest(con.conkey) with ordinality k(attnum, ord) join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.attnum) as cols,
           (select string_agg(a.attname, '_' order by k.ord) from unnest(con.conkey) with ordinality k(attnum, ord) join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.attnum) as colname
    from pg_constraint con join pg_class rel on rel.oid = con.conrelid join pg_namespace ns on ns.oid = rel.relnamespace
    where con.contype = 'f' and ns.nspname = 'public'
      and not exists (select 1 from pg_index i where i.indrelid = con.conrelid and (i.indkey::int2[])[0:array_length(con.conkey, 1) - 1] = con.conkey)
  loop
    execute format('create index if not exists %I on %s (%s)', left('idx_' || r.relname || '_' || r.colname, 63), r.tbl, r.cols);
    idx_count := idx_count + 1;
  end loop;
end
$mig$;
