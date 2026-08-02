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
- **mutation 버튼은 공용 `Button`의 `loading` prop을 씁니다.** label 폭을 보존합니다. 같은 mutation을 시작할 수 있는 형제 컨트롤도 pending 동안 함께 비활성화합니다.

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
