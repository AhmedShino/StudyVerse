-- StudyVerse initial schema for Supabase (PostgreSQL).
-- Apply only after reviewing the policies in a development project.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (char_length(username) between 3 and 24),
  display_name text not null default 'Student' check (char_length(display_name) <= 40),
  avatar_url text,
  is_private boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null default 'General' check (char_length(subject) <= 60),
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_seconds integer not null check (duration_seconds between 60 and 43200),
  completed boolean not null default true,
  client_request_id uuid not null,
  created_at timestamptz not null default now(),
  unique(user_id, client_request_id),
  check (ended_at >= started_at)
);

create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 100),
  description text not null default '',
  cadence text not null check (cadence in ('daily','weekly','custom')),
  target_seconds integer not null check (target_seconds > 0),
  reward_xp integer not null check (reward_xp between 0 and 10000),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.challenge_participants (
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  progress_seconds integer not null default 0 check (progress_seconds >= 0),
  completed_at timestamptz,
  primary key(challenge_id, user_id)
);

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined','blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_id <> addressee_id),
  unique(requester_id, addressee_id)
);

create table if not exists public.study_rooms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  goal text not null default '' check (char_length(goal) <= 160),
  visibility text not null default 'private' check (visibility in ('public','private')),
  invite_code text unique,
  status text not null default 'waiting' check (status in ('waiting','running','finished','cancelled')),
  duration_seconds integer not null check (duration_seconds between 300 and 14400),
  started_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  check ((status <> 'running') or (started_at is not null and ends_at is not null))
);

create table if not exists public.room_members (
  room_id uuid not null references public.study_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','moderator','member')),
  status text not null default 'joined' check (status in ('joined','left','removed')),
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key(room_id, user_id)
);

create table if not exists public.room_events (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.study_rooms(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('room_started','room_paused','room_resumed','room_finished','member_joined','member_left')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.user_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reward_key text not null,
  xp integer not null check (xp >= 0),
  granted_at timestamptz not null default now(),
  unique(user_id, reward_key)
);

-- Enable RLS on user-owned/social data. Add policies after testing each workflow.
alter table public.profiles enable row level security;
alter table public.study_sessions enable row level security;
alter table public.challenges enable row level security;
alter table public.challenge_participants enable row level security;
alter table public.friendships enable row level security;
alter table public.study_rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.room_events enable row level security;
alter table public.user_rewards enable row level security;

-- Minimal self policies. Room membership and challenge policies should be expanded
-- together with server-side RPCs before public deployment.
create policy "profiles select public fields" on public.profiles for select
  using (is_private = false or id = auth.uid());
create policy "profiles insert self" on public.profiles for insert
  with check (id = auth.uid());
create policy "profiles update self" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

create policy "sessions select own" on public.study_sessions for select
  using (user_id = auth.uid());
create policy "sessions insert own" on public.study_sessions for insert
  with check (user_id = auth.uid());
create policy "sessions update own" on public.study_sessions for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "sessions delete own" on public.study_sessions for delete
  using (user_id = auth.uid());

create policy "challenges readable" on public.challenges for select using (true);
create policy "participants read self" on public.challenge_participants for select
  using (user_id = auth.uid());
create policy "friendships visible to participants" on public.friendships for select
  using (requester_id = auth.uid() or addressee_id = auth.uid());
create policy "friendships request self" on public.friendships for insert
  with check (requester_id = auth.uid());
create policy "friendships update participants" on public.friendships for update
  using (requester_id = auth.uid() or addressee_id = auth.uid())
  with check (requester_id = auth.uid() or addressee_id = auth.uid());

create policy "rooms visible to owner or joined members or public" on public.study_rooms for select
  using (visibility = 'public' or owner_id = auth.uid() or exists (
    select 1 from public.room_members rm where rm.room_id = id and rm.user_id = auth.uid() and rm.status = 'joined'
  ));
create policy "room owner create" on public.study_rooms for insert
  with check (owner_id = auth.uid());
create policy "room owner update" on public.study_rooms for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "members read room participants" on public.room_members for select
  using (user_id = auth.uid() or exists (
    select 1 from public.room_members own where own.room_id = room_id and own.user_id = auth.uid() and own.status = 'joined'
  ));
create policy "members join self" on public.room_members for insert
  with check (user_id = auth.uid());
create policy "members update self" on public.room_members for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "events read room members" on public.room_events for select
  using (exists (select 1 from public.room_members rm where rm.room_id = room_id and rm.user_id = auth.uid() and rm.status = 'joined'));

-- NOTE: No client insert policy for room_events or user_rewards on purpose.
-- A trusted RPC/Edge Function should validate room transitions and award rewards.
