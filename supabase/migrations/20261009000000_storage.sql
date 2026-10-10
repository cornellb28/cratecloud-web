-- Cloud audio storage accounting (Backblaze B2). See lib/storage/*.
--
-- Per-user usage and per-object records. RLS: a user can SELECT only their own
-- rows. There is NO insert/update/delete policy and table writes are revoked, so
-- every write goes through the service-role-only functions below, called by the
-- /api/storage/* route handlers.
--
-- Atomicity: each function locks the user's storage_usage row (SELECT ... FOR
-- UPDATE) before checking the cap, so parallel uploads for one user are
-- serialised and cannot exceed it.

-- ── Roll back ────────────────────────────────────────────────────────────
-- This migration is additive (new tables, indexes, policies and functions; it
-- alters nothing that exists). To undo it, run in this order:
--   drop function if exists public.reserve_storage(uuid, text, bigint, text, bigint, timestamptz);
--   drop function if exists public.complete_storage(uuid, text, bigint, text);
--   drop function if exists public.release_storage(uuid, text);
--   drop function if exists public.hide_storage(uuid, text);
--   drop function if exists public.remove_hidden_storage(uuid, text);
--   drop table if exists public.storage_objects;
--   drop table if exists public.storage_usage;
-- then `supabase migration repair --status reverted 20261009000000`.
-- Dropping the tables deletes the storage accounting rows (not the files in B2).

create table public.storage_usage (
  user_id         uuid primary key references auth.users (id) on delete cascade,
  used_bytes      bigint not null default 0 check (used_bytes >= 0),
  reserved_bytes  bigint not null default 0 check (reserved_bytes >= 0),
  -- End of the read-only window after a cancelled subscription (set by the
  -- Stripe webhook). Downloads are allowed until this time; uploads never are.
  read_only_until timestamptz,
  updated_at      timestamptz not null default now()
);

create table public.storage_objects (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  size_bytes   bigint not null check (size_bytes > 0),
  object_key   text not null,
  version_id   text,
  content_type text not null,
  status       text not null check (status in ('pending', 'active', 'hidden')),
  hidden_at    timestamptz,
  created_at   timestamptz not null default now(),
  completed_at timestamptz,
  -- The key is always derived from the verified user id and the content hash.
  constraint storage_objects_key_layout
    check (object_key = 'u/' || user_id::text || '/' || content_hash)
);

-- One live (pending or active) record per user per content hash: dedupe is
-- within a single user's own files only, never across users.
create unique index storage_objects_live_idx
  on public.storage_objects (user_id, content_hash)
  where status in ('pending', 'active');

create index storage_objects_status_created_idx
  on public.storage_objects (status, created_at);

alter table public.storage_usage enable row level security;
alter table public.storage_objects enable row level security;

revoke all on table public.storage_usage from anon, authenticated;
revoke all on table public.storage_objects from anon, authenticated;
grant select on table public.storage_usage to authenticated;
grant select on table public.storage_objects to authenticated;

create policy "own storage usage is readable"
  on public.storage_usage for select to authenticated
  using (user_id = auth.uid());

create policy "own storage objects are readable"
  on public.storage_objects for select to authenticated
  using (user_id = auth.uid());

-- ── reserve_storage ──────────────────────────────────────────────────────
-- Releases this user's stale pending reservations, then reserves p_size bytes
-- if used + reserved + p_size fits p_cap. Idempotent for a hash that is already
-- pending (same bytes are not reserved twice).
create or replace function public.reserve_storage(
  p_user         uuid,
  p_hash         text,
  p_size         bigint,
  p_content_type text,
  p_cap          bigint,
  p_stale_before timestamptz
) returns table (result text, object_id uuid, used_bytes bigint, reserved_bytes bigint)
language plpgsql
set search_path = public
as $$
declare
  v_usage    public.storage_usage%rowtype;
  v_existing public.storage_objects%rowtype;
  v_freed    bigint;
  v_id       uuid;
begin
  insert into public.storage_usage (user_id) values (p_user) on conflict (user_id) do nothing;
  select * into v_usage from public.storage_usage where storage_usage.user_id = p_user for update;

  -- Release stale pending reservations (an upload that never completed).
  with gone as (
    delete from public.storage_objects o
    where o.user_id = p_user and o.status = 'pending' and o.created_at < p_stale_before
    returning o.size_bytes
  )
  select coalesce(sum(size_bytes), 0) into v_freed from gone;
  if v_freed > 0 then
    update public.storage_usage u
      set reserved_bytes = greatest(u.reserved_bytes - v_freed, 0), updated_at = now()
      where u.user_id = p_user
      returning * into v_usage;
  end if;

  select * into v_existing from public.storage_objects o
    where o.user_id = p_user and o.content_hash = p_hash and o.status in ('pending', 'active');

  if found and v_existing.status = 'active' then
    return query select 'already_stored'::text, v_existing.id, v_usage.used_bytes, v_usage.reserved_bytes;
    return;
  end if;
  if found and v_existing.status = 'pending' then
    return query select 'reserved'::text, v_existing.id, v_usage.used_bytes, v_usage.reserved_bytes;
    return;
  end if;

  if v_usage.used_bytes + v_usage.reserved_bytes + p_size > p_cap then
    return query select 'over_cap'::text, null::uuid, v_usage.used_bytes, v_usage.reserved_bytes;
    return;
  end if;

  insert into public.storage_objects (user_id, content_hash, size_bytes, object_key, content_type, status)
    values (p_user, p_hash, p_size, 'u/' || p_user::text || '/' || p_hash, p_content_type, 'pending')
    returning id into v_id;
  update public.storage_usage u
    set reserved_bytes = u.reserved_bytes + p_size, updated_at = now()
    where u.user_id = p_user
    returning * into v_usage;

  return query select 'reserved'::text, v_id, v_usage.used_bytes, v_usage.reserved_bytes;
end;
$$;

-- ── complete_storage ─────────────────────────────────────────────────────
-- Moves a pending reservation to active once the server has HEADed the object
-- and confirmed the size. Returns completed | already_active | size_mismatch |
-- not_found.
create or replace function public.complete_storage(
  p_user uuid, p_hash text, p_size bigint, p_version text
) returns text
language plpgsql
set search_path = public
as $$
declare
  v_obj public.storage_objects%rowtype;
begin
  perform 1 from public.storage_usage where user_id = p_user for update;
  select * into v_obj from public.storage_objects o
    where o.user_id = p_user and o.content_hash = p_hash and o.status in ('pending', 'active');
  if not found then return 'not_found'; end if;
  if v_obj.status = 'active' then return 'already_active'; end if;
  if v_obj.size_bytes <> p_size then return 'size_mismatch'; end if;

  update public.storage_objects set status = 'active', version_id = p_version, completed_at = now()
    where id = v_obj.id;
  update public.storage_usage u
    set reserved_bytes = greatest(u.reserved_bytes - v_obj.size_bytes, 0),
        used_bytes = u.used_bytes + v_obj.size_bytes,
        updated_at = now()
    where u.user_id = p_user;
  return 'completed';
end;
$$;

-- ── release_storage ──────────────────────────────────────────────────────
-- Drops a pending reservation (failed upload or size mismatch).
create or replace function public.release_storage(p_user uuid, p_hash text)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_size bigint;
begin
  perform 1 from public.storage_usage where user_id = p_user for update;
  delete from public.storage_objects o
    where o.user_id = p_user and o.content_hash = p_hash and o.status = 'pending'
    returning o.size_bytes into v_size;
  if v_size is not null then
    update public.storage_usage u
      set reserved_bytes = greatest(u.reserved_bytes - v_size, 0), updated_at = now()
      where u.user_id = p_user;
  end if;
end;
$$;

-- ── hide_storage ─────────────────────────────────────────────────────────
-- Accounting side of "delete track": active -> hidden, bytes no longer count.
-- Returns hidden | already_hidden | not_found, plus the object's version id.
create or replace function public.hide_storage(p_user uuid, p_hash text)
returns table (result text, version_id text)
language plpgsql
set search_path = public
as $$
declare
  v_obj public.storage_objects%rowtype;
begin
  perform 1 from public.storage_usage where user_id = p_user for update;
  select * into v_obj from public.storage_objects o
    where o.user_id = p_user and o.content_hash = p_hash and o.status in ('active', 'hidden')
    order by (o.status = 'active') desc, o.created_at desc
    limit 1;
  if not found then
    return query select 'not_found'::text, null::text;
    return;
  end if;
  if v_obj.status = 'hidden' then
    return query select 'already_hidden'::text, v_obj.version_id;
    return;
  end if;
  update public.storage_objects set status = 'hidden', hidden_at = now() where id = v_obj.id;
  update public.storage_usage u
    set used_bytes = greatest(u.used_bytes - v_obj.size_bytes, 0), updated_at = now()
    where u.user_id = p_user;
  return query select 'hidden'::text, v_obj.version_id;
end;
$$;

-- ── remove_hidden_storage ────────────────────────────────────────────────
-- Final step of a purge, after the stored version was deleted: drops the record.
create or replace function public.remove_hidden_storage(p_user uuid, p_hash text)
returns void
language sql
set search_path = public
as $$
  delete from public.storage_objects
  where user_id = p_user and content_hash = p_hash and status = 'hidden';
$$;

-- Service role only.
revoke all on function public.reserve_storage(uuid, text, bigint, text, bigint, timestamptz) from public, anon, authenticated;
revoke all on function public.complete_storage(uuid, text, bigint, text) from public, anon, authenticated;
revoke all on function public.release_storage(uuid, text) from public, anon, authenticated;
revoke all on function public.hide_storage(uuid, text) from public, anon, authenticated;
revoke all on function public.remove_hidden_storage(uuid, text) from public, anon, authenticated;
grant execute on function public.reserve_storage(uuid, text, bigint, text, bigint, timestamptz) to service_role;
grant execute on function public.complete_storage(uuid, text, bigint, text) to service_role;
grant execute on function public.release_storage(uuid, text) to service_role;
grant execute on function public.hide_storage(uuid, text) to service_role;
grant execute on function public.remove_hidden_storage(uuid, text) to service_role;

-- TODO(purge-job): deleted accounts purge after 60 days; the cancelled-subscription
-- sweep (delete objects once read_only_until passes) is not built yet.
