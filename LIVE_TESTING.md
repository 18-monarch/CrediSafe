# Private Live Testing Plan

## Stage 1 — local combined test

1. Run Next.js and Python service.
2. Add the real vehicle registration number.
3. Run a GPS trip from a phone using localhost on the same network only if practical, or deploy the web app over HTTPS.
4. Record a separate short clip where the registration plate is clearly visible.
5. Upload it through `/app/vision` and connect it to the trip.
6. Confirm the GPS score and video evidence appear together.

## Stage 2 — private HTTPS pilot

Deploy:

- Next.js to Vercel or another Node host.
- Python Docker service to Render, Railway, Fly.io or a VM with Tesseract.
- Supabase as the database/auth provider.

Use the product only with your team first.

## Test checklist

- account signup/login
- vehicle creation
- mobile GPS permission
- at least 10 valid GPS samples
- distance and speed reasonableness
- trip saving exactly once
- XP/reward update exactly once
- short-video upload under 25 MB
- Python service availability
- expected plate visible and readable
- matched/unmatched result is correct
- video file deleted after processing
- evidence linked to the selected trip
- no random compliance event or points

## Safe testing

A passenger should operate the phone. The rider/driver must not interact with the product while moving.
