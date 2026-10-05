# 앱 아이콘과 설치 파일 및 배포 준비

- 이슈: [APP-895](https://linear.app/minswon/issue/APP-895)
- spec: docs `docs/app-895/desktop-release:projects/PRO-55-데스크톱-회의-사운드-캡처/spec/APP-895/spec.md` @ `e97a05a`
- 프로젝트 브랜치: `pro-55/desktop-audio`
- APP 브랜치: `feat/app-895/desktop-release` ← local PRO `bf3dbe0` (APP894·APP899·APP900 포함)
- 병합: 부모 승인 뒤 로컬 squash. 원격 PR·feature/PRO push 없음. 검증·로컬 병합 뒤 main/dev push는 승인됐으며 부모가 수행한다.
- 검증: `pnpm test:run && pnpm verify`

## spec 검토 결과

| 관점 | 확인 결과 |
|---|---|
| 계약 | 앱 코드는 기존 remote web·capture 계약을 유지한다. 공개 릴리즈가 없어 다운로드 계약을 아직 웹에 연결하지 않는다. |
| 실측 | 승인 PNG를 직접 열었다. Mac 패키지 검증은 가능하나 Windows 실물 지원을 주장할 수 없다. |
| 경계 | apps/desktop package·배포 scripts·workflow만 편집한다. root·APP893 runtime·APP894 tray는 제외한다. |
| 되돌리기 | 로컬 커밋 revert로 복구. artifact workflow는 외부 Release를 게시하지 않는다. |
| 사용자 결정 | squircle 사용 승인·원격 작업 브랜치·PR 없이 검증된 main/dev 통합·실제 게시 전 결과 준비 지시를 반영한다. 공개 tap은 team-minswon/homebrew-tap, unsigned beta이며 게시 채널은 minswon-official 브라우저다. |

## 건드리는 것

| 파일 | 변경 |
|---|---|
| apps/desktop/build/icons/ | 원본 PNG·ICNS·ICO와 provenance |
| apps/desktop/package.json | 브랜드 아이콘·명명된 Mac/Windows 설치 산출물·명시적 publish never scripts |
| apps/desktop/scripts/ | 아이콘 재생성·컨테이너 검증·OS ASAR 검사·checksum 및 실제 Release 검사 도구 |
| .github/workflows/desktop-artifacts.yml | 수동 artifact CI, 게시 권한 없음 |
| apps/desktop/docs/release.md | 설치·출시 조건·서명·tap 절차 |

## 순서

### 1. 아이콘 자산

- 승인된 source/export를 보존하고 sips·iconutil로 재현 가능한 ICNS·ICO를 만든다.
- container sizes·embedded PNG signature·alpha를 확인한다.
- 자산 커밋을 revert하면 이전 기본 아이콘으로 돌아간다.

### 2. 설치 파일과 산출물 검사

- Mac DMG/ZIP·Win NSIS 및 architecture별 이름을 설정하고 unpacked ASAR 검사를 양 OS에 적용한다.
- Mac arm64 설치 산출물 및 포함 아이콘을 검사하고 실제 Dock 확인은 부모 CUA와 조율한다.
- 실패 시 산출물을 제공하지 않는다.

### 3. 공개 배포 준비

- 수동 CI를 artifacts-only로 구성하고 SHA256SUMS를 생성한다.
- 실제 공개 Release asset 다운로드와 hash를 확인해야 download manifest/cask를 만든다.
- 미게시·필수파일 누락·hash mismatch 회귀 테스트를 추가한다.

## 마지막 관문

통합 전 전체 `MOA_VERIFY`, E2E, desktop typecheck/test/package, Codex 독립 리뷰를 수행한다. Windows 빌드·설치, Intel Mac, 운영 웹 runtime 배포 및 실제 로그인·회의 녹음은 별도 미검증 조건으로 남긴다. GitHub workflow 정의만으로 CI 실행 성공을 표시하지 않는다.

## 안 하는 것

기능 QA 전 릴리즈 게시, CLI 게시, 인증서 발급·자동 업데이트, root 설정 변경, APP893·APP894 코드 편집, 존재하지 않는 URL을 사용하는 다운로드 UI. APP896 실제 OS 수용은 별도다.

## 확인된 준비 결과

APP893 통합 PRO `798cc70` 위에 rebase했고 OAuth protocol과 auth ASAR allowlist를 보존했다. 이 base에서 웹 152파일·2049테스트, verify(lint/typecheck/build), desktop typecheck와 native 50테스트를 통과했다. Mac arm64·Intel DMG/ZIP 생성 및 ASAR allowlist를 통과했고 외부 shasum으로 설치 파일 4개의 checksum 일치를 확인했다. Info.plist의 승인 ICNS byte 일치와 authentication scheme도 확인했다. 실제 Dock·새 설치·Windows 실행은 아직 확인하지 않았다.

첫 E2E는 패키지 압축과 여러 빌드가 겹친 동안 cold page.goto timeout이 발생해 중단했다. 제품 assertion 이전 navigation load 실패를 확인하고 다른 패키지 작업 종료 뒤 이 worktree의 .next를 새로 만들었다. source나 timeout을 바꾸지 않고 workers2로 전체 81개를 다시 실행해 모두 통과했다.

독립 리뷰에서 Windows listPackage의 native path separator 문제를 확인했다. 경로를 정규화하고 Windows 경로의 정상 패키지와 누락 auth·비밀·웹 소스 거부 회귀를 추가했다. 수정 `997d2fa` 재리뷰는 명확한 결함 없이 종료했다. 이후 수동 workflow source-policy는 YAML의 실제 shell을 실행해 dev/main 허용과 feature/fork/임의 SHA 거부를 확인했다. 최신 APP894 base 통합 뒤 최종 패키지와 독립 리뷰는 다시 확인한다.

workflow는 데스크톱 artifact 전용이고 Vercel·웹 배포를 건드리지 않았다. 웹 브랜치 push·PR·GitHub dispatch·공개 Release·tap 게시를 하지 않았다. 실제 public tap은 team-minswon/homebrew-tap이며 unsigned beta 정책을 확정했고, 운영 웹 desktop runtime 배포·물리적 OS 수용은 출시 관문으로 남는다.

## 최신 tap·beta 준비

APP894 local PRO 6931a36으로 rebase하고 tray 자산·native 모듈 allowlist를 보존했다. Windows ASAR fixture에 tray 경로를 반영한 native 68테스트를 통과했다. version은 0.1.0-beta.1이며 새 패키지를 다시 검증한다. 실제 tap은 빈 public 저장소이므로 가짜 cask나 다운로드 URL을 생성하지 않았다. 별도 tap updater는 공개된 Mac ZIP 두 개의 byte/hash를 검증한 뒤 heymoa 단일 token을 생성한다. 정확한 Mac 14.2 기준은 full-version preflight로 유지한다.

사용자가 브라우저 Release 게시를 승인했고 허용 login은 실제 메뉴에서 확인한 minswon-official이다. CLI alstn113 게시·계정 전환은 차단한다. 최종 기능 QA와 파일·checksum을 준비한 뒤 Release 내용을 먼저 알리고 브라우저 계정을 재확인한다. tap updater/publisher 정책 4테스트는 통과했고 아직 Release·cask·brew 설치는 실행하지 않았다.

최신 배포 지시는 검증·로컬 병합 뒤 main/dev push로 기존 Vercel 자동 배포를 사용하는 방식이다. 원격 PR과 feature/PRO push는 하지 않고 Actions는 desktop 수동 artifact 전용이다. workflow_dispatch는 workflow 파일이 기본 main에 등록된 뒤에 가능하다. 부모가 main/dev 통합과 게시를 조율한다.

## 최종 통합 전 검증

최종 local PRO bf3dbe0 위 source 3e54ac9에서 native 68개, 웹 153파일·2050테스트(workers2), lint·typecheck·production build, E2E 84개(workers2)가 통과했다. Codex 독립 review --base bf3dbe0는 명확한 조치 가능 결함 없이 끝났다. 이후 변경은 배포 지시를 반영한 문서뿐이다. 양 Mac beta.1 DMG·ZIP과 unpacked ASAR 검사 및 외부 shasum 검증이 통과했다. 부모·별도 QA 담당자가 actual packaged Dock/권한/소리/종료와 운영 서버 연결을 검증하며 Intel·Windows 실물과 공개 다운로드·brew 설치는 아직 완료로 주장하지 않는다.
