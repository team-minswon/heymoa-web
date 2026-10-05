# 마이크와 컴퓨터 소리를 함께 녹음해 전사하기 구현 계획

- 이슈: [APP-892](https://linear.app/minswon/issue/APP-892)
- spec: docs `origin/docs/app-892/dual-audio-capture:projects/PRO-55-데스크톱-회의-사운드-캡처/spec/APP-892/spec.md` @ `3406c89`
- 프로젝트 브랜치: `pro-55/desktop-audio` ← `dev`
- APP 브랜치: `feat/app-892/dual-audio-capture` ← `pro-55/desktop-audio`
- 병합: APP→PRO 로컬 squash, PRO→dev 전체 검증 후 rebase 반영. web remote PR 없음.
- 검증: `pnpm test:run && pnpm verify`

## spec 검토 결과

| 관점 | 확인 | 답 |
|---|---|---|
| 계약 | 기존 PCM·배처·ACK | capture-config·worklet·realtime-session 주입 지점을 확인했고 공개 전사 형식은 유지한다 |
| 실측 | 실제 OS·permission | Electron 고정 버전 source는 display도 media permission을 사용한다. Mac packaged nonzero와 video stop 뒤 audio 유지는 실제 테스트 대상이며 fake stream으로 대체하지 않는다 |
| 경계 | browser와 desktop | 기존 PcmAudioCapture tests·별도 desktop security tests를 유지하고 optional 입력 factory·source callback을 추가한다 |
| 되돌리기 | 입력·grant | 모든 track·context·listener·grant를 정리하고 코드 revert로 browser 기준선 복귀. 디스크 저장 없음 |
| 사람에게 물은 것 | 권한·최적화 | 사용자 자율 구현·capture·컴퓨터 테스트 승인과 메모리/IPC/meter 최적화 요청이 있으며 전체 시스템+마이크 범위로 진행한다 |

## 건드리는 것

| 파일 | 현재 | 변경 |
|---|---|---|
| apps/desktop/src/media-grant.ts | 없음 | one-shot display/audio 권한·세대·만료·수명주기 |
| apps/desktop/src/main.ts·preload.ts·policy.ts·security.ts | deny all | 원격 deny-all 유지·사용자 begin/end 및 bounded PCM 전용 bridge |
| apps/desktop/src/capture-host.ts·capture-protocol.ts·capture-preload.ts | 없음 | 신뢰된 로컬 exact-frame 권한·packet schema·단일 in-flight ACK/timeout |
| apps/desktop/renderer·scripts/build-renderer.mjs | 없음 | 외부 통신 없는 CSP 로컬 capture bundle, 기존 worklet 복사 |
| apps/desktop/test | 보안 기준선 | grant 재사용·origin/frame·userGesture·late callback·권한 종류 테스트 |
| lib/transcription/audio.ts·audio.test.ts | 단일 mic | 입력 factory·mono mixer·입력별 상태/레벨·late async 정리 |
| lib/desktop/capture.ts·capture.test.ts | 없음 | stream 없는 typed PCM AudioPort·세대와 subscription cleanup |
| package allowlist validator | 기반 compile 결과 | 새 grant runtime 모듈 허용·필수 검사 |

## 순서

### 1. 권한 grant와 bridge

- 원격 현재 문서·정확한 origin·사용자 활성화에 결합한 begin/end를 구현한다. native media 요청은 exact local capture frame만 승인하며 원격 미디어는 항상 거부한다.
- 검증: `pnpm desktop:typecheck && pnpm desktop:test`.
- 되돌리기: grant 연결을 빼고 기존 deny-all로 복귀한다.

### 2. 입력 확보와 단일 AudioContext

- 기존 캡처를 로컬 capture renderer에 bundle해 input factory와 하나의 mono worklet 경로·source 상태·meter를 사용한다. 임시 video는 로컬에서 즉시 제거하고 원격에는 최대 3200byte PCM·상태만 전달한다. ACK·timeout으로 queued PCM을 제한하고 모든 비동기 단계에서 세대 확인과 부분 자원 정리를 수행한다.
- 검증: audio·desktop capture scoped Vitest, desktop typecheck·unit tests.
- 되돌리기: 기존 browser 입력을 유지하고 desktop factory만 제거한다.

### 3. 실제 패키지와 회귀

- macOS .app을 생성하고 실제 source별 nonzero PCM·video stop 뒤 audio 유지·권한 거부를 확인한다. 부모 에이전트와 실제 실행을 조율한다.
- 검증: `pnpm desktop:package`, 웹 필수 검증과 패키지 목록 검사·독립/적대적 리뷰.
- 되돌리기: 실패한 앱을 제공하지 않고 grant/factory를 비활성화한다.

## 마지막 관문

`pnpm test:run && pnpm verify` 및 e2e·desktop 검증과 packaged 실제 입력 검증을 완료한다. 이 레포는 remote PR과 CI가 없어 실제 실행 결과가 관문이다. Node의 experimental webstorage 때문에 기존 테스트가 깨지는 환경은 확인된 `NODE_OPTIONS=--no-experimental-webstorage`로 실행하며 Vercel Node 환경과 구분한다. 검증하지 못한 Windows 실행은 성공으로 기록하지 않는다.

## 안 하는 것

APP-893 provider 제품 연결과 인증, APP-894 트레이, APP-895 Release, APP-896 전체 OS 수용 검증. 항상 켠 입력·디스크 저장·특정 앱 선택·자동 녹음은 추가하지 않는다.

적대적 리뷰에서 원격 renderer의 임시 video 확보가 sound-only 보안 경계를 강제하지 못함을 확인했다. Electron 고정 소스는 video 없는 display callback도 거부한다. 따라서 제한된 PCM IPC 복사 비용을 수용하고 로컬 renderer로 stream 소유권을 옮긴다.

## 확인된 실물 결과

2026-10-05 별도 QA packaged 앱에서 production 캡처 파일 10개의 SHA 일치를 확인한 뒤 CUA로 실제 macOS system audio를 검증했다. 원격 media 요청 2개 거부, local media 승인·userGesture true, 임시 video ended/제거·audio live, file worklet 시작을 확인했다. 별도 afplay의 오른쪽 채널 음원은 mic meter 최대 0인 동안 system meter 최대 1·nonzero PCM 130187 sample·peak 약 0.25003을 만들었다. 중지 후 local-host-disposed/stopped 및 최종 250 packet·399680 sample을 확인했다. 마지막 부분 packet도 drain됐다.

이 증거는 system-only 실제 입력과 종료 검증이다. 마이크 말소리 nonzero PCM, Windows·Intel Mac·production 로그인과 provider 연결은 확인하지 않았다. 원본 오디오는 저장하지 않았다. 초기 QA fileOrigin false는 native origin 직렬화와 `file://` 문자열의 정확 비교 문제로, bundled document URL/exact-frame 승인 실패가 아니다. helper만 문서 scheme/native category 진단으로 수정했고 shipping capture 코드와 기존 증거는 변경하지 않았다.

## 공통 타입과 테스트 품질 검토

APP-897 foundation code PRO `d6a70f7` 위에 rebase했다. bridge·packet·capability·입력 상태는 `@heymoa/desktop-contracts` type-only 선언을 사용하고 runtime schema는 native 경계에 둔다. 기존 workspace의 esbuild 보안 override와 맞게 direct pin을 갱신했다.

권한 만료 테스트의 Date.now 직접 변경은 Node 가상 시계로 바꾸고 실제 TTL 폐기·ready 이후 deadline 취소를 검증했다. Host의 ACK deadline 경계·정상 ACK·최신 ended 상태 coalescing·local crash·tail drain 실패를 추가했다. 입력 확보·worklet loading 테스트는 polling 대신 관찰 가능한 stop/module-request promise로 동기화했다. 기존 realtime 테스트의 dependency/fake-timer 구조는 유지했다.

구조 검토에서 임의의 2초 captureSamples gap 상한을 제거해 기존 캡처 공백 좌표를 전달한다. stop tail drain IPC 실패는 삼키지 않고 reject·onCaptureError로 알리며 finally로 listener와 level을 정리한다. 실제 QA는 이 두 수정과 type-only 통합 전 artifact를 확인한 기록이며 최종 exact-head 실물 실행으로 표시하지 않는다.

## 통합 전 검증 기록

구현 `97d9207`에서 웹 전체 150파일·2032테스트, `pnpm verify`의 lint/typecheck/production build, E2E 81테스트, native 26테스트, 관련 웹 audio/realtime 117테스트와 desktop typecheck/package를 통과했다. `codex review --base origin/pro-55/desktop-audio`는 수정이 필요한 명확한 결함 없이 종료했다. 통합 스크립트가 최신 PRO 기준으로 `MOA_VERIFY`를 다시 실행한다.

프로젝트 통합 브랜치에 코드를 제공하되 APP-892의 실제 마이크 말소리 수용 조건은 남겨 둔다. Windows·Intel Mac·최종 production 로그인 및 제품 연결 검증도 미완료다. 이 단계는 Linear Done이나 배포 수용 완료가 아니다. 최종 spec 체크포인트는 `docs/app-892/dual-audio-capture`의 `7b64f52`다.
