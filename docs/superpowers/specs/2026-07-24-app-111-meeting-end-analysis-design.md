# APP-111 회의 종료 + 분석 결과 UI 설계

**목표:** 노트 full 모드에 회의 조작권(중지·재개·종료, 시작자 단독)과 요약 탭(분석 상태·마크다운·재분석)을 더한다. APP-112가 세운 2컬럼 셸 위에 얹는다.

**입력:** `docs/api-surface.md` 회의·분석 절, `docs/design-decisions.md` note-hub 행(y=20000: `TkHep` `DdzUR` `oMqgT`)·회의종료요약 행(y=22000: `hbv5v` `m6E89F` `f9FCb` `uWnWH` `quNSL` `PAVkf`), `AnalysisResultResponseData`(status·overview/actionItems/insights markdown·errorCode).

**범위 밖:** 공유 챗봇·개인 챗봇(APP-112/113/114 완료). 녹음 시작/전사(기존 `RecordingDock`·`TranscriptView`).

## 자문자답으로 잡은 것

### 조작권은 `meetingStartedBy.userId === 내 userId` 하나로 가른다

`useAuth().user.userId`와 `note.meetingStartedBy?.userId`를 비교한다. 시작자면 조작 버튼, 뷰어면 상태 pill + "OO님이 시작한 회의"(`oMqgT`). 403 `NOT_MEETING_STARTER`는 **버튼을 숨겨 예방**하므로 최후 방어선일 뿐 — 도달하면 토스트(계약상 정상 흐름엔 없음).

상태별 버튼(시작자):

| meetingStatus | 버튼 | 프레임 |
|---|---|---|
| IN_PROGRESS + startedBy=me | 중지(`usePauseMeeting`) · 회의 종료 | `TkHep` |
| PAUSED + startedBy=me | 재개(`useResumeMeeting`) · 회의 종료 | `DdzUR` |
| IN_PROGRESS/PAUSED + startedBy=타인 | 없음. pill + 시작자 힌트 | `oMqgT` |
| ENDED | 없음 (조작 끝) | — |
| startedBy=null (미시작) | 없음 (녹음 독이 시작 담당) | `NsGqf` |

### 탭은 full 모드에서 항상 3개다

디자인 감사가 "full 3탭 / side 2탭" 불일치를 미해결로 남겼다(design-decisions 91행). **full은 항상 `실시간 전사 / 요약 / 노트 정보` 3탭**으로 통일한다(full 행 규칙). 요약은 종료 시 생성되므로 ENDED 전에는 요약 탭이 **"회의가 끝나면 요약이 생성됩니다"** 안내를 보인다(재분석 버튼 없음 — 계약상 `MEETING_NOT_ENDED` 409를 버튼 숨김으로 예방). side 모드는 이 이슈 범위 밖(2탭 유지).

`NoteTab`을 `"details" | "transcript" | "summary"`로 넓힌다.

### 분석 상태는 요약 응답 하나로 갈린다

`GET analyses/latest`가 만드는 다섯 화면:

| 응답 | 화면 | 프레임 |
|---|---|---|
| **404** | 오류 아님 — "아직 분석 전". ENDED면 `요약 만들기`(`useRequestAnalysis`), 진행 중이면 안내만 | `f9FCb` |
| PENDING·RUNNING | 3행 스켈레톤. **폴링**(`refetchInterval`) | `uWnWH` |
| SUCCEEDED | overview/actionItems/insights 마크다운 3종 | `quNSL` |
| FAILED | `errorCode`·`errorMessage` destructive `Alert` + `다시 분석` | `PAVkf` |

**404는 빈 상태다(오류 아님).** `useGetLatestAnalysis`의 404를 error boundary가 아니라 빈 상태로 떨어뜨린다(`errorCodeOf === "ANALYSIS_JOB_NOT_FOUND"`). 폴링은 status가 PENDING/RUNNING일 때만 켜고 SUCCEEDED/FAILED/404면 멈춘다.

### 회의 종료는 확인 다이얼로그 + 녹음 중 분기

`회의 종료` → `AlertDialog`(`hbv5v`). 확인 → `useEndMeeting`(202) → 요약 탭이 분석 대기로 간다. **녹음 중이면 409 `ACTIVE_TRANSCRIPTION_SESSION`** → 다이얼로그 안 destructive `Alert` + 기본 동작을 `녹음 중지`로(`m6E89F`). 녹음 중지 후 다시 종료. 다이얼로그에 "녹음 상태" 행을 두어 왜 막히는지 화면에서 읽히게 한다.

409 `MEETING_ALREADY_ENDED`(다른 참가자가 먼저 종료)는 종료 후 화면과 같은 상태로 수렴하므로 **토스트**로 충분(전용 화면 없음, design-decisions 141행).

### 마크다운은 최소 문법만 — 의존성 없이

`overview`·`actionItems`·`insights`는 마크다운이지만 계약이 쓰는 건 **문단·`-` 목록·`1.` 목록** 셋뿐이다(표·코드블록 없음, design-decisions 144행). 새 의존성 대신 이 셋만 그리는 소형 렌더러(`lib/markdown/render-markdown.tsx`)를 둔다. 인라인 강조(`**bold**`)는 계약 예시에 없어 넣지 않는다(필요하면 별도 결정).

`ponytail:` 표·코드블록·인라인 강조는 미지원. 계약이 그 문법을 쓰기 시작하면 렌더러를 늘리거나 라이브러리로 승격한다.

### 재분석 연타는 버튼 disabled로 막는다

`PAVkf`의 `다시 분석` → `useRequestAnalysis`(202) → 곧바로 `uWnWH`(분석 중). 409 `ANALYSIS_IN_PROGRESS`는 버튼 disabled + pending으로 예방(전용 화면 없음).

## 구조

```
lib/markdown/render-markdown.tsx     (신규) 최소 마크다운(문단·- ·1.) → React. 순수, 테스트됨
components/notes/note-summary.tsx    (신규) 요약 탭 — 404/analyzing/succeeded/failed + 폴링 + 재분석
components/notes/meeting-controls.tsx (신규) 앱바 조작 — 시작자 중지/재개/종료, 뷰어 pill+힌트
components/notes/meeting-end-dialog.tsx (신규) 종료 확인 AlertDialog + 409 녹음 중 분기
components/notes/note-panel.tsx      (수정) 3탭(전사/요약/노트정보) + 앱바 meeting-controls
```

`meeting-controls`·`meeting-end-dialog`는 `note.meetingStatus`·`meetingStartedBy` + `useAuth().user`로 분기한다. `note-summary`는 `useGetLatestAnalysis` 하나로 다섯 화면을 만든다.

## 오류 표시 — AGENTS.md 경계

| 무엇 | 어떻게 |
|---|---|
| 404 분석 없음 | 빈 상태(오류 아님) |
| FAILED 분석 | 요약 탭 인라인 destructive `Alert` + 재분석 (주 데이터가 실패 상태) |
| 409 녹음 중 종료 | 종료 다이얼로그 안 인라인 `Alert` + 녹음 중지 액션 |
| 409 이미 종료·미종료·분석 중 | 토스트 (전역 MutationCache) 또는 버튼 숨김/disabled로 예방 |
| 노트 404 | error boundary/빈 상태 (기존) |

## 성공 기준

- 시작자만 조작 버튼(중지/재개/종료), 뷰어는 상태 pill + 시작자 힌트
- 회의 종료 확인 → 202 → 요약 탭이 분석 대기로; 녹음 중이면 409 → 다이얼로그 안 녹음 중지 분기
- 요약 탭 다섯 화면: 404 빈 상태(ENDED면 요약 만들기) / analyzing 폴링 / SUCCEEDED 마크다운 3종 / FAILED 재분석
- 마크다운 렌더러가 문단·`-`·`1.`을 그린다
- full 모드 3탭 유지, ENDED 전 요약 탭은 안내
- vitest: 마크다운 단위 + note-summary(다섯 상태) + meeting-controls(시작자/뷰어) + 종료 다이얼로그(409)
- 브라우저 실측 + 전체 검증

## 리뷰 게이트

로컬 `codex exec review --base dev` 한 번. 판단은 `docs/codex-review-app-111.md`에 남긴다.
