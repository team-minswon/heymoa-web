<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# HeyMoa Web — Agent Rules

## Project Identity

- **Service**: HeyMoa — 회의를 기록하고 참여하며, 대화를 실제 업무로 연결하는 참여형 AI Agent
- **Design System**: ElevenLabs editorial style (see `DESIGN.md`)
- **API Contract**: `openapi3.yml` → Orval → TanStack Query hooks + MSW mocks
- **Architecture**: read `docs/frontend-architecture.md` before changing route, data, auth, loading, or realtime state boundaries

## Architecture

- `app/**/page.tsx` stays a Server Component and only orchestrates params, redirects, server prefetch, and hydration.
- Persistent app chrome such as the workspace sidebar, toolbar, and background list belongs in a shared route `layout.tsx`; nested pages render only the surface that changes.
- Keep interactive code in the smallest practical Client Component. Never disable SSR for an entire feature to hide a hydration mismatch.
- Server state belongs to TanStack Query. Use Orval query options + `HydrationBoundary` for data needed on the first render.
- Global client state is limited to truly cross-route lifecycles such as auth and active recording. Keep feature selection and dialog state local.
- High-frequency microphone level consumers use `useRecordingMeter()`; other components use `useRecording()` so transcript surfaces do not rerender at 20Hz.
- Persisted transcript segments remain immutable. Presentation grouping belongs in pure selectors under `lib/transcription/`.

## Critical Conventions

### Next.js 16

- Use `proxy.ts` for middleware. **NEVER create `middleware.ts`** — it conflicts and causes 404 loops.
- After changing proxy/middleware logic, always `rm -rf .next` before `pnpm dev`.

### Styling

- CSS variables use `--el-*` namespace. `--clay-*` is legacy alias — do NOT reference in new code.
- Display headings: `font-serif font-light` + negative tracking.
- CTA buttons: `rounded-full` (pill geometry). Never `rounded-xl` or smaller for CTAs.
- Cards: `rounded-2xl border border-[var(--el-hairline)] bg-white shadow-[0_4px_16px_rgba(0,0,0,0.04)]`.
- Gradient orbs are **atmosphere only** — never use as button fills, text colors, or card backgrounds.
- Product UI must not expose query polling, database/reconciliation labels, segment counts, session IDs, or environment configuration.

### Hydration & Loading

- Server HTML and the first client render must match. No render-time randomness, browser-only branching, or implicit locale/timezone formatting.
- Format product dates through `lib/format/date.ts`.
- `ssr: false` and `suppressHydrationWarning` are last-resort escape hatches and require a documented browser-only reason.
- Prefer feature-sized skeleton/error/retry states over a route-sized spinner. Match skeleton geometry to the final surface.
- Do not render a temporary modal or sheet skeleton and then mount an animated modal or sheet in the same place. Keep the parent surface visible and let the final overlay enter once.
- Use the shared `Button loading` prop for mutations; it preserves the original label width. Disable sibling controls that trigger the same mutation while pending.

### API & Data

- All API calls MUST use Orval-generated hooks from `lib/api/generated/`. No direct `fetch()` to API endpoints.
- The custom fetcher at `lib/api/fetcher.ts` handles auth token refresh automatically.
- When `openapi3.yml` changes: run `pnpm orval` first, then update `lib/mocks/handlers.ts`.

### MSW Mocking

- MSW handlers in `lib/mocks/handlers.ts` MUST use **explicit override responses** with `success: true`.
- NEVER use default faker-generated responses (they produce random `success: false` which breaks auth).
- SSR mock path: `lib/auth/server.ts` `getCurrentUserForSsr()` returns hard-coded mock user when `shouldEnableMocking()` is true.

### Authentication

- Cookie-based: `access_token` + `refresh_token` (HttpOnly from backend).
- `proxy.ts` handles SSR-side token refresh before page render.
- Client-side: `lib/api/fetcher.ts` intercepts 401 → calls `/v1/auth/refresh` → retries.
- Mock user: `userId: "user-12345"`, `name: "테스트 유저"`, `email: "test@heymoa.com"`.

## Verification Checklist

Before any commit:

```bash
pnpm test:run && pnpm lint && pnpm build
```

## File Conventions

- `app/(main)/` — Pages with Navbar + Footer
- `app/(static)/` — Legal/static pages (simplified footer)
- `app/auth/` — Authentication flow pages
- `components/ui/` — shadcn/ui primitives
- `components/heymoa/` — HeyMoa compound components
- `lib/api/generated/` — Auto-generated (DO NOT edit)
- `lib/mocks/handlers.ts` — MSW handler registry (manually maintained)
