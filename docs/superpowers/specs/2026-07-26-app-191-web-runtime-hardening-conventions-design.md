# heymoa-web 런타임 견고성 + 컨벤션 정비 설계

**Goal:** heymoa-web의 데이터 로딩·오류 경계를 Suspense + ErrorBoundary로 일원화하고, 흩어진 팀 컨벤션(merge·커밋 이름·Codex 리뷰·hydration·오류/로딩 표시)을 AGENTS.md에 명문화한다.

**한 줄 요약:** 데이터 위젯은 공용 `<DataBoundary>` 하나로 감싸 로딩은 skeleton, 실패는 인라인 재시도로 통일하고, 규칙은 문서에 박제한다.

---

## 1. 배경 · 현황 (실측)

- `error.tsx`·`global-error.tsx`·`not-found.tsx`(route 레벨)는 이미 있고 품질도 좋다. 없는 것은 **컴포넌트/데이터 경계**의 Suspense·ErrorBoundary다.
- `useSuspenseQuery`·`QueryErrorResetBoundary`·`ErrorBoundary` 미사용. Orval 생성 훅은 `useQuery` 기반(`useGetNote` 등)이고, **약 20개 컴포넌트**가 이 쿼리 훅을 호출한다.
- skeleton 인프라(`components/ui/skeleton.tsx`, `workspace-route-skeleton.tsx`)는 있으나 적용이 들쭉날쭉하다. 예: `app/w/[workspaceId]/loading.tsx`가 `return null`.
- `sonner`(토스트)는 이미 사용 중. `query-client.ts`가 mutation 실패를 기본 토스트로 처리하고 `meta.suppressErrorToast`로 인라인 전환하는 규칙이 정립돼 있다.
- hydration 억압 안티패턴(`suppressHydrationWarning`, `ssr:false`) 없음 — hydration은 버그 수정이 아니라 **예방 가이드라인** 대상.
- `HydrationBoundary` + 서버 프리페치 패턴은 `app/w/[workspaceId]/layout.tsx`, `notes/[noteId]/page.tsx` 2곳에서 이미 사용.
- **AGENTS.md 오기**: "dev→main도 squash"라 적혀 있으나 확정 방침은 dev→main **rebase(ff)**.

## 2. 스코프

**In (heymoa-web repo 안):**

- 데이터 경계 전면 전환: Orval suspense 훅 재생성 + 공용 `<DataBoundary>` + 약 20개 컴포넌트 전환.
- 로딩 표준화(skeleton 우선 / spinner 인라인), 빈 `loading.tsx` 보강.
- AGENTS.md 컨벤션 명문화: merge 방식, 커밋 이름, Codex 리뷰 게이트, hydration 안전 규칙, 오류·로딩 경계 규칙.

**Out (이 이슈 밖):**

- heymoa-server 모듈 분리 (별 repo, 별 이슈).
- Linear 이슈 템플릿, GitHub PR/이슈 템플릿 (web은 GitHub PR·이슈를 쓰지 않음 — 미사용 방침만 AGENTS.md에 유지).
- mutation 실패 처리 방식 변경 (기존 토스트 정책 유지).

## 3. 검증된 통합 패턴 (근거)

TanStack Query v5 공식 Suspense 가이드가 `react-error-boundary`를 그대로 예제로 쓴다. Orval은 `override.query.useSuspenseQuery`로 suspense 변형 훅을 기존 `useQuery`와 **함께** 생성한다.

```tsx
// TanStack Query 공식 패턴 — DataBoundary 의 뼈대
import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";

<QueryErrorResetBoundary>
  {({ reset }) => (
    <ErrorBoundary
      onReset={reset}
      fallbackRender={({ resetErrorBoundary }) => (
        <InlineRetry onRetry={resetErrorBoundary} />
      )}
    >
      <Suspense fallback={skeleton}>{children}</Suspense>
    </ErrorBoundary>
  )}
</QueryErrorResetBoundary>;
```

## 4. 축 1 — 데이터 견고성 (코드)

### 4.1 의존성

- `react-error-boundary` 추가 (react-query 공식 경로). react-query v5의 `QueryErrorResetBoundary`는 내장.

### 4.2 Orval 재생성

`orval.config.ts`의 `output.override.query`를 추가한다:

```ts
override: {
  query: { useQuery: true, useSuspenseQuery: true, useMutation: true, usePrefetch: true },
  mutator: { path: "./lib/api/fetcher.ts", name: "apiFetch" }, // 기존 유지
}
```

- `useQuery`(유지) + `useSuspenseQuery`(신규) + `usePrefetch`(신규 — 서버 프리페치+HydrationBoundary 확장용).
- `pnpm orval` 후 `lib/api/generated` diff를 리뷰. mutation 훅·mock 생성은 그대로.

### 4.3 공용 `<DataBoundary>`

- 위치: `components/ui/data-boundary.tsx`.
- 책임: §3 패턴 캡슐화. props: `fallback`(skeleton 노드), 선택 `errorFallback`(기본 = 공용 `InlineRetry`).
- `InlineRetry`(`components/ui/inline-retry.tsx`): 실패 문구 + "다시 시도" 버튼. DESIGN.md 제품 면 규칙(각짐·hairline·shadow-e 계층) 준수.
- 규칙: **주 데이터 실패는 인라인(DataBoundary), mutation 실패는 토스트** — `query-client.ts` 주석의 기존 경계와 일치.

### 4.4 약 20개 컴포넌트 전환

- 각 컴포넌트의 `useGetX` → `useGetXSuspense`로 바꾸고, 데이터 위젯을 `<DataBoundary fallback={<XSkeleton/>}>`로 감싼다.
- skeleton은 위젯 모양에 맞춰 재사용 컴포넌트로. 기존 `workspace-route-skeleton` 계열 활용.
- 전환 목록(정확한 파일·훅 매핑)은 plan에서 확정. 대상 파일군: `components/notes/*`, `components/workspace/*`, `components/settings/*`, `components/chat/*`, `components/notification/*`, `components/transcription/*`, `components/auth/auth-provider.tsx`.
- **경계 배치 원칙:** 페이지 셸(사이드바·툴바 등 chrome)은 layout에서 프리페치+HydrationBoundary로 즉시 렌더, 개별 데이터 위젯만 DataBoundary로 감싼다. 셸 전체를 하나의 Suspense로 묶어 화면이 통째로 비지 않게 한다.

### 4.5 로딩 표준

- **skeleton 우선:** 페이지·리스트·데이터 위젯 로딩.
- **spinner 인라인:** 버튼·mutation 진행 등 짧은 액션.
- 빈 `loading.tsx`(`app/w/[workspaceId]/loading.tsx` 등)를 해당 화면 skeleton으로 채운다.

## 5. 축 2 — 컨벤션 (AGENTS.md)

- **Merge:** feature→dev는 로컬 squash merge 후 push. **dev→main은 로컬 rebase merge(fast-forward, 커밋 보존) 후 push.** GitHub PR·이슈 없음. (현재 "dev→main squash" 문구를 rebase로 정정)
- **커밋 제목:** `[APP-N] 제목`. `feat(app-N):`·`feat:` 등 conventional prefix 금지. 이슈 없는 잡일만 `chore:`/`docs:` bare 허용.
- **Codex 리뷰:** push 전 로컬 `codex exec review --base dev --title "..."`가 게이트. 원격 `@codex review`(GitHub 봇)는 요청·반영하지 않는다.
- **Hydration 안전 규칙:** SSR을 기능 단위로 통째 끄지 않는다. 시간·랜덤·`typeof window` 결과를 첫 렌더에 직접 그리지 않는다. `mounted` 가드는 최후수단이며 최소화한다. 불일치는 숨기지 말고 원인을 고친다.
- **오류·로딩 경계 규칙:** 데이터 위젯은 `<DataBoundary>`로 감싼다(로딩=skeleton, 실패=인라인 재시도). mutation 실패=토스트(`query-client.ts` 규칙). skeleton vs spinner 기준(§4.5) 명시.

## 6. 검증

- 게이트: `pnpm test:run && pnpm lint && pnpm format:check && pnpm build`.
- 테스트: 전환 위젯 대표 케이스에 대해 (a) 로딩 시 skeleton 렌더, (b) 쿼리 실패 시 InlineRetry 렌더 + "다시 시도"가 `resetErrorBoundary`로 재요청, 를 MSW 목으로 검증.
- 기존 402개 테스트 무회귀.

## 7. 산출 형태

- **Linear 단일 이슈**(heymoa-web 라벨) + 체크리스트: ① 의존성/Orval 재생성 ② DataBoundary/InlineRetry ③ 컴포넌트 전환(위젯군별로 쪼갬) ④ 로딩 표준·loading.tsx ⑤ AGENTS.md 컨벤션.
- 브랜치 `feature/*` → dev 로컬 squash merge. 커밋/이슈 제목 `[APP-N]`.

## 8. 리스크 · 미결

- **전환 규모(약 20개):** 위젯군별로 커밋을 쪼개 리뷰 가능한 단위로 유지. 셸 vs 위젯 경계 판단이 컴포넌트마다 다를 수 있어 plan에서 파일별로 확정한다.
- **Suspense 폭포(waterfall):** 서로 의존 없는 위젯이 순차 로딩되지 않도록, 병렬 데이터는 형제 DataBoundary로 나누고 공통 데이터는 상위 프리페치로 끌어올린다.
- **usePrefetch 도입 범위:** 이미 프리페치하는 2곳 외 확장은 화면 체감에 맞춰 선택 적용(전면 강제 아님) — plan에서 대상 지정.
