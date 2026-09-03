# 경계와 렌더링

여기에는 **어겼는지 판정할 수 있는 것**만 둡니다. 값의 원본은 코드이므로 어긋나면
코드를 따르고, 이 파일을 고칩니다.

## 서버/클라이언트 경계

- `app/**/page.tsx`는 Server Component로 둡니다. params·redirect·server prefetch·hydration만 합니다.
- 사이드바·툴바·배경 목록처럼 계속 떠 있는 셸은 공용 route `layout.tsx`에 둡니다. 중첩 페이지는 바뀌는 면만 그립니다. **중첩 route를 닫을 때 부모 셸과 목록이 다시 마운트되면 셸을 잘못 얹은 것입니다.**
- 인터랙션은 가장 작은 Client Component 안에 둡니다. hydration 불일치를 가리려고 기능 전체의 SSR을 끄지 않습니다.

## 의존 방향은 한쪽입니다

```
app → feature UI → feature logic → generated API / primitive
```

**`components/ui/`는 제품 의미를 모릅니다** — workspace·notes·transcription을 import하지
않습니다. 어느 폴더가 무엇인지는 [`CLAUDE.md`](../../../CLAUDE.md)의 「어디에 무엇이
있나」가 원본입니다. 여기 옮겨 적지 않습니다.

**같은 API query를 여러 자식이 각각 구독하지 않습니다.** 그럴 이유가 없으면 shell이 한 번
읽고 context나 props로 내립니다.

## 상태의 자리

- 서버 상태는 TanStack Query가 소유합니다. 첫 렌더에 필요한 데이터는 Orval query options + `HydrationBoundary`로 넘깁니다.
- 전역 클라이언트 상태는 route를 넘나드는 lifecycle(인증·녹음)만입니다. 선택 상태와 다이얼로그 상태는 지역에 둡니다.
- 마이크 레벨처럼 고빈도 값을 읽는 곳만 `useRecordingMeter()`를 쓰고, 나머지는 `useRecording()`을 씁니다. 전사 화면이 20Hz로 리렌더되지 않게 하는 분리입니다.
- 영속 전사 segment는 불변입니다. 화면용 묶기는 `lib/transcription/`의 순수 selector에서 합니다.
- **logout은 캐시를 비우지 않고 `/`로 하드 내비게이션합니다.** 세션 게이트가 모듈 상태라 새 문서로만 풀리고, 캐시를 비우면 떠나는 화면이 다시 조회해 오류가 스쳐 지나갑니다. 캐시는 문서와 함께 사라지고 BFCache로 되살아난 문서는 `pageshow`에서 새로 받습니다.
- **노트가 열린 채 project를 고르면 노트를 닫고 목록으로 돌아갑니다.** 노트 표면이 본문 컬럼을 덮어서(full은 항상, side는 모바일에서 `inset-0`) 필터만 바꾸면 화면이 안 움직이는 것처럼 보입니다.

## 실시간은 네 계층으로 자릅니다

WebSocket·SSE·폴링을 쓰는 feature는 같은 네 계층을 반복합니다. **새로 만들 때 층을 합치지
않습니다** — transport가 이벤트 의미를 알면 feature가 늘 때마다 transport를 고치게 되고,
protocol이 React를 알면 파싱을 테스트할 수 없습니다. 지금 전사와 챗 둘이 같은 모양입니다.

| 계층 | 무엇을 아나 | 전사 | 챗 |
|---|---|---|---|
| transport | 연결·프레이밍만. React도 이벤트 의미도 모릅니다 | `lib/transcription/socket.ts` | `lib/api/sse.ts` (공용) |
| protocol | 계약의 zod union. 파싱 실패는 에러입니다 | `lib/transcription/protocol.ts` | `lib/chat/stream-protocol.ts` |
| reducer | 순수 함수. 이벤트 → 화면 상태 | `transcript-reducer.ts` | `use-chat-stream.ts` |
| provider | lifecycle 소유, Query 캐시와 연결 | `recording-provider.tsx` | — |

- **transport는 공용, protocol은 feature별입니다.** SSE-over-POST는 `lib/api/sse.ts`의
  `postEventStream()`을 씁니다 — 네이티브 `EventSource`는 GET 전용이고 orval은 스트리밍
  훅을 생성하지 못합니다. 401 refresh는 transport가, payload 파싱은 feature protocol이 맡습니다.
- **폴링은 TanStack Query가 소유합니다.** `refetchInterval` + `enabled` 게이팅만 씁니다.
  별도 폴링 루프나 폴링 추상화를 만들지 않습니다. (경과 시간 카운터처럼 폴링이 아닌 타이머는
  여기 안 걸립니다.)
- 실시간 이벤트는 화면을 즉시 갱신하고, **확정된 데이터는 invalidate로 서버에 수렴**시킵니다.
  스트림과 폴링이 같은 상태를 이중으로 쓰지 않게 reconcile 지점은 provider 한 곳입니다.
- 스트림이 목록을 늘리는 화면에서 **follow 의도는 새 DOM이 붙기 전에 읽습니다.** 붙은 뒤에
  재면 이미 밀린 위치를 재게 되어 따라가던 사용자가 떨어집니다.

## URL을 쓴다고 다 이동은 아닙니다

**같은 화면 안의 상태를 URL에 쓸 때는 `router.push/replace`를 쓰지 않습니다.**
`window.history.pushState/replaceState`를 씁니다 — Next 16이 라우터와 통합해 두어
`usePathname`·`useSearchParams`가 그대로 갱신되고 RSC 요청은 안 나갑니다.

가르는 기준은 **다른 화면으로 가는가**입니다.

| 무엇 | 무엇으로 | 예 |
|---|---|---|
| 같은 화면의 상태 | `history.replaceState` | 노트 탭, side↔full, 정렬·필터를 URL에 남길 때 |
| 다른 화면으로 이동 | `router.push` / `router.replace` | 노트 열기·닫기, 워크스페이스 전환, 삭제 후 목록 |

`page.tsx`가 `searchParams`를 읽으면 Next는 쿼리 변경을 **진짜 내비게이션으로** 취급합니다.
노트 탭이 그랬습니다 — 누를 때마다 `_rsc=` 왕복이 돌고 서버 prefetch와 쿼리가 다시 나갔으며,
탭 UI는 그 왕복이 끝나야 움직였습니다(102ms → 10ms, 왕복 1건 → 0건).

`page.tsx`에서 `searchParams`를 읽는 것 자체는 괜찮습니다. 첫 렌더·새로고침·딥링크가 그
값을 씁니다. 라우터를 안 거치면 다시 돌지 않습니다.

## Next.js 16

- 미들웨어는 `proxy.ts`입니다. **`middleware.ts`를 만들지 않습니다** — 충돌해서 404 루프가 됩니다.
  (hook `block-forbidden-writes.sh`가 생성을 막습니다.)
- proxy를 고친 뒤 dev 서버가 옛 동작을 보이면 `pnpm dev:clean`으로 `.next`를 지우고 다시 띄웁니다.
  항상 지울 필요는 없습니다 — 실제로 밟았을 때의 회피책이지 절차가 아닙니다.
  **`app/globals.css`의 `@keyframes`를 고쳤는데 옛 애니메이션이 그대로일 때도 같은 자리입니다.**
  같은 파일의 JS는 반영되는데 CSS만 낡아 있어서 코드를 의심하게 됩니다 — dev 서버를 껐다
  켜도 안 풀리고 `.next`를 지워야 풀립니다.

## Hydration

- 서버 HTML과 첫 클라이언트 렌더가 같아야 합니다. 렌더 중 무작위값·브라우저 전용 분기·암묵적 locale/timezone 포맷을 쓰지 않습니다.
- 제품 날짜는 `lib/format/date.ts`를 거칩니다.
- `ssr: false`와 `suppressHydrationWarning`은 최후 수단이고, 브라우저 전용인 이유를 주석으로 남겨야 씁니다.
- **hydration 여부를 이유로 전체 화면을 두 번 렌더링하지 않습니다.** 가릴 자리는 그 경계뿐입니다.

## 제품 UI가 내부를 드러내지 않습니다

폴링 상태·DB/reconciliation 라벨·segment 개수·세션 ID·환경 설정을 제품 화면에 노출하지 않습니다.
`isFetching`을 "저장 중"처럼 다른 뜻으로 번역하는 것도 여기 걸립니다.

디자인 판단의 원본은 [`DESIGN.md`](../../../DESIGN.md)입니다. 형태·타이포 값은 여기 옮기지 않습니다 —
원본은 `app/globals.css`의 `@theme inline`이고 `lib/design-tokens.test.ts`가 존재를 지킵니다.
