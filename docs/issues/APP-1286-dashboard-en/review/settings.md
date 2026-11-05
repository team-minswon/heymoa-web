# 설정 (`settings`)

맡은 파일:

- `components/settings/*.tsx`(시험 제외): 설정 창(`settings-dialog`), 일반(`workspace-settings-form`, `workspace-deletion-section`), 멤버(`members-settings`), 임시 참여자(`guests-settings`, `workspace-guests-settings`), 연동(`workspace-integrations-settings`), MCP 연결(`workspace-agent-access-settings`), 내 계정(`account-settings-form`, `account-deletion-section`), 알림(`notification-settings`), 내 MCP 연결(`agent-connections-settings`), 공용(`confirm-phrase-field`, `rename-person-dialog`)
- `app/(product)/settings/notifications/page.tsx`(로그인 카드 문구, Server Component라 `getTranslations`)
- 더 맡은 것: `components/terms/*`(용어 사전 탭). 설정 창에서만 쓰이고 다른 모듈 목록에 없어 이 모듈에 넣었습니다(코드 리뷰 1회차 P2). `lib/terms/term-bulk.ts`의 `summaryParts`는 문구 대신 `count`를 돌려주고 컴포넌트가 번역합니다
- 더 맡은 것: `lib/workspace/use-rename-member.ts`, `use-rename-guest.ts`의 실패 기본 문구(설정에서만 쓰는 훅, 코드 리뷰 3회차 P2)
- 언어 파일: `messages/<ko|en>/settings.json`. `common.actions`에 `saveChanges`·`rename`·`confirm`을 더했습니다
- `language-settings.tsx`는 `common.language`를 그대로 씁니다. 「언어 · Language」 탭 이름은 화면 언어와 상관없이 두 언어로 적는 의도라 언어 파일 밖 상수로 두었습니다

## 문구 평가

| 축 | 1차 | 2차 |
|---|---|---|
| slop | 4 | 4 |
| 용어 | 4 | 4 |
| 적합도 | 3 | 4 |
| 일관성 | 3 | 4 |
| **평균** | **3.5** | **4.0** |

용어 사전 탭(`terms`)과 이름 변경 실패 문구는 2차 평가 뒤에 더해서 평가를 받지 않았습니다. 같은 기준으로 윤문했고 아래 표에 있습니다.

## 반영한 지적

- `accountDeletion.plan.transfer`·`soleAdmin`: 「관리자 넘기기」가 사람을 넘기는 것처럼 읽혀 「관리자 권한 넘기기」(en Transfer admin role)
- `accountDeletion.effects.deleted`(en): 능동문으로, 「account information」으로 한국어와 맞춤
- `guests.description`: 「이어 붙일」 대신 같은 화면의 「연동」으로
- `guests.addDialog.description`: 「사람을 미리 만들어 둡니다」 → 「사람을 미리 추가합니다」(ko·en)
- `guests.lockedPartial`·`lockedStale`: 「잠갔습니다」 대신 무엇을 못 하는지(ko·en)
- `guests.linkDialog.title`·`deleteDialog.title`·`pairSeparator`: 「을(를)」 대신 이름 받침에 맞는 조사(`{particle}`, `confirm-phrase-field`의 `objectParticle`을 export해 재사용)
- `guests.linkDialog.done`(en), `agentConnections.form.workspace`(en), `agentConnections.row.expires`(en), `agentConnections.usage.nextFailed`(en 「Click」 제거)
- `notifications.mute.*.body`: 「선택 인앱 알림」 → 「선택 알림을 인앱으로」, `reset.body`의 「웹 알림」 → 「인앱 알림」(같은 화면 채널 이름)
- `*.row.meta`: 「{날짜} 연결」 → 「{날짜}에 연결」
- `agentConnections.issued.scopeNote`: 조사 앞 띄어쓰기 제거, 「바꿔 넣으므로」 → 「대체하므로」

## 남긴 지적과 이유

- `accountDeletion.submit` 「탈퇴」→「계정 삭제」: 확인 문구 「회원 탈퇴」와 짝이고, 뒤에 깔린 섹션 버튼 「계정 삭제」와 갈립니다. 영어는 Delete account
- `workspaceAgents.allow.on`·`agentConnections.description`의 「맡기다」: 제품이 위임을 부르는 말이라(설정 화면·가이드 공통) 그대로 둡니다
- `agentConnections.issued.close` 「복사했습니다, 닫기」: 토큰을 다시 볼 수 없어 복사를 확인시키는 의도된 문구입니다
- `agentConnections.usage.*` 「Usage history」: 용어집은 Usage지만 공개된 가이드 영어판이 **[Usage history]**라 D5대로 가이드를 따랐습니다. 용어집을 고쳐야 합니다
- `notifications.mute.muteEmail.label` 「Turn off all email」: 가이드 영어판 표기 그대로입니다

## 한국어에서 바뀐 문장

| 키 | 전 | 후 |
|---|---|---|
| `accountDeletion.reason.codes.MISSING_FEATURE` | 필요한 기능이 없음 | 필요한 기능 부족 |
| `accountDeletion.reason.codes.SECURITY_CONCERN` | 보안·데이터가 걱정됨 | 보안과 데이터 걱정 |
| `accountDeletion.reason.codes.TRANSCRIPTION_QUALITY` | 스크립트·요약 품질 | 스크립트와 요약 품질 |
| `accountDeletion.reason.codes.OTHER_SERVICE` | 다른 서비스를 씀 | 다른 서비스 이용 |
| `accountDeletion.reason.codes.RARELY_USED` | 자주 쓰지 않음 | 낮은 사용 빈도 |
| `accountDeletion.plan.deleteSolo` | 삭제 — 혼자 쓰는 워크스페이스입니다 | 혼자 쓰는 워크스페이스라 삭제합니다. |
| `accountDeletion.plan.leaveShared` | 나가기 — 다른 사람은 계속 씁니다 | 다른 사람이 계속 쓰므로 나가기만 합니다. |
| `accountDeletion.plan.deleteWorkspace` | 워크스페이스 삭제 — 멤버 모두에게 메일이 갑니다 | 워크스페이스 삭제(멤버 모두에게 메일로 알립니다) |
| `accountDeletion.effects.deleted` | 계정 정보와, 혼자 쓰던 워크스페이스·삭제하기로 고른 워크스페이스의 회의 기록(노트·스크립트·음성)이 바로 삭제됩니다. | 계정 정보, 그리고 혼자 쓰던 워크스페이스와 삭제하기로 고른 워크스페이스의 회의 기록(노트, 스크립트, 음성)을 바로 지웁니다. |
| `accountDeletion.effects.conversations` | 모든 워크스페이스에서 내가 나눈 에이전트 대화가 삭제됩니다. | 모든 워크스페이스에서 내가 나눈 에이전트 대화를 지웁니다. |
| `accountDeletion.effects.external` | 이미 외부 도구(Linear·GitHub)로 보낸 내용과 보낸 메일은 남습니다. | 이미 외부 도구(Linear, GitHub)로 보낸 내용과 보낸 메일은 남습니다. |
| `accountDeletion.effects.retained` | 문의 기록 등 일부 정보는 정해진 기간 동안 보관한 뒤 삭제됩니다. | 문의 기록 등 일부 정보는 정해진 기간 동안 보관한 뒤 지웁니다. |
| `workspaceDeletion.description` | 회의 기록(노트·스크립트·음성)을 비롯한 모든 내용을 지우고, 멤버 모두의 접근을 바로 막습니다. 멤버에게는 메일로 알립니다. | 회의 기록(노트, 스크립트, 음성)을 비롯한 모든 내용을 지우고, 멤버 모두의 접근을 바로 막습니다. 멤버에게는 메일로 알립니다. |
| `workspaceDeletion.dialog.description` | 회의 기록(노트·스크립트·음성)을 비롯한 이 워크스페이스의 모든 내용이 지워지고 되돌릴 수 없습니다. 이미 외부 도구(Linear·GitHub)로 보낸 내용과 보낸 메일은 남습니다. | 회의 기록(노트, 스크립트, 음성)을 비롯한 이 워크스페이스의 모든 내용을 지웁니다. 되돌릴 수 없습니다. 이미 외부 도구(Linear, GitHub)로 보낸 내용과 보낸 메일은 남습니다. |
| `members.removeDialog.description` | {email} 계정이 이 워크스페이스의 멤버 목록과 접근 권한을 잃고, 그 멤버가 이 워크스페이스에서 나눈 에이전트 대화가 삭제됩니다. | {email} 계정은 이 워크스페이스에 더 이상 접근할 수 없습니다. 이 멤버가 여기서 나눈 에이전트 대화도 지웁니다. |
| `members.leave.dialog.description` | 회의 기록과 프로젝트에 더 이상 접근할 수 없게 되고, 이 워크스페이스에서 나눈 에이전트 대화가 삭제됩니다. | 회의 기록과 프로젝트에 더 이상 접근할 수 없고, 이 워크스페이스에서 나눈 에이전트 대화도 지웁니다. |
| `members.invite.failed` | 초대에 실패했습니다. | 초대하지 못했습니다. |
| `guests.lockedPartial` | 목록을 끝까지 불러오지 못해 연동·삭제를 잠갔습니다. | 목록을 끝까지 불러오지 못해 연동하거나 삭제할 수 없습니다. |
| `guests.lockedStale` | 최신 목록을 확인하지 못해 연동·삭제를 잠갔습니다. | 최신 목록을 확인하지 못해 연동하거나 삭제할 수 없습니다. |
| `integrations.roleFailed` | 권한을 확인하지 못해 연결·해제를 할 수 없습니다. | 권한을 확인하지 못해 연결하거나 해제할 수 없습니다. |
| `integrations.adminOnly` | 연동 연결·해제는 관리자만 할 수 있습니다. 새 연동이 필요하면 ADMIN에게 요청하세요. | 관리자만 연동을 연결하거나 해제할 수 있습니다. 새 연동이 필요하면 관리자에게 요청하세요. |
| `workspaceAgents.description` | 팀원이 Claude·ChatGPT 같은 AI 앱에 이 워크스페이스를 연결해도 되는지 정합니다. 관리자는 연결된 앱을 보고 끊을 수 있습니다. | 팀원이 Claude나 ChatGPT 같은 AI 앱에 이 워크스페이스를 연결해도 되는지 정합니다. 관리자는 연결된 앱을 보고 끊을 수 있습니다. |
| `workspaceAgents.allow.on` | 팀원이 이 워크스페이스를 Claude·ChatGPT 같은 AI 앱에 맡길 수 있습니다. | 팀원이 이 워크스페이스를 Claude나 ChatGPT 같은 AI 앱에 맡길 수 있습니다. |
| `workspaceAgents.allow.off` | 꺼짐 — 새 연결을 만들 수 없습니다. | 꺼져 있어 새 연결을 만들 수 없습니다. |
| `workspaceAgents.offDialog.description` | 지금 연결된 연결이 모두 끊기고, 다시 켜도 되살아나지 않습니다. 끈 동안은 누구도 이 워크스페이스로 연결할 수 없습니다. | 지금 열린 연결이 모두 끊기고, 다시 켜도 되살아나지 않습니다. 끈 동안은 누구도 이 워크스페이스로 연결할 수 없습니다. |
| `workspaceAgents.row.neverUsed` | 아직 안 씀 | 없음 |
| `agentConnections.description` | Claude·ChatGPT 같은 AI 앱이 내가 맡긴 워크스페이스의 회의와 프로젝트를 읽을 수 있게 연결합니다. | Claude나 ChatGPT 같은 AI 앱이 내가 맡긴 워크스페이스의 회의와 프로젝트를 읽을 수 있게 연결합니다. |
| `guests.description` | 계정 없이 회의에 참여한 사람입니다. 나중에 계정이 생기면 이어 붙일 수 있습니다. | 계정 없이 회의에 참여한 사람입니다. 나중에 계정이 생기면 그 계정과 연동할 수 있습니다. |
| `guests.linkDialog.title` | {name}을(를) 계정과 연동 | {name}{particle} 계정과 연동 |
| `guests.linkDialog.pairSeparator` | 을(를) 다음 계정과 잇습니다: | {particle} 다음 계정과 잇습니다: |
| `guests.deleteDialog.title` | {name}을(를) 삭제할까요? | {name}{particle} 삭제할까요? |
| `notifications.mute.muteAll.body` | 선택 인앱 알림을 받지 않습니다. 다시 켜면 이전 설정이 그대로 돌아옵니다. | 선택 알림을 인앱으로 받지 않습니다. 다시 켜면 이전 설정이 그대로 돌아옵니다. |
| `notifications.mute.muteEmail.body` | 선택 메일을 받지 않습니다. 다시 켜면 이전 설정이 그대로 돌아옵니다. | 선택 알림을 메일로 받지 않습니다. 다시 켜면 이전 설정이 그대로 돌아옵니다. |
| `notifications.reset.body` | 일시정지된 회의 메일과 검토할 결과 웹 알림이 다시 켜집니다. | 일시정지된 회의 메일과 검토할 결과 인앱 알림이 다시 켜집니다. |
| `workspaceAgents.row.meta` | {connected} 연결 · 최근 사용 {lastUsed} | {connected}에 연결 · 최근 사용 {lastUsed} |
| `agentConnections.row.meta` | {connected} 연결 · 최근 사용 {lastUsed} | {connected}에 연결 · 최근 사용 {lastUsed} |
| `agentConnections.issued.scopeNote` | Claude Code 는 명령을 실행한 폴더에서만 연결됩니다. 어느 폴더에서나 쓰려면 <code>--scope user</code> 를 붙이세요. Codex 는 모든 폴더에서 연결됩니다. Codex 블록은 기존 heymoa 등록을 바꿔 넣으므로 다시 붙여 넣어도 됩니다. Claude Code 는 이미 등록했다면 먼저 <code>claude mcp remove heymoa</code> 로 지우세요. | Claude Code는 명령을 실행한 폴더에서만 연결됩니다. 어느 폴더에서나 쓰려면 <code>--scope user</code>를 붙이세요. Codex는 모든 폴더에서 연결됩니다. Codex 블록은 기존 heymoa 등록을 대체하므로 다시 붙여 넣어도 됩니다. Claude Code에 이미 등록했다면 먼저 <code>claude mcp remove heymoa</code>로 지우세요. |
| `accountDeletion.plan.soleAdmin` | 내가 유일한 관리자입니다. 관리자를 넘기거나 워크스페이스를 삭제하세요. | 내가 유일한 관리자입니다. 관리자 권한을 넘기거나 워크스페이스를 삭제하세요. |
| `accountDeletion.plan.transfer` | 관리자 넘기기 | 관리자 권한 넘기기 |
| `guests.addDialog.description` | 계정 없이 회의에 참여하는 사람을 미리 만들어 둡니다. | 계정 없이 회의에 참여할 사람을 미리 추가합니다. |
| `terms.help` | 받아쓰기가 자주 틀리는 제품명·사내 용어·영어 약어를 적어 두면, 이 워크스페이스의 모든 회의에서 받아 적을 때 참고해요. 흔한 단어는 넣지 않아도 돼요. | 받아쓰기가 자주 틀리는 제품명, 사내 용어, 영어 약어를 적어 두면 이 워크스페이스의 모든 회의를 받아 적을 때 참고합니다. 흔한 단어는 넣지 않아도 됩니다. |
| `terms.fullPlaceholder` | 더 넣을 자리가 없어요 | 더 넣을 자리가 없습니다 |
| `terms.full` | 다 채웠어요. 하나를 지우면 더할 수 있어요. | 다 채웠습니다. 하나를 지우면 더할 수 있습니다. |
| `terms.previewHint` | 쉼표(,)·줄바꿈·세미콜론·탭으로 나누면 여기에 미리 보여 드려요. | 쉼표(,), 줄바꿈, 세미콜론, 탭으로 나누면 여기에 미리 보여 드립니다. |
| `terms.previewStatus.duplicate` | 이미 있어요 | 중복 |
| `terms.summary.duplicates` | 이미 있어요 {count}개 | 중복 {count}개 |
| `terms.summary.overLimit` | 한도를 넘어 못 넣어요 {count}개 | 한도 초과 {count}개 |
| `terms.empty` | 아직 등록한 용어가 없어요. | 아직 등록한 용어가 없습니다. |
| `terms.noMatch` | 찾는 용어가 없어요. | 찾는 용어가 없습니다. |
| `terms.outcome.added` | {count}개를 더했어요 | {count}개를 더했습니다 |
| `terms.outcome.existing` | 이미 있던 {count}개는 건너뛰었어요 | 이미 있던 {count}개는 건너뛰었습니다 |
| `terms.outcome.overLimit` | 한도를 넘어 {count}개는 못 넣었어요 | 한도를 넘어 {count}개는 넣지 못했습니다 |
| `terms.outcome.invalid` | {count}개는 형식이 맞지 않아 뺐어요 | {count}개는 형식이 맞지 않아 뺐습니다 |
| `terms.outcome.failed` | {count}개는 보내지 못했어요. 입력란에 남겼으니 다시 눌러 주세요 | {count}개는 보내지 못했습니다. 입력란에 남겼으니 다시 눌러 주세요 |

`accountDeletion.confirmPhrase`(새 키, ko 「회원 탈퇴」·en 「delete my account」): 확인 문구를 화면 언어로 받고, 맞으면 계약 값 「회원 탈퇴」를 보냅니다. 영어 사용자가 한국어 입력기 없이 탈퇴할 수 있어야 해서입니다(코드 리뷰 4회차 P2).

## 렌더 확인

영어 계정, 1440·1024. `check.mjs`가 `networkidle`에서 페이지마다 120초 시간 초과로 멈춰, `load` + 3.5초 대기로 바꾼 사본으로 돌렸습니다. 확인창은 클릭을 더한 임시 스크립트로 열었습니다(1440).

| 경로 | 무엇을 열었나 | 넘침 | 비고 |
|---|---|---|---|
| `/w/01K0000000000?settings=workspace`·`members`·`guests`·`terms`·`integrations`·`workspaceAgents`·`account`·`notifications`·`agents` | 각 탭 | 없음 | 잡힌 넘침은 모두 sr-only(폭 1px: 창 제목·설명, 초대 칸 라벨, 도움말 툴팁 내용)와 「Skip to content」, chat 모듈의 「내 에이전트」 |
| `/settings/notifications` | 메일 푸터 진입(목 모드라 알림 탭으로 넘어감) | 없음 | |
| 같은 탭들 | 워크스페이스 삭제, 계정 삭제, 멤버 메뉴·내보내기·이름 변경, 나가기, 임시 참여자 추가·삭제·연동, 알림 되돌리기·메일 끄기, MCP 끄기·끊기, 사용 내역·회수·지난 연결 | 없음 | |

1024에서 「My MCP connections」 메뉴 글자가 왼쪽 열 끝(220px)에 가깝지만 잘리지 않습니다.

남은 한글 중 이 모듈 것이 아닌 것:

- 목·사용자 데이터: 워크스페이스·사람·연결·용어 이름, 회의 목록(배경)
- `agents`: 「새 연결」 안내(`AgentOAuthGuide`), `AgentAccessNotice`, `TaskChangesToggle`, `CopyBlock`, `BLOCKED_SUFFIX` 「 (MCP 꺼짐)」
- `components/heymoa/help-link.tsx`의 「자세히」, `components/ui/dialog.tsx`의 sr-only 「닫기」
- 「언어 · Language」(의도)

## 코드 리뷰

| 회차 | 지적 | 처리 |
|---|---|---|
| 1 | P2: 용어 사전 탭 본문이 한국어 | `components/terms`를 이 모듈에 넣어 옮김 |
| 1 | P3: ICU 문법·인자 검증 없음 | 남김. 5회차에서 codex가 ICU 파서로 두 파일을 돌려 오류 없음을 확인 |
| 2 | P2: 「새 연결」 안내(`AgentOAuthGuide`)가 한국어 | 범위 밖(`agents` 모듈)이라 남김 |
| 3 | P2: 이름 변경 실패 기본 문구가 한국어(`use-rename-*`) | `settings.renameDialog.failed`로 옮김 |
| 4 | P2: 영어 화면에서 계정 삭제 확인 문구가 한국어로 고정 | 화면 언어로 입력받고 계약 값을 보냄. 영어 시험 추가 |
| 5 | 지적 없음 | |

시험: `notification-settings.test.tsx`(영어 표·확인 창), `account-deletion-section.test.tsx`(영어 확인 문구 → 계약 값)에 영어 시험을 더했습니다. 바뀐 한국어 문구에 맞춰 컴포넌트 시험과 e2e 세 곳(`account-deletion`, `workspace-agent-access`, `term-dictionary`)의 기대값을 고쳤습니다(e2e는 돌리지 않음).
