<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# HeyMoa Web — Agent Rules

## Project Identity
- **Service**: HeyMoa — 회의를 기록하고 참여하며, 대화를 실제 업무로 연결하는 참여형 AI Agent
- **Design System**: ElevenLabs editorial style (see `DESIGN.md`)
- **API Contract**: `openapi3.yml` → Orval → TanStack Query hooks + MSW mocks

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
pnpm lint && pnpm build
```

## File Conventions
- `app/(main)/` — Pages with Navbar + Footer
- `app/(static)/` — Legal/static pages (simplified footer)
- `app/auth/` — Authentication flow pages
- `components/ui/` — shadcn/ui primitives
- `components/heymoa/` — HeyMoa compound components
- `lib/api/generated/` — Auto-generated (DO NOT edit)
- `lib/mocks/handlers.ts` — MSW handler registry (manually maintained)
