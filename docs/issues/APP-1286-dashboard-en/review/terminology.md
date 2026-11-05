# 영어 용어 정리 (용어집 재검토 반영)

용어집(docs `1d52e647`)이 D16·D17 기준(다른 서비스의 관용 표기 우선, 없으면 자연스러운 미국 영어)으로 다시 쓰인 뒤, 이미 끝낸 모듈의 영어 언어 파일을 맞췄습니다. 한국어 파일은 바꾸지 않았습니다. `content/help/en/**`와 `messages/en/help.json`은 4단계에서 따로 고칩니다.

대상: `messages/en/{shell,settings,workspace,notes,errors,common,landing,auth}.json`. `errors.json`과 `auth.json`에는 옛 표기가 없었습니다(`auth.json`의 「joins the conversation」은 회의 대화를 가리켜 그대로 둡니다).

값 65개를 바꿨습니다.

## 바꾼 표기

### settings.json

| 키 | 이전 | 새 |
|---|---|---|
| `nav.items.terms` | Glossary | Custom vocabulary |
| `terms.title` | Glossary | Custom vocabulary |
| `terms.loading` | Loading glossary | Loading custom vocabulary |
| `terms.loadFailed` | Couldn't load the glossary. | Couldn't load custom vocabulary. |
| `terms.full` | The glossary is full. … | Your custom vocabulary is full. … |
| `terms.outcome.existing` | Skipped {count} already in the glossary | Skipped {count} already in your vocabulary |
| `accountDeletion.effects.conversations` | Your agent conversations … | Your agent chats … |
| `members.description` | … members and pending invites. | … members and pending invitations. |
| `members.removeDialog.description` | Their agent conversations here … | Their agent chats here … |
| `members.leave.description` | … you'll need a new invite. | … you'll need a new invitation. |
| `members.leave.dialog.description` | … your agent conversations … | … your agent chats … |
| `members.invite.description` | … the link in the invite. | … the link in the invitation. |
| `members.invite.failed` | Couldn't send the invite. | Couldn't send the invitation. |
| `members.pending.title` | Pending invites | Pending invitations |
| `members.pending.loading` | Loading pending invites | Loading pending invitations |
| `members.pending.loadFailed` | Couldn't load pending invites. | Couldn't load pending invitations. |
| `members.pending.empty` | No pending invites. | No pending invitations. |
| `notifications.types.WORKSPACE_INVITATION` | Workspace invites | Workspace invitations |
| `workspaceAgents.allow.title` | Allow MCP connection | Allow MCP connections |
| `workspaceAgents.open.title` | Open connections | Active connections |
| `workspaceAgents.open.loading` | Loading open connections | Loading active connections |
| `workspaceAgents.open.empty` | No open connections. | No active connections. |
| `workspaceAgents.offDialog.descriptionCount` | The # open connection … / All # open connections … | The # active connection … / All # active connections … |
| `workspaceAgents.offDialog.description` | All open connections … | All active connections … |
| `agentConnections.credential.PERSONAL_TOKEN` | Personal token | Personal access token |
| `agentConnections.usage.label` | Usage history | Activity |
| `agentConnections.usage.loading` | Loading usage history | Loading activity |
| `agentConnections.usage.loadFailed` | Couldn't load usage history. | Couldn't load activity. |
| `agentConnections.usage.nextFailed` | Couldn't load more history. … | Couldn't load more activity. … |
| `agentConnections.usage.loadingMore` | Loading more usage history | Loading more activity |

### workspace.json (초대 수락 화면 `invite.*`)

| 키 | 이전 | 새 |
|---|---|---|
| `invite.missingToken` | … in the invite email. | … in the invitation email. |
| `invite.anonymous.description` | … accept the invite … | … accept the invitation … |
| `invite.alreadyMember.description` | … accept the invite again. … | … accept the invitation again. … |
| `invite.checking.title` | Checking your invite | Checking your invitation |
| `invite.acceptFailed.title` | Couldn't accept the invite | Couldn't accept the invitation |
| `invite.errors.notFound.title` | This invite link isn't valid | This invitation link isn't valid |
| `invite.errors.notFound.description` | … the invite was deleted. Check the link in the invite email. | … the invitation was deleted. Check the link in the invitation email. |
| `invite.errors.expired.title` | This invite has expired | This invitation has expired |
| `invite.errors.expired.description` | Invite links are valid … | Invitation links are valid … |
| `invite.errors.notPending.title` | This invite was already handled | This invitation was already handled |
| `invite.errors.notPending.description` | … for a new invite. | … for a new invitation. |
| `invite.errors.emailMismatch.title` | This invite is for a different email | This invitation is for a different email |

동사 invite(「Invite teammates」「Invite members」「Ask a workspace admin to invite you again」)는 그대로입니다.

### notes.json

| 키 | 이전 | 새 |
|---|---|---|
| `endNudge.items.speakers.title` | Speaker separation | Speaker identification |
| `endNudge.items.speakers.body` | Separates speakers so you can name them | Identifies speakers so you can name them |
| `endDialog.participantsNone` | … speakers are separated … speaker separation. | … speakers are identified … speaker identification. |
| `endDialog.participantsOne` | … this speaker separation. | … this speaker identification. |
| `endDialog.participantsMany` | … this speaker separation. | … this speaker identification. |
| `endFeedback.progress.failed` | … You can reanalyze it on the Summary tab. | … You can regenerate the summary on the Summary tab. |
| `preEnd.steps.speakers.title` | Speaker separation | Speaker identification |
| `deleteDialog.chats` | Agent conversations … Conversations that also … | Agent chats … Chats that also … |
| `details.facts.duration` | Recorded time | Duration |

`timeline.retracted`(Reversed), `timeline.agendaRetracted`(Withdrawn), `speakers.status.*`(Identifying speakers), `summary.failed.reanalyze`(Regenerate)는 이미 새 표기였습니다.

### shell.json · common.json

| 파일 | 키 | 이전 | 새 |
|---|---|---|---|
| shell | `sidebar.deleteDialog.description` | … the agent conversations in it … | … the agent chats in it … |
| common | `agentChat.starter.examples.actionItems.question` | Turn this meeting's action items into tasks | Turn what this meeting agreed to do into tasks |

### landing.json (용어만, 문장 구조는 그대로)

| 키 | 이전 | 새 |
|---|---|---|
| `app.undoExclude` | Undo exclude | Include |
| `app.retracted` | Retracted | Reversed |
| `faq.items.q3.a` | … marks it Retracted. | … marks it Reversed. |
| `faq.items.q4.a` | … and Undo exclude brings them back. | … and Include brings them back. |
| `faq.items.q6.a` | Speakers aren't separated during the meeting … | Speakers aren't identified during the meeting … |
| `team.lead2` | … the link in the invite. | … the link in the invitation. |
| `team.caption` | … one pending invite. | … one pending invitation. |
| `team.members.description` | … pending invites. | … pending invitations. |
| `team.members.pending` | Pending invites | Pending invitations |
| `safety.external.figure` | … the expanded usage list … | … the expanded activity list … |
| `safety.external.usage` | Usage | Activity |
| `demo.details.recorded` | Recording length | Duration |

## 용어집과 어긋나게 판단한 곳

- **`common` 제안 질문 「이 회의의 액션 아이템을 할 일로 만들어줘」**: 한국어가 「액션 아이템」을 쓰지만 D17이 영어에서 action items를 쓰지 않기로 해서, 「Turn what this meeting agreed to do into tasks」로 옮겼습니다. 사용자가 에이전트에 보내는 문장이라 뜻만 같으면 됩니다
- **랜딩 SEO 키워드 `meta.keywords`의 「meeting minutes」「action items」**: 화면 용어가 아니라 검색어라 그대로 뒀습니다. 사람들이 실제로 검색하는 말입니다
- **`terms.outcome.existing`**: 「already in custom vocabulary」는 관사가 없어 어색해서 「already in your vocabulary」로 썼습니다(용어집 메모의 「짧게 vocabulary」)
- **회의 대화를 뜻하는 conversation**(`workspace.onboarding.descriptionNoNote`, `notes.transcript.notStarted.title`, `auth` 설명)은 채팅이 아니라 그대로 뒀습니다

## 같이 고친 것: 1024 노트 상단바의 상태 칩과 탭 겹침

1024 전체 보기(오른쪽 에이전트 레일 440px)에서 노트 상단바 폭이 553px이고, 영어 탭(Details·Transcript·Timeline·Summary)과 「End meeting」 버튼이 한국어보다 약 110px 넓어 왼쪽 묶음(이동 버튼·상태 칩·제목)이 26px로 눌렸습니다. 줄지 않는 칩이 탭 밑으로 들어갔습니다.

- `MeetingStatusChip`: 「일시정지됨」에만 걸던 좁은 상단바(`@max-[640px]/topbar`) 접기를 모든 상태에 겁니다. 점·아이콘만 남고 글자는 스크린리더와 툴팁(`title`)에 남습니다
- 「End meeting」 버튼도 같은 폭에서 아이콘만 남깁니다. 이름은 sr-only와, 막히지 않은 때의 `title` 툴팁으로 남습니다(막힌 때는 원래 있던 이유 툴팁)
- 확인: 1440·1024에서 노트 3건(기록 중 0002·0028, 일시정지 0006)을 `?view=full`로 열고 상단바의 탭 목록과 나머지 요소의 `getBoundingClientRect` 겹침 면적이 모두 0입니다. 1024에서 탭 목록 왼쪽이 81 → 159px로 옮겨 왼쪽 묶음이 제자리를 찾았습니다
- 영향: 같은 폭에서는 한국어 화면도 칩 글자가 접힙니다. 제목은 이 폭에서 원래도 0px였고 바로 아래 노트 머리에 큰 제목이 있습니다

## 코드 리뷰 (codex)

| 회차 | 지적 | 처리 |
|---|---|---|
| 1 | P2 회의 종료 버튼이 좁은 폭에서 아이콘만 남아 이름이 안 보임 | 막히지 않은 때 `title` 툴팁을 더했습니다 |
| 1 | P2 상태 칩 글자가 접히면 터치로 확인할 수 없음 | 그대로 둡니다. 「일시정지됨」에 이미 쓰던 접기(점·아이콘 + `title` + sr-only)를 넓힌 것이고, 기준 폭은 데스크톱입니다(`ui-text-layout.md`). 상태는 녹음 독과 노트 머리에도 보입니다 |
| 1 | P2 `messages/en/legal.json`에 옛 용어가 남음 | 범위 밖입니다. 약관·처리방침은 이번 대상 파일이 아니고 법률 문서라 따로 다룹니다(아래 「남은 것」) |
| 1 | P3 겹침을 브라우저 시험으로 지키지 않음 | e2e는 이번에 더하지 않습니다. 위 Playwright 스크립트로 확인했습니다 |
| 2 | 지적 없음 | |

## 남은 것

- `messages/en/legal.json`에 glossary·speaker separation·agent conversations 같은 옛 표기가 있습니다. 법률 문서라 손대지 않았습니다
- 가이드(`content/help/en/**`, `messages/en/help.json`)는 4단계에서 고칩니다. `help-pages-en.test.tsx`·`e2e/help-en.spec.ts`의 「glossary」 검색어도 그때 같이 바뀝니다
