# v5 디자인 결정 (2026-07-24)

APP-152 전체 재디자인의 결과다. **화면 구현(APP-154~157)이 읽을 문서는 `mvp.pen`이 아니라
이 파일과 v5 SPEC 노트다** — `.pen`은 git 밖이라 변경 이력이 남지 않는다.

이전 세대는 `design-decisions-v4.md`(참조용). v4 행(y17000~36900)은 캔버스에 보존돼 있다.

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

## SPEC 노트 (mvp.pen y52000)

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

## v5 프레임 ID

| 행               | 프레임 (이름 = ID)                                                                                                                                                                       |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| y40000 셸        | note-hub `LHXhy` · note-hub-chat-closed `cWU64` · sidebar `sLzX8`                                                                                                                        |
| y42000 노트 full | transcript `Ftvu9` · summary `m0eVmx` · details `AB8zp` · chat-closed `MFFmb`                                                                                                            |
| y44000 노트 side | transcript `oLmGL` · summary `viNgv` · details `KCoyt`                                                                                                                                   |
| y46000 챗봇      | shared-streaming `jsz26` · personal-fab `fQwhV` · personal-open `lbdN9` · approval-pending `I49sOL` · approval-result `d6dtU`                                                            |
| y48000 알림·설정 | notify-open `sPg4o` · notify-empty `e71yPK` · notify-resolved `M5pzv` · settings-account `WKSCp` · settings-workspace `Bt1kk` · settings-members `V3H0t` · settings-integrations `jG86c` |
| y50000 상태      | empty `MQYkO` · skeleton `j2y3od` · error `ybD9g` · meeting-end `UqTC4`                                                                                                                  |
| y52000 SPEC      | FORM `XaNLp` · ELEVATION `oKPxF` · MOTION `RY2I9` · CHROME `wqUUn` + 키프레임 `WBWIU`/`w6xaTE`/`d3KGHq`                                                                                  |

## 프레임 이미지가 git에 있다

`mvp.pen`은 git 밖이라 fresh checkout에서 캔버스를 볼 수 없다. 그래서 v5 화면 프레임 26개를
PNG로 export해 `docs/design/frames/v5/<프레임ID>.png`에 넣었다 — v4가 `docs/design/frames/`에
한 것과 같다. **화면 구현(APP-154~157)이 실제로 보는 것은 이 PNG와 위 SPEC 노트 텍스트다.**

SPEC 노트 4개와 키프레임은 이미지가 아니라 이 문서와 `mvp.pen` y52000 노트에 텍스트로 있다 —
수치가 본체이므로 PNG로 뜨지 않는다. 프레임을 고치면 해당 PNG를 다시 export해 갱신한다.

## 충돌 시 SPEC이 프레임보다 우선이다

프레임 PNG는 시각 참조이고, **수치·규칙의 정답은 [`design/v5-spec-notes.md`](design/v5-spec-notes.md)의 SPEC 노트다.**
둘이 어긋나면 SPEC을 따른다 — PNG는 6개 병렬 에이전트가 v4를 복제해 만든 것이라 v4 잔재가 남을 수 있고,
SPEC은 그 위에서 규칙을 통일한 결과다. 최종 정답은 이 캔버스가 아니라 구현된 코드이므로
캔버스를 픽셀까지 맞추는 대신 SPEC을 정답으로 두고 구현(APP-153~157)이 SPEC을 따른다.

**알려진 프레임 잔재** — 구현 시 SPEC대로 고칠 것(PNG를 그대로 베끼지 말 것):

- **상단바 `중지` 버튼** — `Ftvu9`·`AB8zp`에 남아 있으나 중지는 레코더 독 하나뿐(MOTION SPEC). 독만 둔다.
- **노트 목록 "녹음 중" 필터 칩** — 목록 계약에 `meetingStatus`가 없어 성립 안 함. `전체`·`내가 시작`만 둔다(FORM SPEC).
- **요약 탭 우측 트레이 라벨** — `m0eVmx`가 "개인 챗봇"으로 되어 있으나 노트 3탭 트레이는 전부 공유 챗봇(CHROME SPEC).
- **요약 섹션 키커** — `m0eVmx`에 `OVERVIEW`/`ACTION ITEMS`/`INSIGHTS` 대문자 키커가 남아 있으나 제품 면 키커 금지(FORM SPEC).

## 계약 가드레일

v5는 계약을 바꾸지 않는다. 프레임 데이터는 `openapi3.yml`로 채운다.
계약에 없는 데이터가 필요하면 화면을 밀지 말고 그 데이터를 뺀다(APP-145에서 계약에 없는 알림 타입을
그렸다가 삭제한 전례). **노트 목록 상태 배지가 그 사례다** — 목록 계약에 `meetingStatus`가 없어
계약을 늘리는 대신(APP-159 취소) 배지를 뺐다. 회의 상태는 노트 상세에서 본다.
