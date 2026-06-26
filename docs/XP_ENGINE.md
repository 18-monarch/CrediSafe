# CrediSafe XP Engine 2.0

CrediSafe separates **lifetime XP** from **spendable reward points**.

## XP calculation

An eligible trip can earn:

| Component | Award |
|---|---:|
| Valid trip completion | +25 XP |
| Safety score | +5 to +110 XP |
| Validated distance | 2 XP/km, capped at 50 XP |
| Clean-trip bonus | +25 XP |
| Trusted GPS data | +8 or +15 XP |
| Daily streak bonus | +5 to +25 XP |
| Maximum per trip | 220 XP |

## Eligibility for real GPS trips

A real GPS trip must:

- cover at least 0.5 km;
- last at least 2 minutes;
- have GPS confidence of at least 35%.

Ineligible trips remain in history for review but award no XP, reward points or streak progress.

## Reward points

- Lifetime XP controls level and leaderboard progress.
- Eligible real GPS trips convert 50% of awarded XP into reward points.
- Simulation trips can demonstrate XP progression but do not create spendable reward points.

## Anti-gaming rules

- Per-trip XP is capped at 220.
- Distance XP is capped at 50.
- Streak XP is awarded once per day.
- Streak progress is not advanced by ineligible trips.
- Video observations do not silently add or remove XP.

Every completed trip stores its full XP breakdown in trip metadata and displays it in the result screen, dashboard and trip history.
