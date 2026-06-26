-- CrediSafe working MVP schema
-- Run in a new Supabase project through the SQL editor or Supabase CLI.

create extension if not exists pgcrypto;

create or replace function public.level_for_xp(xp integer)
returns text
language sql
immutable
as $$
  select case
    when xp >= 5500 then 'Legend'
    when xp >= 3500 then 'Elite'
    when xp >= 2000 then 'Platinum'
    when xp >= 1000 then 'Gold'
    when xp >= 500 then 'Silver'
    else 'Bronze'
  end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default 'CrediSafe Driver',
  city text not null default 'India',
  total_xp integer not null default 0 check (total_xp >= 0),
  reward_points integer not null default 0 check (reward_points >= 0),
  level text not null default 'Bronze' check (level in ('Bronze','Silver','Gold','Platinum','Elite','Legend')),
  current_streak integer not null default 0 check (current_streak >= 0),
  best_streak integer not null default 0 check (best_streak >= 0),
  last_trip_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  registration_number text not null,
  make_model text not null,
  vehicle_type text not null check (vehicle_type in ('car','bike','scooter','other')),
  is_primary boolean not null default false,
  verification_status text not null default 'simulated' check (verification_status in ('simulated','pending','verified')),
  created_at timestamptz not null default now(),
  unique(user_id, registration_number)
);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  mode text not null check (mode in ('simulation','gps')),
  started_at timestamptz not null,
  ended_at timestamptz not null,
  distance_km numeric(10,2) not null default 0 check (distance_km >= 0),
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  average_speed_kmh numeric(8,1) not null default 0 check (average_speed_kmh >= 0),
  maximum_speed_kmh numeric(8,1) not null default 0 check (maximum_speed_kmh >= 0),
  overspeed_events integer not null default 0 check (overspeed_events >= 0),
  major_overspeed_events integer not null default 0 check (major_overspeed_events >= 0),
  gps_quality numeric(4,2) not null default 0 check (gps_quality between 0 and 1),
  safety_score integer not null check (safety_score between 0 and 100),
  xp_earned integer not null default 0 check (xp_earned >= 0),
  events jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (ended_at >= started_at)
);

create table public.trip_points (
  id bigint generated always as identity primary key,
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  point_index integer not null,
  recorded_at timestamptz not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_m numeric(8,2) not null check (accuracy_m > 0),
  speed_kmh numeric(8,2),
  heading numeric(6,2),
  unique(trip_id, point_index)
);

create table public.xp_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  trip_id uuid references public.trips(id) on delete set null,
  amount integer not null check (amount <> 0),
  reason text not null,
  created_at timestamptz not null default now()
);

create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  reward_type text not null check (reward_type in ('fuel','fastag','ev','insurance')),
  points_cost integer not null check (points_cost > 0),
  partner_name text not null,
  simulated boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.reward_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  reward_id uuid not null references public.rewards(id),
  points_spent integer not null check (points_spent > 0),
  voucher_code text not null unique,
  status text not null default 'claimed' check (status in ('claimed','redeemed','expired')),
  created_at timestamptz not null default now()
);

create index profiles_total_xp_idx on public.profiles(total_xp desc);
create index vehicles_user_id_idx on public.vehicles(user_id);
create index trips_user_id_ended_at_idx on public.trips(user_id, ended_at desc);
create index trip_points_trip_id_idx on public.trip_points(trip_id, point_index);
create index trip_points_user_id_idx on public.trip_points(user_id);
create index xp_transactions_user_id_idx on public.xp_transactions(user_id, created_at desc);
create index reward_claims_user_id_idx on public.reward_claims(user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1), 'CrediSafe Driver'))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.vehicles enable row level security;
alter table public.trips enable row level security;
alter table public.trip_points enable row level security;
alter table public.xp_transactions enable row level security;
alter table public.rewards enable row level security;
alter table public.reward_claims enable row level security;

create policy "Authenticated users can view leaderboard profiles"
on public.profiles for select to authenticated
using (true);

create policy "Users can insert their own profile"
on public.profiles for insert to authenticated
with check ((select auth.uid()) = id);

create policy "Users can update their own profile"
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "Users manage their own vehicles"
on public.vehicles for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can view their own trips"
on public.trips for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert their own trips"
on public.trips for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can view their own trip points"
on public.trip_points for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert their own trip points"
on public.trip_points for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can view their own XP transactions"
on public.xp_transactions for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Active rewards are visible"
on public.rewards for select to authenticated
using (active = true);

create policy "Users can view their own reward claims"
on public.reward_claims for select to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.record_trip_result(
  p_vehicle_id uuid,
  p_mode text,
  p_started_at timestamptz,
  p_ended_at timestamptz,
  p_distance_km numeric,
  p_duration_seconds integer,
  p_average_speed_kmh numeric,
  p_maximum_speed_kmh numeric,
  p_overspeed_events integer,
  p_major_overspeed_events integer,
  p_gps_quality numeric,
  p_safety_score integer,
  p_xp_earned integer,
  p_events jsonb,
  p_metadata jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_trip_id uuid;
  v_trip_date date := (p_ended_at at time zone 'UTC')::date;
  v_last_trip_date date;
  v_current_streak integer;
  v_new_streak integer;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_mode not in ('simulation','gps') then raise exception 'Invalid trip mode'; end if;
  if p_safety_score < 0 or p_safety_score > 100 then raise exception 'Invalid safety score'; end if;
  if p_xp_earned < 0 then raise exception 'Invalid XP'; end if;

  if p_vehicle_id is not null and not exists (
    select 1 from public.vehicles where id = p_vehicle_id and user_id = v_user_id
  ) then
    raise exception 'Vehicle does not belong to the authenticated user';
  end if;

  insert into public.trips (
    user_id, vehicle_id, mode, started_at, ended_at, distance_km, duration_seconds,
    average_speed_kmh, maximum_speed_kmh, overspeed_events, major_overspeed_events,
    gps_quality, safety_score, xp_earned, events, metadata
  ) values (
    v_user_id, p_vehicle_id, p_mode, p_started_at, p_ended_at, p_distance_km, p_duration_seconds,
    p_average_speed_kmh, p_maximum_speed_kmh, p_overspeed_events, p_major_overspeed_events,
    p_gps_quality, p_safety_score, p_xp_earned, coalesce(p_events, '[]'::jsonb), coalesce(p_metadata, '{}'::jsonb)
  ) returning id into v_trip_id;

  select last_trip_date, current_streak
  into v_last_trip_date, v_current_streak
  from public.profiles
  where id = v_user_id
  for update;

  v_new_streak := case
    when v_last_trip_date is null then 1
    when v_last_trip_date = v_trip_date then greatest(v_current_streak, 1)
    when v_last_trip_date = v_trip_date - 1 then v_current_streak + 1
    else 1
  end;

  update public.profiles
  set
    total_xp = total_xp + p_xp_earned,
    reward_points = reward_points + greatest(coalesce((p_metadata ->> 'rewardPointsEarned')::integer, 0), 0),
    level = public.level_for_xp(total_xp + p_xp_earned),
    current_streak = case when p_xp_earned > 0 then v_new_streak else current_streak end,
    best_streak = case when p_xp_earned > 0 then greatest(best_streak, v_new_streak) else best_streak end,
    last_trip_date = case when p_xp_earned > 0 then greatest(coalesce(last_trip_date, v_trip_date), v_trip_date) else last_trip_date end
  where id = v_user_id;

  insert into public.xp_transactions(user_id, trip_id, amount, reason)
  values (v_user_id, v_trip_id, p_xp_earned,
    case when p_mode = 'simulation' then 'Simulation XP · Engine ' || coalesce(p_metadata ->> 'xpVersion', 'legacy')
         else 'GPS trip XP · Engine ' || coalesce(p_metadata ->> 'xpVersion', 'legacy') end);

  return v_trip_id;
end;
$$;

create or replace function public.claim_reward(p_reward_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_cost integer;
  v_title text;
  v_claim_id uuid;
  v_code text;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;

  select points_cost, title into v_cost, v_title
  from public.rewards
  where id = p_reward_id and active = true;

  if v_cost is null then raise exception 'Reward not found'; end if;

  update public.profiles
  set reward_points = reward_points - v_cost
  where id = v_user_id and reward_points >= v_cost;

  if not found then raise exception 'Insufficient reward points'; end if;

  v_code := 'CS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.reward_claims(user_id, reward_id, points_spent, voucher_code)
  values (v_user_id, p_reward_id, v_cost, v_code)
  returning id into v_claim_id;

  return v_claim_id;
end;
$$;

grant execute on function public.record_trip_result(uuid,text,timestamptz,timestamptz,numeric,integer,numeric,numeric,integer,integer,numeric,integer,integer,jsonb,jsonb) to authenticated;
grant execute on function public.claim_reward(uuid) to authenticated;

insert into public.rewards (id, title, description, reward_type, points_cost, partner_name, simulated, active)
values
  ('10000000-0000-4000-8000-000000000001', '₹100 Fuel Voucher', 'Prototype voucher for a future fuel-partner programme.', 'fuel', 1000, 'Demo Fuel Partner', true, true),
  ('10000000-0000-4000-8000-000000000002', '₹150 FASTag Cashback', 'Simulated cashback reward for safe-trip consistency.', 'fastag', 1500, 'Demo Mobility Partner', true, true),
  ('10000000-0000-4000-8000-000000000003', '₹250 EV Charging Credit', 'Prototype charging credit for future EV partnerships.', 'ev', 2200, 'Demo Charging Network', true, true)
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  reward_type = excluded.reward_type,
  points_cost = excluded.points_cost,
  partner_name = excluded.partner_name,
  simulated = excluded.simulated,
  active = excluded.active;
