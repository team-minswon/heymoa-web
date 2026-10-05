# Electron workspace와 보안 경계 구현 계획

- 이슈: [APP-890](https://linear.app/minswon/issue/APP-890)
- spec: docs `origin/docs/app-890/desktop-workspace:projects/PRO-55-데스크톱-회의-사운드-캡처/spec/APP-890/spec.md` @ `10aaa34`
- 프로젝트 브랜치: `pro-55/desktop-audio` ← `dev`
- APP 브랜치: `feat/app-890/desktop-workspace` ← `pro-55/desktop-audio`
- 병합: APP→PRO 로컬 squash, PRO→dev 전체 검증 후 반영. web remote PR 없음.
- 검증: `pnpm test:run && pnpm verify`

## spec 검토 결과

| 관점 | 확인 | 답 |
|---|---|---|
| 계약 | 기존 전사·브라우저 인증 | 이번 기반 이슈는 변경하지 않음, 캡처·인증은 후속 APP892/891/893 |
| 실측 | Next 배포 크기 | 수정 전 production build에서 baseline을 수집, 캐시 포함 .next 전체는 기준으로 쓰지 않음 |
| 경계 | tsconfig·eslint·pnpm·Next root | 현재 desktop 포함 glob과 binary script deny를 확인, 독립 compile와 출력 제외 필요 |
| 되돌리기 | 패키지·설정 변경 | 앱과 설정 커밋만 revert 가능, 웹 root·DB 변경 없음 |
| 사용자 판단 | 자율 진행·worktree·PRO→APP | 사용자 승인 범위에서 지원 기준·최소 API를 정하고 전용 worktree 사용 |

## 건드리는 것

| 파일 | 현재 | 변경 |
|---|---|---|
| apps/desktop | 없음 | main/preload·origin/payload/OS policy·테스트·packager |
| pnpm-workspace.yaml·pnpm-lock.yaml | 단일 root | desktop workspace와 Electron binary install만 허용 |
| package.json | web 명령만 | desktop 전용 명령·Vercel install helper |
| tsconfig.json·eslint.config.mjs·vitest.config.ts·.gitignore | web 전체 glob | desktop code·출력 분리 |

## 순서

### 1. Workspace와 보안 정책

- 운영 origin 고정·개발 loopback 전용 정책·OS 지원·최소 bridge schema 구현.
- 검증: desktop typecheck·node unit tests; 잘못된 payload/frame/origin 거부.
- 되돌리기: workspace 설정과 앱 파일 제거.

### 2. Electron 런타임과 로컬 패키징

- origin/mainFrame 검증 IPC·popup/navigation·permission deny 정책 연결, preload 최소 API.
- exact Electron/builder pin, compiled files allowlist, 사용 설명 포함 .app package.
- 검증: desktop compile·package:dir, app.asar 파일 검사, 로컬 앱 실행.
- 되돌리기: 앱 런타임·패키지 커밋 revert.

### 3. 웹 회귀와 크기 확인

- baseline 대비 static chunk·tracing 파일 목록 대조, Electron 바이너리 web trace 혼입 검사.
- 웹 client code는 이 이슈에서 바꾸지 않음.

## 마지막 관문

`pnpm test:run && pnpm verify`와 레포 필수 e2e, desktop tests/typecheck/build/package를 실행하고 독립·적대적 리뷰를 받습니다. 웹은 PR을 사용하지 않으므로 실제 실행 증거가 유일한 관문입니다.

### 실행 결과

- 웹 테스트: 로컬 Node 25에서 `NODE_OPTIONS=--no-experimental-webstorage pnpm test:run`으로 147파일·2,018테스트 통과. Vercel은 Node 24.x입니다.
- `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test:e2e` 통과. Playwright 81개 통과.
- desktop typecheck/build와 정책·보안 테스트 12개 통과. macOS arm64 `.app` 패키징·ASAR 허용 목록 검사 통과, 앱에서 운영 웹 화면 확인.
- 수정 전후 `.next/static`, `.next/server`, nft 추적 파일의 크기와 개수 동일. Electron trace 혼입 없음.
- 독립·적대적 리뷰에서 외부 main frame 이벤트 순서 결함을 수정하고 회귀 검증 완료. `codex exec review --base pro-55/desktop-audio`에서 추가 차단 지적 없음.
- Vercel 설치 helper는 루트 `vercel.json`에서 선택합니다. 설치 중 Electron 바이너리 다운로드를 생략하며 웹 빌드 명령과 루트는 유지합니다.

## 안 하는 것

캡처 APP892, 인증 APP891·893, 트레이 APP894, Release APP895는 해당 브랜치에서 구현합니다. 서명·공증·Windows 실제 동작은 미검증 상태를 숨기지 않습니다.
