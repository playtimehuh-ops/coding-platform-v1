create table if not exists public.users (
  github_id text primary key,
  login text not null,
  name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  github_id text primary key references public.users(github_id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan text not null default 'free',
  status text not null default 'inactive',
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.usage (
  github_id text not null references public.users(github_id) on delete cascade,
  month text not null,
  runs integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (github_id, month)
);

create index if not exists subscriptions_stripe_customer_idx
  on public.subscriptions(stripe_customer_id);

create index if not exists subscriptions_stripe_subscription_idx
  on public.subscriptions(stripe_subscription_id);

alter table public.users enable row level security;
alter table public.subscriptions enable row level security;
alter table public.usage enable row level security;

create or replace function public.increment_usage(p_github_id text, p_month text)
returns integer
language plpgsql
security definer
as $$
declare next_runs integer;
begin
  insert into public.usage(github_id, month, runs)
  values (p_github_id, p_month, 1)
  on conflict (github_id, month)
  do update set runs = public.usage.runs + 1, updated_at = now()
  returning runs into next_runs;
  return next_runs;
end;
$$;