# 공유 챗봇 (y=24000)

노트 full 모드 우측에 붙는 고정 패널. 뷰포트 1440×900, 사이드바 없음(노트 상세 셸), 우측 트레이 464 = 패널 448 + 좌우 padding 8.

## 프레임

| 프레임 ID | 화면 | 대응 operation | 응답이 만드는 상태 | shadcn | 실측 파생 근거 |
|---|---|---|---|---|---|
| `F8dV8C` (x=0) | shared-chat-streaming — 내가 보낸 메시지가 스트리밍 중 | `POST /v1/notes/{noteId}/chat/messages` (SSE 진행 중) | `message_end` 이전. 마지막 ASSISTANT 메시지에 caret, 입력창 잠김("응답 생성 중"), 전송 버튼 disabled(`$el-hairline-strong`) | 채팅 패널 고정 패널 · 비활성 Input/Button | 트레이 464 − padding 8×2 = 카드 448. 카드 820 = 헤더 82 + 스레드 636 + 컴포저 102. 스레드 좌우 padding 24 → 메시지 폭 400 |
| `xPpzc` (x=1840) | shared-chat-locked — 관전자(다른 멤버가 입력 중) | `GET /v1/notes/{noteId}/chat/messages` 폴링 (`useGetNoteSharedChatMessages`) | `lock.locked=true`, `lock.lockedBy="김민수"`, `lock.pendingApproval=null`. 스트림을 받지 않으므로 진행 중인 답변은 보이지 않고 "입력 중" 디바이더만 노출 | `Alert`(잠금, lock 아이콘) + 비활성 Input | 컴포저 145 = padding 14/18 + Alert 59 + gap 10 + Input 44. 스레드는 fill로 593까지 축소 |
| `TqX06` (x=3680) | shared-chat-archive — 회의 ENDED 후 | `GET .../chat/messages`(읽기 전용) + 전사 아카이브 | 회의 종료 → 공유 챗봇 패널은 닫히고 우측 트레이는 개인 챗봇으로 교체. 공유 Q&A는 좌측 전사 타임라인에 `q`/`a` 행으로 인터리브되어 남음 | 채팅 패널(개인) · 좌측 타임라인 | 좌측 본문 폭 878(전사 아카이브), 우측 트레이 464 유지 |
| `Ngodq` (x=5520) | shared-chat-stream-dropped — 종료 이벤트 없이 끊긴 스트림 | `POST .../chat/messages` SSE가 `message_end`/`error` 없이 절단 | 부분 텍스트는 남기고 caret 제거, 도구 스텝은 완료 표기. destructive `Alert` + [다시 시도] / [닫기]. 컴포저는 다시 활성(`$el-primary` 전송 버튼) | `Alert`(destructive: `$el-error-soft` / `$el-error-tint` / `$el-destructive`) + `Button` outline · ghost | Alert 101 = padding 12×2 + 본문 39 + gap 10 + 액션 28. 이만큼 늘어난 만큼 스레드 앞 Q&A 1쌍(69+129+gap 64)을 덜어 634 안에 맞춤 |
| `dH6kK` (x=7360) | shared-chat-inactive-paused — 회의 중지 중(409 비ACTIVE) | `POST .../chat/messages` → 409 (meetingStatus ≠ IN_PROGRESS) | 히스토리는 그대로 읽히고 전송만 막힘. "중지 중에는 개인 챗봇을 이용하세요" + [개인 챗봇 열기]. 상단 pill "중지됨", 독 "김민수님이 중지함" | `Alert`(pause 아이콘) + `Button` outline + 비활성 Input | 컴포저 183 = padding 32 + Alert 97(본문 77 + padding 20) + gap 10 + Input 44. 스레드 555, StartDivider 제거(16+gap 32)로 흡수 |
| `DZu5q` (x=9200) | shared-chat-not-started — 노트는 IN_PROGRESS이나 `meetingStartedBy = null` | 동일 409. ACTIVE 판정 = `meetingStatus === IN_PROGRESS` **AND** `meetingStartedBy !== null` | 전사 없음(빈 상태), 스레드 없음(빈 상태), 상단 pill "시작 전" + [회의 시작], Alert의 액션도 primary [회의 시작] | `Alert`(circle-play) + `Button` default + 빈 상태 2종 | 좌측 빈 상태는 전사 컬럼 864 폭 유지, 상하 padding 120으로 시각 중앙. 스레드 537 안에서 `justifyContent: center` |

다음 새 프레임 x = **11040**.

## 추가한 것

- **`Ngodq` shared-chat-stream-dropped (x=5520)** — 계약의 세 번째 스트림 종료(종료 이벤트 없이 끊김)가 행 전체에 없었다. 이걸 처리하지 않으면 영원히 로딩이므로, 부분 응답을 남긴 채 destructive `Alert` + [다시 시도]를 스레드 안(끊긴 ASSISTANT 메시지 하위)에 붙이고 컴포저를 다시 활성화했다. `error` 이벤트도 같은 슬롯을 쓰되 문구만 서버가 준 메시지로 대체한다(별도 프레임 없음).
- **`dH6kK` shared-chat-inactive-paused (x=7360)** — 409 회의 비ACTIVE 안내가 없었다. 컴포저를 `Alert` + 비활성 Input으로 바꾸고 "중지 중에는 개인 챗봇을 이용하세요" 문구와 [개인 챗봇 열기] 액션을 넣었다. 히스토리 조회는 계속 되므로 스레드는 그대로 읽힌다.
- **`DZu5q` shared-chat-not-started (x=9200)** — ACTIVE 판정의 두 번째 조건(`meetingStartedBy !== null`)이 만드는 화면이 없었다. 새 노트는 생성 시점부터 IN_PROGRESS라 "중지 중" 문구를 그대로 쓰면 거짓말이 된다. 전사·스레드 모두 빈 상태, pill "시작 전", 액션은 [회의 시작].

## 고친 것

- **`xPpzc` 컴포저** — `lock.locked`가 힌트 한 줄("김민수님이 입력 중")로만 표현돼 있고 입력창은 "메시지 보내기" 플레이스홀더라 여전히 칠 수 있어 보였다. 409 잠금이 만드는 상태를 shadcn `Alert`(lock)로 승격하고, 플레이스홀더를 "김민수님이 입력을 마칠 때까지 기다려 주세요"로 바꿔 비활성임을 명시했다.
- **`xPpzc` 스레드 하단 디바이더** — `PendingDivider` "김민수님 승인 대기 · 완료되면 여기에 올라옵니다"로 되어 있었다. 이 프레임의 lock 상태는 `pendingApproval=null`인 입력 중 상태이고, 승인 대기 관전자 화면은 도구 승인 행 `jobCE`(y=28000, x=1840)가 이미 담당한다. `TypingDivider` "김민수님이 입력 중 · 응답이 끝나면 여기에 올라옵니다"로 정정해 lock 필드와 1:1로 맞췄다.

## 보고만 하는 것

- **`lock.pendingApproval` 관전자 화면은 이 행에 없다** — 도구 승인 행 `jobCE`(v4/approval-spectator, y=28000 x=1840)가 담당한다. 다만 그 프레임의 컴포저 힌트는 "한 번에 한 명만 입력할 수 있습니다"라는 일반 문구라, `{approvalId, tool, summary}`의 `tool`·`summary`가 화면에 드러나지 않는다. 계약이 요구하는 `Alert` + `Badge`(승인 대기) 표현은 그 행에서 보강이 필요하다.
- **TOOL 메시지 렌더링도 이 행에 없다** — `ImOW0`(v4/approval-result, y=28000 x=3680)의 "실행 기록 · 승인"(외부 링크 포함) / "실행 기록 · 거절" 블록이 승인 기록(`decision`)과 실행 기록(`status`)을 모두 커버한다. 공유 챗봇 스레드는 같은 컴포넌트를 재사용하면 되고, 이 행에 중복 프레임을 만들지 않았다.
- **400 빈 메시지** — 전용 프레임을 만들지 않았다. 빈 입력일 때 전송 버튼이 `$el-hairline-strong`(비활성)으로 남는 것이 `F8dV8C`·`xPpzc`에 이미 드러나 있어 서버 400에 도달할 경로가 UI에 없다. 서버 400은 스트림 실패와 같은 `Alert` 슬롯을 재사용한다.
- **`TqX06` 이름과 내용의 어긋남** — 프레임 이름은 "shared-chat-archive · 공유 챗봇 (ENDED)"인데 우측 트레이는 개인 챗봇 패널이다. 종료 후 공유 챗봇이 사라지고 Q&A가 전사 아카이브로 흡수되는 설계 자체는 계약(`종료 후 읽기 전용`)과 어긋나지 않아 손대지 않았다. 다만 개인 챗봇 행(y=26000)과 우측 패널이 겹치므로, 이름을 `shared-chat-archive-in-transcript`류로 바꾸거나 우측을 공유 챗봇 읽기 전용 스레드로 되돌릴지는 결정이 필요하다.
- **공용 `reusable` 노드는 건드리지 않았다.** 이 행의 프레임들은 shadcn reusable 인스턴스를 쓰지 않고 v4 토큰(`$el-*`)으로 직접 조립돼 있다. `Alert`/`Badge`/`Card` reusable(`QyzNg`, `UjXug`, `pcGlv` 등)과 v4 프레임 사이에 스타일 계보가 끊겨 있는 점은 행 전체의 구조 이슈로 남는다.
- **pencil 렌더/레이아웃 캐시** — 새로 만든 노드가 직후 `get_screenshot`에 그려지지 않고 `snapshot_layout`의 마지막 자식 `y`가 이전 값으로 남는 현상이 있었다. 높이 합과 재조회로 검증했고 최종 상태에서는 이 행 6개 프레임 모두 `problemsOnly` 무결이다.
