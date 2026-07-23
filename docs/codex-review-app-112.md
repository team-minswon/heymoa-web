# APP-112 codex 게이트 기록

`codex exec review --base dev`. 지적은 전부 실재해 전부 반영했다.

## R1 — 3건 P2

### 1. forceVisible가 노트를 떠나도 안 풀린다 (personal-chat.tsx)

PAUSED에서 개인 챗봇을 force-open한 뒤 다른 활성 노트로 이동하면, `forceVisible`가
`close()`로만 풀려 남아 있어 그 노트의 `hidden`을 무시하고 공유 트레이 위에 개인 패널이
겹친다. spec의 "감춤을 이긴다"를 **현재 노트 맥락에 한정**해야 했다.

**반영:** `setNoteScope`에서 들어오는 noteId가 직전과 다르면(=탐색) `forceVisible`를 접는다.
같은 노트에서의 재등록(full↔전환·리렌더)에는 유지되어 force-open이 즉시 닫히지 않는다.

### 2. 공유 챗 히스토리 실패가 입력을 연다 (shared-chat-panel.tsx)

히스토리 GET가 실패/비성공이면 빈 메시지+잠금 없음으로 접혀 `canSend`가 참으로 남는다 —
잠금·대화 상태를 모른 채 전송을 허용한다. APP-113 개인 챗봇과 같은 계열(주 데이터 실패는
빈 상태가 아니다).

**반영:** `isUnavailable`(에러/비성공)을 도입해 인라인 오류+재시도를 그리고 컴포저를 잠근다.

### 3. 아카이브 로드 실패가 빈 아카이브로 보인다 (note-archive.tsx)

ENDED에서 전사 실패를 `[]`로 접어 "전사된 대화가 없습니다"를 거짓으로 띄운다. 게다가 이 뷰가
`TranscriptView`를 대체하므로 원래의 실패/재시도 경로가 사라진다.

**반영:** 전사 쿼리 에러를 보존해 오류+재시도 상태를 그린다. 공유 Q&A는 조회가 성공하고
메시지가 있을 때만 섹션을 그린다(실패를 "없음"으로 위장하지 않는다).

## R2 — 3건 P2

### 1. 다중 멤버 회의 상태가 stale (note-panel.tsx)

다른 멤버가 시작·중지·재개·종료해도 `useGetNote`에 폴링·무효화 경로가 없어 `phase`가
영원히 낡는다 — 관전자가 중지 후에도 활성 컴포저를 보고 계속 `MEETING_NOT_ACTIVE`를 받는다.

**반영:** `meetingRefetchInterval`(순수 함수, 테스트됨)로 종료 전까지 5초 폴링, 종료되면 멈춘다.

### 2. 실패한 턴의 유저 메시지가 두 벌 (shared-chat-panel.tsx)

스트림이 실패·정지·중단해도 `pendingUserMessage`가 남는데, 3초 폴링이 재개되면 서버가
`message_end` 없이도 저장한 USER 메시지를 올려 로컬 사본과 겹친다.

**반영:** `isPendingReconciled` — 폴링한 히스토리(기준선 이후)가 그 USER를 담으면 로컬 사본을
가린다. 실패 안내(스트림 상태)는 그대로 두고 유저 버블만 히스토리 것으로 수렴시킨다.

### 3. 긴 스레드에서 새 출력이 안 보인다 (shared-chat-panel.tsx)

`viewportRef`를 `ScrollArea`에 넘기기만 하고 tail을 따라가지 않아, 트레이보다 긴 히스토리에서
새 토큰·폴링 메시지가 뷰포트 아래에 붙는다(개인 챗봇과 달리 bottom-stick이 없었다).

**반영:** 개인 챗봇과 같은 bottom-stick 스크롤을 포팅 — 바닥 근처일 때만 tail을 따라간다.

## R3 — 2건 P2

### 1. forceVisible가 같은 노트 재개(PAUSED→ACTIVE)에도 남는다 (personal-chat.tsx)

R1 수정이 노트 ID 변경에만 forceVisible를 접어, PAUSED에서 연 개인 패널이 같은 노트가
재개돼도(둘 다 hidden:true) 활성 트레이 위에 남았다.

**반영:** forceVisible 기제를 **통째로 제거**했다(패치보다 삭제). 대신 **PAUSED에는 개인
챗봇을 감추지 않는다** — 그 화면이 "개인 챗봇을 이용하세요"라고 안내하므로 열려야 맞다.
공유 트레이가 레일을 독차지하는 건 활성·미시작뿐이고, "[개인 챗봇 열기]"는 평범한 `open()`을
쓴다. 재개되면 hidden이 다시 true가 되어 자연히 감춰진다 — 누수가 구조적으로 불가능해진다.

### 2. 시드된 남의 잠금이 전송을 안 막는다 (db.ts)

`seedForeignLock` 후 GET은 잠겼다고 하는데 `acquireSharedChatLock`은 `sharedChatLocks`만 봐서
POST가 통과했다 — 목이 계약(CHAT_LOCKED)을 시연하지 못했다.

**반영:** `acquireSharedChatLock`이 남의 잠금도 CHAT_LOCKED로 막는다. sse-handler 테스트로 가드.

## R4 — 1건 P2

### 관전자가 승인 대기를 "입력 중"으로 오표시 (shared-chat-panel.tsx)

관전자는 스트림을 못 받아 `lock.pendingApproval` 폴링이 승인 대기의 유일한 신호인데, 패널이
`locked`·`lockedBy`만 읽어 승인 대기 동안에도 "입력 중"만 보였다.

**경계 판단:** spec은 관전자 pending **행**(`jobCE`, 리치 표현)을 APP-114로 미뤘다. 하지만
"입력 중" 오표시는 APP-112 관전자 처리의 **정확성** 문제다. 그래서 이미 폴링하는 필드로
**정확한 상태**("{이름}님이 승인 대기 중" + tool/summary)만 최소로 반영하고, 승인/실행 기록의
심화·403/409 분기는 APP-114에 남긴다.

## R5 — 1건 P1

### sub-lg에서 공유 챗봇이 통째로 사라진다 (note-panel.tsx)

트레이가 `hidden lg:flex`라 좁은 화면 full+활성/미시작에서 공유 챗봇이 사라지고, 그 phase에는
개인 챗봇도 감춰져 모바일·태블릿에 챗 입구가 아예 없었다. 내가 천장으로 넘겼던 것을 P1로
재평가한다 — "드문 흐름"이 아니라 전 모바일 사용자다.

**반영:** 트레이를 반응형으로 — `lg`는 우측 사이드 레일(420), 좁은 화면은 본문 아래 스택
(`h-[45vh]`). 어느 폭에서도 공유 챗봇에 닿는다. 375px 실측으로 확인.

## R6 — 2건 P2 + 1건 P3

### 1. 회의 종료가 흐르던 공유 스트림을 끊는다 (note-panel.tsx)

5초 폴링이 ENDED를 올리면 트레이가 즉시 언마운트돼 `useChatStream`이 abort → 흐르던 답변이
사라지고 아카이브엔 유저 메시지만 남는다(APP-113의 "언마운트=abort" 계열).

**반영:** `SharedChatPanel`이 턴 활성을 부모에 보고하고(`onTurnActiveChange`), 트레이는 턴이
끝날 때까지 유지된다. 아카이브(`showArchive`)도 턴이 settle된 뒤에만 좌측을 대체한다.

### 2. 노트 로드 실패가 모든 챗 입구를 감춘다 (note-view.tsx)

`useGetNote` 실패 시 `phase`가 `unknown`으로 남아 개인 챗봇을 감추는데, 트레이도 unknown을
빼므로 챗 입구가 전무해졌다. `unknown`은 로딩 전용 의도였다.

**반영:** `isPersonalChatHiddenInNote`(순수·테스트됨)로 로딩(pending)일 때만 감추고 실패면
개인 챗봇을 남긴다.

### 3. 목의 남의 잠금을 해제할 수 없다 (rest-handlers.ts, P3)

`{ lockedBy: null }`(해제)에 `?? "김민수"`가 걸려 잠금이 다시 생겼다.

**반영:** 생략(undefined)일 때만 기본값을 넣고, 명시적 null은 해제로 통과시킨다.

## R7 — 2건 P2 (모두 note-archive)

### 1. 아카이브가 종료 직전 캐시를 재사용해 마지막 데이터가 빠진다

전역 staleTime 60초 + 포커스 refetch 꺼짐이라, 종료 후 아카이브가 마운트돼도 최종 전사·Q&A를
다시 안 당겨 마지막 조각이 안 보일 수 있다.

**반영:** 두 아카이브 쿼리에 `refetchOnMount: "always"` — 마운트 시 최종 상태를 당긴다.

### 2. 아카이브 Q&A 실패에 재시도가 없다

전사 실패는 재시도 버튼이 있는데 챗봇 대화 실패는 문구만 있어, 일시 장애가 새로고침 전까지
복구 불가였다.

**반영:** `chatQuery.refetch()`에 물린 "다시 시도" 버튼 추가.

## R8 — 통과

"No actionable correctness issues were identified." 7라운드 / 지적 15건(P1 1·P2 12·P3 2) 전부 반영.
