# 오류와 로딩을 어디에 그리나

실패를 전부 토스트로 밀거나 전부 화면에 그리는 것 둘 다 틀렸습니다. **사라져도 되는가**로 가릅니다.

| 무엇 | 어떻게 | 왜 |
|---|---|---|
| mutation 실패 | 토스트 (자동) | 방금 한 행동의 응답이라 사라져도 됩니다 |
| 지속 상태 — 입력 잠금, 회의 비ACTIVE, 승인 카드 무효화, 권한 없음 | 인라인 `Alert` | 오류가 아니라 "지금 할 수 없음"입니다. 토스트가 사라지면 왜 막혔는지 알 수 없습니다 |
| 주 데이터 실패 — 노트 404, 분석 FAILED, 종료 없이 끊긴 스트림 | error boundary / 빈 상태 + 재시도 | 그릴 것이 없습니다. 토스트만 띄우면 빈 화면이 남습니다 |
| 로딩 | `Skeleton` / Suspense | 기능 크기 단위로. route 전체 spinner 금지 |

skeleton의 기하는 최종 화면에 맞춥니다. 두 가지가 실제로 지뢰였습니다.

- **이미 뜬 부모 화면 위에 시트·모달이 열릴 때 임시 skeleton을 그리지 않습니다.** 부모를 그대로 두고 실제 오버레이만 한 번 진입시킵니다. 안 그러면 같은 자리에서 두 번 애니메이션합니다.
- **진입 애니메이션(`starting:`)은 첫 렌더에서 뺍니다.** `@starting-style`은 DOM에 새로 꽂히는 모든 경우에 돌아서, "옆 화면에서 넘어왔다"와 "이게 이 문서의 첫 페인트다"를 구분하지 못합니다. 그 URL로 새로고침하면 빈 화면을 보다가 면이 뒤늦게 커지며 들어옵니다 — 노트 전체 화면이 그랬습니다(하이드레이션 뒤 567ms). 첫 렌더가 커밋됐는지를 아는 값으로 가릅니다(`note-route-surface`는 이미 있는 `isOpen`을 씁니다).
- **mutation 버튼은 공용 `Button`의 `loading` prop을 씁니다.** label 폭을 보존합니다. 같은 mutation을 시작할 수 있는 형제 컨트롤도 pending 동안 함께 비활성화합니다.
- **상태로 브랜치가 갈리는 버튼은 로딩 자리표시와 확정의 children이 같아야 합니다.** `Button`이 보존하는 것은 *자기가 받은* children의 폭입니다 — 로딩 브랜치에서 아이콘 하나를 빼면 그만큼 튑니다(랜딩 CTA가 146.1 → 168.1px로 22px 튀었습니다). **`min-w-`로 덮지 않습니다.** 실제 폭과 어긋나면 반대로 줄어듭니다(Navbar가 144 → 138.1px였습니다).

둘 다 jsdom으로 px를 못 재니 **children이 같은지**로 검사합니다(`landing-cta.test.tsx` 선례).

**확정되면 사라질 컨트롤이라고 로딩 자리를 없애지 마세요.** `auth-status`가 확인 중에
같은 폭의 「로그인」을 그리고 로그인한 사람에게는 `null`이 되는 것을 시프트로 보고 지웠다가
되돌렸습니다. `AuthProvider`는 SSR이 유저를 찾으면 `initialData`를 채우므로 **로그인한
사람은 `checking`을 아예 안 지납니다** — 그 시프트는 일어나지 않습니다. 반대로 자리를 없애면
쿠키 없는 첫 방문이 「시작하기」만 보이다가 「로그인」이 끼어들어 헤더가 밀립니다.
어느 상태가 실제로 그 분기를 지나는지 먼저 확인하세요.

## 조회 위젯은 `<DataBoundary>`로 감쌉니다

`components/ui/data-boundary.tsx`. suspense 훅(`useGetXSuspense`)을 쓰고, 로딩은 skeleton
fallback, 실패는 `InlineRetry`로 통일합니다.

**예외 기준은 suspense와 맞지 않는 조회입니다** — 폴링(`refetchInterval`), 조건부(`enabled`),
실패를 정상 UI로 다루는 것(404를 빈 상태로 그리는 `note-summary` 등). 이때는 `useQuery`를
유지합니다. 목록이 아니라 기준으로 판정하세요.

## mutation 토스트는 자동입니다

토스트는 base-ui `Toast`이고 표면은 **`lib/ui/toast.ts` 하나**입니다 — 제품 코드는 `sonner`가
아니라 여기서 `toast`를 가져옵니다. 뜨는 자리(우측 상단)와 스택은 `components/ui/toast.tsx`가
정합니다. 우측 하단에는 개인 챗봇 FAB가, 하단 중앙에는 레코더 독이 상주해 그 위를 덮습니다.

`lib/query/query-client.ts`의 `MutationCache.onError`가 모든 실패를 잡습니다. 컴포넌트마다
`onError`를 쓰지 않습니다. **opt-out 없이 자기 `toast.error`를 부르면 두 개가 겹칩니다** —
전역 훅이 호출부의 `catch`보다 먼저 돌기 때문입니다.

건너뛰려면 `mutation: { meta: { suppressErrorToast: true } }`로 opt-out합니다. 이유는 둘뿐입니다 —
**화면이 인라인으로 그리거나**, **호출부가 실패 코드마다 다른 문구를 띄우거나**.

문구는 서버 것을 씁니다. `lib/api/error-message.ts`의 `errorMessageOf()`가 봉투에서 뽑고,
코드로 분기해야 할 때만 `errorCodeOf()`를 씁니다. web이 코드별 문구를 다시 만들면 서버가
바뀔 때마다 갈라집니다.
