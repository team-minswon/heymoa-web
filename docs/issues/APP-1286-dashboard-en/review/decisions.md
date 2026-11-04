# APP-1286 결정 기록 — 사용자 검토용

사용자가 자리에 없는 동안 추천안으로 정하고 진행한 것들입니다. 항목마다 **무엇을·왜·되돌리는 법**을 적습니다.
확인이 끝난 항목은 앞에 ✅, 바꾸기로 한 항목은 ✏️를 붙여 주세요.

spec: docs `docs/app-1286/dashboard-en` @ `e455d14e` (`projects/PRO-66-웹-국제화/spec/APP-1286/spec.md`), 용어집 `spec/APP-1286/docs/glossary.md`

## D1. 브랜치를 APP-1285 위에 쌓음

- **무엇을**: `feature/app-1286/dashboard-en`을 `feature/app-1285/product-language`(`30f376ba`)에서 땄습니다. docs spec 브랜치는 `docs/pro-66/specs`에서 땄습니다
- **왜**: APP-1285가 머지 전이고, 언어 결정·Provider·`useDisplayLocale` 위에서만 이 작업이 의미가 있습니다
- **되돌리는 법**: APP-1285 머지 뒤 `git rebase --onto pro-66/웹-국제화 30f376ba feature/app-1286/dashboard-en`

## D2. 이름공간을 기능 모듈 단위로 나눔

- **무엇을**: `shell`·`settings`·`workspace`·`notes`·`chat`·`tasks`·`notification`·`agents`·`recording`·`errors`·`dates`. `common.agentChat`은 `chat`으로 옮깁니다
- **왜**: 모듈별 평가·리뷰·커밋 단위와 맞고, 파일마다 나누면 200개 가까운 이름공간이 생깁니다
- **되돌리는 법**: 이름공간 JSON을 합치고 `useTranslations("…")` 인자를 바꾸면 됩니다. 키 경로는 그대로 둡니다

## D3. React 밖 모듈은 `<html lang>`으로 `errors` JSON을 직접 고름

- **무엇을**: `fetcher.ts`·`query-client.ts`·`error-message.ts`·`recording-messages.ts`가 `errors` JSON 두 벌을 import하고 `document-locale.ts`의 화면 언어로 고릅니다
- **왜**: 언어를 바꾸면 전체 새로고침이라 문서 수명 동안 언어가 고정입니다. 키를 던지면 모든 소비자가 번역을 알아야 합니다
- **되돌리는 법**: 그 함수 하나를 키 반환으로 바꾸고 소비자에서 번역

## D4. 시험은 기본 wrapper로 한국어 Provider를 씌움

- **무엇을**: `vitest.setup.ts`가 RTL `render`·`renderHook`의 기본 wrapper로 한국어 Provider를 둡니다
- **왜**: 수백 개 컴포넌트 시험을 문구와 무관하게 고치지 않아도 됩니다
- **되돌리는 법**: setup의 목을 지우고 각 시험에 `wrapper: intlWrapper()`

## D5. 영어 화면 이름은 사용 가이드 영어판 표기를 따름

- **무엇을**: 「Finish review」「Set assignee」「Summary」 등 가이드·랜딩에 이미 쓴 표기를 대시보드에 그대로 씁니다. 랜딩의 짧은 「Assign」 대신 가이드의 「Set assignee」를 고릅니다
- **왜**: 이미 공개된 문서이고, 따르면 가이드를 고칠 곳이 줄어듭니다
- **되돌리는 법**: 용어집 표를 고치고 언어 파일을 바꿈

## D6. 용어집 열린 항목의 임시 선택 (사용자 확인 필요)

- 회의록·회의 노트 → 영어는 meeting notes로 모음. 한국어 통일은 하지 않음
- 임시 참여자 → guest participant
- 대화 → conversation(「New conversation」)
- 회의록 Markdown 복사 → 화면 언어로 만듦

## D7. 한국어 윤문은 문구 기준에 걸리는 문장만

- **무엇을**: 평서문 해요체→합니다체, 가운뎃점 나열·한두 줄 글머리표→문장, 번역투·피동을 고칩니다. 걸리지 않는 문장은 그대로 둡니다. 바뀐 문장은 모듈별 평가 파일에 남깁니다
- **왜**: 이관과 윤문을 한 번에 하면서도 검토할 양을 줄이려는 것입니다
- **되돌리는 법**: 모듈 커밋 단위로 한국어 JSON만 되돌림

## D8. 공용 버튼 문구는 `common.actions`

- **무엇을**: 「취소」「저장」「삭제」「다시 시도」를 `common.actions`에 두고 모듈마다 새로 만들지 않습니다(셸 모듈 `cd30417d`에서 시작)
- **왜**: 같은 버튼이 수십 곳에 있고, 영어 표기를 한 곳에서 맞추려는 것입니다
- **되돌리는 법**: 각 모듈 이름공간에 키를 복사하고 `useTranslations` 인자를 바꿈

## D9. Navbar·Footer·focus-chrome 문구를 `shell`에 둠

- **무엇을**: 마케팅 루트의 `clientNamespaces`는 바꾸지 않았습니다
- **왜**: 마케팅 경로는 `NavbarGate`·`FooterGate`가 랜딩 크롬을 세웁니다. 이 Navbar·Footer는 제품 루트의 `/mock-oauth`, `/help-samples`, 로그아웃 상태의 `/inquiries/*`에서만 그려집니다(렌더로 확인)
- **되돌리는 법**: `navbar`·`footer`·`focusChrome` 키를 `common`으로 옮김

## D10. `desktop-download-link.tsx`는 `shell.desktopDownload`

- **무엇을**: `components/heymoa`에 있지만 데스크톱 앱 안내와 비교 창에서만 쓰여 셸에 넣었습니다. 랜딩은 `landing.download`를 따로 씁니다
- **되돌리는 법**: 키를 다른 이름공간으로 옮김

## D11. 영어 화면의 마케팅 링크는 아직 한국어 주소로 감 (사용자 확인 필요)

- **무엇을**: 제품 면의 `/terms`·`/privacy`·`/download`·`/download?start=1` 링크가 영어 화면에서도 무접두(한국어) 주소입니다. 이번 문구 이관 범위 밖이라 그대로 두었습니다
- **추천**: 마지막 관문 전에 `lib/i18n/locales.ts`의 언어별 주소 함수로 한 번에 바꾸는 작은 커밋을 더합니다
- **되돌리는 법**: 그 커밋 revert

## D12. 영어 화면의 계정 삭제 확인 문구 (사용자 확인 필요)

- **무엇을**: 영어 화면에서는 「delete my account」를 입력받고, 맞으면 서버에는 계약 값 「회원 탈퇴」를 그대로 보냅니다(`settings.accountDeletion.confirmPhrase`, 설정 모듈 `1547997d`)
- **왜**: 영어 사용자가 한국어 입력기 없이 탈퇴할 수 있어야 합니다. 실수 방지 관문(입력 확인)은 그대로입니다
- **되돌리는 법**: 그 키를 지우고 `WITHDRAWAL_CONFIRMATION`을 다시 씁니다. 근본 해결은 서버 계약이 확인 문구를 언어별로 받거나 아예 받지 않게 바꾸는 것입니다(server 이슈 필요)

## D13. 설정 모듈의 작은 판단들

- 「언어 · Language」 탭 이름은 화면 언어와 무관하게 두 언어로 적는 의도라 언어 파일 밖 상수로 둡니다
- 이름 뒤 조사 「을(를)」은 `objectParticle`로 받침에 맞춰 `{particle}` 자리에 넣습니다
- 용어 사전 탭(`components/terms`)은 설정에서만 쓰여 `settings.terms`에 둡니다. `lib/terms/term-bulk.ts`의 `summaryParts`는 문구 대신 개수를 돌려줍니다
- 공용 확인 버튼의 영어는 「OK」입니다(`common.actions.confirm`)
- 사용 내역은 가이드 영어판을 따라 「Usage history」입니다(용어집의 Usage를 고침)

## D14. 워크스페이스 모듈의 판단들 (`7480448c`)

- **새 워크스페이스 창 문구는 `common.createWorkspace`**: 랜딩(마케팅 루트)도 이 창을 엽니다. 마케팅에 `workspace` 이름공간 전체를 보내지 않으려는 것입니다. 되돌리기: 키를 `workspace`로 옮기고 마케팅 `clientNamespaces`에 `workspace`를 더함
- **회의 상태는 `common.meetingStatus`**(Not started / Recording / Paused / Ended): 노트 목록과 노트 화면이 같이 씁니다. 옛 상수 `MEETING_STATUS_LABEL`은 notes 모듈이 바꾼 뒤 지웁니다
- **문의 본문의 「화면:·환경:」 꼬리는 한국어 그대로**: 운영자가 읽는 데이터이고 `userPart`가 이 표식으로 잘라 냅니다
- **온보딩 체크리스트 단계 이름은 컴포넌트가 그림**: `lib/onboarding/checklist.ts`에는 id만 남습니다
- **연결 지도 옆 패널 영어 탭을 「Item」으로 줄임**: 「Agenda item」이면 1440·1024에서 「View this topic larger」 버튼이 닫기를 덮었습니다. 되돌리기: 키 값만 바꾸고 패널 머리 레이아웃을 손봄

## D15. 회의 노트 머리·상태·정보의 판단들 (`4e071007`)

- **종료 후 의견의 저장 머리 「[회의 종료 후] 녹음·소리」는 한국어 고정**: 운영자가 읽고 거르는 데이터입니다(D14와 같은 판단). 화면 분류 이름은 번역합니다
- **제목을 비우고 저장할 때의 기본 제목은 화면 언어**(「제목 없는 노트 / Untitled note」): 만든 사람의 언어로 데이터가 남습니다. 되돌리기: `details.untitled` 대신 한국어 상수를 보냄
- **`CopyMarkdownButton`은 `label` 대신 `kind`**(transcript·summary·timeline)를 받아 탭 이름으로 번역합니다
- **회의 상태 이름은 `MEETING_STATUS_KEY` 한 곳**에서 `common.meetingStatus`로 바꿉니다. `MEETING_STATUS_LABEL`은 지웠습니다
- **참여자 자동 열기의 버튼 찾기 기준을 `data-slot="participants-add"`로**: 영어 화면에서는 한국어 aria-label로 찾지 못합니다
- **「변경사항 저장」 vs 「변경 저장」 (사용자 확인 필요)**: 대시보드 공용 키 `common.actions.saveChanges`는 「변경사항 저장」, 랜딩 미리보기는 「변경 저장」입니다. 영어는 둘 다 Save changes입니다. 대시보드 쪽(변경사항 저장)을 그대로 두고 용어집에 둘 다 적었습니다

## D16. 영어 표기는 다른 서비스의 관용 표기를 먼저 따름 (사용자 결정)

- **무엇을**: 영어 용어는 비교 서비스(Otter·Fireflies·Fathom·Zoom·Google Meet·Teams·Notion·Slack·Linear·Asana 등)가 실제 화면에서 쓰는 관용 표기를 1순위로 씁니다. 관용 표기가 없는 고유 개념만 미국 영어 사용자에게 자연스럽게 옮깁니다. 용어집에 행마다 「관용 근거」 열을 둡니다
- **왜**: 사용자가 돌아와 정한 기준입니다. 영어권 사용자가 다른 도구에서 익힌 말을 그대로 알아보게 하려는 것입니다
- **D5와의 관계**: D5(사용 가이드 영어판 표기를 따름)를 대체합니다. 가이드 영어판은 4단계에서 대시보드에 맞춰 고칩니다
- **이미 끝낸 모듈**: 용어집 재검토 뒤 셸·설정·워크스페이스·노트 머리의 영어 파일을 한 번에 맞춥니다

## D17. 할 일은 Tasks, 랜딩도 새 용어집에 맞춤 (사용자 결정)

- **무엇을**: 「할 일」은 회의 안에서도 프로젝트 목록에서도 Tasks입니다(회의 도구 관용 Action items는 쓰지 않음). 용어집 재검토(docs `1d52e647`)로 바뀐 영어 표기를 대시보드뿐 아니라 랜딩(`messages/en/landing.json`)과 사용 가이드 영어판에도 맞춥니다
- **왜**: 회의에서 나온 할 일과 프로젝트 할 일이 같은 개체입니다. 랜딩·가이드·대시보드가 다른 말을 쓰면 영어 사용자가 같은 것을 못 알아봅니다
- **되돌리는 법**: 용어집 표기를 되돌리고 같은 정리 커밋을 revert

## D18. 회의 노트 타임라인·전사·요약의 판단들 (`f1b1566b`)

- **복사본·회의록이 읽는 한국어 함수는 13단계까지 남김**: `gapHeadline`·`formatGapDuration`·`SECTION_LABELS`·`CONTEXT_KIND_LABEL`, 화자 resolver의 한국어 기본값. 화면은 같은 문구를 언어 파일에서 그립니다. 13단계에서 기본값을 지우고 호출부가 `t`를 넘깁니다
- **lib 함수는 문구 대신 값을 돌려줌**: `gapDurationOf`(단위·값), `speakingTimeParts`(분·초). 이름 없는 화자 이름은 `useSpeakerFallbackNames()`가 만듭니다
- **요약 섹션 이름: 영어 Tasks, 한국어는 「액션 아이템」 그대로 (사용자 확인 필요)**: 한국어는 복사본과 같아야 해서 그대로 뒀습니다. 한국어도 「할 일」로 모으자고 추천합니다(13단계에서 복사본과 같이)
- **항목 철회는 Withdrawn, 결정 번복은 Reversed**로 나눴습니다
- **한국어 표기 통일**: 「대화 기록」「전사」→「스크립트」(탭 이름), 도크 「이름 없음 N」→「미지정 N」
- **`LiveChip`의 `label`을 필수로**: 한국어 기본값이 있으면 영어 화면에서 빠뜨려도 모릅니다

## D19. 용어 정리 커밋의 판단들 (`42100780`)

- **약관·개인정보 영어판(`messages/en/legal.json`)의 옛 표기는 그대로 (사용자 확인 필요)**: glossary·speaker separation·agent conversations가 남아 있습니다. 법률 문서라 손대지 않았습니다. 고치려면 별도 커밋으로 하고 한국어본이 우선한다는 고지는 그대로 둡니다
- **랜딩 `meta.keywords`의 meeting minutes·action items는 그대로**: 화면 용어가 아니라 검색어입니다
- **회의 대화를 뜻하는 conversation은 그대로**: chat으로 바꾼 것은 내 에이전트와의 대화뿐입니다
- **1024px 노트 상단바 겹침 수정**: 좁은 상단바(640px 이하)에서 모든 상태 칩과 「End meeting」 버튼이 글자를 접고 아이콘·점만 남깁니다(`title`로 이름 보존). 한국어 화면도 같은 폭에서 접힙니다. 되돌리기: `meeting-controls.tsx`의 `@max-[640px]/topbar:sr-only` 범위를 일시정지 칩으로 되돌림

## D20. 회의 노트 검토·회의록·공유의 판단들 (`06326516`)

- **회의록 PDF도 화면 언어로**: `render-minutes-pdf`가 `<html lang>`을 워커에 넘기고 PDF가 `notes.minutes.pdf`를 읽습니다. 영어 제목은 본문 글꼴 굵게(세리프 제목 글꼴에 「회의록」 세 글자만 있음). 되돌리기: `locale`을 "ko"로 고정
- **공유 메일 본문은 한국어 그대로 (사용자 확인 필요)**: 서버 `NoteShareEmailContent`가 언어 구분 없이 한국어로 보냅니다. 미리보기도 서버와 같게 둡니다. 영어 메일은 server 이슈가 필요합니다
- **「녹취록」(PDF·메일에 붙는 문서)과 「스크립트」(탭 이름)를 나눔 (사용자 확인 필요)**: 영어는 둘 다 Transcript입니다. 한국어도 하나로 모을지 정해 주세요
- **「이전 결정 N개 끝남」은 랜딩 미리보기와 같아서 그대로**, 공유 결과 칩 「보내지 못함」→「보내기 실패」
- **할 일 상태는 `common.taskStatus`**(In progress / Done / Canceled). 할 일 모듈이 `TASK_STATUS_LABEL`을 이것으로 바꿉니다
- **후속 후보(이번 범위 밖, 기존 문제)**: 1024에서 옆 채팅 패널을 연 채 전체 화면이면 검토 할 일 줄의 내용 칸이 한 글자 폭으로 줄어듭니다(`review-row.tsx`의 `sm:grid-cols`가 화면 폭 기준). 한국어도 같습니다

## D21. 채팅의 판단들 (`0d768a89`)

- **실패 문구는 코드로 고름**: 스트림 리듀서는 서버 문구만 담고, 코드만 온 실패는 배너가 `chat.errors.turnFailures.<코드>`로 그립니다(모르는 코드는 `chat.errors.noResponse`). 되돌리기: 리듀서에 문구 표를 다시 넣음
- **순수 함수는 문구 대신 키**: 진행 배지·대화 기록 날짜 묶음·피커 묶음
- **서버 기본 제목 「새 대화」는 화면 언어로 그림 (server 후속 후보)**: `titleSource === "DEFAULT"`이면 `chat.newChat`. 근본 해결은 서버가 기본 제목을 비우거나 언어별로 주는 것
- **「이름 바꾸기」「제목 바꾸기」를 공용 「이름 변경」으로**
- **예시 질문의 「액션 아이템」은 D18과 함께 정함**
- **`lib/chat/time-divider.ts`·`chat-list.ts`의 「오늘/어제/방금」**: APP-1285가 이미 locale로 영어를 고르는 코드라 그대로 두고, 13단계에서 `dates`로 모을지 봅니다

## D22. 할 일·알림의 판단들 (`5c07491f`, `6562697a`)

- **공용 소품 문구는 `common`, `components/ui`도 번역**: 담당·기한 칸, 받는 사람 입력, 접기, Dialog·Sheet의 닫기, `InlineRetry`가 `useTranslations`를 씁니다. Provider 밖에서 그려지던 `help-samples` 페이지는 `common`도 내려 받게 했습니다. 되돌리기: 소품에 prop 기본값을 다시 둠
- **영어 날짜에 맞춰 칸을 넓힘**: 할 일 표 기한 칸 112→128px, 이력 시트 칸 이름 열 32px→`auto`. 한국어 화면에서 내용 칸이 16px 줄어듭니다. 되돌리기: `taskRowGrid`
- **이력은 문구 대신 값을 돌려줌**(`revisionChanges`)
- **「수락함/거절함」→「수락됨/거절됨」**(「~함」 조각 금지)
- **메일 수신거부 화면은 한국어 고정 그대로 (사용자 확인 필요)**: `app/(mail)/layout.tsx`가 `locale="ko"`입니다. 서버 메일이 한국어뿐이라(D20) 두었고, 영어 문구는 준비돼 있어 `locale`만 바꾸면 됩니다
- **이력 문구 「회의 확정으로 생겼습니다」→「회의 검토를 마치며 생겼습니다」 (사용자 확인 필요)**: 판에 `approvalId`가 있으면 검토 완료로 생긴 것으로 봤습니다. 이 해석이 맞는지 확인이 필요합니다
