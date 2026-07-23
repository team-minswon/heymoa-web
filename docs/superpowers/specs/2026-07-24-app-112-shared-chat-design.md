# APP-112 공유 챗봇 UI 설계

**목표:** 노트 full 모드 우측에 공유 챗봇 트레이를 붙인다. **APP-113이 만든 SSE 레이어(`stream-protocol`·`use-chat-stream`·`chat-thread`)를 그대로 재사용**하고, 공유 챗봇만의 것 — 회의 상태 게이트, 입력 잠금, 관전자 폴링, 아카이브 — 을 더한다.

**범위 밖:** 도구 승인 UX의 상태 심화(APP-114 — 관전자 pending row `jobCE`, 204 잠금 표현 `pysh5`, 만료/409 카드 무효화 `WKrCG`/`d9IWR`). 회의 종료·중지·재개 **버튼**과 요약 탭(APP-111 — 앱바 조작권). APP-112는 그 버튼들이 바꾸는 `meetingStatus`를 **읽기만** 한다.

**입력:** `docs/api-surface.md` 공유 챗봇 절, `docs/design-decisions.md` 공유 챗봇 행(y=24000: `F8dV8C` `xPpzc` `TqX06` `Ngodq` `dH6kK` `DZu5q`)과 노트 full 행(y=20000), `docs/contracts/agent-chat-flow.md` 챗봇 2종 비교표, `NoteSharedChatResponse` 계약.

## 순서 결정 — 왜 APP-114보다 먼저인가

착수 시 APP-114(도구 승인 UX)를 먼저 열었다가 되돌렸다. 근거를 남긴다.

APP-114의 성공 기준 절반("관전자 화면에 대기 상태 표시")과 경계 항목(관전자 pending row `jobCE`, 403 `NOT_APPROVAL_OWNER` 분기, 409 `MEETING_NOT_ACTIVE` 분기)은 **모두 공유 챗봇 폴링 응답의 `lock.pendingApproval`·`lockedBy`로만 구동**된다(`NoteSharedChatResponse`). 개인 챗봇에는 `lock`도 관전자도 없다. 즉 APP-114의 관전자 UI를 마운트하고 e2e로 검증할 유일한 숙주가 이 이슈(APP-112)다. APP-112 없이 APP-114를 먼저 하면 붙일 화면도 테스트도 없는 투기 컴포넌트가 된다.

반대로 APP-112는 APP-113이 만든 SSE 레이어의 직접 연장이다(APP-113 spec이 "앞의 셋은 공유 챗봇이 그대로 쓴다"고 명시). 그래서 **APP-112 → APP-114** 순서로 뒤집었다. APP-112 블로커(APP-145/120/109/110/105)는 전부 Done이다.

## 자문자답으로 잡은 것

사용자에게 묻지 않고 결정했다. 계약·기존 코드·디자인 감사에서 드러난 결정 여섯을 못 박는다.

### 노트 full은 2컬럼 셸이 된다 — side는 그대로

현재 `NotePanel`은 단일 중앙 컬럼(max-w-820: 전사/노트정보 탭 + 녹음 독)이고 full·side가 같은 컴포넌트를 쓴다. v4 노트 full 행(`TkHep` 등)은 **본문 컬럼 832 + 우측 고정 패널(챗 트레이 448)** 이다. 그 우측 트레이가 아직 없다.

**APP-112가 full 모드에만 2컬럼 셸을 도입한다.** 좌측은 기존 `NotePanel` 내용, 우측은 공유 챗봇 트레이. side 모드(Sheet)는 손대지 않는다 — side에는 챗 트레이가 없고 개인 챗봇도 감춰진다(APP-113 규칙).

셸 소유 경계: full 2컬럼 레이아웃은 APP-112가 세운다. APP-111은 그 좌측 컬럼에 요약 탭과 앱바 조작 버튼을 더한다. 둘이 같은 셸을 건드리지만, APP-112가 트레이를 도입할 이유가 있으므로 셸 변경을 여기서 낸다.

### 개인 챗봇과 공유 챗봇은 우측 레일을 두고 겹친다 — 회의 상태로 가른다

개인 챗봇(APP-113)은 글로벌 `fixed right-2` 오버레이(448)다. 공유 챗봇도 우측 트레이(448)다. 둘을 같은 자리에 두면 겹친다. 계약·디자인이 이미 답을 준다 — 공유 챗봇은 **회의(note) 스코프**이고, 종료 후에는 개인 챗봇으로 교체된다(`TqX06`: "종료 → 우측 트레이는 개인 챗봇으로 교체").

**규칙:**

| meetingStatus | 우측 레일 | 개인 챗봇 |
|---|---|---|
| IN_PROGRESS · PAUSED | 공유 챗봇 트레이 | **감춤** (`hidden`) |
| ENDED | 개인 챗봇 (노트 스코프) | 보임 |

노트 화면이 `usePersonalChatScope`에 넘기는 `hidden`을 `side || (full && meetingStatus !== "ENDED")`로 바꾼다. APP-113이 만든 감춤 기계(감출 뿐 언마운트 안 함, 스트림 유지)를 그대로 확장한다.

예외 하나: PAUSED 프레임(`dH6kK`)은 "중지 중에는 개인 챗봇을 이용하세요 + [개인 챗봇 열기]"를 준다. 감춰진 개인 챗봇을 그 버튼으로 열 수 있어야 한다. **`open()`이 감춤을 이긴다** — Provider에 `forceVisible`을 두어 `open()`이 켜고, `close()`·라우트 이탈이 끈다. 열리면 공유 트레이 위에 오버레이(z-30)로 뜬다.

### 관전자 판별은 이름이 아니라 "내가 스트리밍 중인가"다

계약의 `lock`은 `{locked, lockedBy(이름), pendingApproval}`뿐이다. "이 잠금이 내 것인가 남의 것인가"를 이름으로 가르면 안 된다 — 이름은 유일하지도 신뢰할 수도 없고, 목은 항상 현재 유저 이름을 `lockedBy`로 준다.

**견고한 신호는 로컬 스트림 상태다.** 내가 메시지를 보내면 나는 잠금을 쥐고 **스트림 위에** 있다 → 스트림을 렌더한다. 내가 보내지 않았는데 `lock.locked`면 나는 **관전자**다 → 잠금 Alert + 폴링으로 완성 메시지를 기다린다. 판별식:

```
관전자 = !내가_로컬_스트리밍_중 && lock.locked
```

관전자는 스트림을 받지 않는다(계약: "스트림 수신은 입력자만"). 그래서 관전자 화면의 전부는 폴링한 `lock`이다.

### 폴링은 회의가 ACTIVE일 때만, 내가 스트리밍 중이 아닐 때만

`useGetNoteSharedChatMessages`의 `refetchInterval`을 켜는 조건: **meetingStatus === IN_PROGRESS** (다른 멤버의 잠금·완성 메시지를 잡으려고) **AND 내가 로컬 스트리밍 중이 아님** (내 스트림이 진실의 출처인 동안 폴링이 낡은 히스토리로 덮지 않게). PAUSED·ENDED에서는 폴링하지 않는다 — 새 메시지가 생기지 않는다.

### 관전자 잠금을 목이 못 만든다 — 목을 고친다

`getNoteSharedChat`의 `lockedBy`가 항상 현재 유저 이름이다(`db.ts`). 그래서 "다른 멤버가 입력 중"인 관전자 화면을 브라우저·e2e에서 재현할 수 없다. **목에 남의 잠금을 심는 경로를 더한다** — 잠금 보유자 이름을 현재 유저가 아닌 값으로 세팅하는 시드(테스트·데모용). vitest 컴포넌트 테스트는 훅을 직접 목킹해 남의 잠금을 넣지만, Playwright 경로는 서비스 워커 목이 실제 응답을 줘야 하므로 시드가 필요하다.

### 아카이브 시간순 인터리브는 계약이 못 받친다 — 천장을 적고 근사한다

전사 세그먼트는 **세션 상대 ms**(`startedAtMs`)만 갖고, 공유 Q&A는 **절대 `createdAt`**(ISO)을 갖는다. 전사 응답에 세션 벽시계 시작이 없어(`TranscriptResponseData`는 `segments[]`뿐) 둘을 같은 축에 못 놓는다. `TqX06`가 원하는 "전사 타임라인에 q/a 행 인터리브"는 정밀하게는 **계약상 불가**다. 게다가 디자인 감사가 `TqX06`를 미해결로 남겼다(design-decisions 181행: "우측을 공유 챗봇 읽기 전용 스레드로 되돌릴지 결정 필요").

**MVP 아카이브:** ENDED 노트에서 좌측 전사 컬럼 아래에 **"회의 중 챗봇 대화" 섹션**을 붙여 공유 Q&A를 `createdAt` 순으로 렌더한다(승인/실행 기록 포함, `chat-thread`의 히스토리 렌더 재사용). 전사 블록 사이에 정밀 삽입하지 않는다.

`ponytail:` 천장 — 세그먼트 절대 시각이 계약에 없어 근사한다. 전사 세션 벽시계 시작이 응답에 생기면 `sessionStart + startedAtMs`로 정밀 인터리브로 올린다.

우측 레일은 위 규칙대로 개인 챗봇으로 교체된다. 공유 Q&A는 좌측 아카이브에만 남는다 — 우측에 읽기 전용 공유 스레드를 또 두지 않는다(중복).

### 공유 스레드는 작성자 이름을 보인다 — `chat-thread`를 넓힌다

공유 메시지(`NoteSharedChatResponseDataMessagesItem`)는 USER에 `authorName`이 있다(멀티멤버). 개인 메시지(`AgentChatMessagesResponseDataMessagesItem`)에는 없다. `chat-thread`의 `ThreadMessage`를 둘 다 받게 넓히고(공통: role·content·toolEvent·createdAt·messageId), USER 버블에 `authorName`이 있으면 위에 작은 이름을 붙인다. 개인 챗봇은 `authorName`이 없어 이름이 안 붙는다 — 한 컴포넌트가 둘을 만족한다.

## 회의 상태 → 컴포저 상태 기계

`useGetNote`의 `meetingStatus`·`meetingStartedBy`가 모든 분기를 만든다. **ACTIVE 판정 = `meetingStatus === "IN_PROGRESS" && meetingStartedBy !== null`**.

| 상태 | 판정 | 컴포저 | 프레임 |
|---|---|---|---|
| **활성** | IN_PROGRESS · startedBy≠null · 잠금 없음/내 것 | 입력 가능. 전송 = SSE 스트림 | `F8dV8C` |
| **관전** | 위 + `!스트리밍 && lock.locked` | 비활성 Input + `Alert`(lock) "OO님이 입력 중" + placeholder "…기다려 주세요". 스레드 하단 TypingDivider | `xPpzc` |
| **미시작** | IN_PROGRESS · startedBy=null | 빈 스레드·빈 전사, `Alert`(circle-play) "녹음을 시작하면 공유 챗봇을 쓸 수 있습니다". 실제 시작은 녹음 독 | `DZu5q` |
| **중지** | PAUSED | 히스토리 읽힘, 전송 막힘. `Alert`(pause) "중지 중에는 개인 챗봇을 이용하세요" + [개인 챗봇 열기] | `dH6kK` |
| **종료** | ENDED | 컴포저 없음. 우측은 개인 챗봇으로 교체, Q&A는 좌측 아카이브 | `TqX06` |

미시작의 [회의 시작]은 녹음 독(기존)이 실제 시작 버튼을 이미 갖고 있어 **중복하지 않는다** — 안내만 준다.

## 스트림 종료 세 경로 — APP-113과 동일

`chat-thread`·`use-chat-stream`이 이미 처리한다. 공유도 같은 이벤트 8종·같은 세 경로다.

| 종료 | 화면 | 프레임 |
|---|---|---|
| `message_end` | 정상 말풍선. 히스토리 폴링이 tee된 기록으로 대체 | `F8dV8C` 완료 |
| `error` | 부분 버림 + `Alert`(destructive) + 재시도 | `Ngodq`와 같은 슬롯 |
| 종료 이벤트 없음 | 부분 회색 유지 + `Alert`(중립) + 재시도 | `Ngodq` |

400 빈 메시지는 전송 버튼이 빈 입력에 비활성이라 도달 경로가 없다(design-decisions 180행). 서버 400은 스트림 실패와 같은 `Alert` 슬롯을 재사용한다.

## 구조

```
components/chat/chat-thread.tsx        (수정) ThreadMessage에 authorName 수용, USER 버블에 작성자 표시
components/notes/shared-chat-panel.tsx (신규) 공유 챗봇 패널 — 게이트·잠금·관전자·스트림. 개인 패널과 형제
lib/notes/meeting-state.ts             (신규) note → {phase: active|spectator|not-started|paused|ended} 순수 파생
components/notes/note-panel.tsx        (수정) full 모드 2컬럼: 좌 기존 + 우 SharedChatPanel
components/notes/note-view.tsx         (수정) 개인 챗봇 hidden을 meetingStatus로 확장
components/chat/personal-chat.tsx      (수정) Provider에 forceVisible — open()이 hidden을 이긴다
components/notes/note-archive.tsx      (신규) ENDED 좌측: 전사 + "회의 중 챗봇 대화" 섹션
lib/mocks/db.ts + rest-handlers.ts     (수정) 남의 잠금 시드 경로 (관전자 재현)
```

`shared-chat-panel.tsx`는 `use-chat-stream`·`chat-thread`를 개인 패널과 똑같이 쓴다. 다른 것은 URL(`getSendNoteSharedChatMessageUrl(noteId)`), 히스토리 훅(`useGetNoteSharedChatMessages`, 폴링), 그리고 회의 상태 게이트뿐이다. `meeting-state.ts`가 게이트 로직을 순수 함수로 떼어 브라우저 없이 테스트한다.

## 오류 표시 — AGENTS.md 경계표

| 무엇 | 어떻게 |
|---|---|
| 409 입력 잠금(관전) · 409 비ACTIVE(중지) | 인라인 `Alert` — 상태가 바뀔 때까지 지속. `suppressErrorToast` |
| 스트림 `error`·무종료·중단 | 스레드 안 인라인 `Alert` + 재전송 (APP-113 재사용) |
| 히스토리 404(노트 접근 불가) | 빈 상태/오류 (주 데이터 없음) |
| 승인 실패 | sonner 토스트 (전역) — 심화는 APP-114 |

전송 게이트(활성 아님·잠김)는 스트림을 열기 전에 UI가 막으므로 409에 도달할 경로를 최소화한다. 그래도 도달하면(경합) 위 인라인 슬롯을 쓴다.

## 성공 기준

- 회의 상태별 컴포저 전환: 활성 입력 / 미시작 안내 / 중지 안내+개인챗 / 종료 아카이브
- 관전자: 남의 잠금이 있으면 입력 비활성 + "OO님이 입력 중", 잠금 해제 후 폴링이 완성 메시지를 올리고 입력 가능
- 활성 상태에서 전송 → SSE 토큰 스트리밍 → `message_end` 후 히스토리 반영 (개인 챗봇과 동일 트랜잭션)
- 스트림 세 종료 경로가 각각 다른 화면 (재사용 검증)
- ENDED 아카이브: 좌측 전사 + "회의 중 챗봇 대화"에 공유 Q&A(승인/실행 기록 포함) `createdAt` 순
- 개인 챗봇: 회의 중 감춰지고, ENDED에서 노트 스코프로 복귀, PAUSED의 [개인 챗봇 열기]가 감춤을 이긴다
- 공유 스레드가 USER 메시지에 작성자 이름 표시, 개인 스레드는 미표시
- vitest: `meeting-state` 단위 + `shared-chat-panel` 통합(목 스트림·목 잠금) + `chat-thread` authorName + 아카이브
- Playwright 스모크: 노트 full에서 공유 챗봇 한 턴을 흘리고, 남의 잠금 시드로 관전자 화면 확인

## 리뷰 게이트

로컬 `codex exec review --base dev` 한 번. 판단은 `docs/codex-review-app-112.md`에 남긴다.
