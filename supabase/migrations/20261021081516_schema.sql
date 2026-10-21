-- QuestFinder schema: tables, row-level security, and the triggers that enforce the spec's rules.
-- Helper and trigger functions live in the "private" schema, which the Data API does not expose,
-- so clients can't call them directly.

create schema if not exists private;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.session_type as enum ('bouldering', 'roped', 'intro', 'outdoor', 'social', 'other');
create type public.event_visibility as enum ('public', 'private');
create type public.event_status as enum ('open', 'cancelled');
create type public.rsvp_status as enum ('going', 'waitlist');
create type public.bucket_status as enum ('wishlist', 'planned', 'done');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  climbing_level smallint check (climbing_level between 0 and 10),
  created_at timestamptz not null default now()
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  -- New signups join every auto_join group (see private.handle_new_user)
  auto_join boolean not null default false
);

create table public.group_members (
  group_id uuid references public.groups on delete cascade,
  user_id uuid references public.profiles on delete cascade,
  primary key (group_id, user_id)
);

create table public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  neighborhood text not null,
  category text not null,
  lat double precision,
  lng double precision,
  google_place_id text,
  google_rating numeric(2, 1)
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  -- User foreign keys point at profiles (not auth.users) so the API can embed display names
  host_id uuid not null default auth.uid() references public.profiles,
  venue_id uuid not null references public.venues,
  activity text not null check (char_length(activity) between 1 and 60),
  session_type public.session_type not null,
  level_min smallint check (level_min between 0 and 10),
  level_max smallint check (level_max between 0 and 10),
  starts_at timestamptz not null,
  price_per_person integer not null check (price_per_person >= 0),
  -- Total headcount including the host; null means no limit
  capacity smallint check (capacity between 2 and 50),
  visibility public.event_visibility not null,
  group_id uuid references public.groups,
  status public.event_status not null default 'open',
  -- Seeded demo events, which a daily job rolls forward (Phase 10)
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  constraint group_iff_private check ((visibility = 'private') = (group_id is not null)),
  -- Both bounds or neither (neither means all levels), lowest first
  constraint level_range check (
    (level_min is null) = (level_max is null)
    and (level_min is null or level_min <= level_max)
  )
);

create table public.rsvps (
  event_id uuid references public.events on delete cascade,
  user_id uuid references public.profiles on delete cascade,
  status public.rsvp_status not null,
  -- Waitlist order
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create table public.bucket_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  venue_id uuid references public.venues,
  status public.bucket_status not null default 'wishlist',
  event_id uuid references public.events on delete set null,
  done_at timestamptz,
  created_at timestamptz not null default now()
);

create index group_members_user_id_idx on public.group_members (user_id);
create index events_upcoming_idx on public.events (starts_at) where status = 'open';
create index events_host_id_idx on public.events (host_id);
create index events_venue_id_idx on public.events (venue_id);
create index events_group_id_idx on public.events (group_id);
create index rsvps_queue_idx on public.rsvps (event_id, status, created_at);
create index rsvps_user_id_idx on public.rsvps (user_id);
create index bucket_items_user_id_idx on public.bucket_items (user_id);
create index bucket_items_event_id_idx on public.bucket_items (event_id);

-- ---------------------------------------------------------------------------
-- Helper: group membership
-- ---------------------------------------------------------------------------

-- Policies on group_members can't query group_members themselves (infinite recursion),
-- so every group check goes through this function, which runs with its owner's rights.
create function private.is_member(target_group uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members
    where group_id = target_group and user_id = (select auth.uid())
  );
$$;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.venues enable row level security;
alter table public.events enable row level security;
alter table public.rsvps enable row level security;
alter table public.bucket_items enable row level security;

create policy "profiles are readable" on public.profiles
  for select to authenticated using (true);
create policy "edit own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "see my groups" on public.groups
  for select to authenticated using (private.is_member(id));
create policy "see members of my groups" on public.group_members
  for select to authenticated using (private.is_member(group_id));

create policy "venues are readable" on public.venues
  for select to authenticated using (true);

-- Rule 1 (visibility): public, or you host it, or you're in its group
create policy "read visible events" on public.events
  for select to authenticated using (
    visibility = 'public'
    or host_id = (select auth.uid())
    or private.is_member(group_id)
  );
create policy "host creates events" on public.events
  for insert to authenticated with check (
    host_id = (select auth.uid())
    and (visibility = 'public' or private.is_member(group_id))
  );
-- Visibility and group can't be updated at all (see grants below), so this only checks ownership
create policy "host edits events" on public.events
  for update to authenticated
  using (host_id = (select auth.uid()))
  with check (host_id = (select auth.uid()));

-- RSVPs inherit their event's visibility: the subquery is itself filtered by the events policy.
-- There are no write policies; RSVPs change only through the locking functions (Phase 6).
create policy "read rsvps of visible events" on public.rsvps
  for select to authenticated using (
    exists (select 1 from public.events e where e.id = event_id)
  );

create policy "own bucket items" on public.bucket_items
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Grants: signed-out visitors get nothing; signed-in users get only what the rules need
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;

grant select on public.profiles, public.groups, public.group_members, public.venues,
  public.events, public.rsvps, public.bucket_items to authenticated;

grant update (display_name, climbing_level) on public.profiles to authenticated;

-- host_id comes from its default (auth.uid()); status and is_demo can't be set by clients
grant insert (venue_id, activity, session_type, level_min, level_max, starts_at,
  price_per_person, capacity, visibility, group_id) on public.events to authenticated;
-- Audience (visibility, group_id) and ownership are fixed after creation
grant update (venue_id, activity, session_type, level_min, level_max, starts_at,
  price_per_person, capacity, status) on public.events to authenticated;

grant insert, update, delete on public.bucket_items to authenticated;

revoke execute on all functions in schema private from public;
grant usage on schema private to authenticated;
grant execute on function private.is_member(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- Signup: create the profile and join the auto_join groups
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
                  split_part(new.email, '@', 1)), 40)
  );
  insert into public.group_members (group_id, user_id)
  select id, new.id from public.groups where auto_join;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Start time must be in the future. A CHECK can't use now(): it would re-run on every update.
create function private.events_future_start()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.starts_at <= now() then
    raise exception 'Start time must be in the future' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger events_future_start
  before insert or update of starts_at on public.events
  for each row execute function private.events_future_start();

-- The host counts as going from the moment the event exists
create function private.events_host_going()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.rsvps (event_id, user_id, status) values (new.id, new.host_id, 'going');
  return new;
end;
$$;

create trigger events_host_going
  after insert on public.events
  for each row execute function private.events_host_going();

-- Cancelling an event sends its planned bucket items back to the wishlist
create function private.events_release_bucket()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.bucket_items
  set status = 'wishlist', event_id = null
  where event_id = new.id and status = 'planned';
  return new;
end;
$$;

create trigger events_release_bucket
  after update of status on public.events
  for each row
  when (old.status = 'open' and new.status = 'cancelled')
  execute function private.events_release_bucket();

-- ---------------------------------------------------------------------------
-- Backfill: accounts created before this migration get a profile too
-- (seed.sql then joins them to the auto_join groups)
-- ---------------------------------------------------------------------------

insert into public.profiles (id, display_name)
select
  id,
  left(coalesce(nullif(trim(raw_user_meta_data ->> 'display_name'), ''), split_part(email, '@', 1)), 40)
from auth.users
on conflict (id) do nothing;
