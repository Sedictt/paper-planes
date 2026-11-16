# AGENTS.md — Project Engineering Standards

Universal engineering rules for AI coding agents (Antigravity, Claude Code, Codex, Cursor). Apply these standards automatically when writing, refactoring, or reviewing code in this repository.

> **Compatibility Tip:** Keep this file at the repository root as `AGENTS.md`. For Claude Code, create a root `CLAUDE.md` containing `@AGENTS.md` (alongside any repo-specific commands).

---

## Core Execution Principle: Scope by Stage
- **Always-on code rules (Sections 1–3):** Apply by default whenever touching UI, APIs, auth, or database code.
- **Scale & infra triggers (Section 4):** Write stateless, scale-ready code from Day 1, but only introduce external infrastructure (Redis, job queues, OpenTelemetry) when the stated threshold is met or requested.
- **Pre-ship audit (Section 5):** Run before marking a feature, PR, or release production-ready.

---

## 1. UI, UX & Interaction Craft

### Typography & Geometry
- **Balanced Headlines:** Apply `text-wrap: balance` to headings (`h1`–`h4`) and short hero copy, and `text-wrap: pretty` to body paragraphs to prevent single-word orphans.
- **Tabular Numbers:** Apply `font-variant-numeric: tabular-nums` (`tabular-nums`) to prices, counters, timers, data tables, and live metrics so digits never jitter on update.
- **Continuous Corners:** Maintain concentric border radii across nested containers (`inner_radius = max(0, outer_radius - padding)`) and use smooth/continuous corner curves where supported.
- **Self-Hosted Fonts:** Self-host variable `.woff2` fonts (cap at 1–2 font families/weights), preload critical fonts, and set `font-display: swap` or `optional`.
- **CSS Units:** Use `rem` for font sizes (respecting user zoom/root preferences), `%` for fluid layouts and widths, `px` for hairline borders and shadows, `em` for component-relative spacing like button padding, and `vw` / `dvh` (`svh`) for full-screen sections (prefer `dvh`/`svh` over `100vh` on mobile to avoid address-bar jump).

### Perceived Speed & Feedback
- **Skeleton Loaders:** Match the exact layout geometry and dimensions of incoming content instead of rendering generic centered spinners that cause layout shift.
- **Blurhash Placeholders:** Render images with explicit `width`/`height` (or `aspect-ratio`) and a BlurHash, ThumbHash, or LQIP base64 placeholder until the full asset decodes.
- **Optimistic Updates:** Update local UI state immediately on user mutation before the server responds; snapshot prior state and roll back cleanly with an error toast if the request fails.
- **Undo Toasts:** For destructive or archive actions, prefer immediate optimistic execution paired with a timed Undo toast (delayed commit or compensating mutation) over blocking confirmation modals.
- **Stale-While-Revalidate:** Serve cached client data immediately on navigation and revalidate in the background (`stale-while-revalidate` via TanStack Query, SWR, or HTTP cache headers).

### Motion Craft
- **Snappy Timing:** Keep micro-interactions `100–200ms` and layout/route transitions `200–350ms` so motion feels crisp and never slows down repeat use.
- **Slow In & Slow Out:** Never use linear easing for UI motion; use asymmetric `cubic-bezier` curves or spring physics, and always respect `prefers-reduced-motion: reduce`.
- **Interruptible Animations:** Build transitions with CSS transitions or spring physics that retarget smoothly mid-flight if user input changes or reverses; never lock pointer/keyboard input while an animation runs.
- **View Transitions:** Use the View Transitions API (`document.startViewTransition` / CSS `@view-transition`) for route and layout state changes.
- **Squash & Stretch:** Apply subtle scale deformations on press, bounce, or elastic overscroll (e.g., `scale(0.97)` on active press) while keeping text legible.
- **Anticipation Wind-Up:** Use brief micro-cues before major state changes (press compression, pull-to-refresh tension, or drag lift) so transitions feel triggered rather than abrupt.
- **Staging the Focus:** Direct attention to the active element by dimming backdrops, blurring inactive layers, or choreographing entrance order around the primary action.
- **Pose-to-Pose:** Define explicit start, mid, and end keyframes (`@keyframes` or layout variants) for multi-step UI transitions instead of ad-hoc property tweens.
- **Follow-Through:** Let secondary elements (shadows, badges, list items) settle slightly after the main container using staggered delays or damped spring physics.
- **Moving in Arcs:** Animate floating elements, shared-element cards, and drag releases along natural curved paths or dual-axis easing rather than rigid straight-line diagonals.
- **Secondary Action:** Pair primary state changes with subtle supporting feedback (icon morph, checkmark draw, or haptic tick) that reinforces without distracting.
- **Exaggerated Feedback:** Amplify critical feedback (error shakes, success pops, delete collapses) just enough to make state changes unmistakable at a glance.
- **Solid Drawing in 3D:** Preserve spatial consistency across elevation, shadows, `perspective`, and `transform-origin` so layered sheets, cards, and flips obey consistent depth.
- **Overall Appeal:** Polish spacing, alignment, micro-copy, and visual rhythm across every state (empty, loading, error, success) so the interface feels cohesive.

### Touch, Mobile & UX Laws
- **Fitts's Law & Bigger Hit Areas (Hit Slop):** Size and position targets proportional to importance and distance; keep primary CTAs large and close to the thumb/cursor zone, and enforce a minimum `44x44px` (`48x48dp` on Android) tap target using invisible hit-slop (`padding` or inset pseudo-elements) on compact controls.
- **Hick's Law:** Minimize decision time by limiting visible choices per view, using progressive disclosure for advanced options, and highlighting a sensible default.
- **Miller's Law:** Chunk dense forms, navigation, and dashboards into scannable groups of roughly 5–9 items (`7 ± 2`) with clear visual hierarchy.
- **Doherty Threshold:** Keep system feedback under `400ms` (using optimistic UI, skeletons, or instant local state) so user flow stays uninterrupted.
- **Postel's Law:** Be liberal in what user input formats you accept (trim whitespace, normalize phone/date/card inputs, tolerate case differences) and strict in what data you validate and persist.
- **Jakob's Law:** Use familiar platform conventions, standard icons, and predictable navigation patterns so users transfer existing mental models immediately.
- **Frequency of Use:** Surface high-frequency actions prominently (pinned toolbars, top-level nav, shortcuts) and tuck rare settings or destructive actions behind menus.
- **Swipe-to-Dismiss Sheets:** Mobile bottom sheets and drawers must support velocity-aware drag/swipe-to-dismiss with backdrop dimming and snap points.
- **Predictive Back:** Support system predictive back gestures on mobile/Android and sync modal/drawer state with browser history where appropriate so back navigation closes the active layer instead of exiting the app.
- **Safe Area Insets:** Respect device notches, rounded corners, keyboard overlays, and home indicators using `env(safe-area-inset-*)` (or native `WindowInsets` / `SafeAreaView`).

### Input, Keyboard & Desktop Polish
- **Command Menu:** Provide a `Cmd+K` / `Ctrl+K` command palette for global navigation, search, and high-frequency actions.
- **Shortcut Hints:** Render keyboard shortcut badges (`<kbd>`) inline on menu items, tooltips, and primary action buttons, adapting modifiers (`⌘` vs `Ctrl`) to the user's OS.
- **Amazon Safe Triangles:** On hover-triggered dropdowns, flyouts, and nested submenus, implement a pointer safe-triangle (cursor vector tracking or SVG clip-path) so diagonal cursor movement from trigger to submenu never prematurely closes the menu.
- **One-Time Code Autofill:** Configure OTP/verification inputs with `autocomplete="one-time-code"`, `inputmode="numeric"`, `pattern="[0-9]*"`, and full multi-digit paste handling across split boxes.

---

## 2. Frontend & Network Performance

### Rendering & Bundle Discipline
- **Pre-Rendering & Server Rendering:** Render pages at build time (SSG/ISR) or on the server (SSR/RSC) by default so initial HTML arrives populated; prefetch likely next routes on link hover/viewport entry.
- **Code Splitting by Route:** Split JavaScript bundles by page/route and dynamically `import()` heavy client components (charts, rich-text editors, modals) below the fold.
- **Prevent Unnecessary Re-Renders:** Colocate state at the lowest leaf component, compute derived values during render instead of syncing via `useEffect`, keep list `key` props stable (never array index on mutating lists), and memoize expensive subtrees.
- **Defer Third-Party Scripts:** Load analytics, pixels, and chat widgets after hydration (`defer`, `async`, `strategy="lazyOnload"`, or web workers) so they never block LCP or main-thread interactivity.

### Media & Long Lists
- **Modern Image Formats:** Serve images in `AVIF`, `WebP`, or `JPEG XL` with responsive `srcset` and `sizes` attributes matched to layout breakpoints.
- **Viewport-Aware Image Loading:** Apply `loading="lazy"` and `decoding="async"` to all below-the-fold images; reserve `loading="eager"` and `fetchpriority="high"` strictly for the above-the-fold LCP hero image.
- **Virtualize Long Lists:** Virtualize any list, feed, or table rendering more than 50–100 rows (using TanStack Virtual, `FlashList`, `LazyColumn`, or CSS `content-visibility: auto`).

### Client Request Hygiene
- **Prevent Duplicate API Calls:** Deduplicate concurrent identical requests via query keys/request memoization and abort superseded requests with `AbortController`.
- **Debounce Search & Autocomplete:** Debounce typeahead, search, and filter network calls (`150–300ms`), keeping local input state controlled and synchronous for zero typing lag.
- **Parallelize Independent Requests:** Run independent async fetches concurrently with `Promise.all` / `Promise.allSettled` (`asyncio.gather` in Python) rather than sequential `await` waterfalls.

---

## 3. Backend, Database & Security Baseline

### Authentication & Access Control
- **Proper Authentication:** Use established auth frameworks/providers; verify authentication tokens/sessions on the server on every protected route, server action, and API handler.
- **Hash Passwords:** Hash user passwords with Argon2id (or bcrypt with cost factor `>= 12`); never log, compare in non-constant time, or store plaintext passwords.
- **Secure Session Cookies:** Issue session cookies with `HttpOnly`, `Secure`, `SameSite=Lax` (or `Strict`), and explicit expiry.
- **Lock Down Admin Routes:** Enforce server-side role/permission checks (RBAC/ABAC) middleware on all `/admin` pages, API routes, and mutations—never rely on client-side route guards or hidden UI links.
- **Expiring Password Reset Links:** Generate password reset links from a CSPRNG (`>= 128-bit` entropy), store only the token hash in the database, enforce a short TTL (`15–60 minutes`), and invalidate immediately upon use.

### Input Validation, Mutations & Payments
- **Server-Side Form & Payload Validation:** Validate and strip unknown fields on every incoming body, query parameter, and header on the server using a strict schema (Zod, Valibot, Pydantic) regardless of client validation.
- **Idempotency Keys:** Require and verify a client-generated `Idempotency-Key` header/field on all payment, checkout, email-dispatch, and non-idempotent POST mutations to prevent duplicate side effects on retry.
- **Verify Prices & Payments Server-Side:** Always calculate item prices, discounts, tax, and entitlements on the server from database records; verify webhook cryptographic signatures (e.g., `Stripe-Signature`) before fulfilling orders.
- **Restrict File Uploads:** Enforce strict server-side file size limits, verify file types via magic bytes (file signature, not file extension or client `Content-Type`), randomize stored filenames (UUIDs), and store uploads in isolated object storage (S3/R2) outside the application web root.
- **XSS Protections:** Escape untrusted output by default, sanitize any rich HTML with DOMPurify before rendering, avoid `dangerouslySetInnerHTML`/`innerHTML` on user content, and enforce a strict `Content-Security-Policy`.
- **CSRF Protections:** Verify `Origin`/`Host` headers or require anti-CSRF tokens on all cookie-authenticated state-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`).

### Database & Query Discipline
- **Secure Database:** Enable Row-Level Security (RLS) or mandatory tenant-scoping predicates on every query, and connect using least-privilege database roles over private networking/SSL.
- **Parameterized Queries:** Always use parameterized queries, prepared statements, or ORM bindings; never concatenate or interpolate variables into SQL strings.
- **Select Only Needed Columns:** Project explicit column lists (`SELECT id, name, created_at`) instead of `SELECT *` to minimize I/O, wire payload, and accidental leakage of sensitive columns.
- **Eliminate N+1 Queries:** Replace per-row queries inside loops with `JOIN`s, `WHERE id IN (...)` batching, or DataLoader patterns.
- **Paginate API Results:** Enforce cursor-based (preferred) or bounded `limit`/`offset` pagination on every list endpoint with a hard server-side maximum page size.
- **Database Indexes:** Add indexes for all foreign keys and columns frequently used in `WHERE`, `JOIN`, and `ORDER BY` clauses; verify hot queries with `EXPLAIN ANALYZE`.
- **Database Connection Pooling:** Route database connections through a connection pooler (e.g., PgBouncer, Supabase Pooler, bounded driver pool), especially in serverless or edge functions.

### Network, Headers & Environment Hardening
- **Validate Environment Variables:** Parse required environment variables at application boot with a strict schema so missing or malformed secrets fail fast on startup.
- **Hide API Keys:** Keep private API keys strictly in server-only modules and environment variables; audit client bundle imports to ensure secret keys are never exposed via `NEXT_PUBLIC_` / `VITE_` prefixes.
- **Rate Limiting:** Apply IP- and account-based rate limiting on login, registration, OTP, password reset, search, file upload, and AI/expensive endpoints.
- **Timeouts on External API Calls:** Attach an explicit timeout (`AbortSignal.timeout(ms)`) and bounded retry with exponential backoff to every outbound third-party HTTP/SDK request.
- **Enforce HTTPS & Security Headers:** Redirect HTTP to HTTPS and set `Strict-Transport-Security` (HSTS), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` (or CSP `frame-ancestors 'none'`), `Referrer-Policy: strict-origin-when-cross-origin`, and a scoped `Permissions-Policy`.
- **Restrict CORS:** Configure explicit origin allowlists for `Access-Control-Allow-Origin`; never combine wildcard `*` origins with credentials.
- **Disable Production Debug Mode:** Suppress stack traces, verbose ORM/SQL errors, and debug playgrounds in production; return safe error codes and log full details server-side with a request correlation ID.
- **Log & Monitor Suspicious Activity:** Emit structured security logs for repeated auth failures, permission denials, rate-limit triggers, and payment mismatches while redacting passwords, tokens, and PII.

---

## 4. Scale & Infrastructure Triggers

Keep the application **stateless** from Day 1 (store sessions, uploads, and job state outside local process memory/disk) so horizontal scaling requires zero code rewrites. Introduce the following components when their trigger condition applies:

- **CDN & Browser Caching (On Deployment):** Serve static assets through an edge CDN with `Cache-Control: public, max-age=31536000, immutable` on content-hashed filenames, and enable **Brotli (`br`) or Gzip compression** on all text/JSON/bundle responses.
- **Background Job Queue (When Task > 500ms or Retries Matter):** Offload transactional emails, webhook processing, PDF/media generation, and batch imports/AI jobs to an async job queue (e.g., BullMQ, Inngest, Trigger.dev, Celery) rather than blocking the HTTP response.
- **Redis Caching (When Read Load or Expensive Computation Repeats):** Cache hot cross-user queries, session lookups, or rate-limit counters in Redis/Upstash with explicit TTLs and deterministic cache-invalidation keys.
- **OpenTelemetry Tracing (When Running Multi-Service or Diagnosing Tail Latency):** Instrument HTTP handlers, DB queries, and outbound API calls with OpenTelemetry spans and distributed trace IDs.
- **Load Balancing (When Traffic Outgrows a Single Instance):** Distribute traffic across multiple stateless application instances behind a health-checked load balancer.

---

## 5. Pre-Ship Security & Performance Audit

Before completing a major feature, opening a release PR, or deploying to production, verify:

1. **Thorough Security Check:** Every new route/mutation verifies authentication, object-level authorization (no IDOR), server-side schema validation, and rate limits.
2. **Exposed Files Check:** `.env*`, `.git/`, `.DS_Store`, database dumps (`.sql`, `.bak`), and private source maps are gitignored and blocked from public web serving.
3. **Git History Secret Scan:** No API keys, tokens, or credentials exist in staged changes or commit history (`gitleaks` / `trufflehog`).
4. **Compromised Key Rotation:** If any secret was ever committed, logged, or exposed to the client, **revoke and replace the key at the provider immediately**—rewriting git history alone is never sufficient.
5. **Dependency Hygiene:** Unused packages are removed from `package.json` / `requirements.txt`, and `audit` checks show zero unmitigated high/critical vulnerabilities.
6. **Real-World Performance Verification:** Critical user journeys are tested under simulated CPU throttling and slow mobile networks (Slow 3G/4G), and Real User Monitoring (RUM) tracks Core Web Vitals (`LCP < 2.5s`, `INP < 200ms`, `CLS < 0.1`).
