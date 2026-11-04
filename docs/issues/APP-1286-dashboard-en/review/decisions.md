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
