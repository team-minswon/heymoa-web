# errors — web 자체 오류 문구

## 코드 리뷰 (codex, 1차 — 뼈대 커밋)

- [P2][local] 녹음 오류(`lib/transcription/recording-messages.ts`)와 채팅 fallback(`lib/chat/use-chat-turn.ts`)이 아직 한국어 — **반영 예정**: plan 7(채팅)·11(녹음) 단계에서 같은 `errors`/`recording` 이름공간으로 옮깁니다. 이 커밋은 fetcher·토스트 fallback·판 충돌만 옮긴 뼈대입니다
- P1 0건

## 12단계 마무리 (`lib/**`·`components/**`에 남은 한글)

목·시험·계약 예시·SEO 데이터·주석을 빼고 다시 찾았습니다. 옮긴 것과 그대로 둔 것입니다.

| 자리 | 처리 |
|---|---|
| `lib/workspace/gone-notice.ts` 토스트 셋 | `errors.workspaceGone`·`workspaceUnavailable`·`workspaceUnavailableDetail`·`switchAccount` (`webMessage`) |
| `lib/desktop/open-site-page.ts` 녹음 중 이동 막힘 | `errors.pageBlockedByRecording`·`…Detail`. 주소가 들어가 `webMessage`에 `{name}` 자리표시자를 더했습니다 |
| `lib/api/sse.ts` 410 fallback | `errors.streamGone`. 화면은 코드(`SSE_STREAM_GONE`)로 가르므로 나가지 않지만 lib에 한글을 남기지 않으려 옮겼습니다 |
| `lib/notes/minutes/sources.ts` 녹취록 읽기 실패 | `errors.transcriptLoadFailed` — PDF·메일 창의 토스트가 이 문구를 그대로 띄웁니다(`errorMessageOf`) |
| `lib/terms/term-list.ts` `termOfResponse` | 실패 문구를 인자로 받습니다. 부르는 쪽이 `settings.terms.addFailed`를 넘깁니다(전역 토스트가 그대로 띄움) |
| `lib/notes/share-mail/recipients.ts` 받는 사람 검증 | 문구 대신 값(`RecipientProblem`)을 돌려주고 공유 창이 `notes.share.mail.problem.*`로 그립니다 |
| `components/auth/*`, `app/(product)/auth/callback/loading.tsx` | 로그인 콜백 실패·진행, 로그인 버튼, 로그아웃 실패·세션 만료 토스트를 `auth.callback`·`auth.status`·`auth.logoutFailed`·`auth.sessionExpired`로. 콜백의 「로그인 거부」와 「로그인 실패」는 한 문구로 합쳤습니다(아래 평가) |
| 화면에 나가지 않는 내부 Error(`deletion-api` 처리 목록, `note-details` 경계, `proposals/select` 상태 코드) | 언어 파일이 아니라 영어 개발자 문구로 바꿨습니다. 화면은 각자 `isError`·경계에서 자기 문구를 그립니다 |
| 그대로 둔 것 | 계약 값 `WITHDRAWAL_CONFIRMATION`(D12), 계약 zod 검증 메시지(`proposals/contract.ts`)·프로토콜 예시(`transcription/protocol.ts`), 개발자 불변식(`help-hub-search`, `help/content.ts`), SEO 이름(`site.ts`), 날짜 경계 보정표(`KO_DAY_PERIOD`), 한국어 조사 함수, 제목에서 날짜를 떼는 정규식, 운영자가 읽는 저장 머리(D14·D15), 메일 미리보기(D20), 「언어 · Language」(D13), 내부 샘플 화면 `help-samples` |

## 문구 평가

대상: `messages/<ko|en>/errors.json` 전체, 이번에 더한 `auth.json`의 `callback`·`status`·`logoutFailed`·`sessionExpired`, `notes.json`의 `share.mail.problem`

| 축 | 1차 | 2차 |
|---|---|---|
| slop | 4 | 5 |
| 용어 | 5 | 5 |
| 적합도 | 3 | 4 |
| 일관성 | 4 | 4 |
| **평균** | **4.0** | **4.5** |

### 반영한 지적

1차
- `requestFailed`: 다음 행동을 붙임 「…잠시 후 다시 시도해 주세요.」 / 「…Try again in a moment.」
- `serverUnavailable`: 5xx에도 쓰여 「연결할 수 없습니다」가 틀릴 수 있음 → 「서버가 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.」 / 「The server couldn't handle the request. Try again in a moment.」
- `streamGone`: 내부 낱말 「스트림」 → 「응답을 이어서 받지 못했습니다.」
- `transcriptLoadFailed`: 다음 행동을 붙임
- 로그인 콜백: 「로그인 거부 / 로그인이 취소되었거나 거부되었습니다」는 URL 오류 전반에 쓰여 원인을 단정했습니다. 실패와 한 문구로 합치고 설명은 다음 행동만 둡니다
- `share.mail.problem.invalid`(en): 여러 주소에도 맞게

2차
- `auth.callback.failedTitle`: 앱 진입 실패에도 쓰여 「로그인을 마치지 못했습니다」 / 「Couldn't finish signing in」
- `share.mail.problem.invalid`(en): 목적어를 넣음 「Remove these addresses and enter them again.」

### 남긴 지적과 이유

- `timeout`에 「결과 확인」을 넣는 안: 문장이 길어지고, 네트워크 확인 뒤 다시 시도가 이미 다음 행동입니다
- `conflict`에 「다시 수정해 주세요」를 넣는 안: 최신 내용이 이미 화면에 있어 다시 고치면 된다는 것이 자명합니다
- `reviewConfirmed`에 다음 행동을 넣는 안: 확정된 검토에서 할 수 있는 일이 없습니다
- `workspaceGone`에 「관리자에게 문의」를 넣는 안: 추방·삭제·다른 기기에서 나감이 모두 여기 와서 원인을 단정하지 않습니다(`gone-notice.ts`의 판단)

## 한국어에서 바뀐 문장

| 키 | 전 | 후 |
|---|---|---|
| serverUnavailable | 서버에 잠시 연결할 수 없습니다. 잠시 후 다시 시도해 주세요. | 서버가 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요. (12단계 평가로 다시 고침) |
| requestFailed | 요청을 처리하지 못했습니다. | 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요. |
| `auth.callback` 제목(거부·실패) | 로그인 거부 / 로그인에 실패했습니다 | 로그인을 마치지 못했습니다 |
| `auth.callback` 설명(거부·실패) | 로그인이 취소되었거나 거부되었습니다. / 인증 정보를 가져오지 못했습니다. 다시 시도해 주세요. | 잠시 후 다시 시도해 주세요. |

## 렌더 확인 (12단계)

- `/auth/callback?error=access_denied`, 영어 계정 1440·1024: 「Couldn't finish signing in」「Try again in a moment.」「Sign in again」「Go to home page」. 한글 0, 넘침은 「Skip to content」(기존)

## 코드 리뷰 (12단계)

- 1회차: [P3] 받는 사람 문제 문구의 ICU(영어 단·복수) 검증이 없음 → `recipients.test.ts`에 두 언어 시험을 더함. P1·P2 0건
