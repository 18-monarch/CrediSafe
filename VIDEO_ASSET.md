# Cinematic video asset

The current experience uses the user-provided `cs-car.mp4` clip, optimized for web delivery.

Generated website files:

- `public/video/credisafe-drive.mp4` — primary H.264 desktop source
- `public/video/credisafe-drive.webm` — VP9 fallback
- `public/video/credisafe-drive-mobile.mp4` — mobile-optimized H.264 source
- `public/video/credisafe-poster.webp` — loading/poster frame

The video audio track is removed because the clip is used as a muted scroll-scrubbed background. Frequent keyframes are included to improve seeking smoothness.

To replace the video later, keep these filenames or update the `<source>` paths in `components/VideoExperience.tsx`. Demo timing uses normalized progress values, so different video durations are supported automatically.
