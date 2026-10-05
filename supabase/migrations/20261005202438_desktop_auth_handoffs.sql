-- One-time keys for the desktop sign-in handoff (see lib/desktop-handoff.ts).
--
-- Service role only: RLS is enabled with NO policies, and table privileges are
-- revoked from anon/authenticated as a second lock. The service role bypasses
-- RLS, so the website's route handlers are the only readers and writers.
--
-- Only SHA-256(key) is stored; the key itself exists only in the user's browser
-- and the desktop app for ~60 seconds.

create table public.desktop_auth_handoffs (
  id         uuid primary key default gen_random_uuid(),
  key_hash   text not null unique,
  challenge  text not null,
  user_id    uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);

-- Opportunistic cleanup scans by expiry; the per-user rate limit scans by user.
create index desktop_auth_handoffs_expires_at_idx on public.desktop_auth_handoffs (expires_at);
create index desktop_auth_handoffs_user_created_idx on public.desktop_auth_handoffs (user_id, created_at);

alter table public.desktop_auth_handoffs enable row level security;

revoke all on table public.desktop_auth_handoffs from anon, authenticated;
