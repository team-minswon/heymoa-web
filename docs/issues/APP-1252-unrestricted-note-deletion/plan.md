# 회의 삭제 UI와 녹음·조회 정리 구현 계획

- 이슈: [APP-1252](https://linear.app/minswon/issue/APP-1252)
- spec: docs `origin/docs/app-1255/deletion-reconnection-registration:projects/PRO-48-명제·관계-온톨로지와-AI-workflow-품질-고도화/spec/APP-1252/spec.md` @ `72ec3c5c3434b3bbf059a1edc83f6166681ecb29`
- 프로젝트 브랜치: `pro-48/명제·관계-온톨로지와-AI-workflow-품질-고도화` ← `dev`
- APP 브랜치: `feature/app-1252-unrestricted-note-deletion` (인계받은 기존 WT와 브랜치를 유지)
- 병합: 별도 승인 뒤 APP → PRO squash, PRO → dev rebase. 이번 작업에는 병합·배포를 포함하지 않음
- 검증: `pnpm test:run && pnpm verify`

## spec 검토 결과

| 관점 | 물은 것 | 답 |
|---|---|---|
| 계약 | 발행된 약속과 어긋나나 | 생성 DELETE의 204와 기존 analysis-flow 조회를 사용한다. Server 담당은 회의 상태 가드 없이 권한 기반 DELETE를 유지한다고 확인했다. Web의 분석 진행 중 비활성화는 기존 `ANALYZING` 값을 사용한다. 공개 응답 사본·Orval 생성물은 Server가 인계한 변경을 보존한다. |
| 실측 | 근거 숫자가 실제로 잰 것인가 | 인계된 기존 테스트 수치는 최종 Orval 전의 결과다. 이 계획의 완료 근거로 재사용하지 않고 최종 생성물에 대해 검사한다. |
| 경계 | 호출자·테스트 더블을 확인했나 | 삭제 호출자는 상세 메뉴와 목록 행의 공용 `NoteDeleteDialog`다. 목록/상세 응답에 분석 상태가 없으므로 확인창이 열릴 때 기존 생성 조회로 상태를 확인한다. 목록마다 새 조회를 돌리지 않는다. `RecordingProvider`, MSW, 캐시 상호작용과 브라우저 흐름이 함께 영향을 받는다. |
| 되돌리기 | 복구 비용은 얼마인가 | Web 변경은 되돌릴 수 있으나 성공한 Server 물리 삭제는 복구하지 않는다. 실패에는 녹음·캐시·화면을 보존하며, 성공 후에는 늦은 목록 조회를 취소하고 대상만 제거한다. |
| 사람에게 물은 것 | 열린 질문에 답이 났나 | 사용자가 분석 중 비활성화/미분석·완료·실패 삭제 허용과 기존 상태 사용을 확정했다. 안건 다중성은 Server·AI 책임으로 남으며 이번 공개 응답을 Web에서 새로 설계하지 않는다. |

## 건드리는 것

| 파일 | 지금 무엇인가 | 무엇으로 바뀌나 |
|---|---|---|
| `components/notes/note-delete-dialog.tsx` | 공용 확인창, 성공 후 녹음·캐시 정리 | 열릴 때 기존 분석 상태를 확인하고 진행 중 확인 버튼 비활성화. 성공 후 진행 중 조회 취소와 연결 조회 갱신 |
| `components/notes/note-panel.tsx`, `components/workspace/note-list-row.tsx` | 기록 중 삭제 메뉴 숨김을 제거한 인계 변경 | 상태와 무관하게 같은 확인창 사용, 권한·확인 유지 |
| `components/transcription/recording-provider.tsx` | 대상 noteId 조건의 disconnect·404 정리 인계 변경 | 다른 회의 녹음 보존과 대상 세션 정리 검증 |
| `lib/mocks/{db,rest-handlers,transcription-scenario}.ts` | 상태 가드 제거·삭제 후 dispose 인계 변경 | 실제 삭제 응답과 일치하는 모의 환경 유지 |
| `openapi3.yml`, `lib/api/generated/**`, `components/notes/review/suggestion-row.tsx` | Server 공개 계약·재생성·nullable 출처 대응 인계 변경 | 손편집 없이 최종 타입·빌드 검사 |
| `lib/notes/review/{meeting-links,confirm,apply-item-patch}.ts`, `lib/mocks/meeting-flow.ts`, 기존 검토 fixture | 최종 생성물의 nullable 출처·필수 decisions/draft·APPLY와 기존 Web 타입의 차이 | 출처 없는 승계 항목에 죽은 회의 링크를 만들지 않고, 빈 decisions/null draft와 기존 선택 의미를 호환. 새 편집 UX는 만들지 않음 |
| 관련 `.test.tsx`, `e2e/smoke.spec.ts` | 기존 성공·실패·기록 중 삭제 검사 | 분석 진행/완료/실패·미분석, 늦은 목록/연결 조회, 대상 녹음과 다른 녹음 보존 보강 |

## 순서

### 1. 기존 분석 상태에 따른 삭제 확인 버튼 제한

- 바꾸는 것: 공용 확인창에서 기존 생성 `useGetAnalysisFlow`와 Query 캐시를 사용한다. 열 때 `staleTime: 0`으로 재확인하며, 열려 있는 동안 기존 `flowPollInterval`을 따른다. 진행 중에는 비활성화 사유를 표시하고, 확인 중이거나 조회 실패일 때는 기존 조회/재시도 UI로 상태를 확인한다. 별도 분석 상태 저장소는 만들지 않는다.
- 검증: `pnpm exec vitest run components/notes/note-delete-dialog.test.tsx components/workspace/note-list-row.test.tsx components/notes/note-panel.test.tsx`
- 되돌리기: 해당 UI와 검사 변경만 되돌릴 수 있다. Server 원문에는 쓰지 않는다.

### 2. 삭제 성공 후 대상 녹음·조회 정합성 보완

- 바꾸는 것: 성공 전에는 자료를 보존한다. 204 뒤에는 목록의 진행 중 조회를 취소한 뒤 대상 행을 제거하고 재조회한다. 대상 노트 상세·전사·분석과 프로젝트 연결 조회를 정리하고, 다른 회의·프로젝트 승계 항목과 녹음은 유지한다. 새 삭제 상태나 tombstone 저장소는 추가하지 않는다.
- 검증: `pnpm exec vitest run components/notes/note-delete-dialog.test.tsx components/transcription/recording-provider.test.tsx lib/mocks/db.test.ts lib/mocks/transcription-scenario.test.ts`
- 되돌리기: Web 변경만 되돌린다. 이미 성공한 삭제 요청은 다시 보내거나 원문을 복구하지 않는다.

### 3. 브라우저 삭제 경로와 독립 검토

- 바꾸는 것: 기존 브라우저 삭제 사례와 분석 상태 제한을 확인하고, 독립 tester가 실패·늦은 응답·다른 녹음 보존을 검토한다. 사용자에게 실제 diff와 검사 결과를 제공한다.
- 검증: `pnpm test:e2e e2e/smoke.spec.ts e2e/meeting-review.spec.ts --grep '삭제' --workers=1` 및 아래 마지막 관문. 별도 브라우저 dev 서버를 사용하며 다른 pane의 서버는 종료하지 않는다.
- 되돌리기: 검사만으로 운영 자료는 바뀌지 않는다. 결함이 발견되면 이 APP 범위에서 수정한다.

## 마지막 관문

Server baseline의 `PatchMeetingReviewItemHandler.requireDecisionsAllowed`는 기존 `APPLIED`와 초안 없는 선택을 허용한다. `MeetingReviewIT`의 기존 APPLIED 저장 성공 사례와 담당 확인을 근거로 Web의 PUT → APPLIED PATCH 반영을 유지한다. 새 APPLY/초안 편집 UX로 바꾸지 않는다. 관계 응답은 Server가 kind로 배열을 재분류하지 않으므로 기존 표시 종류를 `meetingLinks`와 `conflicts` 양쪽에서 읽고 중복을 제거한다. nullable 표본 검사에서 기존 목이 제공하지 않는 저장 초안·APPROVED 출처는 정확한 필드/사유로 남기며 검증 성공으로 세지 않는다.

최종 변경과 생성물에 `pnpm test:run && pnpm verify`를 한 번 통째로 실행한다. 이 레포에는 PR/CI가 없어 이 검사가 로컬 관문이다. 브라우저 삭제 검사와 레포 `code-review` 기준의 리뷰를 추가한다. 병합/배포 완료로 보고하지 않는다.

## 안 하는 것

전건 분석, 프로젝트 요약, 승계 결정·할 일 재판정, Web 연결 합성, SQS/AI 호출, 새 기능·이슈, 일반 분석 flag, 별도 삭제 상태관리, 병합·배포는 하지 않는다. AI 그룹 실험은 %4, Server 삭제는 %1, AI 비실험 구현은 %0 소유다.
