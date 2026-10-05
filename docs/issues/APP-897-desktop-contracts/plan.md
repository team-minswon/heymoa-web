# 공통 bridge 타입 패키지 연결 순서

- 이슈: [APP-897](https://linear.app/minswon/issue/APP-897)
- spec: docs `docs/app-897/desktop-contracts:projects/PRO-55-데스크톱-회의-사운드-캡처/spec/APP-897/spec.md` @ `074e5bd`
- 프로젝트 브랜치: `pro-55/desktop-audio` ← `dev`
- APP 브랜치: `feat/app-897/desktop-contracts` ← `pro-55/desktop-audio`
- 병합: 독립 리뷰와 마지막 관문 뒤 APP → PRO 로컬 squash, PRO → dev rebase
- 검증: `pnpm test:run && pnpm verify`

## spec 검토 결과

| 관점 | 물은 것 | 답 |
|---|---|---|
| 계약 | 공개 약속이 바뀌나 | Orval와 REST 모델은 그대로 두고 native bridge 타입만 공유한다 |
| 실측 | 실제 중복이 있나 | APP-893 auth-policy와 lib/desktop/auth, APP-892 capture-protocol와 lib/desktop/capture의 대응 선언을 확인했다 |
| 경계 | 호출자와 빌드를 확인했나 | foundation preload는 Electron-only runtime import, main은 tsc CommonJS, ASAR는 node_modules 제외 allowlist다 |
| 되돌리기 | 데이터 복구가 필요한가 | 선언·import·workspace dependency만 되돌리면 된다 |
| 사람에게 물은 것 | 범위가 결정됐나 | 최소 타입 분리만 위임받았고 Orval·오디오 이동은 제외했다 |

## 건드리는 것

| 파일 | 지금 무엇인가 | 무엇으로 바뀌나 |
|---|---|---|
| packages/desktop-contracts | 없음 | runtime export·의존성 없는 declaration package |
| pnpm-workspace.yaml, package.json, apps/desktop/package.json, pnpm-lock.yaml | desktop workspace만 있음 | 공통 타입 workspace와 양쪽 dev dependency |
| apps/desktop/src/policy.ts, preload.ts | foundation summary 선언 | 공통 타입 소비, runtime validator 유지 |
| APP-892·APP-893 소비자 | 타 소유자의 진행 중 변경 | 각 소유자에게 교체안을 전달하고 통합 후 검증 |

## 순서

### 1. 선언 패키지와 foundation 연결

- 바꾸는 것: 공통 declaration, workspace와 dev dependency, foundation summary 타입
- 검증: frozen install, 웹·Electron typecheck, desktop tests, emitted JS의 package require 부재
- 되돌리기: 이 커밋의 선언·import·manifest를 revert한다

### 2. 인증·캡처 소비자 통합

- 바꾸는 것: 소유자가 APP-892·APP-893의 중복 타입을 import type으로 교체한다
- 검증: 소유자 브랜치의 인증·캡처 테스트와 합쳐진 package allowlist
- 되돌리기: 기존 타입 선언을 복원한다

## 마지막 관문

`pnpm test:run && pnpm verify`와 CLAUDE의 `pnpm test:e2e`, desktop typecheck/tests/package allowlist를 최종 통합에서 통과시킨다. PR·CI가 없는 웹 레포의 검증은 로컬 관문이다. 웹 production trace와 desktop compiled preload/main에 새 runtime dependency가 없는지 검사한다. 소비자 통합이 끝나지 않으면 APP-897을 완료로 판정하지 않는다.

## 안 하는 것

Orval, fetcher, React Query 훅, 오디오 구현, worklet, 서버 OpenAPI 미러는 이동하지 않는다. capability 협상과 origin/frame/user activation 검사는 기존 runtime 코드를 유지한다.
