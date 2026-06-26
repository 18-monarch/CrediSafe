# Security and Privacy Notes

## Implemented

- Supabase cookie-based authentication
- Protected `/app` routes when Supabase is configured
- Server-side user verification in every write endpoint
- Zod validation for request payloads
- Row Level Security on every user-data table
- Ownership checks for vehicles and GPS points
- Database functions verify `auth.uid()`
- Publishable key only in the browser
- No service or secret key shipped to the client
- Atomic trip settlement and reward claiming

## GPS privacy

- Location is requested only when the user starts a live trip.
- `clearWatch` stops collection when the trip ends or the component unmounts.
- Raw GPS points are tied to the authenticated user and trip.
- The MVP does not continuously monitor background location.

## Before production

- Add rate limiting to write endpoints.
- Add retention and trip-deletion controls.
- Complete a privacy policy and consent review.
- Add abuse detection for synthetic GPS data.
- Review local transport, rewards and insurance regulations.
- Perform a third-party security review before handling partner data.

---

## Video-verification security

- The browser uploads through the authenticated Next.js route, not directly to an unprotected Python endpoint.
- Next.js validates the selected trip and vehicle belong to the authenticated user.
- Next.js and Python share a private `VISION_API_KEY`.
- Uploads are limited to short supported video files.
- Python writes to a temporary file and deletes it after analysis.
- Supabase RLS restricts analysis and detection rows to their owner.
- A video plate match is stored as `video_matched`, not official `verified`.
- The service never credits XP or rewards from OCR detections.
