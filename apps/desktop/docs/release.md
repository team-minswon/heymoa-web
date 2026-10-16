# 설치와 배포 준비

**Mac 설치 파일은 Developer ID로 서명하고 Apple 공증·staple까지 CI에서 합니다(0.1.0부터).** Windows 설치 파일은 아직 서명이 없는 베타입니다. 사람이 릴리즈를 게시하는 순서는 바로 아래 「서명 릴리즈 절차」에 있습니다.

## 서명 릴리즈 절차 (Mac 0.1.0)

릴리즈 게시는 사람이 합니다. 아래는 그 순서의 틀이고, 각 단계는 앞 단계가 끝난 뒤에만 합니다.

| # | 단계 | 어떻게 | 끝났다는 증거 |
|---|---|---|---|
| 1 | 서명 빌드 | GitHub → Actions → **Build HeyMoa Desktop** → Run workflow, Branch `dev`. 터미널은 `gh workflow run desktop-artifacts.yml --ref dev` | Mac arm64·Intel job 둘 다 초록. 「Verify Developer ID signature and notarization」 단계 통과 |
| 2 | 산출물 받기 | run 화면 Artifacts에서 `heymoa-mac-arm64`·`heymoa-mac-x64`(Windows는 `heymoa-win-x64`). artifacts ZIP 자체를 게시하지 않고 안의 DMG·ZIP만 씁니다 | run의 head SHA가 의도한 dev 커밋 |
| 3 | 로컬 재확인 | 받은 파일을 한 폴더에 모아 `node apps/desktop/scripts/checksums.mjs <폴더>`로 SHA256SUMS를 다시 만들고 아래 「서명 확인 명령」을 돌립니다 | checksum 일치, `spctl`이 `Notarized Developer ID` |
| 4 | 내 Mac 설치 확인 | 기존 HeyMoa 삭제 → **브라우저로 받은** DMG를 설치해 실행(「설치 확인」 참고) | 「확인되지 않은 개발자」 경고 없이 열림, 로그인·녹음 시작 |
| 5 | GitHub Release 게시 | 공개 저장소 **`team-minswon/homebrew-tap`**의 Releases, 태그 `desktop-v0.1.0`. 사용자가 승인한 브라우저의 `minswon-official` 계정으로 직접 올립니다(CLI 계정으로 게시하지 않음) | Mac DMG·ZIP 4개와 SHA256SUMS가 공개 URL에서 내려받아짐 |
| 6 | 공개 파일 검증 | `node apps/desktop/scripts/release-manifest.mjs team-minswon/homebrew-tap 0.1.0 <출력폴더>` | downloads.json 생성(해시·크기 불일치면 출력 안 함) |
| 7 | cask 갱신 | tap 저장소에서 `node scripts/update-cask.mjs 0.1.0`, **caveats의 「unsigned beta」 문장과 README의 「서명·공증이 적용되지 않아」 문장을 지웁니다**, `brew audit --cask --online team-minswon/tap/heymoa`, `brew install --cask`로 설치 | audit 통과, 설치 후 실행 |
| 8 | 웹 배포 | heymoa-web `main`에 `dev`를 fast-forward로 올립니다(`merging` skill 4단계). 문구는 이미 dev에 있습니다(APP-1123·1124·1126) | 운영 `/download`가 Mac 정식·Windows 베타로 보임 |

**순서가 중요한 이유**: 5~7이 끝나기 전에 8을 하면 아직 서명 안 된 옛 파일(beta.1·beta.2)을 받는 사용자에게 「서명·공증된 앱」이라고 말하게 됩니다.

릴리즈 본문에 적을 것: 지원 환경(macOS 14.2 이상, Apple Silicon·Intel), Mac은 서명·공증됨, Windows는 베타·서명 없음(포함하지 않으면 그렇다고), SHA256SUMS 확인 방법, 알려진 제한(자동 업데이트 없음, 녹음 중 업데이트 금지).

**서명 빌드 요구 사항**: 저장소 secret `MAC_CERT_P12_BASE64`, `MAC_CERT_PASSWORD`, `APPLE_API_KEY_P8_BASE64`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`. 하나라도 비면 Mac job이 서명 없이 만들지 않고 실패합니다. 공증이 길어져도 job은 40분에서 멈춥니다. Apple 서버 연결이 끊겨 staple이 실패하면 패키징을 최대 3번 다시 합니다. 첫 계정은 공증이 30분 넘게 걸린 적이 있고, 이후 제출은 4분이었습니다.

### 서명 확인 명령

```bash
# 압축을 푼 HeyMoa.app 에서
codesign --verify --deep --strict --verbose=2 HeyMoa.app
codesign -dv --verbose=2 HeyMoa.app 2>&1 | grep -E "Authority=Developer ID Application|flags=.*runtime"
xcrun stapler validate HeyMoa.app
spctl --assess --type execute --verbose=2 HeyMoa.app   # source=Notarized Developer ID
```

### 설치 확인 (내 Mac)

- **브라우저로 받은 파일로 해야 의미가 있습니다.** 직접 `pnpm package`한 앱이나 `curl`로 받은 파일에는 「인터넷에서 받음」(quarantine) 표시가 없어 Gatekeeper 검사를 안 거칩니다.
- 처음부터 보려면: 기존 앱을 휴지통으로 옮기고, 로그인 상태를 지우려면 `~/Library/Application Support/HeyMoa`를 지웁니다. 권한을 다시 묻게 하려면 `tccutil reset Microphone app.heymoa.desktop`.
- 열었을 때 「인터넷에서 받은 앱입니다」 확인만 뜨고 「확인되지 않은 개발자」 차단이 없어야 합니다.

## 빌드

root에서 `pnpm --filter @heymoa/desktop package:mac:arm64`, `package:mac:x64`, `package:win:x64`를 각각 실행합니다. 모든 명령은 publish never이고 installer 생성 뒤 unpacked ASAR allowlist와 checksum을 확인합니다. OS/아키텍처와 형식·이름은 desktop package의 build 설정이 소유합니다. 승인 아이콘 원본·변환은 [자산 기록](../build/icons/README.md)에 있습니다. 원본 PNG는 ASAR에 들어가지 않습니다.

[desktop-artifacts workflow](../../../.github/workflows/desktop-artifacts.yml)는 수동 실행만 허용하며 Mac arm64·Intel 및 Windows x64 runner에서 artifacts를 만듭니다. contents 권한은 read이고 Release를 생성하지 않습니다. 원격 PR·feature/PRO 브랜치 push는 하지 않습니다. 검증과 로컬 병합 뒤 main/dev push는 승인됐으며 기존 Vercel 자동 배포를 사용합니다. Actions는 desktop 빌드에만 사용합니다. 각 job의 checksum은 그 OS 파일만 포함하므로 다운로드한 세 job 파일을 하나의 디렉터리에 모아 `node apps/desktop/scripts/checksums.mjs <directory>`로 최종 SHA256SUMS를 다시 만듭니다. GitHub artifacts ZIP을 설치 파일 자체처럼 게시하지 않습니다.

수동 빌드는 trusted `team-minswon/heymoa-web`의 dev/main ref만 허용하고 feature branch·임의 SHA·fork는 source-policy job에서 실패합니다. checkout은 dispatch ref의 commit을 그대로 사용하고 자격 증명을 저장하지 않습니다. commit·publication·secret 입력은 없고 서명 비밀은 저장소 secret에서만 읽습니다. 빌드가 서명·공증되었다는 것이 곧 공개 릴리즈를 뜻하지는 않습니다. 대상 commit은 Actions run의 head SHA로 확인합니다. 공개 게시와 운영 웹·서버 배포 수용은 아래 별도 관문을 거칩니다.

workflow는 기본 브랜치에 등록되어 수동 실행할 수 있습니다. 2026-10-05 [Desktop Actions #3](https://github.com/team-minswon/heymoa-web/actions/runs/37296653557)은 `minswon-official`이 dev source `9c0d1ac808f6abf2123ef1d0cd166ee40d3f13b2`로 실행했고 source-policy 및 Mac arm64·Intel·Windows x64 패키징이 모두 성공했습니다. 다운로드한 Mac DMG·ZIP 네 파일과 Windows NSIS 한 파일의 실제 checksum, ASAR allowlist·compiled 코드 및 플랫폼별 ICNS·ICO 일치를 검증했습니다. 이 결과는 실제 GUI·Google 로그인·캡처 수용이나 공개 Release·cask 게시를 뜻하지 않습니다. 이후 desktop runtime이 바뀌면 검증·통합한 dev/main ref에서 새 수동 빌드를 실행하고 해당 run의 source SHA와 산출물을 다시 검증합니다.

Windows NSIS는 실제 Windows runner가 기본입니다. macOS에서 교차 빌드는 Wine 도구가 추가로 필요하며 생성 성공만으로 Windows 설치·권한·녹음 지원을 증명하지 않습니다. Intel Mac·Windows 실물 설치는 APP896에서 확인합니다. 현재 앱의 런타임 지원 기준은 `src/policy.ts`의 `platformSupport`가 소유합니다.

## 공개 게시 관문

1. 웹·서버 desktop 인증 및 runtime 배포, 실제 앱 로그인·외부 연동·기록 시작과 종료를 확인합니다.
2. 지원 OS별 설치 파일을 새 설치 환경에서 검증합니다. 앱·도움말·릴리즈 안내의 unsigned/signed 상태를 일치시킵니다. 패키지 allowlist·icon·권한 설명·checksum을 확인합니다.
3. 공개 다운로드와 자체 tap은 실제 public `team-minswon/homebrew-tap`을 사용합니다. private 소스 저장소의 인증이 필요한 asset을 일반 다운로드 링크로 제공하지 않습니다. public tap의 GitHub Releases에는 검증된 바이너리와 checksum·설치 안내만 올립니다.
4. 게시 전에 실제 최종 파일·checksum·QA 결과와 릴리즈 내용을 사용자에게 알립니다. 사용자가 승인한 브라우저에서 실제 login `minswon-official`을 게시 직전 확인합니다. CLI `alstn113`로는 draft 생성·게시를 하지 않으며 기능 QA 완료 전에도 게시하지 않습니다. 계정 자동 전환·fallback은 하지 않습니다. 릴리즈 본문에 실제 검증 범위, OS별 서명 상태(Mac 서명·공증, Windows 서명 없음), 설치 절차, 알려진 제한을 기록합니다. 필수 파일을 모두 붙여 공개한 뒤 실제 바이트를 다시 확인합니다. 이 workflow가 릴리즈를 생성하지 않습니다.
5. `node apps/desktop/scripts/release-manifest.mjs OWNER/REPO VERSION OUTPUT_DIR`로 이미 공개된 `desktop-vVERSION`의 실제 Mac 파일을 확인합니다. Windows는 별도 수용 후 `--include-windows`로 명시적으로 포함합니다. 필수 asset·SHA256SUMS가 없거나 draft·download hash/size 불일치면 출력하지 않습니다. 다운로드는 streaming hash를 사용해 설치 파일 전체를 메모리에 저장하지 않습니다.
6. 검증된 downloads.json을 웹 다운로드·수동 새 버전 안내의 입력으로 연결합니다. tap 저장소의 `scripts/update-cask.mjs VERSION`이 공개된 두 Mac ZIP을 다시 검증해 Casks/heymoa.rb를 만듭니다. 단일 heymoa token을 사용해 중복 앱 ID·protocol 충돌을 피합니다. brew audit·실제 설치를 확인한 뒤 안내합니다. 가짜 다운로드를 만들지 않습니다.

Release manifest 도구는 파일 존재·해시·크기만 확인하고 서명 상태는 보지 않습니다. 서명 검증은 위 「서명 확인 명령」으로 따로 합니다. Windows 코드 서명을 도입할 때는 OS 검증 증거와 manifest의 서명 상태를 함께 확장해야 합니다. 자동 업데이트는 아직 구성하지 않습니다. 녹음 중 앱 교체·재시작은 피하고, 종료 후 검증된 새 설치 파일로 교체합니다.

## Mac 설치

검증된 GitHub Release에서 자신의 architecture 설치 파일을 받고 SHA256SUMS와 비교합니다. DMG를 열어 HeyMoa를 Applications로 옮긴 후 실행합니다. Apple 서명·공증을 받은 앱이라 처음 실행할 때 「인터넷에서 받은 앱」 확인 창이 뜰 수 있고, 열기를 누르면 됩니다. 「확인되지 않은 개발자」나 「손상됨」 경고가 뜨면 단순 출처 경고로 넘기지 말고 파일과 SHA256을 다시 확인하고 설치 지원으로 문의합니다.

Homebrew tap도 같은 서명된 파일을 설치합니다. cask에 quarantine 제거, spctl 비활성화, no_check를 넣지 않습니다. 마이크·시스템 소리 권한은 앱에서 사용자가 녹음을 시작할 때 별도로 승인합니다.

Windows 설치 파일은 서명이 없는 베타라 SmartScreen 경고가 뜰 수 있습니다.

## 확인할 증거

Mac에서 Info.plist의 CFBundleIconFile, 번들의 ICNS byte 일치, 실제 Dock 표시, 설치 후 실행을 각각 확인합니다. Developer ID와 공증은 codesign·spctl·stapler 결과로 따로 판정하며 로컬 실행 성공을 공증 성공으로 기록하지 않습니다. Windows는 Explorer·Start 메뉴·설치 앱 아이콘, per-user 설치·업데이트·제거와 실제 로그인/소리 입력을 확인합니다. installer 크기와 app.asar 코드 크기는 구분하며 `.next` cache 전체를 웹 배포 크기로 쓰지 않습니다.

## 근거

- [Apple 앱별 승인](https://support.apple.com/guide/mac-help/open-a-mac-app-from-an-unidentified-developer-mh40616/mac)
- [electron-builder 플랫폼 빌드](https://www.electron.build/v26/docs/features/multi-platform-build/)
- [GitHub runner architecture](https://docs.github.com/en/actions/how-tos/write-workflows/choose-where-workflows-run/choose-the-runner-for-a-job)
- [Homebrew cask contract](https://docs.brew.sh/Cask-Cookbook)
