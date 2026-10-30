# CrediSafe Web Platform v3.0 — iPhone companion + Team Control Center

## Purpose and scope

**Current admin implementation:** the original read-only Team Control Center has been extended into the CrediSafe Operations Center. See [OPERATIONS_CENTER.md](./OPERATIONS_CENTER.md) for the current role matrix, account actions, trip diagnostics, XP ledger, team governance, versioned configuration, audit history and production bootstrap procedure. This follow-up uses the existing Neon `admin_members`, `admin_audit_logs` and `admin_config` tables.

This milestone adds a useful Safari/PWA entrance for iPhone users and a
**restricted, read-only** team operations dashboard. It does not pretend that
browser GPS supports the same background sensors or confidence-aware Android
Rules Engine v2. It does not unify Supabase web accounts and Android/Neon identities.

**Previous releases:** Android v2.7.0-beta.4.1 and website APK download stay
available. Changes live in feature PRs until tests and setup are confirmed.

## iPhone experience
- Route: `/ios`; Safari users see a tailored entry link from the header.
- Existing web app `/app/trip`: records GPS while the page stays visible.
- On visibility/background interruptions, active recording is stopped and
  the partial journey is discarded rather than treating unobserved time as driving.
- Web GPS does not assume that 60 km/h is the universal speed limit.
  It **does not** issue verified overspeed detections, authoritative safety XP,
  or real-world reward points. Web GPS history is an **unverified preview**.
- Android v2 is still the correct platform for phone-sensor event detection.
- PWA remains installable from Safari via Share > Add to Home Screen.
  Neither this nor the service worker grants background geolocation.

## Secure admin architecture
`/admin` (private) -> Supabase Auth `getUser()` -> exact UUID allowlist ->
Supabase MFA AAL2 -> same-origin `/api/admin/overview` ->
fixed-origin server-side Render request with confidential bridge secret ->
Render `/v1/internal/overview` -> aggregated read-only Neon data.

The bridge never returns email, phone, device IDs, name, latitude/longitude,
raw GPS samples, or road history. Operational trip IDs are visible only to
authorized team accounts. All responses are `Cache-Control: private,no-store`.
Admin write endpoints are limited to audited account status/session operations, team membership and allowlisted configuration updates. Raw telemetry exports and raw GPS coordinates remain unavailable.

### Setup required before team access
1. Ensure the website has working Supabase authentication.
2. In Supabase Dashboard > Authentication, find the confirmed Supabase Auth
   **UUIDs** of the people authorized to administer the project.
3. Set `CREDISAFE_ADMIN_USER_IDS` on **Vercel** to a comma-separated list
   of those exact UUIDs. Empty/unset means nobody has admin access. Do not
   assign access via guessable email names or client-side role flags.
4. Set `CREDISAFE_ADMIN_REQUIRE_MFA=true` on Vercel (also the default).
   After sign-in, admins open `/team/security`, register a TOTP authenticator
   and verify a code. `/admin` requires Supabase AAL2.
5. Generate **one new cryptographically random secret of at least 32 bytes**
   and configure the identical `CREDISAFE_ADMIN_BRIDGE_SECRET` value in
   **both Render backend and Vercel website**, as *server-only secret env vars*.
   This is separate from Android JWT secrets and Supabase public API keys.
   Never prefix this variable with `NEXT_PUBLIC_`.
6. Review PRs and CI before merging. Deploy **Render bridge first**, then
   deploy Vercel website. Check `/admin` using a test admin and a non-admin.
7. In the Supabase SQL Editor, review and apply
   `supabase/migrations/202610260001_webgps_preview_security.sql` before
   allowing any browser-GPS participants to collect redeemable benefits.
   This deliberately disables spendable rewards from the unverified legacy
   web RPC; Android/Neon has its own server-verified XP ledger.
8. If an integration is not configured, the dashboard shows an explicit
   unavailable status. **No demo metrics are substituted.**
9. If a secret is exposed, rotate both providers together and verify logs.
   Add audit logging, alerts, authorization reviews and scheduled key rotation
   before using this dashboard for a large real-world study.

### Production verification
- Unauthenticated `GET /api/admin/overview` returns 401.
- Logged-in user not in allowlist returns 403.
- Approved admin without MFA AAL2 returns 403.
- Approved admin with MFA but no bridge secret sees 503, never fake metrics.
- Wrong secret to Render internal endpoint returns 403.
- Matching server-only secret gives real Android aggregate metrics.
- No GPS coordinate or driver email appears in page HTML, API response or logs.
- Verify count parity against Neon with an authorized database operator.
- iPhone: test permission denial, phone lock, Safari tab backgrounding,
  intermittent connectivity, iOS Home Screen installation and session recovery.

### Data-source separation
- Android: Render + Neon custom auth, native sensor Rules Engine v2.
- Website: Supabase Auth and browser-GPS demonstration/scoring.
- Admin: authenticated website proxy to **read-only Android aggregate data**.
- **Web vs Android accounts are still distinct.** A unified user database,
  rewards ledger and across-device history are future engineering work.
- Web's legacy Supabase `record_trip_result` RPC accepts numerical input
  from authenticated callers. The committed database migration forces
  browser-GPS awards and all spendable web points to zero, but must be
  applied manually to Supabase. Until applied, **do not admit reward-seeking
  web users** or represent historical web rewards as verified achievements.

### Privacy and product limitations
- Web GPS is only reliable while Safari is foregrounded; installing as a
  Home Screen app does not grant native-style continuous background recording.
- Current PWA SW caches only public pages; authenticated and team routes are
  excluded. Cache version was bumped to invalidate older private-page caches.
- Android incident-rate accuracy and posted speed limits remain unvalidated
  on independently labelled field data.
- All monitoring is read-only; editing user scores requires a separate
  audited governance workflow and is intentionally omitted.

## Remaining gates (not optional)
- Vercel env configuration by owner, Supabase admin approval/MFA.
- Real-device Safari/Android QA and end-to-end Neon sync measurements.
- Operational logging, privacy notice, informed pilot consent, retention policy.
- Review and harden Supabase XP RPC before live redeemable rewards.
- Later: role-based audit table, opt-in diagnostic uploads, combined account
  identity and explicit web/Android source labels on unified analytics.
