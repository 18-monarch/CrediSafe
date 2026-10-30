# CrediSafe Operations Center v2

The Operations Center extends the existing private /admin Team Control Center. It does not replace website or Android authentication and does not merge Supabase and Neon identities.

## Components

- Website UI: components/admin/OperationsCenter.tsx, served at /admin.
- Website API proxy: app/api/admin/operations/route.ts.
- Signed server-to-server bridge: lib/server/adminBridge.ts.
- Owner and role verification: lib/server/admin.ts.
- Android admin API: backend/src/api/internalAdmin.ts, mounted at /v1/internal/admin.
- Admin schema migration: backend/migrations/202610300001_operations_center_v2.sql.

## Roles

| Role | Permissions |
|---|---|
| OWNER | All operations; team governance; bounded XP adjustments |
| ADMIN | User suspend/restore, session revoke, configuration |
| SUPPORT | Account and trip investigation; session revocation |
| ANALYST | Read-only overview, trips and XP |
| AUDITOR | Read-only trips, XP and audit history |

Every administrator must have an explicit admin_members record in Neon and a Supabase session with MFA assurance level AAL2. The backend rechecks the role for every operation; hiding a button in the UI is not authorization.

## Dedicated Platform Owner account

Use a dedicated mailbox controlled by the CrediSafe operator and invite it directly in Supabase Dashboard → Authentication → Users. Do not create the Owner through the public driver registration flow, and do not create a row in the Android users table. This keeps the operations identity separate from driver accounts and their XP/trips.

The new account must have a confirmed email address, a unique owner-controlled sign-in method, and be used only for platform operations. Enroll a TOTP authenticator and verify it to reach AAL2 before opening /admin. After TOTP verification, register at least one passkey. Prefer a second passkey on a separate trusted device or hardware security key for recovery.

### Passkey configuration

The website uses Supabase JS 2.108.x, which is new enough for the current Supabase passkey APIs. Passkey APIs are experimental and must be explicitly enabled. They are an additional phishing-resistant sign-in credential, not a replacement for the stable TOTP second factor currently enforced by CrediSafe's AAL2 gate.

In Supabase Dashboard → Authentication → Passkeys:
- Enable Passkey authentication.
- Relying Party Display Name: CrediSafe
- Relying Party ID: credi-safe.vercel.app
- Relying Party Origins: https://credi-safe.vercel.app

Keep this RP ID stable; changing it invalidates previously enrolled passkeys. After enabling the dashboard setting, set the Vercel Production environment variable NEXT_PUBLIC_SUPABASE_PASSKEY_ENABLED=true and redeploy the website. The /team/security page supports passkey registration and management for a signed-in Owner at AAL2. The login page offers passkey sign-in only when this public feature switch is enabled.

If CrediSafe later moves to a custom domain, plan a passkey migration before changing the RP ID. Do not casually change the RP ID.

## Initial Owner bootstrap

1. Create or choose the dedicated operations mailbox, then invite it from Supabase Dashboard → Authentication → Users. Confirm the invitation and complete its sign-in setup.
2. Visit /team/security. If not yet approved, the page displays that account's Supabase Auth UUID.
3. In Vercel project credi-safe, set server-only environment variable CREDISAFE_ADMIN_USER_IDS to the exact UUID. Apply to Production. Preview should be enabled only when team previews are intentionally used.
4. Ensure CREDISAFE_ADMIN_BRIDGE_SECRET is the same random 32+ character secret in Vercel and the Render Android backend. It must never be named NEXT_PUBLIC_*.
5. Redeploy Vercel and Render if the environment values were changed.
6. Return to /team/security. The first signed, allowlisted authorization request inserts the initial OWNER membership and writes an audit record.
7. Enroll and verify a TOTP authenticator. Confirm the session reaches AAL2; the admin panel requires this stable second factor.
8. Enable passkeys in Supabase and the Vercel feature switch as described above, redeploy, and register the Owner passkey from /team/security.
9. Remove temporary/incorrect UUIDs from the allowlist after bootstrap; the persisted OWNER membership remains authoritative. Keep an emergency owner process documented.

An allowlisted UUID is only eligible for the initial OWNER bootstrap; it does not bypass login, MFA, backend role checks or signed requests. Never add a shared or public test account.

## Signed bridge protocol

The website server signs each request using HMAC-SHA256 over:
- HTTP method
- exact backend route path (query string excluded)
- millisecond timestamp
- Supabase Auth user UUID
- owner-bootstrap boolean
- SHA-256 hash of the JSON request body

The Render backend accepts assertions only within 60 seconds and then checks admin_members. The secret is shared only between Vercel server runtime and Render. The browser never receives it. The proxy is fixed to the CrediSafe backend origin; browser-supplied upstream URLs are never accepted.

## Administrative controls

- Account suspend/restore updates status, revokes refresh sessions on suspension, and the Android API checks account status on authenticated requests and WebSocket upgrades. Login and refresh are also denied for suspended accounts.
- Session revocation invalidates active refresh tokens.
- XP changes are OWNER-only, bounded to ±500 per action, cannot create negative balances and append an ADMIN_ADJUSTMENT_V1 ledger record. The original trip awards are retained.
- Remote config accepts only explicit keys and typed values. Records are versioned and every update is audited. Android clients can fetch GET /v1/config and cache the response after sign-in. A key changes app behavior only after a native feature explicitly consumes that key.
- Release view reads public GitHub release metadata. APK signing and publication remain in the protected GitHub Actions release pipeline.
- Health view reports point-in-time Render/Neon checks, Supabase Auth provider reachability and the current Vercel request runtime. This is not an uptime SLA.

## Privacy

- Dashboard overview is aggregated. Account detail is role-limited; SUPPORT sees masked email addresses.
- Raw GPS coordinates, route tracks, raw telemetry samples, password hashes and refresh-token values are not exposed.
- Account details, trip diagnostics and XP entries are available only to explicit roles and should be opened only for a legitimate support or operations reason.
- Every mutation requires a reason (8–500 characters) and adds an audit record.
- admin_audit_logs has an UPDATE/DELETE prevention trigger. Corrections are new events, not edits to previous audit records.

## Production database

The additive migration 202610300001_operations_center_v2.sql adds account status, admin membership, audit history and versioned configuration. It preserves existing account, trip, telemetry, session and XP data. The migration was tested on an isolated Neon branch and applied to the production Neon branch on 2026-10-30; the audit immutability trigger was also applied. Production schema verification confirmed the new tables and columns.

For future environments, run this migration before deploying backend code that references these objects. Do not run the migration repeatedly by manually editing production; use the committed migration file as the source of truth and record its application in the team's migration process.

## Rollout checklist

- [ ] Android CI and unit tests pass for the admin API and suspended-account enforcement.
- [ ] Website CI/typecheck/build pass.
- [ ] Render deploy is live on the backend admin commit.
- [ ] Vercel production deploy is live on the website admin commit.
- [ ] The Render and Vercel bridge secrets match.
- [ ] Dedicated Platform Owner account is invited and its email is confirmed.
- [ ] Owner UUID is explicitly allowlisted in Vercel.
- [ ] Owner bootstrap succeeds and TOTP MFA reaches AAL2.
- [ ] Passkey feature is enabled in Supabase and Vercel; Owner passkey registration succeeds.
- [ ] /admin works for OWNER and denies a non-admin.
- [ ] Test SUPPORT masking and role restrictions.
- [ ] Test suspension, login denial, refresh denial and API 403 with a dedicated test account.
- [ ] Verify XP adjustment ledger plus audit entry with a dedicated test account; do not modify real user balances during smoke tests.
- [ ] Verify remote-config read after test update and confirm clients cache it; do not enable a setting whose native consumer is not released.
- [ ] Confirm raw GPS and telemetry are absent from admin pages, API responses and logs.
