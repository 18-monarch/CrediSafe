# API Reference

All production endpoints require an authenticated Supabase session.

## `GET /api/mvp`

Returns the complete product snapshot:

- profile
- vehicles
- trips
- rewards
- claims
- leaderboard

## `POST /api/trips/simulate`

```json
{
  "vehicleId": "optional-uuid",
  "preset": "safe_city"
}
```

Presets: `safe_city`, `mixed_city`.

## `POST /api/trips/complete`

```json
{
  "vehicleId": "optional-uuid",
  "startedAt": "ISO timestamp",
  "endedAt": "ISO timestamp",
  "points": [
    {
      "latitude": 22.30,
      "longitude": 73.20,
      "timestamp": 1782000000000,
      "accuracy": 12,
      "speed": 8.2,
      "heading": 120
    }
  ]
}
```

Browser speed is supplied in metres per second and converted server-side.

## `POST /api/vehicles`

Adds a vehicle and optionally marks it primary.

## `PATCH /api/profile`

Updates driver name and city.

## `POST /api/rewards/:id/claim`

Atomically spends reward points and creates a prototype voucher claim.

---

## Unified video-verification APIs

### `GET /api/vision/status`

Checks whether the configured Python service is reachable.

### `POST /api/vision/analyze`

Multipart fields:

- `video` — required short video file
- `tripId` — optional CrediSafe GPS trip
- `vehicleId` — selected rider vehicle
- `expectedPlate` — used only in local demo mode; Supabase mode loads it from the authenticated user's vehicle

The route validates ownership, proxies the clip to the API-key-protected Python service, stores evidence and returns a `VideoAnalysis` result.

### Python `GET /health`

Reports OpenCV, Tesseract, upload limit and behaviour-model status.

### Python `POST /v1/analyze`

Internal server-to-server multipart endpoint. Requires `X-CrediSafe-Key` when `VISION_API_KEY` is configured.
