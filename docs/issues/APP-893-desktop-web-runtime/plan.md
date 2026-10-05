# 데스크톱 로그인과 웹 기록 연결 구현 계획

- 이슈: [APP-893](https://linear.app/minswon/issue/APP-893)
- spec: docs `origin/docs/app-893/desktop-web-runtime:projects/PRO-55-데스크톱-회의-사운드-캡처/spec/APP-893/spec.md` @ `706b5cf`
- 프로젝트 브랜치: `pro-55/desktop-audio` ← `dev`
- APP 브랜치: `feat/app-893/desktop-web-runtime` ← `pro-55/desktop-audio`
- 병합: APP→PRO 로컬 squash, PRO→dev 프로젝트 전체 검증 후 반영. web remote PR 없음.
- 검증: `pnpm test:run && pnpm verify`

## spec 검토 결과

| 관점 | 확인 | 답 |
|---|---|---|
| 계약 | 서버 Desktop REST·callback과 소비자 | APP-891 Controller·DocsTest의 AppResponse 응답과 HttpOnly writer를 사용하며 별도 token 계약 없음 |
| 실측 | 기존 경계·빌드 크기 | APP-890 static/server/nft 크기 동일, APP-892 trusted local renderer에서 기존 batcher로 PCM을 만들고 bounded IPC로 웹 transport에 전달 |
| 경계 | auth 진입·returnTo·연결 설정·runtime | GoogleLoginButton, paths.ts, auth/callback, workspace-integrations-settings, recording-provider의 createAudio 주입 확인 |
| 되돌리기 | 앱 session과 외부 연결 | 로그인 세션은 logout, 연결은 disconnect로 폐기. optional bridge 웹 변경 revert로 브라우저 복구 |
| 사람에게 물은 것 | 실제 OS cookie/URI·입력 검증 | 사용자 실제 앱 테스트·컴퓨터 접근 승인. 구현 후 packaged 앱 테스트로 확인할 항목이며 미확인 상태를 완료로 표시하지 않음 |

## 건드리는 것

| 파일 | 현재 | 변경 |
|---|---|---|
| apps/desktop/src/auth.ts·auth-policy.ts | 없음 | PKCE pending broker·strict callback/authorize URL·timeout/cancel 정책 |
| apps/desktop/src/main.ts·preload.ts·policy.ts | 기반 IPC | 단일 인스턴스·protocol·auth IPC 및 Electron session fetch |
| lib/desktop | APP-892에서 추가 중 | capability·auth 소비 API와 호환 검사, 선행 브랜치 통합 뒤 최종 타입 정리 |
| components/auth/google-login-button.tsx | 웹 전체 문서 이동 | 지원 앱의 browser login 뒤 기존 auth callback 진입 |
| components/settings/workspace-integrations-settings.tsx | 웹 authorize 이동 | 앱 ticket 시작·결과·연결 목록 갱신 |
| components/transcription/recording-provider.tsx·녹음 UI | 기존 mic runtime | 지원 앱 dual capture 선택·source 안내·summary 전달 |
| openapi3.yml·lib/api/generated | 기존 REST 미러 | APP-891 생성 계약에서 public 경로만 동기화, 필요 소비 코드 생성 |

## 순서

### 1. 앱 인증 정책과 broker

- PKCE와 pending state는 main 메모리에서 관리하며 renderer에 결과만 전달한다.
- callback은 `app.heymoa:/auth/callback`과 `app.heymoa:/integrations/callback`을 정확히 받는다. 외부 링크를 OS 브라우저로 여는 취소된 navigation은 pending 요청을 유지하고 실제 문서 교체에서만 취소한다.
- 승인한 callback의 query 중복·origin·path·state와 서버 authorize URL을 검증한다.
- 검증: desktop node tests, typecheck/build. wrong state·재사용·timeout·cancel·네트워크 실패·late response cleanup 재현.
- 되돌리기: 신규 auth 파일 revert, 기존 웹/캡처 독립.

### 2. Electron protocol과 session 연결

- macOS open-url, Windows initial argv/second-instance를 한 callback 처리로 통합한다.
- 고정된 API와 기존 앱 partition에서 fetch하고 쿠키가 저장된 뒤 성공을 반환한다.
- 검증: desktop tests/package, 실제 시스템 브라우저→앱→인증된 API. 선행 서버 경로 구현과 배포가 필요하다.
- 되돌리기: auth bridge만 비활성화해 구버전/서버 실패를 명시한다.

### 3. 기존 웹과 캡처 runtime 연결

- APP-892를 PRO에 합친 뒤 rebase하고 해당 캡처/capability를 사용한다.
- 로그인·연결 UI, source 상태 및 runtime summary를 기존 제품 함수와 연동한다.
- APP-891 생성 REST 계약을 소비하고 원래 웹 인증·마이크 회귀를 확인한다.
- 검증: 선택 auth/settings/recording 테스트, 실제 packaged 캡처와 로그인, 전체 웹 gate.
- 되돌리기: optional desktop 분기를 revert, 서버 session/연결은 기존 폐기 경로.

## 마지막 관문

`pnpm test:run && pnpm verify`와 `pnpm test:e2e`, desktop tests/typecheck/build/package를 통과하고 Codex·독립·적대적 리뷰를 받는다. 웹 remote PR은 없으므로 이 로컬 검증이 유일한 관문이다. 실제 packaged 로그인·인증된 API·두 입력과 macOS/Windows 앱 복귀를 별도로 확인하며 실행 환경이 없는 항목은 후속 검증 상태로 명시한다.

## 안 하는 것

서버 원자적 ticket/code 검증 APP-891, PCM·권한 APP-892, 메뉴·종료 보호 APP-894, 아이콘·설치·배포 APP-895는 각 이슈에서 처리한다. renderer token 전달·브라우저 cookie 복사·전사 client 복제는 도입하지 않는다.
