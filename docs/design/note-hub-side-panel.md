# note-hub + side panel (y=20000, 32000)

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
