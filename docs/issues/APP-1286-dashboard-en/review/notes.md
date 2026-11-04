# 회의 노트 (`notes`)

회의 노트 화면은 세 묶음으로 나눠 옮깁니다. 묶음마다 절을 더합니다.

## 1. 머리·상태·정보

맡은 파일(`components/notes/` 바로 아래):

- `note-panel.tsx`, `note-view.tsx`, `note-route-surface.tsx`, `note-full-skeleton.tsx`, `note-status-band.tsx`, `note-auto-end-notice.tsx`
- `meeting-controls.tsx`, `meeting-end-dialog.tsx`, `meeting-end-feedback.tsx`, `pre-end-guide.tsx`
- `note-delete-dialog.tsx`, `note-details.tsx`, `note-participants.tsx`, `note-participants-field.tsx`, `note-context-section.tsx`
- `note-archive.tsx`, `note-agent-rail.tsx`, `copy-markdown-button.tsx`(버튼 문구)
- `note-route-client.tsx`, `nudge-bubble.tsx`는 주석만 한글이라 그대로입니다
- `lib/notes/meeting-state.ts`: `MEETING_STATUS_LABEL`을 지우고 `common.meetingStatus` 키 표 `MEETING_STATUS_KEY`를 두었습니다. 노트 목록 행(`note-list-row.tsx`)이 따로 들고 있던 같은 표도 이것으로 바꿨습니다. 쓰는 곳 없이 시험만 읽던 `MEETING_PRIMARY_ACTION_LABEL`도 지웠습니다
- 언어 파일: `messages/<ko|en>/notes.json`(최상위 키는 하위 화면별: `panel`·`surface`·`view`·`controls`·`endNudge`·`endDialog`·`endFeedback`·`preEnd`·`statusBand`·`autoEnd`·`deleteDialog`·`details`·`participants`·`participantsField`·`context`·`archive`·`agentRail`·`copy`)

범위 밖 파일을 조금 건드렸습니다.

- `copy-markdown-button`이 한국어 `label` 대신 `kind`(`transcript`·`summary`·`timeline`)를 받아 노트 탭 이름으로 번역합니다. 그래서 `note-summary`·`transcript-view`·`note-timeline`의 호출부 한 줄씩을 `kind`로 바꿨습니다
- `components/transcription/recording-dock.tsx`의 `startLabel` 타입을 `"회의 시작" | "재개"`에서 `string`으로 넓혔습니다. 노트 패널이 번역한 시작 문구를 넘기기 위해서입니다. 독의 나머지 문구는 녹음 모듈 몫입니다

판단:

- **회의 종료 후 의견의 저장 머리는 한국어로 둡니다.** 화면의 분류 이름은 번역하지만, 문의 본문 앞에 붙는 「[회의 종료 후] 녹음·소리」는 운영자가 읽고 거르는 데이터라 `REASONS[].tag`로 한국어를 고정했습니다(workspace 모듈의 「화면:·환경:」 꼬리와 같은 판단)
- **제목을 비우고 저장할 때의 기본 제목은 화면 언어입니다**(「제목 없는 노트 / Untitled note」). 사용자가 만드는 데이터의 기본값은 만든 사람의 화면 언어로 둡니다. 새 회의 창의 기본 제목과 같은 결정입니다
- **`EXTERNAL_LABEL` 상수는 남겼습니다.** 이 묶음의 파일은 `notes.participants.external`을 쓰지만 화자 지정 메뉴(`speaker-assign-menu`, 다음 묶음)가 아직 상수를 읽습니다. 다음 묶음이 바꾼 뒤 지우면 됩니다
- **참여자 자동 열기의 셀렉터를 문구에서 떼었습니다.** `button[aria-label="참여자 추가"]`가 영어 화면에서 버튼을 못 찾으므로 `data-slot="participants-add"`로 찾습니다
- 영어의 「외부」는 용어집의 guest에 맞춰 「Guest」로, 참여자 선택의 「외부인」도 한국어 「임시 참여자」로 맞췄습니다
- 정보 탭의 「변경 저장」 버튼은 `common.actions.saveChanges`(「변경사항 저장」)를 씁니다. 용어집은 「변경 저장」이라 둘 중 하나로 맞춰야 합니다(아래 「남긴 지적」)

## 문구 평가

| 축 | 1차 | 2차 |
|---|---|---|
| slop | 4 | 4 |
| 용어 | 4 | 4 |
| 적합도 | 4 | 4 |
| 일관성 | 3 | 3 |
| **평균** | **3.8** | **3.8** |

2차 지적 대부분을 반영했으나 다시 평가하지는 않았습니다. 최종 점수는 2차 3.8입니다.

## 반영한 지적

1차
- `view.statusChange.message`: 「일시정지됨으로」「종료됨으로」가 어색해 「회의 상태가 바뀌었습니다: {status}」로
- `participantsField.searchPlaceholder`·`createGuestHint`: 「외부인」을 용어집의 「임시 참여자 / guest participant」로
- `endDialog.participantsOne`: 「한 사람으로 나눕니다」가 모순이라 「같은 화자로 봅니다」로
- `preEnd.loneParticipant`: 누구를 추가해야 하는지(말한 사람) 밝힘
- `archive.resetDialog.description`·`applyAllDialog.*`(en): 발화 자체가 지워지는 것처럼 읽히지 않게 「지정」을 지운다고 씀
- `context.backgroundPlaceholder`: 「로그 결과와 조치를 정해요」 → 「로그를 살펴보고 조치를 정해요」(ko·en 같은 뜻)
- `autoEnd.title`(en): 「The meeting ended automatically.」
- `panel.expandBusy`·`collapseBusy`: 무엇으로 바뀌는지(전체 화면·사이드 뷰)를 말함

2차
- `endNudge.items.speakers.body`: 이름은 사람이 붙인다는 것을 두 언어에서 같게
- `endNudge.items.review.title`: 버튼 이름 「검토 완료 / Finish review」 대신 종료 전 안내와 같은 단계 이름 「검토 후 확정 / Review and confirm」
- `panel.viewerEnded.*`: 「기록」이 무엇인지 모호해 「스크립트」로
- `panel.subscription.alreadySubscribed`(en): 확인되지 않은 원인을 단정하지 않게
- `endDialog.editParticipants`(en): 「Go to participants」(이동하는 버튼)
- `endFeedback.description`·`reasonsLabel`(en): 「every note」가 회의 노트와 헷갈려 고침, 「What could be better」
- `deleteDialog.chats`(en): 「used」 → 「asked about」(ko와 같은 기준)
- `archive.truncated`(en): 「The transcript wasn't saved to the end.」
- `archive.resetFailed`·`resetDialog.title`: 「되돌리기」와 「초기화」가 섞여 「초기화」로 통일

렌더 확인에서
- `preEnd.loneParticipant`(ko): 1024에서 「주세요.」만 둘째 줄로 떨어져 「종료하기 전에」 → 「종료 전에」로 줄임
- `preEnd.steps.summary.body`(ko): 카드 폭에서 「할 / 일을」로 갈려 「할 일」 사이를 줄바꿈 없는 공백으로

## 남긴 지적과 이유

- `common.actions.saveChanges` 「변경사항 저장」이 용어집 「변경 저장」과 다름(1·2차): 공용 키라 다른 화면도 같이 바뀝니다. 이 묶음에서 혼자 바꾸지 않았고, 용어집과 공용 키 중 어느 쪽을 맞출지 정해 주시면 됩니다
- `statusBand.pausedDays` 「{count}일째」와 「Paused for N days」의 뜻 차이(1차): 노트 목록(workspace 모듈)의 같은 표현과 맞춘 것이라 두 곳을 함께 바꿀 때 고칩니다
- `endFeedback.reasons.*.label`의 가운뎃점 「녹음·소리」「속도·사용법」(1차): 카드 이름표라 예외로 둡니다. 저장 머리에도 같은 낱말이 실립니다
- `panel.desktopHint` 「화상회의 녹음은 데스크톱 앱으로」: 조각 문장이지만 독 위 말풍선(한 줄, `whitespace-nowrap`)이라 길이를 늘리지 않았습니다
- `participantsField.searchPlaceholder` 「이름 검색 또는 임시 참여자 추가」: 팝업 폭(288px)에 맞춘 짧은 안내라 문장으로 늘리지 않았습니다
- 「종료 뒤에 추가한 참여자는 … 반영되지 않습니다」 같은 피동: 자연스러운 한국어라 그대로 두었습니다(D7)

## 한국어에서 바뀐 문장

| 키 | 전 | 후 |
|---|---|---|
| `details` 저장 버튼(`common.actions.saveChanges`) | 변경 저장 | 변경사항 저장 |
| `panel.startBlocked.otherDevice` | 다른 탭·기기에서 기록 중입니다. | 다른 탭이나 기기에서 기록 중입니다. |
| `view.statusChange.message` | 회의 상태가 {status}으로 변경되었습니다. | 회의 상태가 바뀌었습니다: {status} |
| `controls.group` | 회의 상태 및 제어 | 회의 상태와 제어 |
| `controls.blockedBy` | {name} 님이 기록 중 — 일시정지한 뒤 종료할 수 있습니다 | {name} 님이 기록 중입니다. 일시정지한 뒤 종료할 수 있습니다 |
| `endNudge.title` | 녹음을 멈췄어요. 이제 마무리할까요? | 녹음을 멈췄습니다. 이제 마무리할까요? |
| `endNudge.items.speakers.body` | 누가 말했는지 나눠 이름을 붙여요 | 누가 말했는지 나누고 이름을 붙일 수 있습니다 |
| `endNudge.items.summary.body` | 결정과 할 일을 한 번에 정리해요 | 결정과 할 일을 한 번에 정리합니다 |
| `endNudge.items.review.body` | 프로젝트 지식으로 확정해요 | 프로젝트 지식으로 확정합니다 |
| `endDialog.description` | 회의를 종료하고 요약을 시작합니다. 이후에는 스크립트를 다시 시작할 수 없습니다. | 회의를 종료하고 요약을 시작합니다. 종료한 뒤에는 이어서 녹음할 수 없습니다. |
| `endDialog.participantsOne` | 참여자가 1명이라 말한 사람이 1명으로 처리됩니다. 여러 명이 말했다면 먼저 참여자를 지정해 주세요. 종료 뒤에 추가한 참여자는 이번 화자 분리에 반영되지 않습니다. | 참여자가 1명이라 말한 사람을 모두 같은 화자로 봅니다. 여러 명이 말했다면 먼저 참여자를 지정해 주세요. 종료 뒤에 추가한 참여자는 이번 화자 분리에 반영되지 않습니다. |
| `endFeedback.progress.ready` | 요약이 준비됐어요 | 요약이 준비되었습니다 |
| `endFeedback.progress.failed` | 회의를 분석하지 못했어요 · 요약 탭에서 다시 분석할 수 있어요 | 회의를 분석하지 못했습니다. 요약 탭에서 다시 분석할 수 있습니다. |
| `endFeedback.progress.unknown` | 요약 상태를 불러오지 못했어요 · 요약 탭에서 다시 시도할 수 있어요 | 요약 상태를 불러오지 못했습니다. 요약 탭에서 다시 시도할 수 있습니다. |
| `endFeedback.progress.running` | 회의를 정리하고 있어요 · 창을 닫아도 계속돼요 | 회의를 정리하고 있습니다. 창을 닫아도 계속됩니다. |
| `endFeedback.description` | 남겨 주시면 운영팀이 읽고 답해요. | 남겨 주시면 운영팀이 읽고 답합니다. |
| `endFeedback.privacy` | 회의 내용은 자동으로 붙지 않아요. | 회의 내용은 함께 보내지 않습니다. |
| `endFeedback.sent` | 고마워요. 보낸 의견은 「문의·피드백」에서 볼 수 있어요. | 고맙습니다. 보낸 의견은 「문의·피드백」에서 볼 수 있습니다. |
| `preEnd.title` | 회의를 종료하면 이런 것들이 만들어져요 | 회의를 종료하면 이렇게 정리됩니다 |
| `preEnd.description` | 보통 종료 후 1분 안에 준비돼요. 종료 전에는 볼 수 없어요. | 보통 종료 후 1분 안에 준비됩니다. 종료 전에는 볼 수 없습니다. |
| `preEnd.steps.summary.body` | 개요, 결정, 액션 아이템을 자동으로 정리해요. | 개요와 결정, 할 일을 자동으로 정리합니다. |
| `preEnd.steps.speakers.body` | 목소리를 사람별로 나누고, 누구인지 이름을 붙일 수 있어요. | 목소리를 사람별로 나누고 이름을 붙일 수 있습니다. |
| `preEnd.steps.review.body` | 정리된 항목을 확인하고 고친 뒤 프로젝트 지식으로 확정해요. | 정리된 항목을 확인하고 고친 뒤 프로젝트 지식으로 확정합니다. |
| `preEnd.loneParticipant` | 참여자가 1명이에요. 종료하기 전에 추가하면 화자를 더 정확히 나눠요. | 참여자가 1명입니다. 여러 명이 말했다면 종료 전에 추가해 주세요. |
| `preEnd.pauseToEnd` | 기록을 일시정지하면 회의를 종료할 수 있어요. | 기록을 일시정지하면 회의를 종료할 수 있습니다. |
| `preEnd.noResume` | 종료한 뒤에는 이어서 녹음할 수 없어요. | 종료한 뒤에는 이어서 녹음할 수 없습니다. |
| `statusBand.autoEndScheduled` | 계속 일시정지 상태라면 {time} 이후 자동 종료될 예정입니다. | 일시정지가 이어지면 {time} 이후 자동으로 종료합니다. |
| `deleteDialog.description` | 이 회의의 녹음과 스크립트, 요약, 발언에 연결된 근거가 함께 삭제됩니다. 녹음 중이라면 녹음도 끝납니다. 삭제한 회의록은 되돌릴 수 없습니다. | 이 회의의 녹음과 스크립트, 요약, 발언에 연결된 근거를 함께 삭제합니다. 녹음 중이라면 녹음도 끝납니다. 삭제한 회의록은 되돌릴 수 없습니다. |
| `deleteDialog.chats` | 이 회의록만 물어본 에이전트 대화도 함께 삭제됩니다. 같은 프로젝트의 다른 회의록과 결정 사항, 할 일, 다른 자료도 함께 물어본 대화는 그대로 남습니다. | 이 회의록만 물어본 에이전트 대화도 함께 삭제합니다. 같은 프로젝트의 다른 회의록과 결정 사항, 할 일, 다른 자료도 함께 물어본 대화는 그대로 남습니다. |
| `details.saveFailed` | 저장하지 못했습니다. 입력한 내용은 유지됩니다. | 저장하지 못했습니다. 입력한 내용은 그대로 남아 있습니다. |
| `details.saved` | 저장됨 | 저장했습니다 |
| `participantsField.departed` | 워크스페이스에 없음 | 워크스페이스에 없는 사람 |
| `participantsField.createGuestHint` | 계정 없이 이 회의의 외부인으로 추가됩니다. | 계정 없이 이 회의의 임시 참여자로 추가합니다. |
| `context.help` | 회의가 무엇에 관한 것인지 알려 주면 받아 적을 때 참고해요. 프로젝트 이름·회의 제목·참석자 이름은 적지 않아도 자동으로 들어가요. | 회의가 무엇에 관한 것인지 적어 두면 받아 적을 때 참고합니다. 프로젝트 이름과 회의 제목, 참석자 이름은 적지 않아도 자동으로 들어갑니다. |
| `context.empty` | 적어 둔 맥락이 없어요. | 적어 둔 맥락이 없습니다. |
| `context.unsaved` | 회의가 끝나 저장하지 못한 내용이에요. 필요하면 복사해 두세요. | 회의가 끝나 저장하지 못한 내용입니다. 필요하면 복사해 두세요. |
| `context.blank` | 적지 않았어요 | 적지 않았습니다 |
| `context.saved` | 저장했어요 | 저장했습니다 |
| `context.saveFailed` | 저장하지 못했어요 | 저장하지 못했습니다 |
| `context.recording` | 녹음 중이에요. 고친 내용은 녹음을 다시 이어 갈 때부터 반영돼요. | 녹음 중입니다. 고친 내용은 녹음을 다시 이어 갈 때부터 반영됩니다. |
| `archive.loading` | 대화 기록 불러오는 중 | 스크립트 불러오는 중 |
| `archive.truncated` | 기록이 끝까지 저장되지 못했습니다. | 기록을 끝까지 저장하지 못했습니다. |
| `archive.resetDialog.title` | 지정한 화자를 모두 되돌립니다 | 지정한 화자를 모두 초기화할까요? |
| `copy.copied` | {label} 내용이 클립보드에 복사되었습니다. | {label} 내용을 클립보드에 복사했습니다. |
| `participantsField.searchPlaceholder` | 이름으로 검색 또는 외부인 추가 | 이름 검색 또는 임시 참여자 추가 |
| `archive.resetDialog.description` | 화자 {count}개에 붙인 이름과 개별로 고친 발화가 사라지고, AI가 나눈 「화자 A」로 돌아갑니다. 되돌릴 수 없습니다. | 화자 {count}개에 붙인 이름과 발화별로 지정한 화자를 지웁니다. AI가 붙인 「화자 A」 같은 이름으로 돌아가고, 되돌릴 수 없습니다. |
| `context.backgroundPlaceholder` | 예: 지난주 결제 승인 실패가 늘어 원인을 찾는 중이에요. 오늘은 PG사 로그 결과와 임시 조치를 정해요. | 예: 지난주 결제 승인 실패가 늘어 원인을 찾는 중이에요. 오늘은 PG사 로그를 살펴보고 임시 조치를 정해요. |
| `panel.expandBusy` | 답변이 끝나면 확장할 수 있습니다 | 답변이 끝나면 전체 화면으로 볼 수 있습니다 |
| `panel.collapseBusy` | 답변이 끝나면 축소할 수 있습니다 | 답변이 끝나면 사이드 뷰로 바꿀 수 있습니다 |
| `endNudge.items.review.title` | 검토 완료 | 검토 후 확정 |
| `panel.viewerEnded.description` | 읽던 기록을 확인한 뒤 종료된 기록과 요약으로 이동할 수 있습니다. | 읽던 내용을 확인한 뒤 종료된 회의의 스크립트와 요약으로 이동할 수 있습니다. |
| `panel.viewerEnded.action` | 기록과 요약 보기 | 스크립트와 요약 보기 |
| `archive.resetFailed` | 화자 {count}개를 되돌리지 못했습니다. | 화자 {count}개를 초기화하지 못했습니다. |

## 렌더 확인

영어 계정, 1440·1024. `check-load.mjs`와, 눌러야 나오는 창을 여는 임시 스크립트(scratch, 레포에 남기지 않음)로 봤습니다. 한국어로 바뀐 문장은 1024에서 종료 확인창과 종료 전 안내를 따로 렌더해 줄바꿈을 봤습니다.

| 경로·화면 | 넘침 | 비고 |
|---|---|---|
| `/w/01K0000000000/notes/01K0000000002?tab=details` 진행 중 노트 정보 탭 | 없음 | 「Recording in another tab or on another device.」가 독 자리에 섭니다 |
| `…/01K0000000006?view=full&tab=details` 일시정지 노트 전체 화면 | 없음 | 1024에서 상태 칩 「Paused」는 의도대로 아이콘만 남습니다(sr-only) |
| `…/01K0000000006?tab=summary` 종료 전 안내 | 없음 | |
| `…/01K0000000920?tab=details` 종료 노트 정보 탭 | 없음 | |
| `…/01K0000000920?view=full&tab=transcript` 아카이브 스크립트 | 없음 | |
| 회의 종료 확인창(일시정지 노트) | 없음 | |
| 노트 삭제 확인창(노트 메뉴 → Delete) | 없음 | |
| 참여자 추가 팝업 | 없음 | |

넘침 목록에 잡힌 「Skip to content」「Meeting status changed: …」「Tell us what the meeting is about…」는 숨은 링크·sr-only·닫힌 도움말 툴팁입니다.

남은 한글 중 이 묶음이 아닌 것:

- 노트 머리 메타 「참석자 3명 · 2026년 7월 11일 오전 9:00」「기록 63분」「워크스페이스 멤버에게 공개」(`lib/notes/note-header-meta.ts`), 자동 종료 예고 시각 「10월 23일(금) 오후 4시 20분」(`formatPromiseTime`): plan 13단계
- 공용 창의 닫기 버튼 「닫기」(`components/ui/dialog.tsx`): 이 모듈 밖
- 녹음 독의 「다른 노트에서 녹음 중」 등(`recording-dock.tsx`): 녹음 모듈
- 아카이브의 「검색」「화자」「요약되고 있습니다.」(전사 검색·화자 도구·전사 행): 다음 묶음
- 사이드바·날짜 묶음 머리, 「내 에이전트」 패널 문구: shell·chat 모듈과 plan 13단계
- 회의 제목·참여자 이름·전사 본문·회의 맥락 값·대화 내용: 목 데이터·사용자 데이터

## 코드 리뷰

| 회차 | 지적 | 처리 |
|---|---|---|
| 1 | P2 복사 버튼이 호출부의 한국어 `label`을 그대로 써서 영어 화면에 「스크립트 copied to clipboard.」 | `label` 대신 `kind`를 받아 노트 탭 이름으로 번역하게 바꾸고 호출부 넷을 고쳤습니다 |
| 1 | P3 영어 복수형·보간을 그리는 시험이 없음 | `meeting-end-dialog.test.tsx`에 영어 시험(1명·2명 복수형, 상태 문구)을 더했습니다. 삭제 확인창 영어 시험(`note-delete-dialog.test.tsx`)은 처음부터 넣었습니다 |
| 2 | P2 서버 오류 문구가 fallback보다 먼저 보임 | 의도입니다. APP-1285 이후 서버가 `Accept-Language`로 화면 언어 문구를 돌려줍니다(`error-loading.md`) |
| 2 | P2 비운 제목의 기본값이 화면 언어로 저장됨 | 의도입니다(위 판단). 새 회의 창 기본 제목과 같은 결정입니다 |
| 2 | P3 복사 버튼 언어별 시험이 없음 | `copy-markdown-button.test.tsx`(ko·en)를 더했습니다 |
| 3 | 지적 없음 | |
