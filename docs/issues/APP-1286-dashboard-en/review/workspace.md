# 워크스페이스·프로젝트·초대 (`workspace`)

맡은 파일:

- `components/workspace/`: `workspace-page.tsx`, `workspace-note-list.tsx`, `note-list-row.tsx`, `new-meeting-dialog.tsx`, `create-project-dialog.tsx`, `create-workspace-dialog.tsx`, `workspace-onboarding.tsx`, `onboarding-checklist.tsx`, `invite-landing.tsx`, `workspace-login-card.tsx`, `feedback-dialog.tsx` (`use-feedback-answers.ts`는 주석만 한글이라 그대로입니다)
- `components/projects/`: `project-view-tabs.tsx`, `project-agenda-map.tsx`, `agenda-ribbon-board.tsx`, `agenda-ribbon-column.tsx`, `agenda-ribbon-hover.tsx`, `agenda-ribbon-legend.tsx`, `agenda-map-panel.tsx`, `agenda-focus.tsx`, `agenda-edge-buttons.tsx`
- `app/(product)/inquiries/[feedbackId]/page.tsx` (`app/(product)/invite/**`와 `app/(product)/w/**`는 주석만 한글입니다)
- `components/heymoa/help-link.tsx` 「자세히」 → `common.actions.learnMore`
- `lib/onboarding/checklist.ts`: 단계 이름을 빼고 id만 남겼습니다. 이름은 `workspace.checklist.steps.<id>`가 그립니다
- 언어 파일: `messages/<ko|en>/workspace.json`, `messages/<ko|en>/common.json`의 `actions.create`·`close`·`learnMore`, `createWorkspace`, `meetingStatus`

판단 셋:

- **새 워크스페이스 창은 `common.createWorkspace`에 두었습니다.** 랜딩(`landing-cta.tsx`, 마케팅 루트)도 이 창을 엽니다. 마케팅 루트의 `clientNamespaces`에 `workspace` 전체를 보내지 않으려고 두 루트가 같이 받는 `common`에 넣었습니다
- **노트 목록의 회의 상태는 `common.meetingStatus`로 그립니다.** `lib/notes/meeting-state.ts`의 `MEETING_STATUS_LABEL`은 노트 화면(`meeting-controls`·`note-view`)도 써서 `notes` 모듈 몫입니다. 목록 행만 먼저 옮겼고, `notes` 모듈이 같은 키를 쓰면 상수를 지울 수 있습니다
- **문의 본문 뒤 「화면:·환경:」 꼬리는 한국어로 둡니다.** 운영자가 읽는 데이터이고 `userPart`가 그 표식으로 잘라 냅니다

## 문구 평가

| 축 | 1차 | 2차 |
|---|---|---|
| slop | 4 | 4 |
| 용어 | 4 | 4 |
| 적합도 | 4 | 4 |
| 일관성 | 3 | 3 |
| **평균** | **3.8** | **3.8** |

2차의 일관성 지적 대부분(영어 복수형, 두 언어의 뜻 차이)을 반영했으나 다시 평가하지는 않았습니다. 최종 점수는 2차 3.8입니다.

## 반영한 지적

1차
- `onboarding.descriptionNoNote`: 「액션 아이템」을 용어집의 「할 일 / tasks」로(ko·en). 영어는 「is transcribed in real time」
- `agendaMap.detail.openItems`: 「남은 질문」 → 용어집의 「열린 질문」
- `agendaMap.panel.siblings`(en): ICU 복수형
- `agendaMap.focus.neighborTitle`(en): 「Also in meetings on {dates}」
- `agendaMap.empty.title`·`noMeetings`(en): 짧고 덜 번역투로
- `createProject.descriptionFirst`(en): 「Name the project after a team, product, or customer you meet about regularly」
- `common.createWorkspace.description`(en): 「Name the workspace for your meeting notes.」

2차
- `page.noteCount`(en): 「meetings recorded」 → 「meeting notes」(한국어 「회의 기록」의 개수와 같은 뜻)
- `invite.errors.notFound.description`(ko): 「링크가 잘못되었거나 초대가 삭제되었습니다.」
- `loginCard.title`(en): 「You'll return to this page after signing in」
- `feedback.kinds.incident.placeholder`(en): 질문 요소의 순서를 자연스럽게
- `agendaMap.detail.splits`(en): ICU 복수형
- `agendaMap.focus.outline`(en): 「Full map outline」

렌더 확인에서
- `agendaMap.panel.agendaTab`(en): 「Agenda item」이면 1440·1024 모두 옆 패널 머리의 「View this topic larger」 버튼이 닫기(X)를 덮었습니다. 탭을 「Item」으로 줄였습니다

## 남긴 지적과 이유

- `agendaMap.focus.back` 「전체 지도 / All topics」, `focusTopicHint`·`panel.focusTopic` 「이 줄기 크게 보기 / View this topic larger」: 두 언어 사용 가이드(`content/help/**/situations/agenda-map.md`)에 실린 버튼 이름입니다(D5)
- `agendaMap.focusTopicHint`의 「눌러서 / Click to」가 aria-label에도 들어간다는 지적: 연결 지도 전체가 같은 꼴(「눌러서 접기」 등)이라 한 곳만 바꾸지 않았습니다
- `agendaMap.expandBranchesPill`의 「+N」: 화면의 알약 모양 그대로를 가리킵니다
- `agendaMap.empty.noMeetings`(ko)·`onboarding.descriptionNoNote`(ko) 추가 윤문: 문구 기준에 걸리지 않아 그대로 두었습니다(D7)
- `agendaMap.columnMeta` 「안건 {total} · 이어짐 {linked}」: 「~짐」 조각이지만 열 머리 한 칸(폭 60px 안팎)의 이름표라 길이를 늘릴 수 없습니다
- 「문의·피드백」 메뉴 이름과 피드백 분류 카드의 hint(「안 되거나 이상해요」 등, 사용자 입장의 말)는 해요체를 그대로 둡니다

## 한국어에서 바뀐 문장

| 키 | 전 | 후 |
|---|---|---|
| `createProject.descriptionFirst` | 회의는 프로젝트 안에 만들어집니다. 팀·제품·고객처럼 회의가 반복되는 단위로 지으면 지난 맥락을 찾기 쉬워집니다. | 회의는 프로젝트 안에 만듭니다. 팀, 제품, 고객처럼 회의가 반복되는 단위로 지으면 지난 맥락을 찾기 쉽습니다. |
| `createProject.created` | 프로젝트가 생성되었습니다. | 프로젝트를 만들었습니다. |
| `createProject.failed` | 프로젝트 생성에 실패했습니다. | 프로젝트를 만들지 못했습니다. |
| `onboarding.descriptionNoProject` | 회의는 프로젝트 안에 만들어집니다. 하나만 만들어 두면 바로 회의를 시작할 수 있습니다. | 회의는 프로젝트 안에 만듭니다. 하나만 만들어 두면 바로 회의를 시작할 수 있습니다. |
| `onboarding.descriptionNoNote` | …끝나면 개요 · 액션 아이템 · 인사이트로 정리됩니다. | …끝나면 개요와 할 일, 인사이트로 정리됩니다. |
| `onboarding.steps.createProject.detail` | 회의를 묶는 상자입니다. 팀·제품·고객 단위로 짓습니다 | 회의를 묶는 상자입니다. 팀, 제품, 고객 단위로 짓습니다 |
| `checklist.allDone` | 준비가 끝났어요 | 준비가 끝났습니다 |
| `invite.anonymous.title` | 워크스페이스 초대가 도착했어요 | 워크스페이스 초대가 도착했습니다 |
| `invite.alreadyMember.title` | 이미 이 워크스페이스의 멤버예요 | 이미 이 워크스페이스의 멤버입니다 |
| `invite.checking.title` | 초대를 확인하고 있어요 | 초대를 확인하고 있습니다 |
| `invite.checking.description` | 잠시만요 — 수락이 끝나면 워크스페이스로 이동합니다. | 수락이 끝나면 워크스페이스로 이동합니다. |
| `invite.errors.notFound.description` | 링크가 잘못되었거나 삭제된 초대입니다. … | 링크가 잘못되었거나 초대가 삭제되었습니다. … |
| `feedback.privacyNote` | 현재 화면 경로와 사용 환경이 함께 담겨요. 회의 내용은 보내지 않아요. | 현재 화면 경로와 사용 환경을 함께 보냅니다. 회의 내용은 보내지 않습니다. |
| `feedback.sent` | 보냈어요. 답변이 달리면 「내 문의」에서 볼 수 있어요. | 보냈습니다. 답변이 달리면 「내 문의」에서 볼 수 있습니다. |
| `feedback.kinds.incident.placeholder` | …오류 문구가 있으면 같이요. | …오류 문구가 있으면 함께 적어 주세요. |
| `feedback.kinds.question.placeholder` | …알려 주시면 더 정확히 답해요. | …알려 주시면 더 정확히 답할 수 있습니다. |
| `feedback.mine.loadFailed` | 내 문의를 불러오지 못했어요 | 내 문의를 불러오지 못했습니다 |
| `feedback.mine.empty` | 아직 보낸 문의가 없어요. | 아직 보낸 문의가 없습니다. |
| `agendaMap.legend.gap` | 다루지 않음 | 다루지 않은 회의 |
| `agendaMap.legend.branch` | 갈라짐 | 갈래 |
| `agendaMap.branchedFrom` | {title}에서 갈라짐 | {title}에서 갈라진 갈래 |
| `agendaMap.detail.splits` | 여기서 {count}갈래로 나뉨 | 여기서 나뉜 {count}갈래 |
| `agendaMap.detail.openItems` | 남은 질문 | 열린 질문 |
| `agendaMap.flow.meta`(옆 패널 흐름 탭) | 안건 {n} · 회의 {m}개 | 안건 {n}개 · 회의 {m}개 (포커스 화면과 한 키로 합침) |
| `agendaMap.focus.since` | {date} 부터 | {date}부터 |
| `agendaMap.focus.goToBranch` | {title} 에서 갈라진 갈래로 이동 | {title}에서 갈라진 갈래로 이동 |

## 렌더 확인

영어 계정, 1440·1024. `check-load.mjs`와, 눌러야 나오는 창을 여는 임시 스크립트(scratch, 레포에 남기지 않음)로 봤습니다.

| 경로·화면 | 넘침 | 비고 |
|---|---|---|
| `/w/01K0000000000` 노트 목록 | 없음(「Skip to content」는 숨은 링크, 「내 에이전트」는 `chat` 모듈) | |
| 새 회의 창 | 없음 | 기본 이름 「11/04 meeting notes」 |
| 새 프로젝트 창 | 없음 | |
| 문의·피드백 창, 내 문의 탭 | 없음 | |
| `/w/01K0000000000/projects/01K0000000001` 연결 지도·범례 | 없음 | |
| 연결 지도 옆 패널(안건·흐름 탭) | 1차에 「View this topic larger」가 닫기를 덮음 → 탭 이름을 줄여 해결 | |
| 줄기 포커스 화면 | 없음 | |
| `/invite?token=e2e` | 없음 | 한글 없음 |

빈 워크스페이스의 온보딩 화면은 목 워크스페이스에 노트가 있어 렌더로는 보지 못했습니다. 문구는 시험과 언어 파일로만 확인했습니다.

남은 한글 중 이 모듈이 아닌 것:

- 날짜 묶음 머리 「2026년 11월 4일 (수)」(`lib/workspace/note-groups.ts`), 연결 지도의 날짜·회의 이름 줄임(`lib/projects/agenda-map.ts`의 `shortMeetingDate`·`meetingHeading`): plan 13단계
- 노트 행 아바타의 「진행자 …」「참여자 N명」 라벨(`components/notes/note-participants.tsx`): `notes` 모듈
- 「내 에이전트」 버튼과 안내 카드(「회의록을 보고 답해요…」「다시 보지 않기」「열어 보기」): `chat` 모듈
- 공용 Dialog의 닫기 버튼 「닫기」(`components/ui/dialog.tsx`): 이번 모듈 밖. `common.actions.close`를 만들어 두었으니 그 키를 쓰면 됩니다
- 프로젝트·회의·안건 이름, 안건 요약, 문의 본문: 목 데이터·사용자 데이터

## 코드 리뷰

| 회차 | 지적 | 처리 |
|---|---|---|
| 1 | P2 노트 행의 회의 상태가 영어 화면에서도 한국어(`MEETING_STATUS_LABEL`) | `common.meetingStatus`로 그리고 영어 시험을 더했습니다 |
| 1 | P2 날짜 묶음 머리가 영어로 안 바뀜 | plan 13단계 범위라 이번에 손대지 않았습니다 |
| 2 | P2 초대 수락의 알 수 없는 오류에서 서버 문구가 우선 | 의도입니다. APP-1285 이후 서버가 `Accept-Language`로 화면 언어 문구를 돌려줍니다(`error-loading.md`) |
| 2 | P3 초대·연결 지도의 영어 렌더 시험이 없음 | `invite-landing.test.tsx`(만료 안내), `agenda-ribbon-legend.test.tsx`(범례)에 영어 시험을 더했습니다 |
| 3 | 지적 없음 | |
