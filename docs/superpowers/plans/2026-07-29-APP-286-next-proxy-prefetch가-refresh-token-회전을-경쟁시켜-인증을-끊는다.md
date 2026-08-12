# APP-286 Proxy Prefetch Refresh Competition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Next.js prefetch 요청이 SSR refresh token 회전에 참여하지 않도록 Proxy matcher에서 제외한다.

**Architecture:** Next Proxy의 공식 matcher `missing` 조건으로 prefetch 헤더 두 종류를 실행 전에 거른다. 설치된 Next.js 16.2.11의 `unstable_doesMiddlewareMatch`로 프레임워크가 실제 config를 해석한 결과를 검증하고 Proxy 함수의 기존 인증 동작은 유지한다.

**Tech Stack:** Next.js 16 Proxy, Vitest, TypeScript

## Global Constraints

- 서버 refresh token 회전 정책과 API 계약은 변경하지 않는다.
- 새 의존성, 전역 single-flight, 분산 락, grace window를 추가하지 않는다.
- 일반 문서 요청의 SSR refresh와 400/401 cookie 정리는 유지한다.
- 커밋 제목은 `[APP-286] 제목` 형식을 쓴다.

---

### Task 1: Proxy matcher에서 prefetch 제외

**Files:**
- Modify: `proxy.test.ts`
- Modify: `proxy.ts:179-183`

**Interfaces:**
- Consumes: Next.js `unstable_doesMiddlewareMatch({ config, url, headers })`
- Produces: `config.matcher`의 prefetch 제외 조건

- [ ] **Step 1: matcher 실패 테스트 작성**

`proxy.test.ts`에 공식 matcher 도우미와 config를 import하고 다음 테스트를 추가한다.

```ts
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { config } from "@/proxy";

describe("proxy matcher", () => {
  it.each([
    { "next-router-prefetch": "1" },
    { purpose: "prefetch" },
  ])("skips Next.js prefetch headers: %o", (headers) => {
    expect(
      unstable_doesMiddlewareMatch({
        config,
        url: "/w/01K0000000000",
        headers,
      })
    ).toBe(false);
  });

  it("keeps normal document requests matched", () => {
    expect(
      unstable_doesMiddlewareMatch({
        config,
        url: "/w/01K0000000000",
      })
    ).toBe(true);
  });
});
```

- [ ] **Step 2: RED 확인**

Run:

```bash
pnpm exec vitest run proxy.test.ts
```

Expected: prefetch 두 케이스가 `received true`로 실패하고 일반 문서 케이스는 통과한다.

- [ ] **Step 3: matcher 최소 구현**

`proxy.ts`의 matcher 문자열을 다음 객체로 교체한다.

```ts
export const config = {
  matcher: [
    {
      source:
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|xml|webmanifest)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
```

- [ ] **Step 4: GREEN 및 기존 Proxy 회귀 확인**

Run:

```bash
pnpm exec vitest run proxy.test.ts
```

Expected: matcher 3케이스와 기존 Proxy 오류·쿠키 테스트가 모두 통과한다.

- [ ] **Step 5: 구현 커밋**

```bash
git add proxy.ts proxy.test.ts
git commit -m "[APP-286] Proxy prefetch 갱신 경쟁 차단"
```

### Task 2: 전체 검증과 통합

**Files:**
- Review: `proxy.ts`
- Review: `proxy.test.ts`
- Review: `docs/superpowers/specs/2026-07-29-app-286-refresh-prefetch-design.md`

**Interfaces:**
- Consumes: Task 1의 matcher와 테스트
- Produces: 검증·리뷰를 통과한 `dev` 및 `main`

- [ ] **Step 1: 전체 web 게이트 실행**

Run:

```bash
pnpm test:run && pnpm lint && pnpm typecheck && pnpm build && pnpm test:e2e
```

Expected: Vitest, ESLint, TypeScript, Next production build, Playwright가 모두 exit 0.

- [ ] **Step 2: Codex 리뷰 실행**

Run:

```bash
codex exec review --base dev
```

Expected: P1·P2 지적 없음. 지적이 있으면 수정하고 전체 게이트와 리뷰를 다시 실행한다.

- [ ] **Step 3: `dev`에 squash 병합하고 push**

```bash
git switch dev
git merge --squash feature/app-286-refresh-prefetch
git commit -m "[APP-286] Proxy prefetch 갱신 경쟁 차단"
git push origin dev
```

- [ ] **Step 4: `main`에 fast-forward하고 push**

```bash
git switch main
git merge --ff-only dev
git push origin main
```

- [ ] **Step 5: Linear 완료 처리**

APP-286을 Done으로 옮기고, `dev` squash 커밋 링크와 검증 결과, 남은 범위를 완료 댓글에 기록한다.
