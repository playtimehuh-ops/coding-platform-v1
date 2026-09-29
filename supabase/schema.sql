create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null default 'Developer',
  avatar_url text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.github_connections (
  user_id uuid primary key references public.users(id) on delete cascade,
  github_id bigint not null,
  login text not null,
  avatar_url text default '',
  token_encrypted text not null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  user_id uuid primary key references public.users(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan text not null default 'free',
  status text not null default 'inactive',
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.usage (
  user_id uuid not null references public.users(id) on delete cascade,
  month text not null,
  runs integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, month)
);

create index if not exists github_connections_login_idx
  on public.github_connections(login);

create index if not exists subscriptions_stripe_customer_idx
  on public.subscriptions(stripe_customer_id);

create index if not exists subscriptions_stripe_subscription_idx
  on public.subscriptions(stripe_subscription_id);

alter table public.users enable row level security;
alter table public.github_connections enable row level security;
alter table public.subscriptions enable row level security;
alter table public.usage enable row level security;

create or replace function public.increment_usage(p_user_id uuid, p_month text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare next_runs integer;
begin
  insert into public.usage(user_id, month, runs)
  values (p_user_id, p_month, 1)
  on conflict (user_id, month)
  do update set runs = public.usage.runs + 1, updated_at = now()
  returning runs into next_runs;
  return next_runs;
end;
$$;

-- Usage increments are server-only; never expose this RPC to browser roles.
REVOKE EXECUTE ON FUNCTION public.increment_usage(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_usage(uuid, text) TO service_role;
