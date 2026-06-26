-- CrediSafe XP Engine v2
-- Safe to run after the original MVP migration.
-- Keeps the existing RPC signature while separating lifetime XP from spendable reward points.

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
  v_reward_points_earned integer := greatest(coalesce((p_metadata ->> 'rewardPointsEarned')::integer, 0), 0);
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_mode not in ('simulation','gps') then raise exception 'Invalid trip mode'; end if;
  if p_safety_score < 0 or p_safety_score > 100 then raise exception 'Invalid safety score'; end if;
  if p_xp_earned < 0 or p_xp_earned > 220 then raise exception 'Invalid XP award'; end if;
  if v_reward_points_earned > 110 then raise exception 'Invalid reward-point award'; end if;

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
    reward_points = reward_points + v_reward_points_earned,
    level = public.level_for_xp(total_xp + p_xp_earned),
    current_streak = case when p_xp_earned > 0 then v_new_streak else current_streak end,
    best_streak = case when p_xp_earned > 0 then greatest(best_streak, v_new_streak) else best_streak end,
    last_trip_date = case when p_xp_earned > 0 then greatest(coalesce(last_trip_date, v_trip_date), v_trip_date) else last_trip_date end
  where id = v_user_id;

  insert into public.xp_transactions(user_id, trip_id, amount, reason)
  values (
    v_user_id,
    v_trip_id,
    p_xp_earned,
    case when p_mode = 'simulation'
      then 'Simulation XP · Engine ' || coalesce(p_metadata ->> 'xpVersion', '2.0')
      else 'GPS trip XP · Engine ' || coalesce(p_metadata ->> 'xpVersion', '2.0')
    end
  );

  return v_trip_id;
end;
$$;

grant execute on function public.record_trip_result(uuid,text,timestamptz,timestamptz,numeric,integer,numeric,numeric,integer,integer,numeric,integer,integer,jsonb,jsonb) to authenticated;
