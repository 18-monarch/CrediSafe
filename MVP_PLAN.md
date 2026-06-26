# CrediSafe MVP Plan

## Product objective

Prove that one driver can complete a journey and receive a believable, explainable safety outcome.

## Core success flow

1. Driver creates an account.
2. Driver adds a vehicle.
3. Driver records a live GPS trip or runs a labelled simulation.
4. The backend validates trip data.
5. The scoring engine calculates distance, speed, events and safety score.
6. XP and reward points are awarded.
7. Driver level, streak and leaderboard rank are updated.
8. The trip remains available in history.
9. The driver can claim a simulated reward when enough points are available.

## Phase 1 — included in this build

- Authentication and protected application routes
- Profile and vehicle records
- Simulation mode
- Live browser GPS mode
- Safety score v1
- XP, streaks and levels
- Rewards and claims
- Leaderboard
- Supabase persistence and RLS
- Local zero-configuration fallback

## Phase 2 — test with users

- Test GPS trips on several Android and iOS devices
- Tune accuracy filtering and event thresholds
- Add route-map visualisation
- Add trip deletion and privacy controls
- Improve onboarding and permission education
- Measure completion rate and repeat usage

## Phase 3 — external integrations

- Vehicle verification partner
- FASTag or toll partner
- Fuel or charging partner
- Insurance pilot
- Official traffic-event data where legally available

## What is intentionally excluded now

- Real cash payouts
- Government-camera access
- Official VAHAN/FASTag integration
- Insurance underwriting decisions
- Claims of accurate harsh braking from basic browser GPS
- Complex AI models before enough labelled trip data exists

## MVP validation target

A new user can sign up, add a vehicle, complete a trip, receive a score and XP, see reward progress, improve rank, and view the saved trip without manual database work.
