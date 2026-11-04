# 대시보드 문구 이관·영어판 구현 순서

- 이슈: [APP-1286](https://linear.app/minswon/issue/APP-1286)
- spec: docs `docs/app-1286/dashboard-en:projects/PRO-66-웹-국제화/spec/APP-1286/spec.md` @ `e455d14e` (용어집: 같은 폴더 `docs/glossary.md`)
- 프로젝트 브랜치: `pro-66/웹-국제화` ← `dev`
- APP 브랜치: `feature/app-1286/dashboard-en` ← `feature/app-1285/product-language` @ `30f376ba`. **APP-1285가 머지 전이라 그 위에 쌓았다. APP-1285 머지 뒤 `pro-66/웹-국제화`로 rebase한다** (`git rebase --onto pro-66/웹-국제화 30f376ba`)
- 병합: APP → PRO squash, PRO → `dev` rebase
- 검증: `pnpm test:run && pnpm verify`

결정 기록(사용자 검토용): [`review/decisions.md`](review/decisions.md). 모듈별 문구 평가: `review/<이름공간>.md`.

## spec 검토 결과

| 관점 | 물은 것 | 답 |
|---|---|---|
| 계약 | 우리가 발행한 약속과 어긋나나 | 계약을 바꾸지 않는다. 서버 문구를 먼저 쓰는 `errorMessageOf`(`lib/api/error-message.ts`)를 그대로 두고 fallback만 옮긴다. `Accept-Language` 전송은 APP-1285의 `acceptLanguageHeader()`가 이미 한다 |
| 실측 | 근거로 댄 숫자가 실제로 잰 것인가 | spec 「문제」의 줄 수는 `30f376ba`에서 주석 줄을 뺀 grep으로 쟀다(근사라고 적혀 있다). 완료 기준은 수치가 아니라 「한글 UI 문구가 없다」이고, 판정은 e2e 화면 검사가 한다 |
| 경계 | 영향받는 호출자·테스트 더블을 모두 확인했나 | 컴포넌트 시험 대부분이 Provider 없이 그린다(`components/help/test-intl.tsx`, `chat-starter.test.tsx`만 Provider를 직접 둠). 그래서 1단계가 기본 wrapper다. `useDisplayLocale` 목(`vitest.setup.ts`)은 그대로 둔다. 마케팅 루트는 `app/[lang]/layout.tsx`가 `clientNamespaces`를 명시하므로 제품 이름공간이 새지 않는다. 제품 루트는 `app-shell.tsx`의 기본값을 쓴다 |
| 되돌리기 | 복구 비용은 얼마인가 | 데이터를 바꾸지 않는다. 모듈마다 커밋이 나뉘어 그 커밋만 revert하면 그 모듈이 한국어 리터럴로 돌아간다 |
| 사람에게 물은 것 | spec의 열린 질문에 답이 났나 | 사용자가 자리에 없다. 다섯 항목 모두 추천안으로 진행하고 `review/decisions.md`(D2·D6·D7)에 남겼다. 사용자 검토 때 바뀌면 해당 모듈 커밋 위에 고친다 |

## 건드리는 것

| 파일 | 지금 무엇인가 | 무엇으로 바뀌나 |
|---|---|---|
| `vitest.setup.ts` | `next/root-params`·`useDisplayLocale` 목 | RTL `render`·`renderHook`의 기본 wrapper로 한국어 Provider |
| `i18n/messages.ts`, `i18n/messages.test.ts` | 이름공간 6개, `REQUIRED_EN` 6개 | 모듈마다 이름공간 하나씩 더함 |
| `messages/<ko\|en>/<ns>.json` | (신규) | 모듈 문구 |
| `components/layout/app-shell.tsx` | 기본 `clientNamespaces = ["common","auth"]` | 제품 이름공간 더함 |
| `lib/i18n/web-message.ts` | (신규) | `errors` JSON 두 벌을 import하고 `documentLocale()`로 고르는 함수 하나. React 밖 모듈 전용 |
| `components/**`(목 제외), `app/(product)/**`(목 화면 제외) | 한국어 리터럴 | `useTranslations`/`getTranslations` |
| 날짜 문장 함수 6곳 | 한국어 낱말 직접 조립 | `locale`·`t` 인자 |
| `content/help/**`, `messages/<ko\|en>/help.json` | 한국어 본문, 영어판의 `hub.uiNote` | 윤문, 화면 이름 맞춤, `uiNote` 제거 |

`common.agentChat`은 `chat` 이름공간으로 옮긴다(D2). 랜딩이 같은 키를 쓰는지 먼저 확인하고, 쓰면 `common`에 남긴다.

## 순서

모듈 단계(3~13)는 같은 절차를 따른다. 문구 이관 → 한국어 윤문 → 영어판 → codex 문구 평가(`review/<ns>.md`) → 1440·1024 렌더 확인(임시 e2e spec으로 캡처, `getBoundingClientRect` 비교, 끝나면 지움) → codex 코드 리뷰(P1·P2 0건) → 커밋 `[APP-1286] <모듈> 문구 영어판과 윤문`.

### 1. 시험의 기본 Provider

- 바꾸는 것: `vitest.setup.ts`에 RTL 목. 호출부 `wrapper`가 있으면 Provider 안에 둔다
- 검증: `pnpm test:run` 전체가 바뀌기 전과 같은 결과
- 되돌리기: 이 커밋만 revert

### 2. React 밖 문구 함수와 `errors` 이름공간 뼈대

- 바꾸는 것: `lib/i18n/web-message.ts`, `messages/<ko|en>/errors.json`(빈 객체로 시작하지 않고 13단계 문구를 여기서 옮긴다), 시험(ko·en·SSR)
- 검증: `pnpm test:run lib/i18n`
- 되돌리기: 이 커밋만 revert

### 3. 공용 셸·사이드바 (`shell`)
### 4. 설정 (`settings`)
### 5. 워크스페이스·프로젝트·초대 (`workspace`)
### 6. 회의 노트 (`notes`) — 하위 화면별로 커밋을 나눈다: 머리·상태 → 타임라인 → 전사·화자 → 요약·검토 → 회의록·공유 → 정보
### 7. 채팅 (`chat`, `common.agentChat` 이전 포함)
### 8. 할 일 (`tasks`)
### 9. 알림 (`notification`)
### 10. 에이전트 연결·외부 에이전트 동의 (`agents`)
### 11. 녹음·전사 독 (`recording`, STOMP 오류 번역 포함)
### 12. web 자체 오류·토스트 fallback (`errors` 채움, `fetcher`·`query-client`·`error-message`)
### 13. 날짜 문장 함수 (`dates`)

- 각 단계 검증: `pnpm test:run` + `pnpm typecheck` + 그 모듈의 렌더 확인
- 각 단계 되돌리기: 그 모듈 커밋만 revert

### 14. 영어 화면 검사 e2e

- 바꾸는 것: `e2e/`에 영어 계정(쿠키 `heymoa-lang=en`)으로 주요 화면을 열어 목 데이터·사용자 데이터 영역을 뺀 본문에서 한글을 찾는 spec
- 검증: `pnpm test:e2e <그 spec>`

### 15. 사용 가이드

- 바꾸는 것: `content/help/**` 한국어 윤문(해요체 유지), `content/help/en/**` 화면 이름을 영어 대시보드에 맞춤, `help.hub.uiNote` 제거
- 검증: `pnpm test:run components/help app/\[lang\]/help`, 가이드 e2e

## 마지막 관문

15단계 뒤 `pnpm test:run && pnpm lint && pnpm typecheck && pnpm build && pnpm test:e2e`를 한 번 돌린다. 전체 e2e는 부하 시간 초과가 나므로 실패한 것만 단독으로 다시 돌려 판정한다. `e2e/help-en.spec.ts`의 `/en/help/start/desktop` `ERR_ABORTED`는 base에서도 실패하는 기존 문제다. 그 뒤 codex 전체 리뷰, 그리고 사용자 검토를 위해 멈춘다(머지·Done 하지 않음).

## 안 하는 것

- 목 데이터와 목 화면 문구(spec 범위 밖)
- 한국어 「회의록」·「회의 노트」 통일(용어집 「정하지 않은 것」, 사용자 확인 뒤)
- 데스크톱(APP-1287)
