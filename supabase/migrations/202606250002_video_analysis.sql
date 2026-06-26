-- CrediSafe unified GPS + video-verification layer
-- Run after 202606210001_credisafe_mvp.sql.

alter table public.vehicles
  drop constraint if exists vehicles_verification_status_check;

alter table public.vehicles
  add constraint vehicles_verification_status_check
  check (verification_status in ('simulated','pending','video_matched','verified'));

create table if not exists public.video_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  trip_id uuid references public.trips(id) on delete set null,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  original_filename text not null,
  status text not null default 'completed' check (status in ('completed','failed')),
  analysis_version text not null default 'plate-ocr-v2',
  expected_plate text,
  matched_registered_plate boolean not null default false,
  matched_plate text,
  processing_ms integer not null default 0 check (processing_ms >= 0),
  warnings jsonb not null default '[]'::jsonb,
  result jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.video_plate_detections (
  id bigint generated always as identity primary key,
  analysis_id uuid not null references public.video_analyses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  plate text not null,
  state_code text not null,
  first_seen_sec numeric(10,2) not null default 0,
  last_seen_sec numeric(10,2) not null default 0,
  bbox jsonb not null default '{}'::jsonb,
  read_count integer not null default 1 check (read_count > 0),
  ocr_confidence numeric(4,2) not null default 0 check (ocr_confidence between 0 and 1),
  confidence numeric(4,2) not null default 0 check (confidence between 0 and 1),
  matches_expected_plate boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists video_analyses_user_created_idx
  on public.video_analyses(user_id, created_at desc);
create index if not exists video_analyses_trip_idx
  on public.video_analyses(trip_id);
create index if not exists video_plate_detections_analysis_idx
  on public.video_plate_detections(analysis_id, confidence desc);
create index if not exists video_plate_detections_user_idx
  on public.video_plate_detections(user_id, created_at desc);

alter table public.video_analyses enable row level security;
alter table public.video_plate_detections enable row level security;

create policy "Users manage their own video analyses"
on public.video_analyses for all to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and (trip_id is null or exists (
    select 1 from public.trips where public.trips.id = trip_id and public.trips.user_id = (select auth.uid())
  ))
  and (vehicle_id is null or exists (
    select 1 from public.vehicles where public.vehicles.id = vehicle_id and public.vehicles.user_id = (select auth.uid())
  ))
);

create policy "Users manage their own plate detections"
on public.video_plate_detections for all to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.video_analyses
    where public.video_analyses.id = analysis_id
      and public.video_analyses.user_id = (select auth.uid())
  )
);
