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
