# CrediSafe Operations Center

The Operations Center extends the existing private website Control Center at `/admin`. It is not a second admin application.

## What is included

- Command Center: Android user, trip, event, telemetry and sync aggregates.
- People & Accounts: paginated account search, role-limited contact data, account status, XP/level totals, trip/session counts.
- Account actions: suspend/restore with a required reason; revoke all sessions across devices.
- Trips & Diagnostics: trip status, classification, scoring, ruleset, sync attempts, redacted diagnostics, telemetry metadata, events and per-trip XP entries. Raw GPS payloads and binary telemetry are not exposed.
- Safety & XP Ledger: read-only authoritative XP entries, reasons and ruleset provenance.
- Team Access: OWNER/ADMIN/SUPPORT/ANALYST/AUDITOR memberships, role-aware authorization and owner protection.
- Releases & Configuration: versioned, allowlisted maintenance/version/feature-flag/pilot settings. This stores release policy metadata; signed APK publishing remains in GitHub Actions.
- Audit History: append-only administrative action records with actor, target, reason and minimal metadata.
- Infrastructure: live Render/Neon/admin-schema checks and operational counts.

## Architecture

`/admin` (Next.js/Vercel) -> Supabase Auth `getUser()` -> MFA AAL2 -> exact owner allowlist or active Neon admin membership -> same-origin `/api/admin/*` -> fixed Render internal API with a server-only bridge secret -> Neon.

The Render bridge re-checks the actor's active `admin_members` role on each privileged request. Browser code never receives the bridge secret. The Vercel proxy rejects cross-origin mutations, does not accept a caller-supplied role, caps JSON request bodies and returns `Cache-Control: no-store`.

## Roles

| Role | Permissions |
|---|---|
| OWNER | All operations, including team governance |
| ADMIN | Operational user actions, trip/XP views, config and audit; cannot grant/revoke OWNER |
| SUPPORT | Account support, session revocation and trip diagnostics |
| ANALYST | Aggregated overview, trips and XP reporting; no account PII or writes |
| AUDITOR | Read-only trip, team, config and audit inspection |

MFA AAL2 is required for every admin role. Support users receive masked email addresses. Analysts do not get account-directory access. Role changes and user actions require a reason. The last active OWNER cannot be removed or demoted.

## Production setup

The Vercel project requires the following server-side variables:

- `CREDISAFE_ADMIN_USER_IDS`: comma-separated exact Supabase Auth UUIDs allowed to bootstrap the initial OWNER. It must not contain emails or display names.
- `CREDISAFE_ADMIN_REQUIRE_MFA=true`: keep MFA mandatory.
- `CREDISAFE_ADMIN_BRIDGE_SECRET`: cryptographically random value of at least 32 characters; the identical value must exist on Render and Vercel. Never add a `NEXT_PUBLIC_` prefix.

The Render backend also requires `CREDISAFE_ADMIN_BRIDGE_SECRET` with the same value. The bridge is disabled when absent or shorter than 32 characters.

### First Owner

1. Sign in to the CrediSafe website with the intended Owner account.
2. Visit `/team/security`. If the account is not bootstrapped, the page displays that account's own Supabase Auth UUID (it does not disclose other users).
3. Add that exact UUID to Vercel Production `CREDISAFE_ADMIN_USER_IDS`, keeping MFA required, and redeploy the website.
4. Visit `/team/security` again and enroll/verify a TOTP authenticator.
5. Open `/admin`. The first successful Owner access creates the initial `admin_members` Owner record in Neon.

Do not add a public self-service "claim admin" route. The first Owner must be explicitly allowlisted by the project owner.

### Adding team members

1. The person must first create their normal CrediSafe website account.
2. An Owner opens Team Access and enters the exact Supabase Auth UUID, role and reason.
3. The invited person signs in and visits `/team/security` to enroll/verify MFA.
4. Once AAL2 is active, they can open `/admin` within their assigned role.

The current implementation does not send email invitations because the website does not hold a Supabase service-role key. It only grants a role to an existing Auth identity.

## Database migration

Android backend migration:
`backend/migrations/20261030000000_operations_center.sql`

It is additive and idempotent. It adds account suspension/session-version fields and ensures the existing admin tables/indexes exist. It does not delete or rewrite users, trips, XP, reward or session history.

Apply and verify this migration on a Neon branch before production. After production application, deploy the Android backend before enabling account suspension actions.

## Account-action semantics

- Suspending an account sets `users.account_status=SUSPENDED`, records actor/time/reason, increments `session_version`, and revokes refresh sessions.
- Authenticated REST requests and WebSocket upgrades compare the signed JWT session version with the database. Suspended or previously revoked sessions are rejected.
- Restoring an account sets status back to ACTIVE and increments session version again. The user must sign in again.
- Revoking sessions increments session version and revokes refresh tokens across all devices. It does not delete the account or journeys.
- The existing XP ledger is read-only in this release. There is deliberately no direct XP balance editor.

## Configuration safety

Only these keys are accepted:
- `maintenance_mode`: enabled flag and optional short message.
- `minimum_app_version`: semantic version name, version code and force flag.
- `feature_flags`: a fixed allowlist of supported flags.
- `pilot_controls`: a fixed allowlist of pilot booleans.

Each update validates the shape, checks the expected version, increments the config version and appends an audit record. These settings are stored by the backend; Android consumers must explicitly fetch and enforce a setting before it changes runtime behavior. Signed APK publishing and signing keys remain exclusively in CI.

## Privacy and limitations

- No password hashes, access/refresh tokens, raw GPS samples or telemetry binary payloads are exposed.
- Sync diagnostics redact email addresses, UUIDs and token-like strings.
- User emails are visible only to OWNER/ADMIN; SUPPORT receives masked values.
- Website Supabase identities and Android/Neon identities remain separate. Do not auto-merge accounts by matching email.
- Infrastructure currently verifies the Render process and Neon query path. It does not claim to verify Supabase email delivery, Vercel deployment history or provider-wide uptime.
- Release policy is configurable, but app update adoption/rollout enforcement requires the Android client to report its version and consume the remote policy. APK publication remains a GitHub Actions responsibility.

## Verification checklist

- Unauthenticated `/admin` redirects to login.
- Signed-in non-admin receives a restricted page.
- Owner requires allowlist + MFA AAL2.
- Invited member requires active role + MFA AAL2.
- Support cannot access team/config/audit/XP write tools.
- Analyst cannot access user directory or user PII.
- Cross-origin mutations are rejected.
- Browser cannot provide its own admin role or bridge secret.
- User suspension immediately invalidates refresh and access sessions and blocks live WebSocket upgrades.
- Every admin write has a required reason and an audit record.
- Production migration is applied before deploying account suspension code.
