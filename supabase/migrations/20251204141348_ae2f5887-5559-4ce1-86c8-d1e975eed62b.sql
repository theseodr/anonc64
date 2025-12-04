-- Allow anonymous access to the single global public board and its data

-- 1) Boards: anon can read the global public board (owner_id is null)
create policy "Anon can read global public board"
  on public.boards
  for select
  to anon
  using (
    owner_id is null
    and visibility = 'public'
  );

-- 2) Strokes: anon can read strokes on the global public board
create policy "Anon can read strokes on global board"
  on public.strokes
  for select
  to anon
  using (
    exists (
      select 1 from public.boards b
      where b.id = board_id
        and b.owner_id is null
        and b.visibility = 'public'
    )
  );

-- 3) Strokes: anon can insert strokes on the global public board
create policy "Anon can add strokes on global board"
  on public.strokes
  for insert
  to anon
  with check (
    exists (
      select 1 from public.boards b
      where b.id = board_id
        and b.owner_id is null
        and b.visibility = 'public'
    )
    and user_id is null
    and octet_length(path_data::text) <= 2000000
  );

-- 4) Messages: anon can read messages on the global public board
create policy "Anon can read messages on global board"
  on public.messages
  for select
  to anon
  using (
    exists (
      select 1 from public.boards b
      where b.id = board_id
        and b.owner_id is null
        and b.visibility = 'public'
    )
  );

-- 5) Messages: anon can post messages on the global public board
create policy "Anon can post messages on global board"
  on public.messages
  for insert
  to anon
  with check (
    exists (
      select 1 from public.boards b
      where b.id = board_id
        and b.owner_id is null
        and b.visibility = 'public'
    )
    and user_id is null
    and char_length(content) <= 4096
  );