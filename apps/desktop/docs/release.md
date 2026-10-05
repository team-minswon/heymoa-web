# 설치와 배포 준비

현재 설치 파일은 Developer ID 서명·공증을 하지 않은 **unsigned beta**입니다. 로컬 패키지와 CI artifact 생성은 공개 출시가 아닙니다. 운영 웹에 APP893 desktop runtime·인증과 APP894 종료 보호가 배포되고 실제 앱의 로그인·두 입력 전사·중지·종료를 확인한 뒤 제공해야 합니다. 앱이 운영 웹을 그대로 읽으므로 바이너리만 준비해 먼저 출시하면 핵심 기능이 연결되지 않습니다.

## 빌드

root에서 `pnpm --filter @heymoa/desktop package:mac:arm64`, `package:mac:x64`, `package:win:x64`를 각각 실행합니다. 모든 명령은 publish never이고 installer 생성 뒤 unpacked ASAR allowlist와 checksum을 확인합니다. OS/아키텍처와 형식·이름은 desktop package의 build 설정이 소유합니다. 승인 아이콘 원본·변환은 [자산 기록](../build/icons/README.md)에 있습니다. 원본 PNG는 ASAR에 들어가지 않습니다.

[desktop-artifacts workflow](../../../.github/workflows/desktop-artifacts.yml)는 수동 실행만 허용하며 Mac arm64·Intel 및 Windows x64 runner에서 artifacts를 만듭니다. contents 권한은 read이고 Release를 생성하지 않습니다. 원격 PR·feature/PRO 브랜치 push는 하지 않습니다. 검증과 로컬 병합 뒤 main/dev push는 승인됐으며 기존 Vercel 자동 배포를 사용합니다. Actions는 desktop 빌드에만 사용합니다. 각 job의 checksum은 그 OS 파일만 포함하므로 다운로드한 세 job 파일을 하나의 디렉터리에 모아 `node apps/desktop/scripts/checksums.mjs <directory>`로 최종 SHA256SUMS를 다시 만듭니다. GitHub artifacts ZIP을 설치 파일 자체처럼 게시하지 않습니다.

수동 빌드는 trusted `team-minswon/heymoa-web`의 dev/main ref만 허용하고 feature branch·임의 SHA·fork는 source-policy job에서 실패합니다. checkout은 dispatch ref의 commit을 그대로 사용하고 자격 증명을 저장하지 않습니다. commit·publication·secret 입력은 없으며 서명 비밀을 받아들이지 않습니다. dev 빌드와 main 빌드는 모두 unsigned beta artifact일 뿐 production release를 의미하지 않습니다. 대상 commit은 Actions run의 head SHA로 확인합니다. 공개 게시와 운영 웹·서버 배포 수용은 아래 별도 관문을 거칩니다.

GitHub workflow 파일이 기본 브랜치에 올라오기 전에는 workflow_dispatch를 실행할 수 없습니다. 지금은 로컬 준비 상태이며 원격 작업 브랜치·PR을 만들지 않습니다. 승인된 로컬 통합을 마친 후 main에 workflow 파일을 등록하고 dev/main에 실제 코드를 반영한 뒤 GitHub Actions에서 수동 실행합니다. 로컬에 없는 workflow를 이미 운영 가능한 것처럼 안내하지 않습니다.

Windows NSIS는 실제 Windows runner가 기본입니다. macOS에서 교차 빌드는 Wine 도구가 추가로 필요하며 생성 성공만으로 Windows 설치·권한·녹음 지원을 증명하지 않습니다. Intel Mac·Windows 실물 설치는 APP896에서 확인합니다. 현재 앱의 런타임 지원 기준은 `src/policy.ts`의 `platformSupport`가 소유합니다.

## 공개 게시 관문

1. 웹·서버 desktop 인증 및 runtime 배포, 실제 앱 로그인·외부 연동·기록 시작과 종료를 확인합니다.
2. 지원 OS별 설치 파일을 새 설치 환경에서 검증합니다. 앱·도움말·릴리즈 안내의 unsigned/signed 상태를 일치시킵니다. 패키지 allowlist·icon·권한 설명·checksum을 확인합니다.
3. 공개 다운로드와 자체 tap은 실제 public `team-minswon/homebrew-tap`을 사용합니다. private 소스 저장소의 인증이 필요한 asset을 일반 다운로드 링크로 제공하지 않습니다. public tap의 GitHub Releases에는 검증된 바이너리와 checksum·설치 안내만 올립니다.
4. 실제 최종 파일·checksum·QA 및 릴리즈 내용을 사용자에게 알리고 먼저 알립니다. 사용자가 승인한 브라우저에서 실제 login `minswon-official`을 게시 직전 확인합니다. CLI `alstn113`로는 draft 생성·게시를 하지 않으며 기능 QA 완료 전에도 게시하지 않습니다. 계정 자동 전환·fallback은 하지 않습니다. 릴리즈 본문에 실제 검증 범위, 서명 없음, 설치 절차, OS별 알려진 제한을 기록합니다. 필수 파일을 모두 붙여 공개한 뒤 실제 바이트를 다시 확인합니다. 이 workflow가 릴리즈를 생성하지 않습니다.
5. `node apps/desktop/scripts/release-manifest.mjs OWNER/REPO VERSION OUTPUT_DIR`로 이미 공개된 `desktop-vVERSION`의 실제 Mac 파일을 확인합니다. Windows는 별도 수용 후 `--include-windows`로 명시적으로 포함합니다. 필수 asset·SHA256SUMS가 없거나 draft·download hash/size 불일치면 출력하지 않습니다. 다운로드는 streaming hash를 사용해 설치 파일 전체를 메모리에 저장하지 않습니다.
6. 검증된 downloads.json을 웹 다운로드·수동 새 버전 안내의 입력으로 연결합니다. tap 저장소의 `scripts/update-cask.mjs VERSION`이 공개된 두 Mac ZIP을 다시 검증해 Casks/heymoa.rb를 만듭니다. 단일 heymoa token에 beta 버전을 사용해 중복 앱 ID·protocol 충돌을 피합니다. brew audit·실제 설치를 확인한 뒤 안내합니다. 실제 repo는 확인했지만 Release와 cask는 아직 없으며 가짜 다운로드를 만들지 않습니다.

Release manifest 도구는 unsigned beta용입니다. Developer ID·공증/Windows 코드 서명에 도입할 때는 OS 검증 증거와 manifest signing 상태를 함께 확장해야 합니다. 자동 업데이트는 아직 구성하지 않습니다. 녹음 중 앱 교체·재시작은 피하고, 종료 후 검증된 새 설치 파일로 교체합니다.

## 개발자 계정 없는 Mac beta 설치

검증된 GitHub Release에서 자신의 architecture 설치 파일을 받고 SHA256SUMS와 비교합니다. DMG를 열어 HeyMoa를 Applications로 옮긴 후 실행합니다. 출처 확인 경고가 뜨면 macOS 시스템 설정 → 개인정보 보호 및 보안에서 해당 앱의 열기/확인 없이 열기 절차를 따릅니다. Apple이 제공하는 앱별 승인 UI가 나타나지 않거나 조직 정책이 차단하면 설치 지원으로 문의합니다. 악성 코드·손상 경고를 단순 출처 경고와 같은 절차로 무시하지 않습니다.

Apple Developer 유료 계정 없이 로컬 실행과 사용자 앱별 승인이 가능한 beta를 만들 수 있지만, 신뢰되는 Developer ID 서명·공증 배포와는 구분합니다. Homebrew 자체 tap도 같은 파일을 설치하므로 Gatekeeper 제약을 해소하지 않습니다. cask에 quarantine 제거, spctl 비활성화, no_check를 넣지 않습니다. 마이크·시스템 소리 권한은 앱에서 사용자가 녹음을 시작할 때 별도로 승인합니다.

## 확인할 증거

Mac에서 Info.plist의 CFBundleIconFile, 번들의 ICNS byte 일치, 실제 Dock 표시, 설치 후 실행을 각각 확인합니다. Developer ID와 공증은 codesign·spctl·stapler 결과로 따로 판정하며 로컬 실행 성공을 공증 성공으로 기록하지 않습니다. Windows는 Explorer·Start 메뉴·설치 앱 아이콘, per-user 설치·업데이트·제거와 실제 로그인/소리 입력을 확인합니다. installer 크기와 app.asar 코드 크기는 구분하며 `.next` cache 전체를 웹 배포 크기로 쓰지 않습니다.

## 근거

- [Apple 앱별 승인](https://support.apple.com/guide/mac-help/open-a-mac-app-from-an-unidentified-developer-mh40616/mac)
- [electron-builder 플랫폼 빌드](https://www.electron.build/v26/docs/features/multi-platform-build/)
- [GitHub runner architecture](https://docs.github.com/en/actions/how-tos/write-workflows/choose-where-workflows-run/choose-the-runner-for-a-job)
- [Homebrew cask contract](https://docs.brew.sh/Cask-Cookbook)
