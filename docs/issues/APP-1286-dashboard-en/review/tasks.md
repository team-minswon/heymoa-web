# 할 일 (`tasks`)

맡은 파일:

- `components/tasks/`: `all-tasks.tsx`(목록·탭·거르기·묶음), `task-row.tsx`(줄), `new-task-dialog.tsx`(할 일 추가), `task-history-sheet.tsx`(이력 시트·되돌리기 확인창), `use-task-update.ts`(저장 실패 토스트)
- `lib/tasks/task-groups.ts`: 묶음 이름을 지우고 키만 돌려줍니다. `TASK_STATUS_LABEL`은 `common.taskStatus`로 바꾸고 더 쓰는 곳이 없어 지웠습니다. `task-list-cache.ts`·`use-task-list-pages.ts`는 한글이 없습니다
- 공용 소품(`common`): `components/heymoa/due-cell.tsx`, `assignee-cell.tsx`, `show-more-button.tsx`, `email-recipients-input.tsx`, `components/ui/dialog.tsx`·`sheet.tsx`의 sr-only 「닫기」
- `lib/assignees/describe.ts`: `describeAssignee`가 화자 이름을 만드는 함수를 받습니다(기본값은 한국어 「화자 X」로, 회의록·복사본이 13단계까지 씀)
- 언어 파일: `messages/<ko|en>/tasks.json`, `messages/<ko|en>/common.json`(`actions.add`·`edit`·`collapse`, `fields`, `assigneeCell`, `dueCell`, `recipients`)
- 등록: `i18n/messages.ts`, `i18n/messages.test.ts`의 `REQUIRED_EN`, `components/layout/app-shell.tsx`의 `PRODUCT_NAMESPACES`

판단:

- **공용 소품 문구는 `common`에 둡니다.** 담당·기한 칸은 검토 화면과 할 일 목록이, 받는 사람 입력은 공유 메일 창이, 「접기」 버튼은 검토 섹션이 같이 씁니다. 칸 이름은 `common.fields`(내용·상태·담당·기한·프로젝트)로 모아 목록 머리·새 할 일 창·이력 시트가 같이 씁니다
- **`DueCell`·`AssigneeCell`의 `label` prop을 지웠습니다.** 넘기는 곳이 없었고, 한국어 어순(「담당 X 바꾸기」)을 조립하던 자리라 문장 전체를 키(`common.assigneeCell.change`·`common.dueCell.change`)로 옮겼습니다. `placeholder`는 넘기지 않으면 언어 파일의 기본값을 씁니다
- **`DueCell`이 화면 언어로 날짜를 씁니다**(`useDisplayLocale`). 전에는 영어 화면에서도 「11월 4일 (수)」였습니다
- **이력의 `revisionChanges`는 문구 대신 칸 키와 비교 값을 돌려줍니다**(상태 코드, 담당 이름 또는 `null`, 날짜 키). 화면이 `common.fields`·`common.taskStatus`·`tasks.sheet.none`과 `formatDueDate(…, locale)`로 그립니다. 첫 판은 `before`가 없고(`undefined`), `null`은 「없음」입니다
- **누가 바꿨는지 문장은 ICU 한 문장**(`tasks.sheet.author.*`)입니다. 한국어 주격 조사는 `subjectParticle`이 받침으로 골라 `{particle}`에 넣고, 동사는 `{verb, select, created … other …}`입니다. 이름 강조는 `t.rich`의 `<b>`
- **영어 화면에 맞춰 레이아웃 두 곳을 넓혔습니다**: 할 일 표의 기한 칸 112px → 128px(「Wed, November 4」가 1440에서 두 줄로 꺾였습니다), 이력·되돌리기 창의 칸 이름 열 32px → `auto`(「Assignee」 「Due date」). 기한 칸 글자에 `whitespace-nowrap`을 붙였습니다(날짜 한 덩어리 규칙)
- `components/ui`에서 `useTranslations`를 씁니다. 제품 루트와 마케팅 루트 모두 `common`을 받으므로 Provider 밖에서 그려지는 Dialog·Sheet는 없습니다. 예외는 가이드 표현 샘플(`app/(product)/help-samples`)이 자기 Provider로 `help`만 내려 주던 것이라 `common`도 내려 주게 했습니다
- 「할 일」 탭 이름은 `common.taskStatus`를 그대로 씁니다(In progress / Done / Canceled)

## 문구 평가

| 축 | 1차 | 2차 |
|---|---|---|
| slop | 4 | 4 |
| 용어 | 5 | 5 |
| 적합도 | 3 | 4 |
| 일관성 | 3 | 4 |
| **평균** | **3.8** | **4.3** |

## 반영한 지적

1차
- `sheet.cancelTask`: 「취소」 → 「할 일 취소」(편집 취소·닫기와 갈리게). 영어는 처음부터 Cancel task
- `common.recipients.sendTo`: 고르면 받는 사람에 더할 뿐이라 「이 주소로 보내기 / Send to this address」 → 「받는 사람으로 추가 / Add as recipient」
- `common.recipients.typed`: 「직접 입력 / Other address」 → 「직접 입력한 주소 / Typed address」
- `sheetClosed`: 「시트」 → 「할 일 창」, en 「…so the task panel closed. Open it again from the list.」
- `newTask.description`: 「…프로젝트 할 일로 추가합니다.」, en 「Add work that came up outside a meeting as a project task.」
- `summary`(en): 진행 중 수에 단위를 붙임 「2 projects · 9 tasks in progress」
- `groups.LATER`(en): Later → Next week and later
- `sheet.description`: 가운뎃점 나열 → 「할 일의 담당과 기한, 변경 이력」
- `revert.description`: 「할 일이 바로 앞 상태로 돌아가고…」 / 「The task goes back to its previous state…」
- `sheet.author.meetingCreated`·`meetingChanged`: 「회의 확정으로」가 회의 자체를 확정한 것으로 읽혀 「회의 검토를 마치며 생겼습니다/바뀌었습니다」 / 「Created/Changed when the meeting review was finished」

2차
- `row.agentNamed`: 「에이전트 · {name}」 → 「에이전트({name})」 / 「Agent ({name})」 — 이력 시트의 「…의 에이전트(연결 이름)」와 같은 꼴
- `noProjects`(en): No projects yet. → No projects.(한국어와 같은 뜻)

## 남긴 지적과 이유

- `sheet.changedTo`(sr-only 「에서 / to」를 「에서 다음으로 변경:」으로): 화면 읽기 프로그램이 「진행 중 에서 완료」로 읽어 「A에서 B」로 뜻이 통합니다. 채팅 승인 카드도 같은 꼴입니다
- `common.assigneeCell.change`·`dueCell.change`를 「담당 바꾸기, 현재 담당: X」로: 문구가 길어지고, 지금 꼴(「담당 한지원 바꾸기」)도 현재 값과 동작이 함께 읽힙니다
- `sheet.discard`(편집 중 「그대로 두기」 → 「취소」): 편집 중에는 「할 일 취소」가 보이지 않지만, 같은 시트에 상태를 바꾸는 「할 일 취소」가 있어 「취소」를 피했습니다. 영어는 Cancel입니다
- `sheet.author.meeting*`의 능동형(「추가했습니다」) 제안: 주어가 사람이 아니라 회의 검토라 피동이 자연스럽습니다
- `summary`의 한국어 가운뎃점: 머리글 아래 개수 표기라 이름표 예외로 둡니다

## 한국어에서 바뀐 문장

| 키 | 전 | 후 |
|---|---|---|
| `tasks.sheet.description` | 할 일의 담당 · 기한과 바뀐 이력 | 할 일의 담당과 기한, 변경 이력 |
| `tasks.sheet.cancelTask` | 취소 | 할 일 취소 |
| `tasks.sheetClosed` | 저장하지 못해 시트를 닫았습니다. 목록에서 다시 열어 주세요. | 저장하지 못해 할 일 창을 닫았습니다. 목록에서 다시 열어 주세요. |
| `tasks.newTask.description` | 회의 밖에서 생긴 일도 프로젝트 할 일로 둡니다. | 회의 밖에서 생긴 일도 프로젝트 할 일로 추가합니다. |
| `tasks.revert.description` | 바로 앞 값으로 돌아가고 팀원에게도 곧바로 보입니다. | 할 일이 바로 앞 상태로 돌아가고 팀원에게도 곧바로 보입니다. |
| `tasks.sheet.author.meetingCreated` | 회의 확정으로 생겼습니다 | 회의 검토를 마치며 생겼습니다 |
| `tasks.sheet.author.meetingChanged` | 회의 확정으로 바뀌었습니다 | 회의 검토를 마치며 바뀌었습니다 |
| `tasks.row.agentNamed` | 에이전트 · {name} | 에이전트({name}) |
| `common.recipients.typed` | 직접 입력 | 직접 입력한 주소 |
| `common.recipients.sendTo` | 이 주소로 보내기 | 받는 사람으로 추가 |

## 렌더 확인

경로 `/w/01K0000000000/tasks`, 영어 계정, 1440·1024. 임시 스크립트로 차례로 열었습니다: 목록 → 완료 탭 → 진행 중 탭 → 프로젝트 메뉴 → 담당 고르기(찾기 결과 없음 포함) → 할 일 추가 창 → 이력 시트(외부 에이전트가 바꾼 줄) → 되돌리기 확인창 → 시트 편집.

- 넘침: 처음에는 영어 날짜가 기한 칸(112px)보다 길어 1440에서 「Wed, November / 4」로 꺾였고, 칸을 128px로 넓히고 `whitespace-nowrap`을 붙여 없앴습니다. 검사에 남은 것은 오탐입니다: 기한 버튼의 `-mx-1.5` 음수 여백으로 바깥 span의 scrollWidth가 6px 큰 것, 가리킬 때만 펼쳐지는 빈 칸 글(「Set due date」), sr-only(「Skip to content」 「Close」 「to」, 시트 설명). 가로 스크롤 없음
- 남은 한글은 모두 목·사용자 데이터입니다: 할 일 내용, 프로젝트 이름(고객·주간), 사람 이름, 워크스페이스 이름, 외부 에이전트 연결 이름(「노트북 Claude Code」), 그것이 들어간 aria-label(「Mark … as done」 「Change assignee (…)」 「Menu for project 고객」)
- 다른 모듈 문구: 없음

## 코드 리뷰

1회차
- 지적 없음
