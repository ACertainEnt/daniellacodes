# UX and offline improvement — work in progress

This branch contains a partial implementation, not a release-ready fulfilment of the full request. The production site remains https://daniellacodes.vercel.app and these changes have **not** been deployed there.

## Implemented

- Shared sheets now use a separate fixed viewport flex container instead of combining CSS centring and Framer Motion transforms on the same element. Includes safe-area padding, dynamic viewport height, scroll containment, focus restoration, keyboard focus trapping, Escape, close button, reduced-motion handling, and a shared scroll lock. Opening a new sheet requests the previous sheet to close.
- Install manifest, icons, and service worker for the app shell and same-origin built assets; authenticated APIs and `/files` are not stored in the service worker cache. The install invitation appears at the bottom of the page, remains visible after a dismissed prompt, and is hidden only when installation is detected. It does not prevent learning.
- Successfully opened lesson payloads are saved in IndexedDB and listed on the sessions page. During an existing signed-in session, a network failure allows reopening a previously cached lesson and viewing its text, code and knowledge check. Server authorization failures do not fall back to cached lessons. Saved lesson data may be stale and remains on the device; shared devices should not be used for private lessons.
- Device-local notes and knowledge-check responses, with notes save feedback; optional per-lesson reading position. Notes and practice responses are not official exams or Supabase records. They are not synced and can be lost if browser storage is cleared. Storage failures are reported where possible.
- Offline/online messaging and an explanation that authentication, videos, Ask Ace and official exams need a connection. Existing server-side completion remains online-only.
- Code blocks are constrained to horizontal scrolling and sheet/toast centring no longer relies on a conflicting transform.

## Tests actually run

- `npm run typecheck`: passed.
- `npm run build`: passed (the JS bundle remains approximately 1.13 MB before gzip; not a performance benchmark).
- `npm run check:curriculum`: passed.
- `npm run verify:api`: 63 passed, 0 failed, using local SQLite, not Supabase or production.
- `npm run verify:render`: passed local Happy DOM smoke rendering; not a real-browser, layout, service-worker or offline test.

## Not yet implemented or verified

- Offline session restoration after a reload or browser restart: authentication still requires the server. The offline lesson cache is available only while the authenticated app is already open.
- Offline progress completion queue, durable Supabase sync, conflicts, retries, duplicate prevention and cross-device notes. The current local notes and practice answers are not a substitute; do not claim they synchronise. Official examination submission and grading remain online-only.
- Spaced revision, personalised recommendations from actual performance, additional practice exercises, server-persisted learning insights and checkpoints are not implemented.
- The service worker, install flow, IndexedDB behaviour, mobile/desktop sheet geometry, touch, focus, navigation, reading position, offline/reconnect scenarios, code editor and exam interaction have not been tested in a real browser or on Android. No browser was available in this environment. Browser console and device performance are unverified.
- Supabase persistence/security and Vercel deployment of these new changes have not been verified. No production deployment was attempted.
- Offline notes and responses are stored as plain device-local browser data. They do not have per-user encryption or shared-device isolation.
- Full accessibility and overlay audit beyond shared `Sheet` remains necessary; loading/error handling and network recovery still need wider review.
