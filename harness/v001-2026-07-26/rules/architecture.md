# 경계와 렌더링

전체 근거는 [`docs/frontend-architecture.md`](../../../docs/frontend-architecture.md)입니다.
여기에는 **어겼는지 판정할 수 있는 것**만 둡니다.

## 서버/클라이언트 경계

- `app/**/page.tsx`는 Server Component로 둡니다. params·redirect·server prefetch·hydration만 합니다.
- 사이드바·툴바·배경 목록처럼 계속 떠 있는 셸은 공용 route `layout.tsx`에 둡니다. 중첩 페이지는 바뀌는 면만 그립니다.
- 인터랙션은 가장 작은 Client Component 안에 둡니다. hydration 불일치를 가리려고 기능 전체의 SSR을 끄지 않습니다.

## 상태의 자리

- 서버 상태는 TanStack Query가 소유합니다. 첫 렌더에 필요한 데이터는 Orval query options + `HydrationBoundary`로 넘깁니다.
- 전역 클라이언트 상태는 route를 넘나드는 lifecycle(인증·녹음)만입니다. 선택 상태와 다이얼로그 상태는 지역에 둡니다.
- 마이크 레벨처럼 고빈도 값을 읽는 곳만 `useRecordingMeter()`를 쓰고, 나머지는 `useRecording()`을 씁니다. 전사 화면이 20Hz로 리렌더되지 않게 하는 분리입니다.
- 영속 전사 segment는 불변입니다. 화면용 묶기는 `lib/transcription/`의 순수 selector에서 합니다.

## Next.js 16

- 미들웨어는 `proxy.ts`입니다. **`middleware.ts`를 만들지 않습니다** — 충돌해서 404 루프가 됩니다.
  (hook `block-forbidden-writes.sh`가 생성을 막습니다.)
- proxy를 고친 뒤 dev 서버가 옛 동작을 보이면 `pnpm dev:clean`으로 `.next`를 지우고 다시 띄웁니다.
  항상 지울 필요는 없습니다 — 실제로 밟았을 때의 회피책이지 절차가 아닙니다.

## Hydration

- 서버 HTML과 첫 클라이언트 렌더가 같아야 합니다. 렌더 중 무작위값·브라우저 전용 분기·암묵적 locale/timezone 포맷을 쓰지 않습니다.
- 제품 날짜는 `lib/format/date.ts`를 거칩니다.
- `ssr: false`와 `suppressHydrationWarning`은 최후 수단이고, 브라우저 전용인 이유를 주석으로 남겨야 씁니다.

## 제품 UI가 내부를 드러내지 않습니다

폴링 상태·DB/reconciliation 라벨·segment 개수·세션 ID·환경 설정을 제품 화면에 노출하지 않습니다.
`isFetching`을 "저장 중"처럼 다른 뜻으로 번역하는 것도 여기 걸립니다.

디자인 판단의 원본은 [`DESIGN.md`](../../../DESIGN.md)입니다. 형태·타이포 값은 여기 옮기지 않습니다 —
원본은 `app/globals.css`의 `@theme inline`이고 `lib/design-tokens.test.ts`가 존재를 지킵니다.
