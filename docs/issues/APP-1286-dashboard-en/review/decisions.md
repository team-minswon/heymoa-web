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
