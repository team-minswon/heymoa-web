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

## Git Workflow

- No GitHub issues or PRs. There are no issue/PR templates and no CI workflows in this repo.
- Branches: `main` (stable), `dev` (integration), and `feature/*` branches cut from `dev`.
- Integrate a feature by **squash-merging it into `dev` locally**, then `git push` — no pull request.
- Promote to `main` the same way: squash-merge `dev` into `main` locally, then push.
- Run the verification checklist below before merging.

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

### 오류·로딩 표시 경계

실패를 전부 토스트로 밀거나 전부 화면에 그리는 것 둘 다 틀렸다. **사라져도 되는가**로 가른다.

| 무엇 | 어떻게 | 왜 |
|---|---|---|
| **mutation 실패** | `sonner` 토스트 (기본, 자동) | 방금 한 행동에 대한 응답이라 사라져도 된다. 인라인으로 그리면 버튼 옆에 문구가 끼어들어 레이아웃이 밀린다 |
| **지속 상태** — 입력 잠금, 회의 비ACTIVE, 승인 카드 무효화, 권한 없음 | 인라인 `Alert` | **오류가 아니라 "지금 할 수 없음"이다.** 토스트로 하면 사라진 뒤 왜 입력이 막혔는지 알 수 없다 |
| **주 데이터 실패** — 노트 404, 분석 FAILED, 종료 이벤트 없이 끊긴 스트림 | error boundary / 빈 상태 + 재시도 | 그 화면에 그릴 것이 없다. 토스트만 띄우면 빈 화면이 남는다 |
| **로딩** | `Skeleton` / Suspense | 기능 크기 단위로. route 전체 spinner 금지 |

**mutation 토스트는 자동이다.** `lib/query/query-client.ts`의 `MutationCache.onError`가 모든 실패를 잡아 서버 문구로 토스트한다. 컴포넌트마다 `onError`를 쓰지 않는다.

전역 토스트를 건너뛰려면 **opt-out**한다. 이유는 둘뿐이다.

```ts
// 1. 화면이 인라인으로 그린다 (지속 상태·주 데이터 실패)
useSendNoteSharedChatMessage({
  mutation: { meta: { suppressErrorToast: true } },
});

// 2. 호출부가 실패 코드에 따라 다른 문구를 띄운다 (프로젝트 삭제 등)
const deleteProject = useDeleteProject({
  mutation: { meta: { suppressErrorToast: true } },
});
```

**opt-out 없이 자기 `toast.error`를 부르면 두 개가 겹친다.** 전역 훅이 호출부의
`catch`보다 먼저 돌기 때문이다.

**문구는 서버 것을 쓴다.** 계약이 사용자에게 보일 한국어 메시지를 담고 있고, web이 코드별 문구를 다시 만들면 서버가 바뀔 때마다 갈라진다. `lib/api/error-message.ts`의 `errorMessageOf()`가 봉투에서 뽑는다. 코드로 분기해야 할 때만 `errorCodeOf()`를 쓴다.

### Hydration & Loading

- Server HTML and the first client render must match. No render-time randomness, browser-only branching, or implicit locale/timezone formatting.
- Format product dates through `lib/format/date.ts`.
- `ssr: false` and `suppressHydrationWarning` are last-resort escape hatches and require a documented browser-only reason.
- Prefer feature-sized skeleton/error/retry states over a route-sized spinner. Match skeleton geometry to the final surface.
- Do not render a temporary modal or sheet skeleton and then mount an animated modal or sheet in the same place. Keep the parent surface visible and let the final overlay enter once.
- Use the shared `Button loading` prop for mutations; it preserves the original label width. Disable sibling controls that trigger the same mutation while pending.

### API & Data

- All API calls MUST use Orval-generated hooks from `lib/api/generated/`. The only exceptions are `lib/api/fetcher.ts` (the shared mutator) and `lib/api/sse.ts` (SSE streams, which generated hooks cannot read). Nothing else may `fetch()` an API path directly.
- SSE endpoints (`sendAgentChatMessage`, `sendNoteSharedChatMessage`) return `text/event-stream`. Their generated hooks exist but are unusable — call `postEventStream()` from `lib/api/sse.ts` instead.
- The custom fetcher at `lib/api/fetcher.ts` handles auth token refresh automatically.
- `openapi3.yml` is a mirror of `docs/contracts/openapi3-server.yml` with the three `/internal/**` paths removed — heymoa-ai calls those, not the browser. Never hand-edit it; recopy and strip.
- When `openapi3.yml` changes: run `pnpm orval` first, then update `lib/mocks/handlers.ts`. Generated tag → file paths are recorded in `docs/generated-api-map.md`.

### MSW Mocking

- REST handlers live in `lib/mocks/rest-handlers.ts` (WebSocket in `lib/mocks/websocket-handler.ts`); `lib/mocks/handlers.ts` only assembles the registry. Edit the right file.
- Handlers MUST use **explicit override responses** with `success: true`.
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
pnpm test:run && pnpm lint && pnpm typecheck && pnpm build && pnpm test:e2e
```

`pnpm build`는 Next가 포함하는 파일만 타입 체크한다 — `.test.tsx`가 계약을 어겨도 통과하므로
`pnpm typecheck`(`tsc --noEmit`)가 따로 필요하다. `pnpm test:e2e`는 MSW의 브라우저 서비스
워커 경로를 덮는다(vitest는 jsdom이라 그 경로를 지나지 않는다).

## File Conventions

- `app/(main)/` — Pages with Navbar + Footer
- `app/(static)/` — Legal/static pages (simplified footer)
- `app/auth/` — Authentication flow pages
- `components/ui/` — shadcn/ui primitives
- `components/heymoa/` — HeyMoa compound components
- `lib/api/generated/` — Auto-generated (DO NOT edit)
- `lib/mocks/handlers.ts` — MSW handler registry (manually maintained)
