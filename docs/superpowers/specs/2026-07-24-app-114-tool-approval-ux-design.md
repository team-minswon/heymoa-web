# APP-114 도구 승인 UX 설계

**목표:** 승인 카드의 **엣지 상태**를 계약대로 그린다 — 204 확정 대기(`pysh5`), 만료 무효화(`WKrCG`), 409 회의 종료 무효화(`d9IWR`), 300초 상한 문구, 관전자 pending Badge(`jobCE`). 개인·공유 챗봇 공용.

**이미 된 것(APP-113/112):** 승인/거절 버튼·`useResolveToolApproval` 호출·`submittedApprovalId` 잠금(`personal-chat`·`shared-chat`), 승인 기록 vs 실행 기록 분리(`chat-thread` `ImOW0`), 도구 실패 후 스트림 계속(`YBXm4`), 관전자 "승인 대기 중" 기본 문구(APP-112). **성공 기준 3개(승인→실행→렌더·거절 기록·관전자 대기)는 충족돼 있다.** APP-114는 그 위의 엣지 상태다.

**범위 밖:** `d9IWR`의 앱바·녹음 독 종료 상태(회의 조작권은 APP-111). APP-114는 그 409에서 **승인 카드 무효화**만 한다.

**입력:** `docs/design-decisions.md` 도구 승인 행(y=28000: `eP8jX` `jobCE` `pysh5` `ImOW0` `WKrCG` `d9IWR` `YBXm4`), 승인 API 계약(403 `NOT_APPROVAL_OWNER`·404 `APPROVAL_NOT_FOUND`·409 `MEETING_NOT_ACTIVE`·400), `agent-chat-flow.md` 1.5장.

## 자문자답으로 잡은 것

### 승인 상태 기계를 공용 훅으로 뺀다

`personal-chat`·`shared-chat`이 `submittedApprovalId` + `TERMINAL_APPROVAL_CODES` + `approve` 콜백을 **각자 복제**하고 있다. APP-114가 여기에 무효화 상태를 더하면 복제가 두 배가 된다. **`lib/chat/use-tool-approval.ts`로 추출**해 둘이 같은 상태 기계를 쓴다.

카드의 상태는 셋이다.

| 상태 | 언제 | 화면 | 프레임 |
|---|---|---|---|
| `open` | `pendingApproval` 있고 미제출 | 버튼 2 + "쓰기 도구" Badge + **300초 상한 문구** | `eP8jX` |
| `submitted` | 204 접수, 아직 `tool_approval_resolved` 전 | 버튼 `opacity 0.4` 잠금 + "확정 대기 중" 줄 | `pysh5` |
| `invalidated` | 종료 오류(403/404/409) 또는 만료 | 버튼 제거, 도구·대상 muted, 무효화 사유 `Alert` | `WKrCG`·`d9IWR` |

확정(`resolved`)은 스트림이 하므로 리듀서가 `pendingApproval`을 지우면 카드가 사라지고 기록(`ImOW0`)이 남는다 — 그건 이미 된다.

### 204는 확정이 아니다 — 낙관적으로 뒤집지 않는다 (`pysh5`)

이미 `submittedApprovalId`로 버튼을 잠그지만, **"제출됐고 확정을 기다린다"가 화면에 없다.** 계약이 "204는 중계했다는 뜻이지 확정이 아니다"라고 못 박는다. 버튼을 `opacity 0.4`로 잠그고 "확정은 응답이 재개되면 반영됩니다" 한 줄을 둔다. 낙관적으로 승인/거절 결과를 미리 그리지 않는다.

### 무효화는 두 입구가 한 화면으로 수렴한다 (`WKrCG`)

카드가 죽는 길은 둘이다.

1. **종료 오류**: 승인 API가 404 `APPROVAL_NOT_FOUND`(만료)·403 `NOT_APPROVAL_OWNER`·409 `MEETING_NOT_ACTIVE`를 준다. (APP-113의 `TERMINAL_APPROVAL_CODES`가 이미 이 셋을 "다시 눌러도 소용없다"로 알지만 화면이 없었다.)
2. **만료(응답 없음)**: 300초를 넘겨 스트림이 끊긴다. 리듀서가 `error`·무종료로 `pendingApproval`을 지운다 — 그래서 훅이 **직전 승인을 기억**해 무효화 카드를 그려야 한다.

둘 다 **버튼을 지우고 muted 카드 + 사유 `Alert`**로 수렴한다. 사유 문구는 코드로 가른다(만료/권한/회의 종료). 계약상 만료는 REJECTED로 처리되고 스트림은 정상 종료되므로 컴포저는 다시 열린다 — 그건 스트림 상태(`idle`/`failed`)가 이미 만든다.

### 409 `MEETING_NOT_ACTIVE`는 무효화의 한 사유일 뿐 (`d9IWR`)

디자인은 이 409에서 앱바·녹음 독까지 종료 상태로 내리지만, **회의 조작권 UI는 APP-111 소관**이다. APP-114는 이 409를 `invalidated`의 한 사유("회의가 종료되어 승인할 수 없습니다")로만 다룬다. 회의 종료는 노트 폴링(APP-112)이 곧 `phase=ended`로 반영해 앱바를 정리한다.

### 관전자 pending에 Badge를 붙인다 (`jobCE`)

APP-112가 관전자 "OO님이 승인 대기 중 · {summary}"를 이미 그린다. `jobCE`는 여기에 **"승인 대기" Badge**를 요구한다(Alert + Badge). 도구 이름이 요약과 함께 드러나게 Badge를 더한다. 관전자에겐 버튼이 없다 — 403은 최후 방어선이라 화면 근거가 아니다(APP-113 유지).

### 300초 문구는 카드에 상수로 둔다

"응답이 없으면 5분 뒤 자동으로 거절 처리됩니다". `eP8jX`가 요구한다. 상한 300초는 계약값이라 카드에 문구로만 둔다(타이머를 화면에서 돌리지 않는다 — 스트림 생존이 상한을 관리하고, web은 무종료/오류로 결말만 받는다).

## 구조

```
lib/chat/use-tool-approval.ts        (신규) 승인 상태 기계 — open/submitted/invalidated. 개인·공유 공용
lib/chat/use-tool-approval.test.ts   (신규) 상태 전이 단위
components/chat/chat-thread.tsx       (수정) ApprovalPrompt에 상태(open/submitted/invalidated) + 300초 문구
components/chat/personal-chat.tsx     (수정) use-tool-approval로 교체
components/notes/shared-chat-panel.tsx (수정) use-tool-approval로 교체 + 관전자 Badge
```

### `use-tool-approval` 인터페이스

```ts
type ApprovalCardState =
  | { kind: "open" }
  | { kind: "submitted" }
  | { kind: "invalidated"; reason: string };

useToolApproval(input: {
  chatId: string | null;
  pending: { approvalId: string; tool: string; summary: string | null } | null;
  streamSettled: boolean;   // 스트림이 idle/failed/stalled/aborted로 끝났는가
}): {
  approve: (decision: ApprovalDecision) => void;
  cardState: ApprovalCardState;
  isPending: boolean;
};
```

- `approve` → `submitted`로. 204(성공)는 아무것도 안 뒤집는다(스트림이 확정).
- 종료 오류(403/404/409) → `invalidated` + 사유. 그 밖 오류 → `open`으로 되돌려 재시도 허용(APP-113 규칙 유지).
- `pending`이 있었는데 `streamSettled && pending===null`(리듀서가 지움) → `invalidated`("만료").
- `pending`의 `approvalId`가 바뀌면 상태를 새로 연다(다음 턴의 새 승인).

## 오류 표시 — AGENTS.md 경계

| 무엇 | 어떻게 |
|---|---|
| 종료 오류·만료(지속 상태) | 카드 내부 인라인 무효화 `Alert` — 사라지면 왜 못 누르는지 모른다 |
| 그 밖 승인 실패(재시도 가능) | sonner 토스트(전역) + 카드 `open` 복귀 |
| 403 관전자 도달 | 토스트(버튼이 없어 정상 흐름엔 도달 불가) |

## 성공 기준

- 승인 카드가 open/submitted/invalidated 세 상태를 그린다 (`eP8jX`/`pysh5`/`WKrCG`)
- 204 뒤 버튼이 잠기고 확정 대기 문구가 뜨며, 스트림 `tool_approval_resolved` 전엔 결과를 낙관적으로 뒤집지 않는다
- 404/403/409는 카드를 무효화하고 사유를 보인다; 그 밖 오류는 카드를 열어 재시도 허용
- 만료(무종료로 pending 소실)면 무효화 카드("만료")가 남고 컴포저가 다시 열린다
- 관전자 pending에 "승인 대기" Badge + 도구·요약이 보인다 (`jobCE`)
- 승인 카드에 300초 상한 문구 (`eP8jX`)
- 개인·공유 챗봇이 같은 `use-tool-approval`을 쓴다
- vitest: 상태 기계 단위 + 개인·공유 통합. 기존 승인 테스트 유지

## 리뷰 게이트

로컬 `codex exec review --base dev` 한 번. 판단은 `docs/codex-review-app-114.md`에 남긴다.
