# HeyMoa desktop foundation

운영 `https://heymoa.app`을 여는 앱 기반입니다. capability의 `capture`와 `captureContractVersion: 1`은 두 입력 캡처 계약을 제공합니다. 웹에서 캡처 모드를 선택하는 연결, 로그인 교환, 트레이는 후속 이슈입니다.

- 지원: macOS 14.2 이상 Apple Silicon/Intel, Windows 11 x64. 실제 Windows 설치 검증은 별도입니다.
- 개발: 루트에서 `pnpm desktop:dev`. 로컬 웹을 사용할 때 `HEYMOA_DESKTOP_DEV_URL=http://localhost:3000`을 설정합니다. packaged 앱은 이 변수를 무시합니다.
- 검증: `pnpm desktop:typecheck`, `pnpm desktop:test`, `pnpm desktop:build`.
- 로컬 macOS 앱: `pnpm desktop:package`. `release/mac*/HeyMoa.app`과 app.asar allowlist 검증을 생성합니다. unsigned preview이며 Developer ID 서명·공증 완료가 아닙니다.
- 설치 파일·아이콘·GitHub/Homebrew 준비: [배포 안내](docs/release.md). OS별 명시적 package scripts는 파일과 checksum만 만들며 공개 릴리즈를 게시하지 않습니다. 운영 웹의 desktop runtime·인증과 종료 보호를 실제 앱에서 확인한 뒤 출시합니다.
- 루트 `vercel.json`의 `installCommand`가 배포 시 `pnpm install:vercel`을 실행해 Electron 바이너리 다운로드를 생략합니다. 기존 Build Command·Root Directory·Output Directory는 변경하지 않습니다.

Bridge는 `window.heymoaDesktop.getCapabilities()`, `reportRecording(summary)` 및 `beginCapture()`, `captureReady(id)`, `endCapture(id)`, `subscribeCapture(listener)`를 제공합니다. 사용자 클릭에서 시작한 캡처만 승인하며, 원격 웹의 미디어 요청은 항상 거부합니다. 앱에 포함한 로컬 capture renderer만 마이크·시스템 stream을 확보하고 임시 video를 제거합니다. 원격 웹은 stream·영상·화면 source를 받지 않습니다. 이동·renderer 종료·취소 때 로컬 창을 닫아 입력을 해제합니다.

로컬 AudioContext와 기존 worklet/batcher가 만든 16kHz mono PCM16과 입력별 상태·레벨만 exact-frame IPC로 전달합니다. PCM은 최대 3200byte이며 ACK를 기다리는 packet과 다음 packet만 유지합니다. 수신 지연이 계속되면 명시적 오류로 종료하며 마지막 부분 PCM은 정상 stop에서 drain합니다. 입력별 미터와 상태 갱신은 활성 캡처 중 20Hz 이하입니다. 로컬 파일의 CSP·network allowlist는 외부 script·통신·탐색을 거부합니다.

summary에는 phase, startedAt, pendingMs, microphone, systemAudio만 허용하며 제목·전사·인증 정보를 담지 않습니다. 현재 summary는 schema 검사만 수행하고 저장하지 않습니다. macOS 시스템 오디오는 CoreAudio Tap 경로를 사용하며 실제 OS 권한·Windows loopback 검증은 별도 확인이 필요합니다.
