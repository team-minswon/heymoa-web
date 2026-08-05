# 이동과 탭 전환이 기다린 뒤에 일어나는 문제

> 이슈 번호가 없습니다. 사용자가 Linear 이슈 없이 `refactor/` 브랜치 하나로 가기로 정했고,
> 커밋은 `refactor:` bare 커밋입니다. rule [`issue-tracking`](../../../harness/v001-2026-07-26/rules/issue-tracking.md)의
> 번호 규칙에 대한 이번 한 번의 예외입니다.

## 무엇이 문제인가

링크를 누르거나 탭을 눌러도 화면이 바로 안 움직입니다. 응답이 올 때까지 이전 화면에
머물다가 한 번에 바뀝니다. 누른 사람 입장에서는 클릭이 먹었는지 알 수 없습니다.

버튼도 같은 성질입니다. 로딩 스피너가 뜨는 순간 폭이 달라져 옆 요소가 밀립니다.

## 실측

prod 빌드(`pnpm build && pnpm start`) · localhost · MSW 기준입니다. 실서버 RTT가 붙으면
더 나빠지는 값입니다.

| 동작 | 클릭 → 커밋 | 첫 피드백 | 판정 |
|---|---|---|---|
| 목록 → 노트 열기 | 402ms | **3ms** — 행 아이콘이 스피너로 | 이미 됩니다 |
| 워크스페이스 전환 | 51ms | **54ms** — `app/w/loading.tsx` 스켈레톤 | 이미 됩니다 |
| 노트 탭 전환 | 100~140ms + `_rsc=` 왕복 **매번** | **없음** | 여기가 문제입니다 |

**이동은 이미 즉시 반응합니다.** 노트 행은 `useLinkStatus`로 3ms 만에 스피너를 켜고,
워크스페이스 전환은 `app/w/loading.tsx`가 54ms에 스켈레톤을 세웁니다. 처음에 이동 전반이
무반응이라고 봤지만 실측이 반증했습니다.

남은 것은 탭 하나입니다. 누를 때마다 나가는 요청이고, 그동안 화면에는 아무 표시가 없습니다.

```
GET /w/{ws}/notes/{note}?view=side&tab=transcript&_rsc=...   200
GET /v1/notes/{note}/transcript                              200
GET /v1/notes/{note}/chat/messages                           200
```

버튼 폭:

| 지점 | 로딩 | 확정 | 차이 |
|---|---|---|---|
| `landing-cta` 대시보드 CTA | 146.1px | 168.1px | **+22px** |
| `Navbar` 대시보드 | 144px | 138.1px | **−5.9px** |

## 왜 그런가

**탭.** `note-view.tsx`가 탭 상태를 URL에 `router.replace`로 씁니다. `page.tsx`는
`searchParams`를 읽는 async Server Component라 Next가 이걸 진짜 내비게이션으로 취급합니다 —
RSC 페이로드를 받아야 커밋되고, `prefetchNoteRoute`가 다시 돌고, 노트·전사·챗 쿼리가 다시
나갑니다. 탭 UI는 URL을 단일 출처로 쓰므로 그 왕복이 끝날 때까지 안 움직입니다.

**버튼.** 공용 `Button`은 이미 라벨을 `opacity-0`으로 남기고 스피너를 absolute로 얹어 폭을
보존합니다. 문제는 호출부입니다. 로딩 자리표시 버튼과 확정 버튼의 children이 서로 다릅니다 —
`landing-cta`는 로딩 브랜치에만 `ArrowRight`가 없고, `Navbar`는 `min-w-24 sm:min-w-36`으로
덮어 두었는데 그 값이 실제 확정 폭보다 큽니다.

## 어떻게 고치나

### 1. 탭은 라우터를 안 탄다

`note-view.tsx`의 `router.replace` 두 곳을 `window.history.replaceState`로 바꿉니다.
Next 16이 공식 지원하고 `useSearchParams`가 그대로 동기화됩니다
(`node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md`의
「Native History API」). RSC 요청이 아예 안 나갑니다.

- 로컬 state를 새로 만들지 않습니다. URL이 계속 단일 출처이고, 갱신 경로만 바뀝니다.
- `page.tsx`의 `searchParams`는 남깁니다. 새로고침과 딥링크의 첫 렌더에만 쓰이고, 라우터를
  안 거치므로 탭 전환으로는 재실행되지 않습니다.
- 히스토리 의미는 그대로입니다. `router.replace`도 `replaceState`도 뒤로가기 항목을 안 만듭니다.

### 2. 이동은 안 건드린다

처음에는 `app/w/[workspaceId]/notes/[noteId]/loading.tsx`를 추가할 계획이었습니다.
**실측하고 접었습니다.**

- 노트 행이 `useLinkStatus`로 3ms에 스피너를 켭니다. 피드백이 이미 있습니다.
- `workspace-route-skeleton.tsx`가 노트 라우트 fallback을 왜 안 두는지 이미 적어 두었습니다 —
  `loading.tsx`는 `searchParams`를 못 받아 side(시트)와 full(전체 면)을 구분할 수 없고,
  기본 경로인 side 진입에서 full 화면을 덮었다가 시트로 바뀝니다.
- 시트 안에 임시 skeleton을 그리는 대안은 rule `error-loading`이 이미 금지합니다 —
  같은 자리에서 두 번 애니메이션합니다.

워크스페이스 전환은 `app/w/loading.tsx`가 54ms에 걸립니다. 노트 **닫기**의 200ms는 의도된
퇴장 애니메이션입니다. 셋 다 그대로 둡니다.

### 3. 버튼은 로딩과 확정의 모양을 맞춘다

- `landing-cta`: 로딩 브랜치에 `ArrowRight`를 넣어 확정 브랜치와 같게 합니다.
- `Navbar`: `min-w-24 sm:min-w-36`을 지우고 로딩 브랜치 children을 확정 브랜치와 같은
  반응형 span 두 벌로 맞춥니다.
- 공용 `Button`은 안 건드립니다. 폭 보존은 이미 되어 있고, 폭을 재서 고정하는 로직을 넣으면
  호출부의 실수를 코드로 덮는 셈입니다.

`다시 시도` 브랜치는 라벨이 달라도 둡니다 — 로딩이 아니라 실패라는 다른 상태입니다.

### 4. full 진입 애니메이션을 새로고침에서 뺀다

`?view=full`로 새로고침하면 노트 면이 하이드레이션 뒤에야 붙어서, 빈 화면을 보다가 노트가
뒤늦게 확대되며 들어옵니다(실측 567ms 지점에서 opacity·scale 트랜지션 시작).

`note-route-surface.tsx`의 `starting:scale-[0.98] starting:opacity-0`이 원인입니다. 코드
주석은 side→full 전환용이라고 적어 두었지만 `@starting-style`은 **DOM에 새로 꽂히는 모든
경우**에 돕니다 — 브라우저는 "side에서 넘어왔다"와 "이게 첫 페인트다"를 구분하지 못합니다.

이미 있는 `isOpen`으로 가릅니다. 첫 렌더가 커밋된 뒤에 켜지므로 새로고침 진입에는 마운트
시점에 꺼져 있고, side→full 전환에는 이미 켜져 있습니다. 새 상태를 만들지 않습니다.

### 5. 재발을 잡는 검사

- e2e 하나 — 노트 탭을 눌렀을 때 `_rsc=` 요청이 0건이고 탭이 바뀌는지. jsdom에는 RSC 요청
  자체가 없어 실제 라우터가 필요합니다.
- vitest 하나 — 로딩 자리표시와 확정 버튼의 children이 같은지. jsdom에는 레이아웃이 없어
  px를 못 잽니다.

## 안 하는 것

- **노트 라우트 `loading.tsx`** — 위 2번의 이유입니다.
- `<Link prefetch>` 확대 — 목록에 노트가 11개면 11번 미리 받습니다. 행 스피너로 충분합니다.
- `useTransition` 도입 — 탭이 라우터를 안 타면 기다릴 것이 없습니다.
- `Button`에 폭 잠금 로직 추가 — 호출부의 실수를 측정 로직으로 덮는 셈입니다.
- `workspace-app-shell`의 OAuth 쿼리 정리용 `router.replace` — 1회성이고 사용자 조작이 아닙니다.
- `다시 시도` 브랜치의 라벨 통일 — 로딩이 아니라 실패라는 다른 상태입니다.
- **`auth-status`의 확인 중 자리표시 제거** — 한 번 지웠다가 codex 리뷰에서 되돌렸습니다.
  `AuthProvider`는 SSR이 유저를 찾으면 `initialData`를 채우므로 로그인한 사람은 `checking`을
  지나지 않습니다. 걱정한 시프트는 일어나지 않고, 자리를 없애면 쿠키 없는 첫 방문이
  「시작하기」만 보이다가 「로그인」이 끼어들어 오히려 헤더가 밀립니다.

## 결과

같은 조건(prod 빌드 · localhost · MSW)에서 다시 잰 값입니다.

| 무엇 | 전 | 후 |
|---|---|---|
| 탭 클릭 → URL·탭 반영 | 102ms | **10~11ms** |
| 탭 클릭당 `_rsc=` 요청 | 1건 | **0건** |
| 랜딩 CTA 로딩 → 확정 폭 | 146.1 → 168.1px | **168.1 → 168.1px** |
| Navbar 대시보드 로딩 → 확정 폭 | 144 → 138.1px | **138.1 → 138.1px** |
| `?view=full` 새로고침 시 면 트랜지션 | opacity·scale (567ms) | **없음** |
| side→full 전환 시 면 트랜지션 | opacity·scale | **그대로** |

**측정 함정 하나.** 탭을 짧은 간격으로 연달아 누르며 재면 전·후 모두 ~1000ms로 나옵니다.
라우터가 아니라 반복 클릭 쪽 스케줄링이 만드는 값이라 개선이 안 보입니다. 한 번 누르고
한 번 재야 합니다.

## 검증

`pnpm test:run && pnpm lint && pnpm typecheck && pnpm build && pnpm test:e2e` 전부와
`codex exec review`. 그 뒤 `dev` squash → `main` rebase.

새 검사 둘은 **고치기 전 코드에서 실제로 실패하는 것을 확인**했습니다.

- e2e `switches note tabs without an RSC round trip` — jsdom에는 RSC 요청 자체가 없어 e2e입니다.
- vitest `로딩 자리표시와 확정 버튼의 내용이 같다` — jsdom에는 레이아웃이 없어 px 대신
  children을 비교합니다. 폭을 재는 e2e도 써 봤지만 **MSW가 서비스 워커라 Playwright의
  `page.route`로 응답을 붙잡지 못해** 로딩 상태를 재현할 수 없었습니다. 버렸습니다.
