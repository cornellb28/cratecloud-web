-- Cloud + mobile waitlist (see app/api/waitlist/route.ts).
--
-- Service role only: RLS is enabled with NO policies, and table privileges are
-- revoked from anon/authenticated as a second lock. Inserts go through the
-- website's route handler.

create table public.waitlist (
  id              uuid primary key default gen_random_uuid(),
  email           text not null,
  dj_type         text check (dj_type in ('bedroom', 'working', 'professional', 'veteran', 'collector')),
  dj_software     text,
  source          text not null default 'waitlist',
  created_at      timestamptz not null default now(),
  confirmed_at    timestamptz,
  unsubscribed_at timestamptz,
  constraint waitlist_email_lowercase check (email = lower(email)),
  constraint waitlist_email_length check (char_length(email) <= 254)
);

create unique index waitlist_email_key on public.waitlist (email);

alter table public.waitlist enable row level security;

revoke all on table public.waitlist from anon, authenticated;
