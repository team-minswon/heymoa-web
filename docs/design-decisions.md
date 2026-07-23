# v4 디자인 결정 (2026-07-23)

APP-145 계약 정합성 감사의 결과다. **화면 구현(APP-111~117)이 읽을 문서는 `mvp.pen`이 아니라
이 파일이다** — `.pen`은 git 밖이라 변경 이력이 남지 않는다.

여섯 에이전트가 행 하나씩 맡아 `docs/api-surface.md`의 계약과 대조하고, 빠진 화면·상태를
프레임으로 메웠다. 실측값(사이드바 256, 본문 컬럼 832, 앱바 1440×109 등)은 컨트롤러가
실제 앱에서 재서 공통 입력으로 넘겼다 — 추측으로 만든 치수는 없다.

**v4 프레임 29 → 48개.** `reusable` 공용 노드는 변경 0건이다.

## 감사에서 나온 계약 위반

프레임을 더한 것보다 **이미 있던 것이 계약과 어긋난** 것이 중요하다.

- `PAVkf`(요약 실패)는 **이름만 요약이고 실제로는 전사 기록 탭을 그리고 있었다.** 요약 탭 활성으로 바꾸고 계약이 요구하는 `errorCode`·`errorMessage`를 넣었다
- `O1xLI`(알림 벨)에 **계약 `type` enum에 없는 알림 두 건**(요약 생성·회의 종료)이 있었다. 계약은 `WORKSPACE_INVITATION` 하나뿐이라 지우고 배지를 3→2로 정정했다
- `ImOW0`(승인 결과)이 **승인 기록과 실행 기록을 한 줄로 합치고 있었다.** 계약은 둘을 나눈다(승인은 `decision`·`status` null, 실행은 `status`·`decision` null). 세 블록으로 갈랐다
- `oMqgT`(뷰어)에 **"왜 버튼이 없는지"가 화면에서 읽히지 않았다.** 시작자 표기를 넣었다
- `xPpzc`(관전자)의 잠금이 힌트 한 줄뿐이고 **입력창이 활성처럼 보였다.** `Alert`로 승격하고 플레이스홀더를 대기 문구로 바꿨다
- `iAG1e`(멤버)의 대기 초대 행이 이메일만 보여줘 계약 필드가 빠져 있었다

## 반복해서 빠져 있던 것

세 행에서 같은 종류의 구멍이 나왔다 — **계약이 명시했지만 코드로 표현되지 않는 상태**다.

- **`meetingStartedBy = null`** (아직 아무도 녹음을 시작하지 않음): note-hub full·공유 챗봇 두 곳에 없었다. `IN_PROGRESS`라도 회의가 열린 게 아니다
- **종료 이벤트 없이 끊긴 SSE**: 개인·공유 챗봇 둘 다 없었다. 처리하지 않으면 영원히 로딩이다
- **도구 실패했지만 이어지는 스트림** (`tool_call_result status=error`): 종료로 다루면 안 되는데 그 화면이 없었다

---

# note-hub + side panel (y=20000 · 32000)

`GET /v1/notes/{noteId}` (`useGetNote`) 응답의 `meetingStatus`(IN_PROGRESS|PAUSED|ENDED)와
`meetingStartedBy`(null이면 아직 아무도 시작하지 않음)가 이 두 행의 모든 분기를 만든다.
조작 버튼 노출 판정은 `meetingStartedBy.userId === 내 userId` 하나뿐이다.

## 프레임

### y=20000 note-hub (`?view=full`)

| 프레임 ID | 화면 | 대응 operation | 응답이 만드는 상태 | shadcn | 실측 파생 근거 |
|---|---|---|---|---|---|
| `TkHep` (x=0) | note-hub-active | `useGetNote` + `useGetNoteTranscript` | IN_PROGRESS · startedBy=me → 중지 + 회의 종료 + "내가 시작한 회의" | Tabs / 고정 패널(full) | 앱바 1440×109(프레임 상단 64 + hairline), 본문 컬럼 832, 탭 리스트 x=310 y=173 |
| `DdzUR` (x=1840) | note-hub-paused | `useGetNote` | PAUSED · startedBy=me → 재개 + 회의 종료, 공유 챗봇 읽기 전용 | Tabs / 고정 패널 | 동일 셸, 헤더 832×156 y=101 |
| `oMqgT` (x=3680) | note-hub-active-viewer | `useGetNote` | IN_PROGRESS · startedBy=타인 → 조작 버튼 없음, 상태 pill + "김민수님이 시작한 회의" | Tabs / 고정 패널 | 앱바 우측 정렬, 독은 본문 컬럼 중앙 |
| `Kl7Dz` (x=5520) | note-hub-chat-closed | `useGetNote` | IN_PROGRESS · startedBy=me · 대화 패널 닫힘 → 본문 1컬럼(832) 중앙 정렬 | 고정 패널 접힘 | 컬럼 832가 1440 안에서 중앙(x=304) |
| **`NsGqf` (x=7360)** | **note-hub-ready** | `useGetNote` → `useStartTranscriptionSession` | **`meetingStartedBy=null`** → IN_PROGRESS라도 회의 미개시. 종료/중지 없음, "녹음 시작"만 | Alert(챗봇 잠금) / Tabs | 전사 빈 상태는 헤더 156 아래 40 여백에서 시작, 독은 기존 40px 높이 유지 |
| **`fBM14` (x=9200)** | **note-hub-transcript-loading** | `useGetNoteTranscript` isPending | 노트는 IN_PROGRESS로 이미 응답, 전사만 로딩 → 스켈레톤 8행 | Tabs (탭 골격 유지) | 세그먼트 실측 구조(타임코드 margin 64 + gap 20) 그대로 스켈레톤 폭에 반영 |
| **`HjcHO` (x=11040)** | **note-hub-start-conflict** | `POST /v1/notes/{noteId}/transcription-sessions` → **409** | 시작 요청 실패, refetch 결과는 startedBy=타인 → 뷰어 화면 + 실패 Alert | Alert(destructive) / Tabs | Alert는 전사 컬럼(748 기준, x=346 섹션 정렬) 상단에 얹힘 |

### y=32000 side panel (`?view=side`)

side 모드에서는 개인 챗봇 패널이 숨는다(full·워크스페이스에서만 노출). 시트 폭 860, 좌측 워크스페이스 셸이 그대로 비친다.

| 프레임 ID | 화면 | 대응 operation | 응답이 만드는 상태 | shadcn | 실측 파생 근거 |
|---|---|---|---|---|---|
| `ezlsT` (x=0) | note-side-recording | `useGetNote` + `GET /v1/transcription-sessions/{sessionId}` | IN_PROGRESS · startedBy=me → 독에 중지/종료 | Sheet(side) | 사이드바 256 고정, 시트 860 우측 정렬(x=572) |
| `X3vCNH` (x=1840) | note-side-ready | `useGetNote`(startedBy=null) + 빈 전사 | 회의 미개시 + 빈 전사 → 녹음 버튼만, 시작 전 안내 4항 | Sheet(side) | 탭 2개(요약 없음), 안내 목록은 전사 margin 64 정렬 |
| `LdiLi` (x=3680) | note-side-ended | `useGetNote` | ENDED → 조작 없음, 탭에 요약 등장, 확장 버튼 강조 | Sheet(side) | ENDED에서만 3탭 |
| `V7cEN` (x=5520) | workspace-recording-elsewhere | `useGetNote`(목록) + 세션 상태 | 내가 시작한 녹음이 다른 화면에서 진행 중 → 상단 중앙 글로벌 독 | 고정 pill | 워크스페이스 본문 컬럼 x=432 기준 중앙 pill |
| **`MUfyh` (x=7360)** | **note-side-viewer** | `useGetNote` | IN_PROGRESS · startedBy=타인 → 독에서 중지·종료 제거, "이서연님이 기록 중"만 | Sheet(side) | 독 구성만 교체, 시트/탭 치수 불변 |
| **`gVcFM` (x=9200)** | **note-side-paused** | `useGetNote` | PAUSED · startedBy=me → 독 "재개" + 종료, 파형·타이머 비활성, partial 라인 없음 | Sheet(side) | full 행 paused와 같은 상태를 side 독 문법으로 |

## 추가한 것

1. **`NsGqf` note-hub-ready** — 계약상 `meetingStartedBy=null`은 "IN_PROGRESS라도 회의가 열린 게 아님"인데, full 뷰에는 이 상태 화면이 아예 없었다(side 행에만 `X3vCNH`가 있었음). 종료·중지 버튼을 지우고 "녹음 시작"만 남겼고, 공유 챗봇은 회의 스코프이므로 잠금 Alert + 비활성 컴포저로 바꿨다. `POST transcription-sessions`의 첫 성공이 시작자를 정한다는 규칙을 안내 01~03으로 화면에 박아뒀다.
2. **`fBM14` note-hub-transcript-loading** — `useGetNoteTranscript`의 pending 상태 화면이 두 행 어디에도 없었다. 노트 응답(앱바·헤더·탭·독)은 이미 도착한 상태에서 전사 영역만 스켈레톤이 되는 게 맞으므로, 셸은 active 그대로 두고 전사 컬럼만 교체했다.
3. **`HjcHO` note-hub-start-conflict** — `useStartTranscriptionSession`의 409(이미 진행 중) 결과 화면이 없었다. 409 이후 refetch하면 `meetingStartedBy`가 타인으로 채워지므로 화면은 뷰어 상태로 떨어지고, 실패 사실만 Alert로 남는다. 403(비ACTIVE 멤버)은 같은 Alert 슬롯에 문구만 바뀌는 형태라 별도 프레임을 만들지 않았다.
4. **`MUfyh` note-side-viewer** — side 행에는 시작자 화면(`ezlsT`)만 있고 뷰어 화면이 없었다. full 행의 `oMqgT`에 대응하는 side 짝을 만들었다. 독에서 중지·종료를 제거하고 "이서연님이 기록 중"만 남겼다.
5. **`gVcFM` note-side-paused** — `ezlsT` 독의 "중지"를 누른 뒤 상태가 side 행에 없었다. PAUSED는 시작자에게만 재개 버튼을 준다는 계약을 side 문법으로 옮겼고, 중지 중에는 부분 인식 라인("인식 중")이 사라지도록 했다.

## 고친 것

- **`oMqgT` (note-hub-active-viewer)** — 상단 앱바에 상태 pill("녹음 중")만 있고 **누가 시작했는지가 없었다**. 이 행의 버튼 노출 판정은 전적으로 `meetingStartedBy.userId === 내 userId`인데, 시작자 프레임(`TkHep`/`DdzUR`/`Kl7Dz`)만 "내가 시작한 회의"를 표기하고 뷰어 프레임은 그 자리에 아무것도 없어서 "버튼이 왜 없는지"가 화면에서 읽히지 않았다. 시작자 프레임과 같은 OwnerHint 텍스트 노드를 복사해 "김민수님이 시작한 회의"를 추가했다(독의 "김민수님이 기록 중"과 일치).
- 나머지 6개 기존 프레임에서 **시작자가 아닌데 조작 버튼이 보이는** 위반은 발견되지 않았다.

## 보고만 하는 것

- **요약 탭 노출 기준이 두 행에서 다르다.** full 행은 IN_PROGRESS/PAUSED에서도 `실시간 전사 / 요약 / 노트 정보` 3탭을 노출하는데, side 행은 시작 전·녹음 중에 `실시간 전사 / 노트 정보` 2탭이고 ENDED(`LdiLi`)에서만 요약이 등장한다. 요약은 종료 시 생성되므로 side 행 쪽 규칙이 계약에 가깝지만, 요약 화면 계약은 y=22000 행 소관이라 손대지 않았다. 두 행의 탭 규칙을 한쪽으로 정하는 결정 필요.
- **`V7cEN`의 글로벌 독에는 정지 버튼이 있다.** 이는 "내가 시작한 녹음이 다른 화면에서 계속되는 중"으로만 성립한다. 다른 사람이 녹음 중인 워크스페이스를 볼 때는 목록의 "기록 중" 배지만 남고 독은 없어야 하는데, 프레임 이름(`recording-elsewhere`)만으로는 이 구분이 드러나지 않는다. 이름에 `startedBy=me`를 명시하거나 뷰어용 짝을 두는 편이 안전하다.
- **공용 `reusable` 노드는 수정하지 않았다.** 이 두 행은 shadcn reusable(`Alert/Default`, `Tabs`, `Dialog`)을 인스턴스로 쓰지 않고 v4 자체 토큰(`$el-*`)으로 재현하는 방식이라, 새 Alert(잠금·409)도 같은 방식(`$el-error-soft` / `$el-error-tint` / `$el-canvas-soft` + hairline)으로 만들었다. v4 전반에서 Alert가 반복되기 시작했으므로 v4 전용 Alert 컴포넌트를 하나 승격시킬 만하다 — 다만 공용 컴포넌트 신설은 이 작업 범위 밖이라 제안만 남긴다.

---

# 회의 종료·요약 (y=22000)

mvp.pen v4 「회의 종료·요약」 행을 계약 기준으로 감사한 결과. 프레임은 모두 1440×900, y=22000 고정.

## 프레임

| 프레임 ID | 화면 | 대응 operation | 응답이 만드는 상태 | shadcn | 실측 파생 근거 |
|---|---|---|---|---|---|
| `hbv5v` (x=0) | v4/meeting-end-confirm — 종료 확인 다이얼로그 | `POST /v1/notes/{noteId}/meeting-end` (`useEndMeeting`) | 확인 전. 확인 → 202 접수 → `uWnWH`(분석 대기) | `AlertDialog` | 뷰포트 1440×900. 다이얼로그 480 폭 = 본문 컬럼 832의 절반 + 여백, x=480(중앙), y=310. 앱바 64 + 노트 헤더/탭 밴드는 행 공통 셸 |
| `m6E89F` (x=7360) **신규** | v4/meeting-end-blocked — 녹음 중 종료 거절 | `POST .../meeting-end` → **409 `ACTIVE_TRANSCRIPTION_SESSION`** | 종료 실패. 다이얼로그 안에 destructive Alert + 기본 동작이 `녹음 중지`로 바뀜 | `AlertDialog` + `Alert`(destructive) | `hbv5v` 복제라 셸·다이얼로그 좌표 동일. Alert 삽입으로 다이얼로그가 386 높이 → y=296으로 올려 900 안에 유지 |
| `uWnWH` (x=1840) | v4/note-summary-analyzing — 분석 진행 중 | `GET /v1/notes/{noteId}/analyses/latest` (`useGetLatestAnalysis`) | `PENDING`/`RUNNING`. overview·actionItems·insights 전부 null → 3행 스켈레톤 | `Skeleton` + `Tabs` | 본문 컬럼 864(= 실측 832 + v4 행 여백 보정), 좌측 margin 64는 행 공통 라벨 거터 |
| `f9FCb` (x=9200) **신규** | v4/note-summary-empty — 아직 분석 전 | `GET .../analyses/latest` → **404(오류 아님)**, 버튼은 `POST /v1/notes/{noteId}/analyses` (`useRequestAnalysis`) | 분석 레코드 없음. 빈 상태 + `요약 만들기` → 202 → `uWnWH` | `Alert`(안내) + `Tabs` + Button | `quNSL` 복제라 탭·밴드·본문 컬럼 864 동일. 요약 3행을 단일 빈 상태 행으로 대체 |
| `quNSL` (x=3680) | v4/note-summary — 요약 3종 | `GET .../analyses/latest` | `SUCCEEDED`. overview/actionItems/insights markdown 렌더 | `Tabs` + markdown | 요약 3행은 라벨 거터 64 + 본문 fill, 행 공통 editorial 그리드 |
| `PAVkf` (x=5520) | v4/note-summary-failed — 분석 실패 | `GET .../analyses/latest` / 재시도는 `POST .../analyses` | `FAILED`. `errorCode`·`errorMessage` 표기 + `다시 분석` | `Alert`(destructive) + `Tabs` | 배너는 본문 컬럼 864 폭 full-bleed, 요약 본문은 다른 요약 프레임과 같은 64+fill 그리드 |

다음 새 프레임 x = **11040**.

## 추가한 것

- **`m6E89F` v4/meeting-end-blocked (x=7360)** — 409 `ACTIVE_TRANSCRIPTION_SESSION`. `hbv5v`를 복제해 다이얼로그만 교체했다.
  - 제목 「아직 회의를 종료할 수 없습니다」 + destructive Alert(mic 아이콘, `409 ACTIVE_TRANSCRIPTION_SESSION` 코드 표기)
  - 본문에 "회의 중지도 같은 조건"을 명시 — `meeting-pause`도 녹음 중이면 409이므로 한 화면에서 두 operation의 제약을 같이 설명한다
  - 액션: `닫기` / `녹음 중지`(primary). 종료 재시도는 녹음 중지 후 `hbv5v`로 되돌아오는 흐름
- **`f9FCb` v4/note-summary-empty (x=9200)** — `GET analyses/latest` 404. 404를 오류 배너가 아니라 "아직 분석 전" 빈 상태로 그렸다.
  - Progress Band: 「아직 요약이 없습니다」 + 「오전 9:41 회의 종료」
  - 본문: 요약 3종이 무엇인지 설명 + `요약 만들기`(POST `/analyses`) + "보통 1~2분" 힌트
  - 하단 aside: 전사·공유 챗봇 Q&A는 전사 기록 탭에서 이미 읽을 수 있음

## 고친 것

- **`PAVkf`가 `tab=summary`를 표방하면서 전사 기록 탭을 그리고 있었다.**
  - 활성 탭을 `전사 기록` → `요약`으로 이동(탭 밑줄·라벨 색)
  - Progress Band를 「요약 생성 실패」(destructive) + 「오전 9:43 분석 실패」로 교체
  - 실패 배너에 계약이 요구하는 값 반영: `errorMessage`(한도 초과 사유)를 sub로, `errorCode`를 mono 텍스트 `ANALYSIS_FAILED · TRANSCRIPT_TOO_LONG`으로 추가
  - 본문의 전사 아카이브 타임라인을 요약 탭 본문(개요·액션·인사이트가 비어 있음 + 전사 기록 탭 안내)으로 교체. 아카이브 타임라인 자체는 `TqX06`(v4/shared-chat-archive)·`LdiLi`(v4/note-side-ended)가 이미 담당한다
- **`hbv5v` 다이얼로그** — 계약의 선행 조건이 화면에 없었다.
  - 본문 첫 문장을 「녹음이 진행 중이면 먼저 중지해야 종료할 수 있습니다」로 교체
  - Info에 `녹음 상태 · 녹음 중` 행 추가 → 이 화면에서 종료를 누르면 왜 `m6E89F`(409)로 가는지가 화면 안에서 읽힌다
  - 편집 중 다이얼로그 서브트리의 레이아웃이 부모 높이를 갱신하지 않는 문제가 생겨, 다이얼로그(`SwUuM` → `Y9ukL`)를 같은 토큰·같은 좌표(x=480, y=310)로 통째로 다시 만들었다. 시각 결과는 동일 + 새 행

## 보고만 하는 것

- **공용 `reusable` 노드는 수정하지 않았다.** 이 행은 애초에 `reusable` 인스턴스를 쓰지 않고 v4 토큰(`$el-*`)으로 직접 조립돼 있다. 반복되는 셸(TopBar / Note Header + Tabs / Right 대화 트레이)이 6개 프레임에 통째로 복제돼 있어 컴포넌트화 여지가 크지만, 규약상 건드리지 않았다.
- **뷰어(시작자 아님) 케이스**는 이 행이 아니라 `oMqgT` v4/note-hub-active-viewer(y=20000)가 담당한다. 거기서 회의 종료·중지 버튼이 없는 상태가 확인된다. 403 `NOT_MEETING_STARTER`는 UI에서 버튼 자체를 숨겨 예방하므로 전용 프레임을 만들지 않았다.
- **409 `MEETING_ALREADY_ENDED`** — 다른 참가자가 먼저 종료한 경우. 종료 후 화면(`uWnWH`)과 동일한 상태로 수렴하므로 전용 프레임 대신 토스트로 처리하면 충분하다고 보고 추가하지 않았다.
- **409 `MEETING_NOT_ENDED`(재분석)** — 회의 진행 중에는 요약 탭에 `요약 만들기` 버튼을 노출하지 않는 것으로 예방한다. 해당 진행 중 화면은 y=20000 행(`TkHep`/`DdzUR`)이 담당하므로 이 행에 프레임을 만들지 않았다.
- **409 `ANALYSIS_IN_PROGRESS`(재분석)** — `uWnWH`(분석 중)에는 재분석 버튼이 없고, `PAVkf`의 `다시 분석`을 누르면 곧바로 `uWnWH` 상태로 넘어간다. 연타 방지는 버튼 disabled로 충분해 전용 프레임을 만들지 않았다.
- **markdown 렌더 범위** — `overview`·`actionItems`·`insights`가 markdown 문자열이므로, `quNSL`의 문단/불릿/번호 목록 세 가지 형태가 사실상 지원해야 할 최소 마크다운 문법(문단, `-` 목록, `1.` 목록)을 규정한다. 표·코드블록은 이 행 어디에도 없다 — 필요하면 별도 결정이 필요하다.

---

# 공유 챗봇 (y=24000)

노트 full 모드 우측에 붙는 고정 패널. 뷰포트 1440×900, 사이드바 없음(노트 상세 셸), 우측 트레이 464 = 패널 448 + 좌우 padding 8.

## 프레임

| 프레임 ID | 화면 | 대응 operation | 응답이 만드는 상태 | shadcn | 실측 파생 근거 |
|---|---|---|---|---|---|
| `F8dV8C` (x=0) | shared-chat-streaming — 내가 보낸 메시지가 스트리밍 중 | `POST /v1/notes/{noteId}/chat/messages` (SSE 진행 중) | `message_end` 이전. 마지막 ASSISTANT 메시지에 caret, 입력창 잠김("응답 생성 중"), 전송 버튼 disabled(`$el-hairline-strong`) | 채팅 패널 고정 패널 · 비활성 Input/Button | 트레이 464 − padding 8×2 = 카드 448. 카드 820 = 헤더 82 + 스레드 636 + 컴포저 102. 스레드 좌우 padding 24 → 메시지 폭 400 |
| `xPpzc` (x=1840) | shared-chat-locked — 관전자(다른 멤버가 입력 중) | `GET /v1/notes/{noteId}/chat/messages` 폴링 (`useGetNoteSharedChatMessages`) | `lock.locked=true`, `lock.lockedBy="김민수"`, `lock.pendingApproval=null`. 스트림을 받지 않으므로 진행 중인 답변은 보이지 않고 "입력 중" 디바이더만 노출 | `Alert`(잠금, lock 아이콘) + 비활성 Input | 컴포저 145 = padding 14/18 + Alert 59 + gap 10 + Input 44. 스레드는 fill로 593까지 축소 |
| `TqX06` (x=3680) | shared-chat-archive — 회의 ENDED 후 | `GET .../chat/messages`(읽기 전용) + 전사 아카이브 | 회의 종료 → 공유 챗봇 패널은 닫히고 우측 트레이는 개인 챗봇으로 교체. 공유 Q&A는 좌측 전사 타임라인에 `q`/`a` 행으로 인터리브되어 남음 | 채팅 패널(개인) · 좌측 타임라인 | 좌측 본문 폭 878(전사 아카이브), 우측 트레이 464 유지 |
| `Ngodq` (x=5520) | shared-chat-stream-dropped — 종료 이벤트 없이 끊긴 스트림 | `POST .../chat/messages` SSE가 `message_end`/`error` 없이 절단 | 부분 텍스트는 남기고 caret 제거, 도구 스텝은 완료 표기. destructive `Alert` + [다시 시도] / [닫기]. 컴포저는 다시 활성(`$el-primary` 전송 버튼) | `Alert`(destructive: `$el-error-soft` / `$el-error-tint` / `$el-destructive`) + `Button` outline · ghost | Alert 101 = padding 12×2 + 본문 39 + gap 10 + 액션 28. 이만큼 늘어난 만큼 스레드 앞 Q&A 1쌍(69+129+gap 64)을 덜어 634 안에 맞춤 |
| `dH6kK` (x=7360) | shared-chat-inactive-paused — 회의 중지 중(409 비ACTIVE) | `POST .../chat/messages` → 409 (meetingStatus ≠ IN_PROGRESS) | 히스토리는 그대로 읽히고 전송만 막힘. "중지 중에는 개인 챗봇을 이용하세요" + [개인 챗봇 열기]. 상단 pill "중지됨", 독 "김민수님이 중지함" | `Alert`(pause 아이콘) + `Button` outline + 비활성 Input | 컴포저 183 = padding 32 + Alert 97(본문 77 + padding 20) + gap 10 + Input 44. 스레드 555, StartDivider 제거(16+gap 32)로 흡수 |
| `DZu5q` (x=9200) | shared-chat-not-started — 노트는 IN_PROGRESS이나 `meetingStartedBy = null` | 동일 409. ACTIVE 판정 = `meetingStatus === IN_PROGRESS` **AND** `meetingStartedBy !== null` | 전사 없음(빈 상태), 스레드 없음(빈 상태), 상단 pill "시작 전" + [회의 시작], Alert의 액션도 primary [회의 시작] | `Alert`(circle-play) + `Button` default + 빈 상태 2종 | 좌측 빈 상태는 전사 컬럼 864 폭 유지, 상하 padding 120으로 시각 중앙. 스레드 537 안에서 `justifyContent: center` |

다음 새 프레임 x = **11040**.

## 추가한 것

- **`Ngodq` shared-chat-stream-dropped (x=5520)** — 계약의 세 번째 스트림 종료(종료 이벤트 없이 끊김)가 행 전체에 없었다. 이걸 처리하지 않으면 영원히 로딩이므로, 부분 응답을 남긴 채 destructive `Alert` + [다시 시도]를 스레드 안(끊긴 ASSISTANT 메시지 하위)에 붙이고 컴포저를 다시 활성화했다. `error` 이벤트도 같은 슬롯을 쓰되 문구만 서버가 준 메시지로 대체한다(별도 프레임 없음).
- **`dH6kK` shared-chat-inactive-paused (x=7360)** — 409 회의 비ACTIVE 안내가 없었다. 컴포저를 `Alert` + 비활성 Input으로 바꾸고 "중지 중에는 개인 챗봇을 이용하세요" 문구와 [개인 챗봇 열기] 액션을 넣었다. 히스토리 조회는 계속 되므로 스레드는 그대로 읽힌다.
- **`DZu5q` shared-chat-not-started (x=9200)** — ACTIVE 판정의 두 번째 조건(`meetingStartedBy !== null`)이 만드는 화면이 없었다. 새 노트는 생성 시점부터 IN_PROGRESS라 "중지 중" 문구를 그대로 쓰면 거짓말이 된다. 전사·스레드 모두 빈 상태, pill "시작 전", 액션은 [회의 시작].

## 고친 것

- **`xPpzc` 컴포저** — `lock.locked`가 힌트 한 줄("김민수님이 입력 중")로만 표현돼 있고 입력창은 "메시지 보내기" 플레이스홀더라 여전히 칠 수 있어 보였다. 409 잠금이 만드는 상태를 shadcn `Alert`(lock)로 승격하고, 플레이스홀더를 "김민수님이 입력을 마칠 때까지 기다려 주세요"로 바꿔 비활성임을 명시했다.
- **`xPpzc` 스레드 하단 디바이더** — `PendingDivider` "김민수님 승인 대기 · 완료되면 여기에 올라옵니다"로 되어 있었다. 이 프레임의 lock 상태는 `pendingApproval=null`인 입력 중 상태이고, 승인 대기 관전자 화면은 도구 승인 행 `jobCE`(y=28000, x=1840)가 이미 담당한다. `TypingDivider` "김민수님이 입력 중 · 응답이 끝나면 여기에 올라옵니다"로 정정해 lock 필드와 1:1로 맞췄다.

## 보고만 하는 것

- **`lock.pendingApproval` 관전자 화면은 이 행에 없다** — 도구 승인 행 `jobCE`(v4/approval-spectator, y=28000 x=1840)가 담당한다. 다만 그 프레임의 컴포저 힌트는 "한 번에 한 명만 입력할 수 있습니다"라는 일반 문구라, `{approvalId, tool, summary}`의 `tool`·`summary`가 화면에 드러나지 않는다. 계약이 요구하는 `Alert` + `Badge`(승인 대기) 표현은 그 행에서 보강이 필요하다.
- **TOOL 메시지 렌더링도 이 행에 없다** — `ImOW0`(v4/approval-result, y=28000 x=3680)의 "실행 기록 · 승인"(외부 링크 포함) / "실행 기록 · 거절" 블록이 승인 기록(`decision`)과 실행 기록(`status`)을 모두 커버한다. 공유 챗봇 스레드는 같은 컴포넌트를 재사용하면 되고, 이 행에 중복 프레임을 만들지 않았다.
- **400 빈 메시지** — 전용 프레임을 만들지 않았다. 빈 입력일 때 전송 버튼이 `$el-hairline-strong`(비활성)으로 남는 것이 `F8dV8C`·`xPpzc`에 이미 드러나 있어 서버 400에 도달할 경로가 UI에 없다. 서버 400은 스트림 실패와 같은 `Alert` 슬롯을 재사용한다.
- **`TqX06` 이름과 내용의 어긋남** — 프레임 이름은 "shared-chat-archive · 공유 챗봇 (ENDED)"인데 우측 트레이는 개인 챗봇 패널이다. 종료 후 공유 챗봇이 사라지고 Q&A가 전사 아카이브로 흡수되는 설계 자체는 계약(`종료 후 읽기 전용`)과 어긋나지 않아 손대지 않았다. 다만 개인 챗봇 행(y=26000)과 우측 패널이 겹치므로, 이름을 `shared-chat-archive-in-transcript`류로 바꾸거나 우측을 공유 챗봇 읽기 전용 스레드로 되돌릴지는 결정이 필요하다.
- **공용 `reusable` 노드는 건드리지 않았다.** 이 행의 프레임들은 shadcn reusable 인스턴스를 쓰지 않고 v4 토큰(`$el-*`)으로 직접 조립돼 있다. `Alert`/`Badge`/`Card` reusable(`QyzNg`, `UjXug`, `pcGlv` 등)과 v4 프레임 사이에 스타일 계보가 끊겨 있는 점은 행 전체의 구조 이슈로 남는다.
- **pencil 렌더/레이아웃 캐시** — 새로 만든 노드가 직후 `get_screenshot`에 그려지지 않고 `snapshot_layout`의 마지막 자식 `y`가 이전 값으로 남는 현상이 있었다. 높이 합과 재조회로 검증했고 최종 상태에서는 이 행 6개 프레임 모두 `problemsOnly` 무결이다.

---

# 개인 챗봇 (y=26000)

mvp.pen v4 「개인 챗봇」 행. 프레임 크기 1440×900, 간격 1840. 다음 새 프레임은 `x=14720`.

## 프레임

| 프레임 ID | 화면 | 대응 operation | 응답이 만드는 상태 | shadcn | 실측 파생 근거 |
|---|---|---|---|---|---|
| `LeuWE` (x=0) | 워크스페이스 · 활성 세션 | `GET /v1/agent-chats/active` (`useGetActiveAgentChat`) + `GET .../messages` | 응답 있음 → 히스토리 복원, 스코프 `workspace` | 고정 패널 · Input · Button | 뷰포트 1440, 사이드바 255+hairline, 패널 카드 448 = 1440−984−8, 본문 컬럼은 패널 열림 시 721로 축소 |
| `LCXcj` (x=1840) | 노트 full · 활성 세션 | 동상, 스코프 `note` | 응답 있음 → 노트 범위 답변 | 고정 패널 | 우측 트레이 464 = 448 카드 + 8 거터 ×2, 앱바 64 |
| `xyR27` (x=3680) | 노트 full · 새 대화 직후 | `POST /v1/agent-chats` (`useCreateAgentChat`) | 같은 대상 이전 세션이 비활성 → 읽기 전용으로 위에 남음. 워크스페이스 스코프 세션은 그대로 | 고정 패널 · Button | 동상 |
| `evks6` (x=5520) | 워크스페이스 · **활성 세션 없음** | `GET /v1/agent-chats/active` → **`null`** | 오류 아님. 빈 상태 + 예시 질문, 첫 전송이 세션을 만듦 | 고정 패널 · Alert 성격의 빈 상태(카드 없이 본문) | 패널 448 내부 padding 24, Thread `justifyContent: end`로 기존 행과 동일 정렬 |
| `L0Wx2` (x=7360) | 노트 full · **새로고침 후 히스토리 복원** | `GET /v1/agent-chats/{chatId}/messages` (`useGetAgentChatMessages`) | `role` USER/ASSISTANT/TOOL. TOOL은 **승인 기록**(`decision`, `status=null`)과 **실행 기록**(`status`, `decision=null`) 두 종류로 갈라져 렌더 | 승인 기록 = 좌측 2px 규칙선, 실행 기록 = `Card`(축약) + `Badge` 완료 + 외부 링크 | 카드 폭 400 = 448 − 24×2, 기존 v4 `실행 기록` 패턴(좌측 보더/외부 링크) 재사용 |
| `Z3EDew` (x=9200) | 노트 full · **도구 실패, 스트림 계속** | `POST .../messages` SSE — `tool_call_result(status=error)` | 실패 Badge를 남기고 **`token`이 계속 이어짐**. 종료 아님 → 컴포저는 중지 버튼 유지 | `Card` + `Badge`(실패, `el-error-tint`) + 커서 | 실패 카드 `el-error-soft`, 나머지 토큰 텍스트는 본문 14/1.65 그대로 |
| `tmNgz` (x=11040) | 노트 full · **`error` 이벤트** | 동상 — SSE `error` | 부분 응답 **저장 안 됨** → 어시스턴트 말풍선 없이 Alert + 다시 보내기 | `Alert`(destructive) + `Button` ×2 | Alert 폭 400, 버튼 높이 30 (v4 승인 카드와 동일) |
| `pn9GH` (x=12880) | 노트 full · **종료 이벤트 없이 끊김** | 동상 — 종료 이벤트 미수신 | 부분 토큰은 회색으로 남기고 40초 뒤 재시도 제안. 처리 안 하면 영원히 로딩 | `Alert`(중립) + `Button` ×2 | 동상 |

## 추가한 것

- `evks6` — **활성 세션 없음(`active` 응답이 `null`)**. v4에 없던 상태였다. 오류 화면이 아니라 "아직 시작된 대화가 없습니다" + 예시 질문 3개, 컴포저 힌트를 "첫 질문을 보내면 대화가 시작됩니다"로 바꿔 첫 전송이 `POST /v1/agent-chats`를 부른다는 걸 드러냈다.
- `L0Wx2` — **히스토리 복원 + `toolEvent` 두 종류**. 기존 3프레임에는 TOOL role 메시지가 한 건도 없어서, 승인 기록(`decision` 있음)과 실행 기록(`status` 있음)이 서로 다른 모양이라는 계약이 화면에 없었다. 스트리밍 중 보이던 문장이 새로고침 후에도 같다(= `message_end.content`)는 것도 이 프레임이 근거다.
- `Z3EDew` — **도구 실패했지만 계속되는 스트림**. `tool_call_result(status=error)`를 종료로 다루지 않는다는 걸 보이려고 실패 Badge 아래에 토큰이 이어지고, 컴포저는 여전히 중지 버튼이다.
- `tmNgz` — **`error` 이벤트**. 부분 응답이 저장되지 않으므로 반쯤 쓰인 말풍선을 남기지 않고 지운 뒤 Alert만 남긴다.
- `pn9GH` — **종료 이벤트 없이 끊긴 스트림**. 세 번째 종료 경로. 부분 토큰은 화면에 남기되 회색 처리하고, "40초째 멈춰 있습니다 / 다시 시도하면 위 조각은 버려집니다"로 무한 로딩을 끊는다.

## 고친 것

- `Z3EDew` 컴포저 힌트에서 폰트에 없는 `■` 글리프를 빼고 "중지 버튼으로만 멈춥니다"로 바꿨다.
- 기존 `LeuWE` · `LCXcj` · `xyR27`은 계약과 어긋나는 곳이 없어 손대지 않았다. (스코프 표시, 새 대화가 같은 대상 세션만 교체한다는 설명, 노트 side 모드에 패널이 없는 것 모두 계약대로였다.)

## 보고만 하는 것

- **Scope Row의 `chevron-down`** (`LeuWE`/`LCXcj`/`xyR27` 및 복사본 전부). 스코프는 어디서 열었는지로 정해지므로 패널 안의 드롭다운은 "여기서 스코프를 바꾼다"로 읽힌다. 다만 대상별 세션 목록을 여는 어포던스일 수도 있어 판단을 미뤘다. 스코프 전환이 아니면 아이콘을 빼거나 라벨을 "세션"으로 바꾸는 게 맞다.
- **404 `AGENT_CHAT_NOT_FOUND` 전용 프레임 없음.** 이미 없는 세션에 보내는 경우라 복구 화면이 `evks6`(활성 세션 없음)과 같아서 프레임을 새로 만들지 않았다. 다른 UX가 필요하면 `x=14720`에 추가하면 된다.
- **공용 `reusable` 노드는 손대지 않았다.** 이 행은 v4 토큰(`el-*`)과 기존 v4 패턴(승인 카드, 실행 기록 좌측 보더, ProjectBadge 형태의 Badge)만 복제해서 만들었고, `Badge`/`Alert`/`Card` 공용 컴포넌트로 승격할 만한 반복은 이 행 안에서만 3회(실행 기록 2, 실패 1) 나온다.
- **워크스페이스 화면의 패널은 절대 좌표(x=984)**, 노트 화면은 flex 트레이(464 + padding 8)로 구조가 다르다. 결과 폭은 448로 같아 시각적으로는 일치하지만, 구현 시 한쪽으로 통일하는 게 낫다.

---

# 도구 승인 (y=28000)

mvp.pen v4 「도구 승인」 행. 프레임 크기 1440×900, 간격 1840. 다음 새 프레임은 `x=12880`.

이 행은 전부 회의 중 노트 full 화면(`?view=full`)이다. 사이드바 없이 앱바 1440×64 + 본문(좌측 기록 976 / 우측 대화 트레이 464)이며, 대화 카드는 464 − 8×2 = 448, 스레드 내용 폭은 448 − 24×2 = **400**이다.

## 프레임

| 프레임 ID | 화면 | 대응 operation | 응답이 만드는 상태 | shadcn | 실측 파생 근거 |
|---|---|---|---|---|---|
| `eP8jX` (x=0) | 승인 요청 · 소유자 | SSE `tool_approval_request` `{approvalId, toolCallId, tool, summary}` | 스트림은 **열린 채 멈춰** 승인을 기다린다. 조회 도구는 이 카드를 거치지 않고 `tool_call_start`로 바로 진행 | `Card` + `Button`(승인/거절) + `Badge`(쓰기 도구) | 카드 폭 400, 버튼 높이 30·radius 8은 기존 v4 승인 카드 값 그대로 |
| `jobCE` (x=1840) | 승인 대기 · 관전자 | `GET /v1/notes/{noteId}/chat/messages` → `lock.pendingApproval` `{approvalId, tool, summary}` **폴링** | 관전자는 스트림을 받지 않는다. **버튼이 아예 없다** — 403 `NOT_APPROVAL_OWNER`는 최후 방어선이지 화면 근거가 아니다 | `Alert` 성격의 Pending Row + `Badge` | 같은 카드 폭 400. 컴포저는 입력 잠김(`Input` 비활성 + SendBtn `el-hairline-strong`) |
| `pysh5` (x=5520) | **승인 중계됨 · 확정 대기** | `POST /v1/agent-chats/{chatId}/approvals/{approvalId}` → **204** | 204는 접수일 뿐이다. 버튼을 낙관적으로 뒤집지 않고 `opacity 0.4`로 잠근 뒤, 확정은 스트림 `tool_approval_resolved`가 온 다음에만 반영한다 | `Card` + 잠긴 `Button` ×2 + 상태 Row | 버튼 형태·위치는 `eP8jX` 그대로 두고 불투명도만 낮춰, 같은 카드의 다른 상태로 읽히게 했다 |
| `ImOW0` (x=3680) | 승인/거절 후 히스토리 | `tool_approval_resolved` `{approvalId, decision}` + `tool_call_result` `{toolCallId, status, summary, url}` | **승인 기록**(`decision` 있음 / `status` null)과 **실행 기록**(`status` 있음 / `decision` null)이 **따로** 남는다. 거절도 기록이 남고, 그 아래엔 실행 기록이 없다 | 기록 = 좌측 2px 규칙선 · 실행 기록에 `Badge`(완료) 자리와 외부 링크 | 기록 블록 좌측 padding 12 + 2px 보더는 v4 기존 `실행 기록` 패턴 |
| `WKrCG` (x=7360) | **만료 → 카드 무효화** | 대기 상한 **300초** 초과, 또는 뒤늦게 누른 요청의 **404 `APPROVAL_NOT_FOUND`** | 카드가 무효화된다(버튼 제거, 도구·대상 문구 muted). REJECTED로 처리되고 **스트림은 정상 종료** → 컴포저는 다시 입력 가능 | 무효화 안내 = 카드 내부 `Alert` 라인(destructive) | 카드 크기·구조는 그대로 두고 Actions만 `enabled:false`. 폭 400 유지 |
| `d9IWR` (x=9200) | **회의 종료 중 승인 → 무효화** | **409 `MEETING_NOT_ACTIVE`** | 일반 오류로 뭉개면 카드가 계속 눌리는 상태로 남는다. 앱바(녹음 중지/회의 종료 버튼 제거, "회의 종료됨"), 녹음 독, 실시간 partial 라인, 컴포저(읽기 전용)까지 함께 종료 상태로 내린다 | 무효화 안내 `Alert` + 컴포저 잠금 | 앱바 64·StatusPill·독은 좌표를 건드리지 않고 `enabled`/문구만 바꿔, 종료 전후가 같은 화면임을 유지 |
| `YBXm4` (x=11040) | **도구 실행 실패, 스트림 계속** | `tool_call_result` `status=error` | 승인은 정상이었고 실행만 실패했다. 실행 기록이 `status error`로 남고(좌측 보더 destructive, 외부 링크 없음) **스트림은 끊기지 않는다** — 아래로 응답이 이어진다 | 실행 기록 `Card`(축약) + 상태 문구 + 진행 Row | 승인 기록/실행 기록 블록을 그대로 재사용하고 색과 문구만 실패로 바꿨다 |

## 추가한 것

- `pysh5` — **204와 확정 사이의 상태**. 계약이 "204는 중계했다는 뜻이지 확정이 아니다"라고 못 박는데, v4에는 요청(눌리는 카드)과 결과(기록) 사이가 비어 있었다. 이 프레임이 없으면 구현이 204에서 곧장 카드를 뒤집는 낙관적 처리로 흐른다. 카드 문구도 "확정은 스트림의 `tool_approval_resolved` 이벤트로만 반영됩니다"로 명시했다.
- `WKrCG` — **만료로 무효화되는 카드**. 300초 상한과 404 `APPROVAL_NOT_FOUND`가 같은 화면으로 수렴한다. 카드를 무효화한 뒤 "승인을 받지 못해 이슈를 만들지 않았습니다" 응답과 **거절 기록(만료)** 이 이어지고, 스트림이 정상 종료됐으므로 컴포저 힌트를 "스트림은 정상 종료되었습니다 · 다시 입력할 수 있습니다"로 두었다.
- `d9IWR` — **409 `MEETING_NOT_ACTIVE`**. 승인을 누르는 사이 회의가 끝난 경우다. 카드만 죽이면 앱바에 여전히 "녹음 중 12:34"가 남아 상태가 어긋나므로, 앱바·녹음 독·전사 partial 라인·컴포저를 함께 종료 상태로 내렸다.
- `YBXm4` — **`status=error`인데 끊기지 않는 스트림**. 실행 기록만 실패로 바뀌고 그 아래로 응답이 이어진다. 컴포저 힌트도 "도구가 실패해도 스트림은 종료되지 않습니다"로 바꿨다.

## 고친 것

- `ImOW0` **히스토리가 계약과 어긋났다.** "김민수님이 승인 → Linear APP-123 생성" 한 줄로 승인과 실행을 합쳐 놓아, `toolEvent`가 승인 기록과 실행 기록 **두 건**으로 나뉘어 남는다는 계약이 화면에 없었다. 세 블록으로 갈랐다.
  - `승인 기록 · decision APPROVED` — "김민수님이 승인 · 09:11" + 대상
  - `실행 기록 · status success` — "Linear 이슈 생성 · 완료" + "APP-123 생성됨" + 외부 링크
  - `승인 기록 · decision REJECTED` — "김민수님이 거절 · 09:12" + 대상 + **"실행 기록 없음 — 도구는 실행되지 않았습니다"**
- `eP8jX` 승인 카드에 **대기 상한**을 넣었다. 300초라는 숫자가 어디에도 없어서 "무한정 기다리는 카드"로 읽혔다 → "응답이 없으면 300초 뒤 자동으로 거절 처리됩니다".
- `eP8jX` 도구 행에 **`쓰기 도구` Badge**를 붙였다. 조회 도구는 승인을 거치지 않는데, 카드만 봐서는 이 도구가 왜 승인 대상인지 알 수 없었다. 같은 메시지의 "조회 도구 2건 자동 실행"과 짝이 맞는다.
- `jobCE`(관전자)는 계약과 어긋나는 곳이 없어 손대지 않았다. 버튼 없음 + Pending Row + 입력 잠김이 모두 계약대로였다.

## 보고만 하는 것

- **공용 `reusable` 노드는 손대지 않았다.** 이 행은 v4 토큰(`el-*`)과 기존 v4 패턴(승인 카드, 기록 블록의 좌측 2px 보더, ProjectBadge 형태의 Badge)만 복제해서 만들었다. 승격 후보는 **기록 블록**이다 — 이 행 안에서만 5회(승인 2, 실행 2, 만료 거절 1) 반복된다.
- **실행 기록의 상태 Badge를 텍스트로 대신했다.** shadcn 매핑은 `Badge`(상태)지만, 이 행에서는 "Linear 이슈 생성 · 완료 / · 실패"처럼 한 줄 텍스트로 뒀다. 좌측 보더 색(`el-hairline-strong` / `el-destructive`)이 이미 상태를 나르고, 400 폭에서 Badge까지 넣으면 기록 밀도가 카드처럼 무거워진다. 구현에서 `Badge`로 올려도 레이아웃은 그대로 들어간다.
- **만료(404)와 회의 종료(409)를 한 프레임으로 합치지 않았다.** 카드만 보면 같은 "무효화"지만 껍데기가 다르다 — 만료는 회의가 계속되고 컴포저가 살아 있고, 409는 화면 전체가 종료 상태다. 합치면 컴포저를 어느 쪽으로 그릴지 결정할 수 없다.
- **403 `NOT_APPROVAL_OWNER` 전용 프레임은 만들지 않았다.** 관전자에게는 버튼 자체가 없으므로(`jobCE`) 403은 정상 흐름에서 도달할 수 없는 최후 방어선이다. 도달했다면 그건 화면 버그이고, mutation 실패 토스트(`MutationCache.onError`)로 충분하다.
- **pencil 렌더러 주의.** 작업 중 `Insert`로 만든 노드가 캔버스에서 y+50만큼 어긋나 그려지는 현상이 있었다(데이터는 정상, `Copy`로 만든 노드는 정상). 이 행의 모든 신규 노드는 기존 노드를 `Copy`한 뒤 속성만 덮어쓰는 방식으로 만들었다. 이 행을 이어서 편집할 때도 같은 방식을 권한다.

---

# 연동·알림·멤버 (y=30000)

`mvp.pen` v4 캔버스 y=30000 행. 프레임은 모두 1440×900, x 간격 1840.
실측 기준: 뷰포트 1440×900 · 사이드바 255(설정 화면은 SettingsNav 255) · 앱바 64 · 셸 `$el-canvas` · 카드 `$el-surface-card`.

## 프레임

| 프레임 ID | 화면 | 대응 operation | 응답이 만드는 상태 | shadcn | 실측 파생 근거 |
|---|---|---|---|---|---|
| `soPy6` (x=0) | settings-integrations-admin | `GET /v1/workspaces/{id}/integrations` · `GET .../integrations/{provider}/authorize` · `DELETE .../integrations/{provider}` | `LINEAR` connected=true → 연결됨 · connectedBy "김민수" · connectedAt 2026-06-02 + **연결 해제**. `GITHUB` connected=false → 연결되지 않음 · connectedBy/connectedAt null(`—`) + **연결**. 미연동 provider도 목록에 오므로 두 카드가 항상 렌더된다 | Card + Button + Badge(연결 상태 dot) | 콘텐츠 1185 = 1440−255, PageWrap padding 40 → 본문 1105 |
| `t8oW0` (x=1840) | settings-integrations-member | 같은 `GET .../integrations` | 같은 응답, role=MEMBER → **버튼 없음**. 상태·connectedBy·connectedAt만. 하단 Alert "새 연동이 필요하면 ADMIN에게 요청하세요." (`DELETE` 403 비ADMIN을 UI에서 미리 막는다) | Card + Alert | 동일 |
| `O1xLI` (x=3680) | notification-bell (드롭다운 열림) | `GET /v1/notifications` · `PUT /v1/notifications/{id}/read` · `POST /v1/invitations/{id}/accept`·`/decline` | unreadCount 2 → Badge "2". PENDING 2건 = 수락/거절 버튼 + 미읽음 dot. ACCEPTED 1건 = 버튼 대신 "수락함" 라벨, dot 없음(readAt 있음) | DropdownMenu + Badge + Button×2 | 드롭다운 404w, 앵커 x=725/y=56 (앱바 64 아래) |
| `iAG1e` (x=5520) | settings-members | `GET .../members` · `GET .../invitations` · `POST .../invitations` · `DELETE .../invitations/{id}` | members 7건(내 role=ADMIN → 초대 폼 노출, ADMIN/MEMBER RoleChip, joinedAt). 대기 초대 2건: inviteeName+inviteeEmail, role, `inviterName · createdAt`, 취소 | Form + Input + Select + Table | 행 높이 52, NameCol 300, RoleCell 130 |
| `Si390` (x=7360) | **notification-empty** | `GET /v1/notifications` (빈 목록) | notifications=[] · unreadCount=0 → Badge 자체가 사라지고 벨 하이라이트 없음, "모두 읽음으로"는 비활성 색. 빈 문구가 "읽은 알림도 남는다"를 명시 | DropdownMenu + 빈 상태 | 드롭다운 폭·앵커 동일, 아이콘 원 44 |
| `x1pwOb` (x=9200) | **notification-invitation-resolved** | 같은 `GET` + `POST .../accept` 409 | invitation.status ≠ PENDING이면 버튼 대신 라벨: **취소됨(CANCELED) · 거절함(DECLINED) · 수락함(ACCEPTED)**. 취소·수락돼도 항목은 목록에 남는다. 상단 Alert = 만료된 PENDING에 수락을 눌렀을 때의 `409 INVITATION_NOT_PENDING` "이미 처리된 초대입니다." | DropdownMenu + Alert(destructive) + Button×2 | 동일 |
| `UOUZl` (x=11040) | **members-invite 409 ALREADY_WORKSPACE_MEMBER** | `POST .../invitations` | 이미 멤버인 junho@heymoa.app → 입력 테두리 destructive + 인라인 Alert "이미 워크스페이스 멤버입니다." + 코드. 멤버 목록/대기 목록은 그대로 | Form + Input(error) + Alert | 폼 아래 Alert 37h, 본문 총 826 < 836 (클리핑 없음) |
| `KOM8F` (x=12880) | **members-invite 409 DUPLICATE_PENDING_INVITATION** | 같은 operation | 이미 대기 중인 dahee@heymoa.app → "이미 대기 중인 초대가 있습니다." 아래 대기 초대 목록에 같은 사람이 보인다 | 동일 | 동일 |
| `iHlP8` (x=14720) | **members-invite 404 INVITEE_NOT_FOUND** | 같은 operation | `Sora@Heymoa.app` → "초대할 사용자를 찾을 수 없습니다. 철자와 대소문자를 확인해 주세요." 서버가 이메일을 정규화하지 않아 **가입한 사용자도 404가 될 수 있어** 문구를 "가입하지 않은 사용자"로 단정하지 않는다 | 동일 | 동일 |
| `uUOq0` (x=16560) | **mock-oauth 승인 화면** | `GET .../integrations/{provider}/authorize` (302) | fetch가 아니라 `window.location` 이동이라 화면 전체가 바뀐다. 목에서는 MSW가 최상위 내비게이션을 못 가로채므로 이 화면이 외부 제공자 + callback을 대신한다. 허용 → callback → `/w/{workspaceId}` | Button(rounded-full) | `components/mocks/mock-oauth-consent.tsx` 실측: max-w-md=448, gap-6=24, space-y-2=8, text-3xl 헤딩, 버튼 full-width rounded-full |

## 추가한 것

- `Si390` **알림 빈 상태** — `notifications: []`, `unreadCount: 0`. 배지 노드를 끄고(`enabled:false`) 벨 배경 하이라이트를 제거해 "미읽음 0"을 시각적으로 일치시켰다. 문구로 "읽은 알림도 사라지지 않는다"를 명시.
- `x1pwOb` **비PENDING 알림 상태 라벨 + 409** — CANCELED/DECLINED/ACCEPTED 세 라벨과 PENDING 1건을 한 화면에 두어, 목록이 남는다는 계약과 "PENDING만 버튼"이라는 규칙을 대비시켰다. 상단 destructive Alert가 `409 INVITATION_NOT_PENDING`(응답 문구 그대로 "이미 처리된 초대입니다.")을 담는다.
- `UOUZl` · `KOM8F` · `iHlP8` **초대 실패 3종** — openapi3.yml의 응답 메시지를 그대로 썼다(`이미 워크스페이스 멤버입니다.` / `이미 대기 중인 초대가 있습니다.` / `초대할 사용자를 찾을 수 없습니다.`). 각 프레임의 입력값이 실패 원인과 맞물린다(기존 멤버 이메일 / 이미 대기 중인 이메일 / 대문자 섞인 이메일).
- `uUOq0` **`/mock-oauth` 목 전용 승인 화면** — 실제 컴포넌트를 실측해 재현. provider가 경로 파라미터(enum) 그대로 노출되므로 헤딩도 `LINEAR`로 표기했다.

## 고친 것

- `O1xLI` 알림 항목 중 `주간 제품 회의 요약 3종이 생성되었습니다`, `디자인 시스템 점검 회의가 종료되었습니다` **삭제**. 계약의 `type` enum은 `WORKSPACE_INVITATION` 하나뿐이라(openapi3.yml `NotificationListResponse`) 초대 외 알림은 존재할 수 없다. 삭제에 맞춰 배지 3 → **2**로 정정(미읽음 2건과 일치), 마지막 항목의 하단 hairline 제거.
- `iAG1e` 대기 초대 행이 `inviteeEmail`만 보여주고 있었다. 계약 필드(`inviteeName`·`inviteeEmail`·`inviteeImage`·`inviterName`·`role`·`createdAt`)에 맞춰 **이름+이메일 2단 셀**로 바꾸고, 보낸 시각 셀을 `inviterName · createdAt`("김민수 · 3일 전 보냄")으로 정정했다. `inviteeImage`가 null인 경우의 폴백은 기존 mail 아이콘 원 그대로.

## 보고만 하는 것

- **공용 `reusable` 노드는 건드리지 않았다.** 이 행은 공용 컴포넌트 인스턴스를 쓰지 않고 v4 토큰으로 직접 조립돼 있어 수정할 일도 없었다.
- **초대 수락 후 "그 워크스페이스가 목록에 나타난다 / 기본 워크스페이스는 안 바뀐다"** 상태의 프레임이 아직 없다. 이 상태는 사이드바 워크스페이스 스위처에서 드러나므로 이 행이 아니라 워크스페이스 셸 행에서 다뤄야 한다.
- **사이드바 폭이 v4 전체에서 255**다(실측 256). 1px 차이가 y=20000~32000 전 행에 동일하게 적용돼 있어 이 행만 고치면 오히려 어긋난다.
- **설정 화면 본문이 1105 폭 풀블리드**다. 실측의 832 컬럼은 워크스페이스 화면(사이드바+중앙 정렬) 기준이라 설정 라우트에는 적용하지 않았다.
- `/mock-oauth`는 워크스페이스 라우트가 아니라 `NavbarGate`/`FooterGate`가 **마케팅 내비게이션·푸터를 렌더한다**. 프레임에는 HeyMoa 워드마크만 있는 최소 앱바로 존재 사실만 표시했다. 마케팅 내비는 랜딩 행 소관.
- 목 `authorize`는 `/mock-oauth?workspaceId=…&provider=…`로 302하고, 승인 후에는 설정 화면이 아니라 `/w/{workspaceId}`로 돌아간다(`components/mocks/mock-oauth-consent.tsx`). 연동 설정 → 승인 → 워크스페이스로 튀는 흐름이라 UX상 재확인이 필요할 수 있다.
- 다른 행 소관이지만 눈에 띈 것: `evks6`(v4/personal-chat-empty, y=26000)에 `placeholder: true`가 남아 있다.

---
