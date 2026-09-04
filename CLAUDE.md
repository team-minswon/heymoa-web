<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# heymoa-web

HeyMoa의 웹 프론트엔드. Next.js 16 App Router + TanStack Query + Tailwind입니다.
HeyMoa는 회의를 기록하고 참여하며 대화를 실제 업무로 연결하는 참여형 AI Agent입니다.

계약(`openapi3.yml`) → Orval → TanStack Query 훅 + MSW 목이 데이터의 뼈대입니다.
디자인 시스템은 ElevenLabs editorial style입니다.

## 명령어

```bash
pnpm dev              # 개발 서버
pnpm dev:clean        # .next를 지우고 dev. proxy를 고친 뒤 옛 동작이 보일 때만
pnpm orval            # openapi3.yml → lib/api/generated/ 재생성
```

머지 전에 전부 통과해야 합니다. 각각이 다른 것을 봅니다.

```bash
pnpm test:run && pnpm lint && pnpm typecheck && pnpm build && pnpm test:e2e
```

| 명령 | 왜 따로 필요한가 |
|---|---|
| `pnpm test:run` | vitest. 순수 selector·reducer·컴포넌트 상호작용 |
| `pnpm lint` | eslint |
| `pnpm typecheck` | `tsc --noEmit`. **`pnpm build`는 Next가 포함하는 파일만 봅니다** — `.test.tsx`가 계약을 어겨도 build는 통과합니다 |
| `pnpm build` | 실제 빌드가 깨지는지 |
| `pnpm test:e2e` | Playwright. **MSW의 브라우저 서비스 워커 경로를 덮습니다** — vitest는 jsdom이라 그 경로를 지나지 않습니다 |

머지 절차와 codex 리뷰 게이트는 skill [`merging`](.claude/skills/merging/SKILL.md)에 있습니다.
커밋·브랜치 제목은 `[APP-N] 제목` 형식입니다.

## 어디에 무엇이 있나

| 경로 | 무엇 |
|---|---|
| `app/(main)/` | Navbar + Footer가 있는 페이지 (마케팅 면) |
| `app/(static)/` | 약관 등 정적 페이지. 랜딩과 같은 마케팅 면입니다 |
| `app/auth/` | 인증 흐름 |
| `app/w/` · `app/settings/` | 워크스페이스 이후 (제품 면) |
| `components/ui/` | shadcn/ui primitive. 제품 의미를 모릅니다 |
| `components/heymoa/` | HeyMoa 합성 컴포넌트 |
| `components/<feature>/` | feature UI |
| `lib/<feature>/` | 순수 selector·protocol·service |
| `lib/api/generated/` | orval 산출물. **편집 금지** (hook이 막습니다) |
| `lib/mocks/` | MSW. `handlers.ts`는 레지스트리만 모읍니다 |
| `proxy.ts` | 미들웨어. **`middleware.ts`를 만들지 않습니다** (hook이 막습니다). SSR 쪽 토큰 갱신을 페이지 렌더 전에 처리합니다 |
| `lib/auth/` | 쿠키 인증. `access_token`·`refresh_token`을 백엔드가 HttpOnly로 심습니다 |
| `lib/api/fetcher.ts` | 클라이언트 401 → `/v1/auth/refresh` → 재시도 |

## 읽을 문서

| 무엇을 바꾸나 | 먼저 읽을 것 |
|---|---|
| 화면의 생김새 | [`DESIGN.md`](DESIGN.md) |
| 코드 리뷰 | [`AGENTS.md`](AGENTS.md) + skill [`code-review`](.claude/skills/code-review/SKILL.md) |

## 하네스

항상 걸리는 규칙은 `.claude/rules/`에 있고 매 세션 로드됩니다. 부를 때만 읽는 절차는
`.claude/skills/`입니다. 둘 다 [`harness/v002-2026-08-13/`](harness/v002-2026-08-13/README.md)를
가리키는 심링크입니다. 무엇이 어디 있고 왜 그렇게 나눴는지는 그 README에 있습니다.
