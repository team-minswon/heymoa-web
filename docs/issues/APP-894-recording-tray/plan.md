# 메뉴 막대 녹음 상태와 종료 보호 구현

- 이슈: [APP-894](https://linear.app/minswon/issue/APP-894)
- spec: docs `origin/docs/app-894/recording-tray:projects/PRO-55-데스크톱-회의-사운드-캡처/spec/APP-894/spec.md` @ `e4d9595`
- 프로젝트 브랜치: `pro-55/desktop-audio` ← `dev`
- APP 브랜치: `feat/app-894/recording-tray` ← `pro-55/desktop-audio @ d6a70f7`
- 현재 통합 기준: 로컬 `pro-55/desktop-audio @ 798cc70` (APP-893 controller·summary·행동 구독 통합)
- 병합: APP-893 반영 후 최신 로컬 PRO로 rebase, 검증 및 docs land 뒤 APP → PRO 로컬 squash. PRO → dev rebase. 사용자 지시로 웹 원격 브랜치와 PR을 만들거나 push하지 않는다. docs 저장소의 checkpoint는 별도다.
- 검증: `pnpm test:run && pnpm verify`

## spec 검토 결과

| 관점 | 물은 것 | 답 |
|---|---|---|
| 계약 | 기존 약속과 어긋나나 | policy의 RecordingSummary 검증과 공통 타입을 유지하며 optional 고정 행동 구독만 추가한다. 공개 전사 API는 수정하지 않는다. |
| 실측 | 수치가 실제 측정값인가 | 시간과 대기 판단은 코드 심볼을 정의하고 가상 시계 테스트로 확인한다. 실제 Windows 작동은 아직 측정하지 않았다. |
| 경계 | 호출자와 테스트 더블을 확인했나 | 기반 main의 close/window-all-closed/crash listener, preload와 summary handler를 확인했다. APP-893 controller 구독은 해당 owner와 통합한다. |
| 되돌리기 | 복구 비용은 얼마인가 | native 모듈 및 optional 구독 추가는 revert 가능하다. 사용자 확인 후 버린 메모리 소리는 복구 불가다. |
| 사람에게 물은 것 | 열린 질문에 답이 났나 | 부모가 고정 행동 구독과 기존 controller 종료·미전송 대기 설계를 승인했다. 추가 질문은 없다. |

## 건드리는 것

| 파일 | 지금 무엇인가 | 무엇으로 바뀌나 |
|---|---|---|
| `apps/desktop/src/recording-lifecycle.ts` | 신규 | 상태 표시와 종료 보호 상태 기계, 의존성 주입 |
| `apps/desktop/src/recording-tray.ts` | 신규 | Electron 메뉴·창 숨김·종료 event adapter |
| `apps/desktop/src/main.ts` | 기반 창·summary IPC | native adapter 연결, 기존 crash 처리와 정합성 유지 |
| `apps/desktop/src/preload.ts`, `policy.ts` | 기반 조회·보고 | 고정 행동 구독 및 정리, 기존 sender 검증 유지 |
| `packages/desktop-contracts/index.d.ts` | 공통 타입 선언 | optional 녹음 행동 구독 타입 |
| `apps/desktop/test/recording-*.test.cjs` | 신규 | 종료 대기·취소·늦은 응답·crash·정리 테스트 |

## 순서

### 1. 상태와 종료 보호 모듈

- 바꾸는 것: 기존 summary로 안전 판정과 메뉴 표시, 종료 확인 및 전송 완료 대기를 구현한다.
- 검증: `pnpm desktop:test`에서 가상 timer와 늦은 응답 시나리오를 확인한다.
- 되돌리기: 모듈 커밋을 revert하면 기존 기반 앱으로 돌아간다.

### 2. 트레이와 고정 행동 구독 연결

- 바꾸는 것: Electron 메뉴·창 close·before-quit·crash adapter와 optional preload 구독을 연결한다. 승인된 단색 템플릿 자산을 사용한다.
- 검증: desktop 타입 검사와 adapter 이벤트 순서 테스트, 실제 Mac 앱에서 창 숨김·복귀를 확인한다.
- 되돌리기: adapter와 optional 구독 추가를 revert한다.

### 3. 기존 녹음 controller 통합

- 바꾸는 것: APP-893 owner가 현재 회의 이동과 stop을 기존 runtime에 연결한다. 최신 PRO로 rebase 후 전체 회귀를 확인한다.
- 검증: 실제 녹음 상태·미전송 버퍼·메뉴 종료 및 웹 브라우저 회귀를 확인한다. Windows 실행은 별도 실측 여부를 기록한다.
- 되돌리기: 통합 전 foundation만으로 완료를 판정하지 않는다.

## 마지막 관문

최신 PRO rebase 뒤 `pnpm test:run && pnpm verify`, desktop 테스트·실제 패키지 검증, 독립 리뷰와 codex review를 수행한다. Node 25 baseline webstorage 충돌은 `NODE_OPTIONS=--no-experimental-webstorage`로 기존 검증 환경을 유지한다. `pnpm test:e2e`는 독립 포트에서 수행한다. PR과 CI가 없어 이 검증이 유일한 병합 관문이다. 부모 승인 없이 land하거나 Done 처리하지 않는다.

## 안 하는 것

APP-893 auth worktree 변경, 새로운 녹음 controller, 서버 API, 자동 녹음, 디스크 복구, 설치 파일 배포는 하지 않는다.
