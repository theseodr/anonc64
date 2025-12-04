-- 1) Roles enum and user_roles table

create type public.app_role as enum ('admin', 'moderator', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

-- Users can see their own roles
create policy "Users can view their own roles"
  on public.user_roles
  for select
  to authenticated
  using (user_id = auth.uid());

-- Users can manage their own non-admin roles (admins will be managed manually)
create policy "Users can manage their own non-admin roles"
  on public.user_roles
  for all
  to authenticated
  using (user_id = auth.uid() and role <> 'admin')
  with check (user_id = auth.uid() and role <> 'admin');


-- 2) Helper function to check roles (security definer to avoid RLS recursion)

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  );
$$;


-- 3) Generic updated_at trigger function (for timestamp maintenance)

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql set search_path = public;


-- 4) Profiles table (1:1 with auth.users)

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by authenticated users"
  on public.profiles
  for select
  to authenticated
  using (true);

create policy "Users can insert their own profile"
  on public.profiles
  for insert
  to authenticated
  with check (id = auth.uid());

create policy "Users can update their own profile"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();


-- 5) Boards and visibility

create type public.board_visibility as enum ('public', 'private');

create table public.boards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  visibility public.board_visibility not null default 'public',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.boards enable row level security;

-- Helper condition: a user can access a board if they own it, it's public, or they are admin

create policy "Boards are readable by owners, admins, or if public"
  on public.boards
  for select
  to authenticated
  using (
    owner_id = auth.uid()
    or visibility = 'public'
    or public.has_role(auth.uid(), 'admin')
  );

create policy "Users can create boards for themselves"
  on public.boards
  for insert
  to authenticated
  with check (
    owner_id = auth.uid()
    or public.has_role(auth.uid(), 'admin')
  );

create policy "Owners or admins can update boards"
  on public.boards
  for update
  to authenticated
  using (
    owner_id = auth.uid()
    or public.has_role(auth.uid(), 'admin')
  )
  with check (
    owner_id = auth.uid()
    or public.has_role(auth.uid(), 'admin')
  );

create policy "Owners or admins can delete boards"
  on public.boards
  for delete
  to authenticated
  using (
    owner_id = auth.uid()
    or public.has_role(auth.uid(), 'admin')
  );

create trigger set_boards_updated_at
  before update on public.boards
  for each row
  execute function public.set_updated_at();


-- 6) Strokes table for whiteboard data

create table public.strokes (
  id bigserial primary key,
  board_id uuid not null references public.boards(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  path_data jsonb not null,
  color text not null,
  width numeric(5,2) not null default 1.00,
  created_at timestamptz not null default now()
);

alter table public.strokes enable row level security;

create policy "Strokes readable on accessible boards"
  on public.strokes
  for select
  to authenticated
  using (
    exists (
      select 1 from public.boards b
      where b.id = board_id
        and (
          b.owner_id = auth.uid()
          or b.visibility = 'public'
          or public.has_role(auth.uid(), 'admin')
        )
    )
  );

create policy "Users can add strokes to accessible boards"
  on public.strokes
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.boards b
      where b.id = board_id
        and (
          b.owner_id = auth.uid()
          or b.visibility = 'public'
          or public.has_role(auth.uid(), 'admin')
        )
    )
    and (user_id = auth.uid() or user_id is null)
  );


-- 7) Chat messages table

create table public.messages (
  id bigserial primary key,
  board_id uuid not null references public.boards(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.messages enable row level security;

create policy "Messages readable on accessible boards"
  on public.messages
  for select
  to authenticated
  using (
    exists (
      select 1 from public.boards b
      where b.id = board_id
        and (
          b.owner_id = auth.uid()
          or b.visibility = 'public'
          or public.has_role(auth.uid(), 'admin')
        )
    )
  );

create policy "Users can post messages on accessible boards"
  on public.messages
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.boards b
      where b.id = board_id
        and (
          b.owner_id = auth.uid()
          or b.visibility = 'public'
          or public.has_role(auth.uid(), 'admin')
        )
    )
    and (user_id = auth.uid() or user_id is null)
  );


-- 8) Video backgrounds for boards (YouTube or uploads)

create type public.video_source_type as enum ('youtube', 'upload');

create table public.video_backgrounds (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  source_type public.video_source_type not null,
  youtube_video_id text,
  file_path text,
  start_at_seconds integer default 0,
  created_at timestamptz not null default now()
);

alter table public.video_backgrounds enable row level security;

create policy "Video backgrounds readable on accessible boards"
  on public.video_backgrounds
  for select
  to authenticated
  using (
    exists (
      select 1 from public.boards b
      where b.id = board_id
        and (
          b.owner_id = auth.uid()
          or b.visibility = 'public'
          or public.has_role(auth.uid(), 'admin')
        )
    )
  );

create policy "Users can manage video backgrounds on accessible boards"
  on public.video_backgrounds
  for all
  to authenticated
  using (
    exists (
      select 1 from public.boards b
      where b.id = board_id
        and (
          b.owner_id = auth.uid()
          or b.visibility = 'public'
          or public.has_role(auth.uid(), 'admin')
        )
    )
  )
  with check (
    exists (
      select 1 from public.boards b
      where b.id = board_id
        and (
          b.owner_id = auth.uid()
          or b.visibility = 'public'
          or public.has_role(auth.uid(), 'admin')
        )
    )
  );


-- 9) Realtime configuration for collaborative features

alter publication supabase_realtime add table
  public.boards,
  public.strokes,
  public.messages,
  public.video_backgrounds;