# APP-114 도구 승인 UX 구현 계획

**Goal:** 승인 카드 엣지 상태(open/submitted/invalidated)·300초 문구·관전자 Badge. 승인 상태 기계를 공용 훅으로 추출해 개인·공유가 공유.

**Tech Stack:** React, TanStack Query v5, orval, MSW, vitest.

## Global Constraints

- 204는 확정이 아니다 — 낙관적으로 뒤집지 않는다. 확정은 스트림 `tool_approval_resolved`.
- 종료 오류 = 403 `NOT_APPROVAL_OWNER`·404 `APPROVAL_NOT_FOUND`·409 `MEETING_NOT_ACTIVE`. 그 밖은 재시도 허용.
- 만료(무종료로 pending 소실)도 무효화로 수렴.
- 지속 상태(무효화)는 인라인, 재시도 가능 오류는 토스트(전역 MutationCache).
- 검증: `pnpm test:run && pnpm lint && pnpm typecheck && pnpm build && pnpm test:e2e`.

---

### Task 1: 승인 상태 기계 (`lib/chat/use-tool-approval.ts`)

**Files:** Create `lib/chat/use-tool-approval.ts`, `lib/chat/use-tool-approval.test.ts`.

**Produces:**
```ts
type ApprovalCardState = { kind: "open" } | { kind: "submitted" } | { kind: "invalidated"; reason: string };
useToolApproval({ chatId, pending, streamSettled }): { approve, cardState, isPending };
```

- [ ] 테스트: 초기 open; approve → submitted; 종료 오류 → invalidated+사유; 그 밖 오류 → open; pending 소실+streamSettled → invalidated("만료"); approvalId 바뀌면 open 리셋.
- [ ] 구현: `useResolveToolApproval` 래핑 + 내부 상태(submittedId, invalidation). 사유 문구는 코드로 가른다.
- [ ] `pnpm test:run lib/chat/use-tool-approval` 통과.
- [ ] Commit: `feat(app-114): 승인 상태 기계 훅`.

### Task 2: 승인 카드 세 상태 + 300초 문구 (`chat-thread.tsx`)

**Files:** Modify `components/chat/chat-thread.tsx`, `components/chat/chat-thread.test.tsx`.

- ApprovalPrompt가 `cardState`를 받아: open=버튼2+Badge+300초 문구, submitted=opacity 잠금+확정 대기 줄, invalidated=버튼 제거+muted+사유 Alert.

- [ ] 테스트: 세 상태 각각 렌더(버튼 유무·문구·무효화 Alert). 300초 문구 존재.
- [ ] 구현: ApprovalPrompt 상태 분기. `ChatThread` prop `approvalCardState`.
- [ ] `pnpm test:run components/chat/chat-thread` 통과.
- [ ] Commit: `feat(app-114): 승인 카드 open/submitted/invalidated + 300초 문구`.

### Task 3: 개인 챗봇이 공용 훅을 쓴다

**Files:** Modify `components/chat/personal-chat.tsx`, `components/chat/personal-chat.test.tsx`.

- `submittedApprovalId`·`TERMINAL_APPROVAL_CODES`·`approve`를 `useToolApproval`로 교체. `streamSettled` = phase idle/failed/stalled/aborted. `approvalCardState`를 ChatThread에 전달.

- [ ] 테스트: 기존 승인 테스트 유지(204 잠금·재시도 오류 해제·만료 잠금 유지) + 무효화 카드 노출.
- [ ] `pnpm test:run components/chat/personal-chat` 통과.
- [ ] Commit: `refactor(app-114): 개인 챗봇을 use-tool-approval로`.

### Task 4: 공유 챗봇이 공용 훅 + 관전자 Badge

**Files:** Modify `components/notes/shared-chat-panel.tsx`, `components/notes/shared-chat-panel.test.tsx`.

- 승인 로직을 `useToolApproval`로 교체. 관전자 pending에 "승인 대기" Badge 추가(`jobCE`).

- [ ] 테스트: 기존 유지 + 관전자 Badge 노출 + 무효화 카드.
- [ ] `pnpm test:run components/notes/shared-chat-panel` 통과.
- [ ] Commit: `feat(app-114): 공유 챗봇 use-tool-approval + 관전자 Badge`.

### Task 5: 검증 + e2e

**Files:** 필요 시 `e2e/smoke.spec.ts`.

- [ ] 브라우저 실측: 개인·공유 승인 카드 세 상태(목 승인 흐름).
- [ ] 전체 검증 통과.
- [ ] Commit: `test(app-114): 승인 엣지 상태`.

## Self-Review

- 스펙 커버: 상태 기계(T1)·카드 3상태·300초(T2)·개인 교체(T3)·공유+Badge(T4)·검증(T5).
- 타입 일관: `ApprovalCardState`(T1)를 T2·T3·T4가 소비.
