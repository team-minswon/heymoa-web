# 알림 (`notification`)

맡은 파일:

- `components/notification/`: `notification-modal.tsx`(모달·탭·빈 상태·초대 거절 확인창), `notification-row.tsx`(행과 종류별 문구), `unsubscribe-landing.tsx`(메일 수신거부 화면). `notification-center.tsx`·`use-read-analysis-ready.ts`는 한글이 주석뿐입니다
- `lib/notification/`: `notification-list.ts`의 `dayLabel`(「오늘」 「어제」 「11월 3일(화)」)은 날짜 문장 단계(13단계)라 그대로 두었습니다. 나머지 파일은 한글이 없습니다
- 같이 고친 공용 primitive: `components/ui/inline-retry.tsx`의 「다시 시도」와 기본 문구(코드 리뷰 1회차 지적). `common.actions.retry`·`common.loadFailed`를 씁니다
- 언어 파일: `messages/<ko|en>/notification.json`, `messages/<ko|en>/common.json`(`loadFailed`)
- 등록: `i18n/messages.ts`, `i18n/messages.test.ts`의 `REQUIRED_EN`, `components/layout/app-shell.tsx`의 `PRODUCT_NAMESPACES`

판단:

- **알림 문구는 모두 web이 고릅니다.** 서버는 값만 줍니다(초대한 사람·워크스페이스 이름, 회의 제목, 일시정지 영업일 수, 문의 id). 그래서 서버 문구로 남긴 것은 없고, 이름·제목 같은 데이터만 그대로 그립니다
- **종류별 렌더러는 `t`를 인자로 받습니다**(`describeNotification(item, actions, t)`). React 밖 함수라 모달이 `useTranslations("notification.row")`로 넘깁니다
- **「워크스페이스」 접미어는 한국어 문장 안의 `select`로**: `workspaceLabel`(한국어 조각을 돌려주던 함수)을 `workspaceSuffix`(`"yes" | "no"`)로 바꾸고, 한국어 키가 `{suffix, select, yes { 워크스페이스} other {}}`로 받습니다. 영어 문장은 이 값을 쓰지 않습니다(「Jane invited you to Design studio」)
- **수신거부 화면의 메일 수는 `{count, plural, =1 {…} other {…}}`**: 한국어 복수 규칙에는 `one`이 없어 `=1`로 가릅니다. 메일 목록은 종류별 키 목록(`MAIL_ITEMS`)만 코드에 두고 문구는 `unsubscribe.items.*`입니다. 이메일 자리는 `t.rich`의 `<email></email>`이 값 또는 skeleton을 그립니다
- **수신거부 화면은 지금 한국어로만 그려집니다**: 메일 루트(`app/(mail)/layout.tsx`)가 `locale="ko"`로 고정입니다. 서버 메일이 한국어뿐이라(D20과 같은 사정) 그대로 두었고, 영어판 문구는 언어 파일에 준비해 두었습니다. 메일 루트가 언어를 따르게 하려면 레이아웃의 `locale`만 바꾸면 됩니다
- 「거절」 버튼과 확인창의 실행 버튼은 같은 키(`row.invitation.decline`), 확인창 취소는 `common.actions.cancel`, 수신거부 화면의 「다시 시도」 「취소」 「홈으로」는 `common`을 씁니다
- 범위 밖이지만 같이 고친 것: `e2e/notification-modal.spec.ts`의 한국어 기대값(윤문한 문장 셋)

## 문구 평가

| 축 | 1차 | 2차 |
|---|---|---|
| slop | 4 | 4 |
| 용어 | 4 | 5 |
| 적합도 | 4 | 4 |
| 일관성 | 4 | 4 |
| **평균** | **4.0** | **4.3** |

## 반영한 지적

1차
- `row.analysis.untitled`: 「회의 / Untitled meeting」 → 「제목 없는 회의 / Untitled meeting」(두 언어가 같은 뜻)
- `row.analysis.autoEnded`: 무엇을 종료했는지 넣음 「…회의를 자동으로 종료했습니다.」 / 「The meeting ended automatically 3 business days after the last pause.」
- `row.invitation.goneDetail`·`row.analysis.gone`: 보조 줄도 문장이라 마침표를 붙임(같은 줄의 `autoEnded`와 맞춤)
- `unsubscribe.body`: 누르기 전이라 조건을 붙임 「메일을 끄면 … 더 이상 보내지 않습니다.」 / 「If you turn off emails, we'll stop sending …」
- `unsubscribe.items.autoEnded`: 「회의를 자동 종료했을 때 보내는 안내」

2차
- `modal.empty.ALL`: 문의 답변도 오는데 초대·검토 결과만 말해 「새 알림이 여기에 도착합니다. / New notifications show up here.」
- `unsubscribe.invalidBody`(en): 「The link may be cut off or may no longer work.」(문법)
- `unsubscribe.alreadyOff`(en): 「You've already turned off {name}」은 사용자가 직접 껐다고 단정해 「Your {name} are already off」

## 남긴 지적과 이유

- `row.analysis.title`을 「…에서 검토할 결과가 준비되었습니다」나 「…의 결과를 검토할 수 있습니다」로: 「〈회의〉의 검토할 결과」가 어색하지 않고, 문구 기준(D7: 걸리지 않는 문장은 그대로)에 따라 두었습니다
- `unsubscribe.names.MEETING_PAUSED_REMINDER`를 「일시정지 및 자동 종료 안내 메일」로: 설정 화면과 메일 푸터가 이미 「일시정지된 회의 메일」로 부르고, 끄는 두 메일은 바로 아래 목록이 보입니다

## 한국어에서 바뀐 문장

| 키 | 전 | 후 |
|---|---|---|
| `row.invitation.result.ACCEPTED` | 수락함 | 수락됨 |
| `row.invitation.result.DECLINED` | 거절함 | 거절됨 |
| `row.inquiry.title` | 문의에 답변이 등록되었습니다 | 문의에 답변이 왔습니다 |
| `modal.declineDialog.description` | 거절하면 다시 참여하려면 새 초대가 필요합니다. | 거절한 뒤 다시 참여하려면 새 초대가 필요합니다. |
| `modal.empty.ALL` | 초대와 검토할 결과 알림이 여기에 도착합니다. | 새 알림이 여기에 도착합니다. |
| `row.analysis.untitled` | 회의 | 제목 없는 회의 |
| `row.analysis.autoEnded` | 마지막 일시정지 후 {days}영업일이 지나 자동으로 종료했습니다. | 마지막 일시정지 후 {days}영업일이 지나 회의를 자동으로 종료했습니다. |
| `row.invitation.goneDetail` | 취소되었거나 더 이상 볼 수 없는 초대입니다 | 취소되었거나 더 이상 볼 수 없는 초대입니다. |
| `row.analysis.gone` | 삭제되었거나 볼 권한이 없는 회의입니다 | 삭제되었거나 볼 권한이 없는 회의입니다. |
| `unsubscribe.body` | (이메일) 계정으로 오는 아래 (두) 메일을 더 이상 보내지 않습니다. | 메일을 끄면 (이메일) 계정으로 오는 아래 (두) 메일을 더 이상 보내지 않습니다. |
| `unsubscribe.items.autoEnded` | 자동 종료했을 때 보내는 안내 | 회의를 자동 종료했을 때 보내는 안내 |

## 렌더 확인

사이드바의 Notifications로 모달을 열어(`/w/01K0000000000`), 영어 계정, 1440·1024. 임시 스크립트로 차례로 열었습니다: 전체 탭 → 목록 끝까지 스크롤 → Unread → Needs action → 초대 거절 확인창 → 전체 탭에서 `heymoaMock.notify()`로 새 알림 도착(「1 new notification」).

- 넘침: sr-only(행마다의 「Unread」, 닫기 「Close」)뿐이고 검사의 오탐입니다. 탭 줄의 「Mark all as read」 「Notification settings」는 1024에서도 한 줄에 섭니다. 가로 스크롤 없음
- 남은 한글 중 목·사용자 데이터: 회의 제목, 사람 이름, 워크스페이스 이름
- 남은 한글 중 다른 단계 문구: 날짜 머리와 행의 날짜 「오늘」 「어제」 「11월 3일(화)」(`lib/notification/notification-list.ts`의 `dayLabel`, 13단계)
- 수신거부 화면은 메일 루트가 한국어 고정이라 영어 렌더를 하지 않았습니다(위 판단)

## 코드 리뷰

1회차
- P2: 영어 모달의 실패 줄에 한국어 「다시 시도」가 보인다(`InlineRetry`가 버튼 문구를 고정). → `components/ui/inline-retry.tsx`가 `common.actions.retry`를, 기본 문구는 `common.loadFailed`를 씁니다. 모든 화면의 `InlineRetry`가 같이 고쳐집니다
- P3: 한국어 `select`(접미어 없음)와 수신거부 본문 `plural`(=1·other) 분기 시험이 없다. → `notification-en.test.tsx`에 이름이 「워크스페이스」로 끝나는 경우, `unsubscribe-landing.test.tsx`에 메일 하나·둘의 본문 문장을 더했습니다

2회차
- P3: 영어 ICU 복수형(새 알림 수 단수·복수, 자동 종료 1일, 수신거부 this/these) 시험이 없다. P3라 남겼습니다. 영어 문구의 분기는 `i18n/messages.test.ts`가 키 구조만 봅니다
