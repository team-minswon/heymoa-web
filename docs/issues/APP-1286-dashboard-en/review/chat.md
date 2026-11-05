# 채팅·내 에이전트 (`chat`)

맡은 파일:

- `components/chat/`: `agent-fab.tsx`(「내 에이전트」 버튼과 첫 안내 말풍선), `personal-chat.tsx`(패널), `chat-list.tsx`(대화 기록), `chat-delete-dialog.tsx`, `chat-starter.tsx`(첫 화면·예시 질문), `chat-thread.tsx`, `chain-of-thought.tsx`(생각 과정·근거 칩), `approval-card.tsx`(승인 카드), `chat-composer.tsx`, `mention-input.tsx`, `scope-picker.tsx`(`@` 피커), `markdown.tsx`(코드 블록 복사), `mermaid-block.tsx`(도표)
- `chat-icon-button.tsx`, `chat-title-input.tsx`, `time-rule.tsx`, `use-agent-nudge.ts`는 한글이 주석뿐이라 그대로입니다
- `lib/chat/`: `stream-protocol.ts`(실패 코드 문구, 승인 카드 본문 기본 이름), `chat-list.ts`(진행 배지, 날짜 묶음 이름), `use-scope-catalog.ts`(피커 묶음 이름), `approval-card.ts`(승인 사유), `use-tool-approval.ts`(승인 오류 사유·토스트), `use-chat-turn.ts`(실패 fallback 토스트, 서버 기본 제목), `use-chat-stream.ts`(스트림 실패 fallback)
- 언어 파일: `messages/<ko|en>/chat.json`. `common.agentChat`을 통째로 옮겼고 `common`에서 지웠습니다
- 등록: `i18n/messages.ts`, `i18n/messages.test.ts`의 `REQUIRED_EN`, `components/layout/app-shell.tsx`의 `PRODUCT_NAMESPACES`

`common.agentChat` 이전 전에 랜딩을 확인했습니다. `components/heymoa/landing/**`는 이 키를 쓰지 않습니다(`safety.tsx`는 채팅 컴포넌트를 주석으로만 가리키고 `landing.safety`를 씁니다). 그래서 남긴 키가 없고, 마케팅 루트(`app/[lang]/layout.tsx`)의 `clientNamespaces`는 `common`·`auth`·`landing`·`help` 그대로라 `chat`을 받지 않습니다.

판단:

- **React 밖 순수 함수는 문구 대신 코드·키를 돌려줍니다.** 스트림 리듀서의 `error.message`는 서버가 보낸 문구만 담고, 실패 코드만 온 자리(`turn_failed`, 재접속 포기)는 `null`입니다. 실패 배너가 코드로 `chat.errors.turnFailures.<코드>`를 고르고, 모르는 코드는 `chat.errors.noResponse`로 접습니다. 진행 배지는 `"streaming" | "approval"`, 날짜 묶음은 `key`만, 피커 묶음은 `kind`만 돌려줍니다
- **승인 사유는 훅이 번역합니다.** `use-tool-approval`은 React 훅이라 `useTranslations`로 사유를 만듭니다. 「결과를 받지 못한 채 끝남」(`check`)은 사유를 생략할 수 있게 하고 카드가 기본 사유를 씁니다. `ENDED_REASON`·`UNKNOWN_REASON` 상수는 지웠습니다
- **서버의 기본 대화 제목 「새 대화」는 화면 언어로 그립니다.** 계약상 기본 제목이 한국어 문자열이라, 목록 행의 `titleSource`가 `DEFAULT`면 `chat.newChat`으로 바꿔 그립니다(코드 리뷰 1회차 지적)
- 공용 버튼은 `common.actions`(취소·삭제·닫기·다시 시도·이름 변경)를 씁니다. 「이름 바꾸기」·「제목 바꾸기」는 공용 「이름 변경」으로 맞췄습니다
- 도표의 「맞춤」은 검토 그래프와 같은 말이라 한국어는 그대로 두고, 영어를 검토 그래프의 「Fit to view」로 맞췄습니다
- 런처 안내 목록(`STARTERS`)의 `hint` 문구 넷은 어디서도 그려지지 않아 옮기지 않고 지웠습니다
- 실패 fallback 문구는 `errors`가 아니라 `chat.errors`에 두었습니다. 채팅 화면만 쓰고 모두 훅·컴포넌트가 읽어 `webMessage()`가 필요 없습니다. 같은 문구인 「요청을 처리하지 못했습니다」는 기존 `errors.requestFailed`를 씁니다
- 범위 밖이지만 같이 고친 것: `lib/mocks/chat-stream.test.ts`의 기대값 한 줄(리듀서가 이제 문구 대신 코드를 싣습니다), `e2e/agent-panel.spec.ts`·`e2e/smoke.spec.ts`의 한국어 기대값(윤문한 문장)

## 문구 평가

| 축 | 1차 | 2차 |
|---|---|---|
| slop | 4 | 4 |
| 용어 | 4 | 4 |
| 적합도 | 4 | 4 |
| 일관성 | 4 | 3 |
| **평균** | **4.0** | **3.8** |

2차 지적 대부분을 반영했으나 다시 평가하지는 않았습니다. 최종 점수는 2차 3.8입니다.

## 반영한 지적

1차
- `rename`: 공용 「이름 변경」(`common.actions.rename`)으로 바꾸고 키를 지웠습니다
- `starter.intro`(en): 「I find decisions, changes, and what's left from your meetings, with sources.」
- `starter.examples.web.question`(en): 「…tools mentioned in the meeting」
- `approval.fallbackTitle`: 「쓰기 작업 승인 / Approve write action」 → 「변경 작업 승인 / Approve changes」
- `thought.pending`(en): 「Reviewing your question」
- `thread.copied`: 「복사함」 → 「복사됨」(「~함」 조각, 코드 블록과 같은 말)
- `diagram.hint`(en): 「Drag to move, Ctrl/⌘+scroll to zoom, or double-click to fit」

2차
- `editTitle`: 「제목 바꾸기」 → 「이름 변경」
- `starter.introNote`·`fab.intro`: 「바꾸는 일은 먼저 묻습니다」 → 「바꾸기 전에는 먼저 승인을 받습니다」(en: 「ask for approval before making changes」)
- `starter.examples.newTask.label`(en) 「Create a task」, `actionItems.label`(en) 「Create tasks」, `webFirst.question`(en) 「…the latest version of Next.js」
- `fab.attention.approval` 「승인이 필요합니다」, `thought.awaiting` 「승인을 기다리는 중」(ko·en 같은 뜻)
- `approval.approveCount`(en): ICU 복수형 「Approve # items」
- `approval.waitingHint`: 「승인하거나 거절할 때까지 기다립니다…」 / 「Waiting for you to approve or decline. To cancel, press Stop.」
- `errors.turnFailures.SERVICE_RESTARTING`: 「서버가 다시 시작되어 응답이 멈췄습니다…」(재시작 사유를 업데이트로 단정하지 않음)

렌더 확인에서
- `panel.placeholder`(en): 「Ask a question. Type @ to add a project or meeting note」가 1440·1024 모두 입력창에서 잘려 「Ask about projects or notes with @」로 줄였습니다
- `starter.examples.changes.label`·`noteChanges.label`(en): 「Changed decisions」가 2열 칩에서 말줄임되어 「What changed」로 줄였습니다

## 남긴 지적과 이유

- `starter.examples.actionItems.question`의 「액션 아이템」: 회의 요약 섹션의 한국어 이름이 아직 「액션 아이템」이라(D18) 그대로 둡니다. 요약 섹션을 「할 일」로 모으면 같이 바꿉니다. 영어 「Turn what this meeting agreed to do into tasks」도 그대로입니다
- `starter.examples.summaryRecent`의 칩 「지난 회의 요약」과 질문 「이 회의를 요약해줘」: 고르면 최근 회의가 범위 칩으로 붙어 「이 회의」가 그 칩을 가리킵니다. 의도한 짝입니다
- `approval.from`(화살표의 aria-label 「에서 / to」): 「3월 1일 에서 3월 5일」로 읽혀 뜻이 통합니다. 길게 늘리지 않았습니다
- `diagram.hint`·`picker.hint`(ko)의 가운뎃점: 단축키 범례라 이름표 예외로 둡니다. `picker.hint`의 끝 조각만 「입력할수록 목록이 줄어듭니다」로 고쳤습니다

## 한국어에서 바뀐 문장

| 키 | 전 | 후 |
|---|---|---|
| `editTitle` | 제목 바꾸기 | 이름 변경 |
| `rename` | 이름 바꾸기 | (공용 「이름 변경」) |
| `deleteDialog.description` | 이 대화의 질문과 답, 승인 기록이 함께 삭제되며 되돌릴 수 없습니다. 답이 만들어지는 중이라면 멈춥니다. | 이 대화의 질문과 답, 승인 기록을 함께 지우며 되돌릴 수 없습니다. 답을 만드는 중이면 멈춥니다. |
| `diagram.failed` | 도표를 그리지 못했어요 | 도표를 그리지 못했습니다 |
| `history.emptyTitle` | 아직 대화가 없어요 | 아직 대화가 없습니다 |
| `history.emptyBody` | 회의록에 대해 물어보면 여기에 쌓여요. | 회의록에 대해 물어보면 대화가 여기에 쌓입니다. |
| `starter.intro` | …근거와 함께 찾아 드려요. | …근거와 함께 찾아 드립니다. |
| `starter.introNote` | 「{title}」 회의를 보고 답해요. 바꾸는 일은 먼저 물어봐요. | 「{title}」 회의를 보고 답합니다. 바꾸기 전에는 먼저 승인을 받습니다. |
| `starter.firstMeeting` | …정리해 드려요. | …정리해 드립니다. |
| `fab.intro` | 회의록을 보고 답해요. 바꾸는 일은 먼저 물어봐요. | 회의록을 보고 답합니다. 바꾸기 전에는 먼저 승인을 받습니다. |
| `fab.tooltip` | 회의록을 보고 답해요 | 회의록을 보고 답합니다 |
| `fab.attention.running` | 답을 준비하고 있어요 | 답을 준비하고 있습니다 |
| `fab.attention.approval` | 확인이 필요해요 | 승인이 필요합니다 |
| `panel.loadFailed` | 대화를 불러오지 못했어요. | 대화를 불러오지 못했습니다. |
| `panel.loadFailedChats` | …새 대화를 시작하지 않아요. | …새 대화를 시작하지 않습니다. |
| `panel.loadFailedMessages` | 이어서 보내면 화면과 실제 대화가 어긋나서 전송을 막아 두었어요. | 화면과 실제 대화가 어긋날 수 있어 보내기를 막아 두었습니다. |
| `panel.placeholder` | @로 프로젝트·회의록을 참조해 물어보세요 | @로 프로젝트나 회의록을 붙여 물어보세요 |
| `panel.overlap` | '{note}'는 '{project}' 안에 있어요. 회의록 칩만 남길까요? | 「{note}」 회의록은 「{project}」 안에 있습니다. 회의록 칩만 남길까요? |
| `panel.awaitingApproval` | 승인을 기다리는 동안에는 보낼 수 없어요. | 승인을 기다리는 동안에는 보낼 수 없습니다. |
| `panel.refetchFailedChats`·`Messages` | 대화 목록(기록)을 다시 읽지 못했어요. 답은 화면에 남아 있어요. | 대화 목록(기록)을 다시 읽지 못했습니다. 답은 화면에 남아 있습니다. |
| `picker.label` | 범위에 더할 프로젝트·회의록 | 범위에 더할 프로젝트와 회의록 |
| `picker.hint` | …· 계속 입력하면 좁혀져요 | …· 입력할수록 목록이 줄어듭니다 |
| `thread.copied` | 복사함 | 복사됨 |
| `thread.copiedAnnounce` | 답을 복사했어요 | 답을 복사했습니다 |
| `thread.disconnected` | 연결이 끊겼습니다. 새로고침하면 지금까지 굳은 답이 보입니다. | 연결이 끊겼습니다. 새로고침하면 지금까지 저장된 답을 볼 수 있습니다. |
| `thought.pending` | 질문을 살펴보고 있어요 | 질문을 살펴보고 있습니다 |
| `thought.stalled` | 응답이 늦어지고 있어요. 계속 기다리거나 멈출 수 있어요 | 응답이 늦어지고 있습니다. 계속 기다리거나 멈출 수 있습니다 |
| `thought.awaiting` | 확인을 기다리는 중 | 승인을 기다리는 중 |
| `approval.fallbackTitle` | 쓰기 작업 승인 | 변경 작업 승인 |
| `approval.submittedHint` | 확정은 응답이 재개되면 반영됩니다. | 응답이 다시 이어지면 확정됩니다. |
| `approval.waitingHint` | 답할 때까지 기다립니다. 그만두려면 「중지」를 누르세요. | 승인하거나 거절할 때까지 기다립니다. 그만두려면 「중지」를 누르세요. |
| `approval.added`·`removed` | 더함 · 뺌 | 추가 · 제거 |
| `errors.turnFailures.TURN_TIMEOUT` | 응답이 너무 오래 걸려 중단됐습니다. | 응답이 너무 오래 걸려 멈췄습니다. |
| `errors.turnFailures.UPSTREAM_ERROR` | 응답 생성에 실패했습니다. 잠시 후 다시 시도해 주세요. | 응답을 만들지 못했습니다. 잠시 후 다시 시도해 주세요. |
| `errors.turnFailures.APPROVAL_EXPIRED` | 승인을 기다리다 시간이 지나 중단됐습니다. | 승인을 기다리다 시간이 지나 멈췄습니다. |
| `errors.turnFailures.CAPACITY_EXCEEDED` | 지금은 처리량이 많습니다. … | 지금은 요청이 많습니다. … |
| `errors.turnFailures.SERVICE_RESTARTING` | 서버가 업데이트되어 응답이 멈췄습니다. 다시 보내 주세요. | 서버가 다시 시작되어 응답이 멈췄습니다. 다시 보내 주세요. |

## 렌더 확인

경로 `/w/01K0000000000`, 영어 계정, 1440·1024. 눌러서 여는 화면은 임시 스크립트로 차례로 열었습니다: 첫 안내 말풍선 → 버튼 툴팁 → 패널 → 새 대화 첫 화면(예시 질문) → `@` 피커 → 대화 기록 → 줄 메뉴 → 대화 삭제 확인창 → 시드 대화(생각 과정 펼침) → 승인 카드(목에서 「이슈」가 든 메시지) → 승인 뒤 완료 카드.

- 넘침: 처음에는 입력창 placeholder와 「Changed decisions」 칩이 잘렸고 문구를 줄여 없앴습니다. 남은 1건은 sr-only 「Skip to content」(검사의 오탐)입니다. 가로 스크롤 없음
- 남은 한글은 모두 목·사용자 데이터입니다: 대화 제목, 시드 대화의 질문·답·생각 문장, 목 에이전트가 보낸 승인 카드 내용(「Linear 이슈 만들기」 「제목」 「앱 팀」), 회의록·프로젝트 이름, 사용자 이름
- 다른 모듈 문구: 노트 목록의 날짜 머리 「2026년 11월 5일 (목)」(날짜 문장 함수, 13단계)

## 코드 리뷰

1회차
- P2: 서버가 기본 제목 「새 대화」를 돌려주면 영어 화면의 머리글과 기록에 한국어가 그대로 보인다(`personal-chat.tsx`). → `use-chat-turn.ts`의 `chatRows`에서 `titleSource === "DEFAULT"`면 `chat.newChat`으로 그리고, 영어로 여는 시험을 `personal-chat.test.tsx`에 더했습니다

2회차
- 지적 없음
