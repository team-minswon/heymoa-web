# 날짜 문장과 복사본 (`dates`)

맡은 파일:

- 날짜 문장: `lib/notification/notification-list.ts`(`dayLabel`), `lib/workspace/note-groups.ts`, `lib/notes/note-header-meta.ts`, `lib/format/date.ts`(`formatPromiseTime`), `lib/chat/time-divider.ts`·`lib/chat/chat-list.ts`(오늘·어제·방금)
- 복사본·회의록: `lib/notes/copy-markdown.ts`, `lib/notes/review/markdown.ts`, `lib/notes/minutes/model.ts`·`markdown.ts`·`exports.ts`·`sources.ts`
- 한국어 기본값을 지운 곳(D18): `lib/transcription/gaps.ts`(`gapHeadline`·`formatGapDuration`), `lib/notes/analysis-sections.ts`(`SECTION_LABELS` → `SECTION_ORDER`만), `lib/notes/proposals/presentation.ts`(`CONTEXT_KIND_LABEL`, 파일 삭제), `lib/notes/review/sections.ts`(섹션 `label`·`KIND_LABEL`), `lib/transcription/speaker-identity.ts`, `lib/notes/speaker-stats.ts`(`KOREAN_NAMES`), `lib/assignees/describe.ts`, `lib/desktop/meeting-timeline.ts`
- 부르는 컴포넌트: `note-status-band`, `notification-modal`, `workspace-note-list`, `note-panel`, `copy-markdown-button`(+ `note-summary`·`transcript-view`·`note-archive`·`note-timeline`), `review-board`, `share-mail-dialog`, `chat-thread`·`chat-list`, `desktop-meeting-timeline`, `task-history-sheet`
- 새 파일: `messages/<ko|en>/dates.json`, `lib/i18n/translator.ts`(`DatesT`·`AppT`·`DocLanguage` 타입), `lib/i18n/use-doc-language.ts`
- `lib/projects/agenda-map.ts`는 한국어 낱말을 만들지 않습니다. 날짜는 숫자(「10.13」)이고 한글은 사용자 제목에서 날짜를 떼는 정규식뿐이라 그대로 두었습니다

판단:

- **날짜만 다루는 함수는 `t: DatesT`(`useTranslations("dates")`)와 `locale`을 받습니다.** 「10월 14일(수)」·「2026년 7월 27일 (월)」은 `{date}({weekday})` 자리표시자라 영어는 「Wed, October 14」 어순이 됩니다. 숫자·월·요일은 `Intl`이 그 언어로 냅니다
- **복사본·회의록을 만드는 함수는 이름공간 없는 `t`(`useTranslations()`)를 받습니다(`DocLanguage = { locale, t }`).** spec은 `useTranslations("dates")`를 적었지만, 복사본은 화면과 **같은 키**(`notes.transcript.gap.*`, `notes.summary.sections.*`, `notes.review.sections.names.*`, `notes.kinds.*`, `notes.speakers.fallback`)를 읽어야 화면과 복사본이 갈라지지 않습니다. `dates`에 사본을 두면 같은 문장이 두 곳에 생깁니다. 복사본에만 있는 말은 `dates.document.*`에 둡니다. 되돌리기: 그 문구를 `dates`로 복사하고 함수 인자를 `DatesT`로
- **`CopyMarkdownButton`의 `build`가 `doc`을 받습니다.** 버튼이 `useDocLanguage()`를 한 번 부르고 누를 때 넘기므로, 복사 버튼을 쓰는 네 화면은 훅을 따로 부르지 않습니다
- **채팅의 오늘·어제·방금도 `dates`로 모았습니다(D21).** 원래 `locale.startsWith("ko")`로 두 언어를 코드에서 골랐습니다. 언어가 늘면 코드를 고쳐야 하고 lib에 한글이 남습니다. 영어 구분선은 「Today at 3:40 PM」(Slack 표기)
- **회의록 PDF의 모델 문자열(길이·일시·꼬리말·근거 번호·파일 이름·「기타」 안건)도 화면 언어**입니다(D20의 PDF 언어 결정을 모델까지). 영어 파일 이름은 `Meeting notes_<제목>_<날짜>.pdf`. 메일 첨부 이름은 서버가 정하므로 바뀌지 않습니다
- **공유 메일 미리보기의 날짜는 한국어로 고정**했습니다. 서버 메일이 한국어라(D20) 미리보기 날짜도 메일과 같아야 합니다. 창 머리의 날짜는 화면 언어 그대로입니다
- **데스크톱 타임라인 팝오버의 유형 이름도 `notes.kinds`로**: `CONTEXT_KIND_LABEL`을 지우며 리포터가 `useTranslations("notes.kinds")`를 넘깁니다
- **`formatAppDate`가 U+202F(좁은 공백)를 보통 공백으로 바꿉니다.** 서버 Node(ICU 78)는 영어 시각을 「9:00 AM」으로, 브라우저(Chromium 149, 실측)는 「9:00 AM」으로 내 영어 화면의 시각이 하이드레이션에서 갈릴 수 있었습니다. 한국어는 영향이 없습니다. 되돌리기: 그 `replace` 한 줄
- **D18 추천안대로 요약 섹션의 한국어를 「액션 아이템」→「할 일」로**: 요약 화면, 요약 없음 안내 두 문장, 복사본, 채팅 예시 질문. 타임라인 복사본의 「후속 조치」도 「할 일」로 맞췄습니다(같은 개체에 이름 하나)
- **회의록 PDF의 영어 「truncated」를 「The recording wasn't fully saved」로** 복사본과 맞췄습니다(`notes.minutes.pdf.truncated`). 스크립트 화면의 `notes.archive.truncated` 「The transcript wasn't saved to the end.」는 노트 모듈 문구라 그대로입니다

## 문구 평가

| 축 | 1차 | 2차 |
|---|---|---|
| slop | 4 | 4 |
| 용어 | 4 | 5 |
| 적합도 | 4 | 5 |
| 일관성 | 4 | 5 |
| **평균** | **4.0** | **4.8** |

## 반영한 지적

1차
- `document.timelineEmpty`: 할 일이 빠져 뜻이 모호 → 「아직 결정이나 할 일, 미결 사항이 없습니다」 / 「No decisions, tasks, or open items yet」
- `document.tones.open`: 근거 번호(`refs.open`)와 같은 「Open item」으로
- `document.participantsMore`(en): 쉼표 없이 「Attendees: {names} and {rest} more」
- `document.truncated`(en): 「The recording wasn't fully saved」. PDF의 같은 문장도 맞춤
- `chat.starter.examples.actionItems.question`(ko): 「하기로 한 일을 할 일로」의 반복 → 「이 회의에서 하기로 한 것을 할 일로 만들어줘」

2차
- 같은 예시 질문(en): 「Create tasks for what we agreed to do in this meeting」

## 남긴 지적과 이유

- 1차 `document.truncated`(ko) 「스크립트를 끝까지 저장하지 못했습니다」 안: 잘리는 것은 녹음 봉인(`TRUNCATED`)이고, 회의록 PDF가 이미 「기록을 끝까지 저장하지 못했습니다」를 씁니다. 두 문서를 같은 문장으로 두었습니다

## 한국어에서 바뀐 문장

| 자리 | 전 | 후 |
|---|---|---|
| 복사본 끝(봉인 잘림) | 기록이 끝까지 저장되지 못했습니다 | 기록을 끝까지 저장하지 못했습니다 (피동, PDF와 같은 문장) |
| 타임라인 복사본 빈 상태 | 정해진 것 · 남은 것이 아직 없습니다 | 아직 결정이나 할 일, 미결 사항이 없습니다 |
| 타임라인 복사본 구분 | 후속 조치 | 할 일 |
| `notes.summary.sections.ACTION_ITEM` | 액션 아이템 | 할 일 |
| `notes.summary.missing.liveBody` | 회의를 종료하면 개요와 액션 아이템, 결정을 자동으로 정리합니다. | 회의를 종료하면 개요와 할 일, 결정을 자동으로 정리합니다. |
| `notes.summary.missing.endedBody` | 이 회의의 요약을 만들어 개요와 액션 아이템, 결정을 정리합니다. | 이 회의의 요약을 만들어 개요와 할 일, 결정을 정리합니다. |
| `chat.starter.examples.actionItems.question` | 이 회의의 액션 아이템을 할 일로 만들어줘 | 이 회의에서 하기로 한 것을 할 일로 만들어줘 |

## 렌더 확인

영어 계정, 1440·1024 (`check-load.mjs` + 알림 모달·하이드레이션 오류를 보는 임시 스크립트)

| 경로 | 본 것 | 결과 |
|---|---|---|
| `/w/01K0000000000` | 노트 목록 날짜 머리 | 「Thu, November 5, 2026」. 넘침은 「Skip to content」「My agent」(기존, 이 모듈 밖) |
| `/w/01K0000000000/notes/01K0000000040` | 노트 머리 메타, 자동 종료 예고 | 「1 attendee · July 7, 2026 at 9:00 AM」「5 min recorded」「…ends automatically after Fri, Nov 6 at 4:20 PM.」 |
| `/w/01K0000000000/notes/01K0000000920`, `…/01K0000000002` | 종료·기록 중 노트 머리 | 영어. 넘침은 sr-only 상태 알림·맥락 도움말(기존) |
| 채팅 패널 | 대화 날짜 구분선, 상대 시각 | 「Yesterday at 3:20 PM」「Today at 1:47 AM」「5m ago」 |
| 알림 모달 | 날짜 머리, 다른 탭의 행 날짜 | 「Today」「Yesterday」「Tue, November 3」, 행 「Tue, November 3 9:20 AM」 |
| `/w/01K0000000000/projects/01K0000000001` | 연결 지도 날짜 | 숫자 「07.01」. 바꾸지 않음 |
| 복사 Markdown | 시험으로 | `components/notes/dates-en.test.tsx`(요약 복사본 영어·한글 없음), 각 lib 시험에 en 결과 |

- 세 노트와 목록에서 하이드레이션 오류 0건
- 남은 한글은 모두 목 데이터·사용자 데이터(워크스페이스·프로젝트·노트 제목, 사람 이름, 채팅 목 대화)입니다

## 코드 리뷰

- 1회차: 지적 없음
