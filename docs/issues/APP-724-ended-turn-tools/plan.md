# APP-724 끝난 턴의 도구·승인 표시 — 구현 순서

- 이슈: [APP-724](https://linear.app/minswon/issue/APP-724)
- spec: docs `docs/app-724/ended-turn-tools:projects/_미분류/APP-724/spec.md` @ `2fbb80e`
- 프로젝트 브랜치: 없음
- APP 브랜치: `fix/app-724/ended-turn-tools` ← `origin/dev` (로컬 전용, push 하지 않는다)
- 병합: 로컬 squash 로 dev 에 넣는 것은 이번 범위 밖(사용자가 정한다)
- 검증: `pnpm test:run && pnpm verify`

## spec 검토 결과

| 관점 | 물은 것 | 답 |
|---|---|---|
| 계약 | 우리가 발행한 약속과 어긋나나 | 어긋나지 않는다. `unknown`·`stopped` 는 `Block` 의 화면 값이고 `lib/api/generated` 의 `toolEvent.status`(`success`·`error`)는 안 건드린다. 히스토리 행의 `turnId` 는 생성 모델 `AgentChatMessagesResponseDataMessagesItem` 에 이미 있다 |
| 실측 | 근거로 댄 숫자가 실제로 잰 것인가 | 수치 근거는 없다. 현상은 코드로 확인했다 — `chain-of-thought.tsx` 의 `Dot` 이 `status === null` 이면 `live` 와 무관하게 `Loader2 animate-spin`, `use-tool-approval.ts` 가 `pending` 소실 + 비정상 종료면 `ENDED_REASON` |
| 경계 | 영향받는 호출자·테스트 더블 | `ChatThread` 호출자는 `personal-chat.tsx` 하나와 `chat-thread.test.tsx`. `groupHistory`·`StreamBlocks` 는 파일 안 함수. `useToolApproval` 호출자는 `personal-chat.tsx` 하나. `ChainOfThought` 는 `chat-thread.tsx` 에서만 쓴다 |
| 되돌리기 | 복구 비용 | 데이터 변경 없음. 커밋 revert 로 끝난다 |
| 사람에게 물은 것 | 열린 질문 | spec 에 열린 질문 없음 |

## 건드리는 것

| 파일 | 지금 무엇인가 | 무엇으로 바뀌나 |
|---|---|---|
| `lib/chat/blocks.ts` | 도구 `status` 는 `success`·`error`·`null` | `stopped`·`unknown` 추가, 끝난 턴을 닫는 `settleEndedTurn` |
| `components/chat/chain-of-thought.tsx` | `status` 없으면 도는 점 | `stopped`「중단됨」·`unknown`「확인 필요」, 정지 점 |
| `components/chat/chat-thread.tsx` | `StreamBlocks` 는 블록 그대로, `groupHistory` 는 짝·턴 정보 없음 | 끝난 phase 면 `settleEndedTurn`, 히스토리 묶음에 `turnId`·승인-결과 짝, `activeTurnId` prop |
| `components/chat/personal-chat.tsx` | 승인 `202` 뒤 블록 그대로 재접속 | 재접속 시작 상태에 결정 기록, `activeTurnId` 전달 |
| `lib/chat/use-tool-approval.ts` | 비정상 종료면 한 가지 사유 | 승인을 보낸 카드는 「확인 필요」, 아니면 「중단됨」 |

## 순서

시험 먼저 쓰고 빨간 것을 본 뒤 구현한다. 한 커밋에 시험과 구현을 함께 싣는다.

### 1. 끝난 턴 블록 규칙과 도구 줄 표시

- 바꾸는 것: `blocks.test.ts`·`chain-of-thought.test.tsx`·`chat-thread.test.tsx` 에 기대 동작 → `blocks.ts`·`chain-of-thought.tsx`·`chat-thread.tsx`·`personal-chat.tsx`(`activeTurnId`)
- 검증: `pnpm vitest run lib/chat/blocks.test.ts components/chat/chain-of-thought.test.tsx components/chat/chat-thread.test.tsx`
- 되돌리기: 이 커밋 revert

### 2. 승인 202 뒤 끝난 카드

- 바꾸는 것: `use-tool-approval.test.ts` 에 기대 동작 → `use-tool-approval.ts`, `personal-chat.tsx` 의 `resolveApproval`
- 검증: `pnpm vitest run lib/chat/use-tool-approval.test.ts components/chat/personal-chat.test.tsx`
- 되돌리기: 이 커밋 revert

## 마지막 관문

두 단계가 끝난 뒤 `pnpm test:run && pnpm verify` 를 한 번 통째로 돌린다. CI 가 없어 이것이 유일한 관문이다.

## 안 하는 것

- 승인 대기 탭이 server 쪽 종료를 누르기 전에 알아채는 것(spec 범위 밖)
- 결과 없는 조회 줄을 히스토리에 세우는 것(server 저장·계약 변경)
