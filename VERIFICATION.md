# Render deployment support — 10 October 2026

- Added a Render Blueprint for one paid Node instance with a persistent disk, a Next production build/server, runtime SQL migrations with checksum validation, and a transactional SQLite adapter for the shared world. X linking and rate limits use the persistent database.
- Next production build and its TypeScript validation pass. All 36 tests pass, including Render persistence after reopening, atomic OAuth claims, rollback, shared rate counters and the configured HTTPS-origin regression.
- Actual production-server HTTP checks with dummy X credentials: homepage, health, world, creation, tick and X start return 200; guest cookie is Secure; X status is configured; authorization URL uses the exact HTTPS callback. Foreign-origin X start returns 403 and an invalid callback redirects safely. X provider consent has not been completed with real credentials.
- `RENDER.md` documents deployment, environment variables, X app setup, single-instance disk limitations and database backup guidance. No live Render deployment was performed during preparation.

# API rate limiting — 10 October 2026

- Added per-IP fixed-window limits at the Worker entry point using atomic shared D1 counters: 240 API requests/minute, 5 creation/import attempts/hour, 60 history requests/minute, and 10 X linking requests/minute. Counters store IP hashes and remove expired rows in bounded batches. Cookies do not affect the budget.
- All 34 tests pass, including actual D1 concurrent budget enforcement, cookie changes, separate IPs, window expiry, cleanup and polling budgets. TypeScript and production build pass.
- Applied `0003_free_thunderbolts.sql` locally. Actual HTTP checks returned 429 with Retry-After on the eleventh X-start attempt while the world endpoint returned 200. Earlier X-start requests returned the expected unconfigured-provider 503. Hosted migration/deployment has not been performed in this change.

# X profile and article links — 10 October 2026

- Added shared-header X and book icon links to the exact supplied profile and Arena article URLs. Both use native anchors, accessible names, hover titles and a new tab with `noopener noreferrer`.
- Desktop and 390px/320px browser checks passed: the icons remain visible, destinations match, and there is no horizontal overflow. Below 600px the 104px header keeps all five navigation actions on two rows; the world viewport correctly uses the remaining 740px at a 320 × 844 size.
- TypeScript, CSS parsing and diff checks pass. This update changes navigation presentation only; no agent data or OAuth configuration changed.

# Moss interface and verified X linking — 10 October 2026

- Extended the selected Moss gradient to the shared header, creation flow, agent panels, dialogs, toolbars, activity feed, inputs, hover states and speech labels. Blue sky, scene materials, avatars and movement behavior remain intact.
- Desktop browser QA checked the creation view, world controls and owner profile at both `/world` and `/successor/<id>`. The X link control correctly shows the setup state while credentials are absent. Computed surfaces match the Moss palette and no horizontal overflow was observed. The browser viewport override did not change the rendered size in this session, so no new phone-size verification is claimed.
- TypeScript without incremental output and diff checks pass. All 31 tests pass, including real D1 owner checks, atomic single-use state, expiry/replay, duplicate X identities, unlink/replacement races and persistence across simulation ticks. Controlled provider responses check token exchange and authenticated profile validation; no real X account was linked during QA.
- Migration `0002_brief_darkstar.sql` was generated, inspected and applied locally. It adds separate X links and temporary OAuth state without altering existing agent records. The X flow uses S256 PKCE and server-only credentials; only public profile fields reach world snapshots. Security and React reviews found no blocking issues.
- The user elected to configure X developer credentials later. Live X consent is pending `X_CLIENT_ID`, `X_CLIENT_SECRET` and the registered `X_CALLBACK_URL`; the implementation does not claim live-provider verification.

# Moss landing background — 10 October 2026

- Fixed the landing background to the selected Moss gradient (#1e2517 → #343e25 → #242d19). Removed the picker component, other palettes, preference state/storage code and swatch styles. Previously saved choices cannot override the background.
- TypeScript and diff checks pass. Desktop browser QA confirms the exact Moss gradient and no picker; the 320px phone layout has no horizontal overflow. The preview recorded no warnings or errors.

# Landing background comparison — 10 October 2026

- Added 15 distinct dark gradients, defaulting to Forest, with numbered swatches, palette names and wrapping previous/next buttons below the hero actions. Header and hero share a continuous gradient.
- Selection is saved per browser with validated IDs and guarded storage access. Background changes and the picker apply only to home; the shared world data and scene behavior are unchanged.
- TypeScript (without incremental output), diff checks and React review pass. All 15 options were exercised in the browser, with 15 unique gradients and exactly one selected swatch. Both wrap directions, reload persistence and return from World were verified. Desktop, 390px and 320px layouts fit without horizontal overflow; the preview recorded no warnings or errors.
- The lightest gradient stops provide at least 10.16:1 contrast for white headings and 5.35:1 for #bcbcbc body text.

# Graphite welcome and playful header — 10 October 2026

- Home uses a soft graphite background (#2b2b2b). The shared header has a small smiling character, stacked title-case name and rounded navigation controls, with the divider removed. The UI remains grayscale.
- Header heights remain 72px on desktop and 64px on phones. About stays visible on mobile, and the compact agent button retains its accessible name.
- TypeScript and diff checks pass. Browser QA checked desktop, 390px and 320px layouts, with no horizontal overflow at phone sizes. About opens and closes, World navigation works, and the world scene retains its existing transform. The preview recorded no warnings or errors.

# Playful landing page — 10 October 2026

- Home uses a heavier headline with a hand-drawn underline, pill buttons with restrained hover feedback, and a rounded, slightly tilted interactive world window. Removed the duplicate Explore/live footer from the hero.
- The exact headline and concise body copy remain. UI colors are black, white and neutral grays. Changes are scoped to the home view, and reduced-motion preferences disable hover translations.
- TypeScript and diff checks pass. Browser QA checked desktop, 820px, 390px and 320px layouts, with no horizontal overflow at phone sizes. Headline/actions precede the scene on phones. Enter the world works, and world scene position/transform remain unchanged. The fresh preview recorded no warnings or errors.

# Blue gradient sky — 10 October 2026

- Replaced the dusk palette with a pale blue horizon, clear blue middle and deeper blue overhead, with soft white clouds and matching atmospheric fog. Removed the warm sunset tint and stars.
- World heading and population text use dark neutral colors for contrast against the brighter sky. Browser inspection confirmed the gradient at the starting angle and while orbiting. TypeScript passes; the preview recorded no warnings or errors.

# Sky and continuous collision movement — 10 October 2026

- Added a camera-following dusk sky with a blue-to-violet horizon, clouds and stars. The starting camera exposes the horizon while retaining the close zoom limits. UI colors remain black, white and neutral grays.
- The renderer and navigation share 380 solid scenery footprints. Routes and per-frame swept collision checks avoid trees, rocks, ponds, buildings, furniture, lamps and the sculpture, using a body radius that includes avatar arms.
- Movement uses actual frame delta with a 1.05-unit/second ceiling and a capped resume step. Avoidance cannot teleport an existing agent; waypoint progress survives polling, reordered snapshots, clock corrections and buffer growth. Animations use actual displacement.
- Older snapshots no longer overwrite newer movement. Existing unsafe saved plans are repaired around scenery with a duration based on their new route length. No schema changes or paid provider calls were needed.
- TypeScript and all 28 tests pass, including 30/60/144 fps movement, clock jumps, frame resumes, obstacle detour completion and actual D1 execution.
- The exact 500-agent obstacle fixture ran through 5,000 resolver frames with cloned/reordered snapshots and clock changes: zero point or swept scenery violations, minimum separation 1.121998, and maximum speed 0.850160 units/second.
- Fresh browser QA measured 4,708 scene frames with 500 moving avatars, all 380 obstacles, delayed snapshots, backward timestamps and eight burst deliveries: zero scenery penetrations, swept crossings, separation violations or speed violations. Agents completed 905 trips, confirming continued progress. The phone viewport was 390 × 844 on this desktop computer; this is not a mobile-device performance guarantee.
- The temporary stress-test route is removed before packaging. Earlier sections below record prior iterations.
- Inspected the normal mobile world and following panel at 390 × 844, including the four retained toolbar controls, saved thoughts and friends/conversation tabs. The fresh QA tab recorded no browser warnings or errors.

# Enriched world and crowd spacing — 10 October 2026

- The camera starts about 21 units from the centre and cannot zoom beyond 24 on desktop or 28 on narrow screens, down from 62/70. Follow framing remains close and keeps the character above the mobile details panel.
- World materials now include green meadow patches and tree canopies, coral/purple flowers, irregular blue ponds, warmer narrow paths, and amber lamps. The interface, scene labels and selection rings remain black and white.
- Removed Text view and Reduce/Restore motion toolbar controls. Automatic WebGL fallback and the operating system's motion preference remain supported.
- The shared crowd resolver runs once per scene frame, maintains at least 1.12 units of body-centre clearance, and supplies detailed avatars, batched avatars, speech labels and the follow camera. Directed lanes and durable separated meeting stops reduce shared-waypoint congestion.
- All 24 tests pass, including frame-by-frame crossings, opposing lanes, coincident destinations across avatar families, safe sculpture routes, 500 dense standing bodies, and actual D1 conversation spacing. TypeScript passes.
- Browser QA rendered 500 moving fixture avatars (eight detailed and 492 batched). Observed roughly 90–109 fps at 1280 × 720 and 112 fps at 390 × 844 on this desktop computer. These are development observations, not mobile-device or production-load guarantees. The temporary fixture was removed before packaging.
- Inspected desktop maximum zoom-out, the enriched scene, four toolbar controls, and mobile following with thoughts, friends and conversations. No browser warnings or errors were recorded.
- Publication is performed after these checks; the older sections below describe prior iterations.

# Current shared D1 update — 10 October 2026

- The default backend now uses the Sites-provisioned D1 binding rather than separate browser demos. Five worldview questions replace the earlier three-question creation flow. Legacy three-answer personality derivation remains available for explicit import only.
- TypeScript passes. All 19 tests pass, including the final neighbor-path optimization and actual D1 execution of every generated migration, including chronological indexes.
- Actual Miniflare D1 checks pass for two private session identities seeing the same visitor-created records, unique ownership under concurrent retries, rejection of existing-ID imports, concurrent tick leasing without lost arrivals, 4�6 nearby scripted meetings, persisted thought/memory/relationship updates, and retained selected-agent history.
- A test database containing 605 saved characters returns all 605 and exactly 500 awake, then fairly rotates the next cohort. These are isolated emulator records, not fabricated live visitors or a production load-test claim.
- Default D1 conversations are authored/scripted, four lines over 24 seconds. No OpenRouter key was provided and no paid provider call was made. The optional Supabase paid path retains its validation and budget checks.
- Current browser QA: two independent local browser origins used the same D1 database. Juniper was created through all five questions; Vela was explicitly imported from its legacy profile. Each visitor saw both agents with separate ownership, and refresh retained the correct owner. Desktop and 390 x 844 mobile layouts, complete avatar previews, follow framing, actual overhead dialogue, thoughts, friends, retained transcripts, naming errors, keyboard submission, dialog Escape and motion controls were checked.
- UI is flat black and white with self-hosted IBM Plex fonts. The round 64-unit-radius island starts at a closer camera distance and has a limited zoom-out range. New avatars use rounded geometry and five outfit families. Scripted exchanges now stay on a single worldview topic.
- The sections below record earlier iterations and their historical limitations. Current production verification is recorded after publishing.

## Earlier verification history

# Verification — 10 October 2026

Executed locally on Windows using the project's Vinext preview and actual browser controls.

- TypeScript: `node node_modules/typescript/bin/tsc --noEmit` passed.
- Eleven domain, validation, provider-adapter and simulation tests passed. Provider responses were controlled test responses, not live paid calls.
- The migration and repeatable seed executed in PostgreSQL through PGlite. Checks passed for atomic concurrent tick leasing, reserved daily allowance, stale-worker rejection, idempotent creation/finalisation, cross-identity canonical visibility, separate ownership, private-role restrictions and paths avoiding the sculpture.
- Production build completed through the Sites build helper. Three.js is lazy-loaded; the build reports a large graphics chunk, expected for the renderer.
- Actual browser creation: Aster (Explorer) and Vela (Maker), on independent localhost origins. These were independent local demos, not shared Supabase sessions.
- Exactly three personality questions and a separate naming step were exercised. Back preserved answers. Space selected an answer; Enter submitted a name. Invalid names preserved all choices and displayed an error.
- Birth, stable avatar/profile after refresh, first encounters, bounded saved memories, relationships, archive and readable labelled scripted transcripts were observed.
- Desktop and 390 × 844 phone layouts were inspected. Mobile quiz, naming and successor bottom sheet were exercised.
- The explicit text-view fallback retained inhabitants, profiles, feed and memories. Reduced-motion controls were exercised; OS reduced-motion preferences are also respected in code.
- During visual QA an unmount error from floating labels was found and fixed by moving labels to the parent React DOM overlay. Subsequent scene/dialog navigation was checked.

## Remaining live checks

No Supabase or OpenRouter credentials were supplied. Live Supabase anonymous authentication, two independent live shared-browser sessions, real provider billing and deployment-specific service settings remain unverified. The SQL tests and controlled HTTP adapters do not claim to establish those live results.

The active mode without credentials is **Local demo — saved on this device**, using scripted encounters and zero paid AI requests. Apply the migration/seed and configure the variables in `.env.example` to enable shared operation. Paid generation additionally requires explicit `WORLD_MODE=shared-ai`.

## Dark design update

- Rechecked TypeScript and all eleven existing tests after the interface and scene changes.
- Inspected the dark homepage, world, distinct avatars and saved profiles at desktop and 390 × 844 sizes. Avatar previews fit complete hats and feet after a camera adjustment.
- Verified inhabitant selection, saved successor access, archive opening, labelled transcripts, text view and the mobile toolbar. Existing Aster and Vela identities, memories and relationships remained intact.
- Removed decorative copy, fake avatar dots, chapter labels and repeated explanations. No user data or backend schema changed.
- React review checked event cleanup, lazy scene loading, motion preferences and keyboard focus in dialogs. The initial dialog focus now lands on its close control.

## Expanded black world

- Verified the exact landing headline, black interface, saved profile, inhabitant search, eight-button toolbar and whole-world overview at desktop and 390 × 844 dimensions. No horizontal overflow or browser errors were observed.
- Rendered 500 moving fixture agents: eight detailed avatars and 492 batched avatars. Foreground preview measurements were roughly 105–130 frames per second at desktop dimensions and 87–94 at phone dimensions on this desktop computer. These are development observations, not a mobile-device performance guarantee.
- Selected a batched fixture agent and checked its detailed promotion. The temporary fixture route was removed before packaging; it does not add fake inhabitants to the published world.
- All fourteen unit tests pass, including connected expanded routes, 500 seeded safe destinations, outer-district encounters and the original first-encounter deadline.
- PostgreSQL checks passed for the incremental expansion migration: 525 saved agents, exactly 500 awake, fair rotation, distinct safe movement endpoints, preserved existing identities and a single global paid reservation. The migration is included for configured shared backends; it was not applied to a live database.
- Reviewed instanced drawing, stable avatar palettes, picking bounds, bounded labels, reused frame objects and listener cleanup. TypeScript passed after the changes.

## Black-and-white interface

- Replaced UI accent colors, error/banner colors, profile bars, inhabitant dots, transcript speakers and the favicon with neutral black/white values. Scene labels and selection feedback are also monochrome; character and world materials retain their individual colors.
- CSS scan found zero chromatic colors. Browser computed-style checks found zero chromatic UI colors on the homepage, selected profile and transcript dialog, including the 390 × 844 layout with no horizontal overflow.
- TypeScript passed. This presentation-only edit did not change simulation or persistence.
