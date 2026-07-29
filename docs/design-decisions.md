# v1 디자인 결정 (2026-07-24 작성, 2026-07-27 v1 통합)

APP-152 전체 재디자인의 결과다. **화면 구현이 읽을 문서는 `mvp.pen`이 아니라
이 파일과 SPEC 노트다** — `.pen`은 git 밖이라 변경 이력이 남지 않는다.

> **2026-07-27 — 캔버스가 v1 한 세대로 통합됐다 (APP-213 ③).**
> 세대 이름이 `v5/`에서 `v1/`로 바뀌었다. **이름만 바꾼 것이 아니다** — v5가 다시 그리지
> 않은 예외 상태를 v4에서, 랜딩·인증을 v2에서 가져와 "지금 맞는 것"만 한 세대로 모았다.
> 아래 문서에서 `v5/`로 적힌 프레임 경로는 전부 `v1/`이다. 무엇을 왜 남기고 지웠는지는
> 캔버스의 `v1 README` 노트(y3200)와 이 문서 맨 아래 「v1 통합」 절에 있다.

이전 세대 문서는 `design-decisions-v4.md`(참조용). v4 프레임은 대부분 지웠고, 살아남은
것은 v1으로 이름이 바뀌었다.

## 왜 v5인가

v4는 화면 구현 이슈(APP-111~117)가 각자 자기 화면만 그리고 각자 스타일을 정하면서 만들어졌다.
MSW로 실제 앱을 띄워 v4 결정과 코드를 대조한 결과, "섞였다"의 정체는 취향 불일치가 아니라
**v4에서 확정한 값이 코드에 반영되지 않은 것**이었다. v5는 새 취향을 정하는 게 아니라
흩어진 결정을 한 곳에서 다시 못박고 구현이 따라올 수 있는 형태로 남기는 일이다.

여섯 에이전트가 행 하나씩 맡아 v4 프레임을 복제·수정했고, SPEC 노트는 통합 작성했다 —
수치를 여섯 곳에서 각자 쓰면 v4와 같은 갈라짐이 재발한다.

## 해소한 drift 7건

각 항목은 v5 SPEC 노트가 수치로 재확정한다.

| #   | v4 결정                                | 코드(2026-07-24 실측)                   | v5                              |
| --- | -------------------------------------- | --------------------------------------- | ------------------------------- |
| 1   | 목록 행 52·한 줄·r8·배경 없음·hairline | 높이 ~90·흰 카드·pill                   | FORM SPEC 목록 행 정본          |
| 2   | 챗봇 부양 카드 416×788                 | 붙박이 컬럼                             | note-full 우측 트레이 부양 카드 |
| 3   | full 탭 좌측정렬·라벨폭 밑줄           | 전체폭 3등분                            | full/side 탭 규칙 분리          |
| 4   | 개인 챗봇 e2 2연타 그림자              | 단일 티어 `0 4px 16px rgba(0,0,0,0.04)` | ELEVATION SPEC e2               |
| 5   | 형태 스케일 5단계                      | 설정 `rounded-[28px]`                   | 다이얼로그 panel 16             |
| 6   | (신규) 알림 드롭다운 불투명            | 반투명 → 뒤 텍스트 비침 결함            | 불투명 + e3                     |
| 7   | (신규) 중지 버튼 1개                   | 헤더 중지 + 레코더 독 = 2개             | 레코더 독 하나                  |

## SPEC 노트 (mvp.pen y30400)

수치의 단일 출처. 화면 구현은 이 노트를 근거로 한다. **전문은 [`design/v5-spec-notes.md`](design/v5-spec-notes.md)에
텍스트로 체크인돼 있다** — `.pen`은 git 밖이라 캔버스를 못 여니 이 파일이 정답이다. 아래는 요약이다.

- **FORM SPEC** (`XaNLp`) — 형태·타이포 스케일, 목록 행, 밀도 합격선, note-full 레이아웃 산술
- **ELEVATION SPEC** (`oKPxF`) — 셸 r0 / e2 부양 / e3 오버레이, 2연타 그림자, `kuPpg` 계승·개정
- **MOTION SPEC** (`RY2I9`) — 레코더 `ROX9B` 계승, 중지 버튼 통합, **`LNplj` 폐기 사유**
- **CHROME SPEC** (`wqUUn`) — 사이드바 정본, 상단바 1단, 알림 위치, 챗봇 스코프 통일

키프레임: 레코더 독 폭 전환 `WBWIU`(t000) / `w6xaTE`(t080) / `d3KGHq`(t250).

## 폐기·조율 결정

- **`LNplj`(사이드바 계층 push) 폐기** — 설정이 라우트가 아니라 전체화면급 Dialog(1024×780 중앙, e3)라
  사이드바가 밀려 들어올 구조가 없다. 다이얼로그를 유지하고 push 스펙을 버렸다.
- **레이아웃 산술 정정** — "좌 952 + 우 464"는 사이드바 없던 v4 값. 사이드바 유지 시
  255 + 952 + 464 = 1671 > 1440으로 불성립. v5 정본은 사이드바 255 + 본문 1185, 트레이 464(padding 24).
- **챗봇 스코프 통일** — 노트 상세 우측 트레이 = 공유 챗봇(노트 스코프), 세 탭 동일.
  개인 챗봇 = 워크스페이스 레벨 플로팅. v4는 요약 탭만 개인 챗봇으로 갈려 있었다.
- **참석자 필드** — `NoteResponse`에 participants 없음 → `meetingStartedBy`만 쓴다.

## v1 프레임 ID

**출처** 열은 그 프레임이 어느 세대에서 왔는지다. v4 출신은 상태의 기록으로는 맞지만
크롬이 낡았다(아래 「v1 통합」 참조).

**캔버스는 세대 하나짜리 격자다.** x=0에서 시작해 **1440 폭 화면 프레임은** 1840씩 오른쪽으로,
행마다 1800씩 아래로 간다(첫 행만 세로로 길어 3400). 각 행 위 120px에 행 라벨 텍스트가 있다.
`x<0`은 v1이 아닌 것(shadcn 디자인 시스템·템플릿 대시보드)의 주차 구역이다.

**작은 노드는 자기 폭에 맞춰 조밀하게 둔다** — 1840을 그대로 쓰면 다이얼로그 384짜리 사이에
1400의 빈 띠가 생긴다. 두 행이 그렇다.

| 행          | 간격                                                                   |
| ----------- | ---------------------------------------------------------------------- |
| 29000 오버레이 | 다이얼로그 3장은 x 0/480/960, 드롭다운 3장은 x 1500/1700/2000        |
| 30400 SPEC  | 키프레임 3장은 x 0/400/800, SPEC 노트 5장은 x 1300부터 980씩           |

| 행 (y)   | 프레임 (이름 = ID)                                                                                                                                                                       | 출처   |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 3200     | `v1 README` 노트 `HtukF` — 무엇을 왜 남기고 지웠는지                                                                                                                                     | —      |
| 4000 마케팅·정적 | landing `A77tqi` · static-terms `MDq9Q` · static-privacy `Z4gKmI`                                                                                                               | v2/신규 |
| 7400 인증·오류 | auth-modal `hpQXM` · auth-callback `y9uef` · auth-callback-failed `FxjoJ` · static-404 `zkxGw`                                                                                     | v2/신규 |
| 9200 셸  | note-hub `LHXhy` · note-hub-chat-closed `cWU64` · sidebar `sLzX8`                                                                                                                        | v5     |
| 11000 노트 full | transcript `Ftvu9` · summary `m0eVmx` · details `AB8zp` · chat-closed `MFFmb`                                                                                                     | v5     |
| 12800 full 예외 | transcript-ready `NsGqf` · transcript-viewer `oMqgT` · transcript-loading `fBM14` · transcript-start-conflict `HjcHO`                                                             | v4     |
| 14600 요약 상태 | summary-analyzing `uWnWH` · summary-empty `f9FCb` · summary-failed `PAVkf`                                                                                                        | v4     |
| 16400 노트 side | transcript `oLmGL` · summary `viNgv` · details `KCoyt` · transcript-ready `X3vCNH` · transcript-recording `ezlsT` · transcript-viewer `MUfyh`                                      | v5/v4  |
| 18200 공유 챗봇 | shared-streaming `jsz26` · shared-archive `TqX06` · shared-locked `xPpzc` · shared-not-started `DZu5q` · shared-stream-dropped `Ngodq`                                             | v5/v4  |
| 20000 개인 챗봇 | personal-fab `fQwhV` · personal-open `lbdN9` · personal-empty `evks6` · personal-history `L0Wx2` · stream-error `tmNgz` · stream-stalled `pn9GH` · stream-tool-error `Z3EDew`      | v5/v4  |
| 21800 도구 승인 | approval-pending `I49sOL` · approval-result `d6dtU` · approval-expired `WKrCG` · approval-meeting-ended `d9IWR` · approval-relayed `pysh5` · approval-spectator `jobCE` · tool-error `YBXm4` | v5/v4 |
| 23600 알림 | notify-open `sPg4o` · notify-empty `e71yPK` · notify-resolved `M5pzv`                                                                                                                  | v5     |
| 25400 설정 | account `WKSCp` · workspace `Bt1kk` · members `V3H0t` · integrations `jG86c` · integrations-member `t8oW0` · invite-404 `iHlP8` · invite-409-duplicate `KOM8F` · invite-409-member `UOUZl` | v5/v4 |
| 27200 상태 | empty `MQYkO` · skeleton `j2y3od` · error `ybD9g` · meeting-end `UqTC4` · meeting-end-blocked `m6E89F` · recording-elsewhere `V7cEN`                                                    | v5/v4  |
| 29000 오버레이 | dialog/project-new `cAif4` · dialog/workspace-new `N6Vsp` · dialog/meeting-end `FnxZm` · menu/note-row `ckrXr` · menu/user `uzfDJ` · menu/workspace-switcher `aP6sW`               | 신규   |
| 30400 SPEC | 키프레임 `WBWIU`/`w6xaTE`/`d3KGHq` · FORM `XaNLp` · ELEVATION `oKPxF` · MOTION `RY2I9` · CHROME `wqUUn` · 레코더 `ROX9B`                                                              | v5     |

## 프레임 이미지가 git에 있다

`mvp.pen`은 git 밖이라 fresh checkout에서 캔버스를 볼 수 없다. 그래서 v1 프레임 72개를
PNG로 export해 **`docs/design/frames/v1/<프레임이름>.png`** 에 넣었다.
**화면 구현이 실제로 보는 것은 이 PNG와 위 SPEC 노트 텍스트다.**

파일명이 노드 ID가 아니라 프레임 이름이다(`shell_note-hub.png`, `chat_shared-locked.png`).
ID로 두면 이름만 보고 무슨 화면인지 알 수 없었고, 실제로 v4 export 34장이 그 상태였다.
`/`는 파일명에 못 쓰므로 `_`로 바꾼다.

SPEC 노트 4개는 이미지가 아니라 이 문서와 [`design/v5-spec-notes.md`](design/v5-spec-notes.md)에
텍스트로 있다 — 수치가 본체이므로 PNG로 뜨지 않는다. 프레임을 고치면 해당 PNG를 다시 export한다.

> **export 도구가 불안정하다.** `export_nodes`는 1440×900 프레임을 여러 개 한 번에 넘기면
> 타임아웃난다. 크기에 비례하므로 큰 프레임은 하나씩(또는 `scale: 1`로) 부른다.
> 실패해도 파일이 안 생기니 재시도하면 된다 — 부분 출력은 없다.

## v1 통합 (2026-07-27, APP-213 ③)

세대를 하나로 모았다. **v5의 이름을 바꾼 것이 아니라, 세대를 가로질러 아직 맞는 것을 모은
것이다.** 근거는 감사 §2-5 — v5가 못 덮는 표면 셋(랜딩·인증 모달·인증 콜백)이 이미 v2 행에
현재 구현과 같은 구조로 그려져 있었다.

**지운 것 (최상위 노드 62개 = 프레임 55 + 노트 2 + 행 라벨 2 + 키프레임 3)**

| 무엇                                       | 몇 개 | 왜                                                |
| ------------------------------------------ | ----- | ------------------------------------------------- |
| 옛 v1                                      | 10    | 전부 대체됨                                       |
| v2 (랜딩·인증 3장 제외)                    | 17    | 전부 대체됨                                       |
| v4-concept · v4-alt                        | 6     | 채택 안 된 탐색                                   |
| v5가 다시 그린 v4                          | 21    | 중복. **PAUSED 3장**(APP-218이 그 상태를 없앴다)과 **`mock-oauth-consent` 1장**(목 전용이라 제품이 아니다, 감사 §3)이 이 21에 포함된다 |
| 사이드바 push — SPEC 노트 1 + 키프레임 3   | 4     | MOTION SPEC이 폐기했다 — 설정이 라우트가 아니다   |
| `v5/static-terms`                          | 1     | 실제 `legal-document.tsx`와 구조가 달라 다시 그림 |
| v4 ELEVATION SPEC (`kuPpg`)                | 1     | v1 ELEVATION SPEC이 계승·개정했다                 |
| 빈 행이 된 라벨 (`v4-concept`·`v4-alt`)    | 2     | 그 행의 프레임이 전부 사라졌다                    |

**남은 숙제 — v4 출신 30장은 크롬이 낡았다**

APP-209·210·211·218·220·222 이전에 그려져서 상단바가 2단이고, radius가 22.4이며,
그림자가 단일 티어다. **상태의 기록(무슨 화면이 언제 뜨는가)으로는 맞지만 생김새는 낡았다.**
다시 그릴 때는 SPEC 넷을 기준으로 한다. 지우지 않은 이유는 그 상태를 그린 프레임이
이것들뿐이기 때문이다 — 지우면 예외 상태의 기록이 통째로 사라진다.

**백업** — `mvp.pen`은 git 밖이다. 정리 직전 상태는 `mvp.pen.bak-2026-07-27-pre-v1`에 있다.

## 충돌 시 SPEC이 프레임보다 우선이다

프레임 PNG는 시각 참조이고, **수치·규칙의 정답은 [`design/v5-spec-notes.md`](design/v5-spec-notes.md)의 SPEC 노트다.**
둘이 어긋나면 SPEC을 따른다 — PNG는 6개 병렬 에이전트가 v4를 복제해 만든 것이라 v4 잔재가 남을 수 있고,
SPEC은 그 위에서 규칙을 통일한 결과다. 최종 정답은 이 캔버스가 아니라 구현된 코드이므로
캔버스를 픽셀까지 맞추는 대신 SPEC을 정답으로 두고 구현(APP-153~157)이 SPEC을 따른다.

**알려진 프레임 잔재** — 구현 시 SPEC대로 고칠 것(PNG를 그대로 베끼지 말 것):

- **상단바 `중지` 버튼** — `Ftvu9`·`AB8zp`에 남아 있으나 녹음 중지는 레코더 독 하나뿐(MOTION SPEC).
  독만 둔다. **상단바 노트 액션은 `회의 종료`와 패널 토글뿐이다.**
  (2026-07-29 APP-288 정정) `PAUSED`는 전사 세션이 끝난 서버 상태로 복구됐지만 별도
  `pauseMeeting`·`resumeMeeting` API는 만들지 않았다. 레코더 독의 `중지`·`재개`가 전사 세션
  전이를 맡고 상단바는 최종 `회의 종료`만 맡는다.
- **노트 목록 "녹음 중" 필터 칩** — APP-288 목록 계약은 `meetingStatus`를 제공하지만 별도
  상태 필터는 제품 요구가 아니다. `전체`·`내가 시작`만 두고 각 행에 네 상태를 표시한다.
- **요약 탭 우측 트레이 라벨** — `m0eVmx`가 "개인 챗봇"으로 되어 있으나 노트 3탭 트레이는 전부 공유 챗봇(CHROME SPEC).
- **요약 섹션 키커** — `m0eVmx`에 `OVERVIEW`/`ACTION ITEMS`/`INSIGHTS` 대문자 키커가 남아 있으나 제품 면 키커 금지(FORM SPEC).

## 계약 가드레일

프레임 데이터는 `openapi3.yml`로 채운다.
계약에 없는 데이터가 필요하면 화면을 밀지 말고 그 데이터를 뺀다(APP-145에서 계약에 없는 알림 타입을
그렸다가 삭제한 전례). APP-288은 서버 계약과 함께 목록의 `meetingStatus`,
`recordedDurationMs`, `activeSessionStartedAt`을 추가했으므로 목록과 상세가 같은 네 상태와
활성 구간 누적 시간을 표시한다.

## APP-288 실제 DOM 왕복 (2026-07-29)

최종 키는 과거 v1 프레임을 덮지 않고 `import-to-canvas`가 새로 반환한 ID만 기록한다.

| 실제 DOM 화면                    | 최종 Pencil frame ID |
| -------------------------------- | -------------------- |
| 목록 · 네 상태와 누적 기록 시간  | `zi0FU`              |
| full · IN_PROGRESS                | `ujfls`              |
| side · IN_PROGRESS 원격 활성 설명 | `zQnLs`              |
| side · NOT_STARTED recorder dock | `OL1es`              |
| 종료 확인 · 기록 중 stop → end   | `B2GwMZ`              |

브라우저 MSW 검증은 생성만(마이크 0회), 시작→종료, 시작→중지→종료,
시작→중지→재개→중지, side 미시작 dock, 원격 활성 설명, 중지·종료 뒤 시간 고정과 재개 뒤
누적 계속을 통과시킨다. partial/final 열 폭과 한국어 줄바꿈은 실제 음성 내용에 좌우되는 E2E
대신 `transcript-view.test.tsx`의 결정적 DOM 계약으로 유지한다.
