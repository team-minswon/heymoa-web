# 스크립트 화면의 실시간 정리 안내 행 제거 — 구현 순서

- 이슈: [APP-636](https://linear.app/minswon/issue/APP-636)
- spec: docs `main:projects/_미분류/APP-636/spec.md`
- APP 브랜치: `fix/app-636/transcript-coverage-rows` ← `dev` (cd764c2, APP-631 web 반영 후). 프로젝트 브랜치 없음
- 병합: 로컬 squash → `dev` push → `main` ff push (Vercel Production)
- 검증: `pnpm test:run && pnpm verify`

## spec 검토 결과

| 관점 | 물은 것 | 답 |
|---|---|---|
| 계약 | 서버 계약이 바뀌나 | 아니다. `runs[]` 는 그대로 받고 reducer 의 `runs` 상태도 남는다(명제 레일 「지금까지 N건」이 쓴다) |
| 경계 | 지우는 코드를 읽는 곳 | `withCoverageRows` — `transcript-view`·`note-archive` 둘. `findCoverageGaps` — timeline 과 테스트 둘. `ContextCoverageGapRow` — 화면 둘. `sortRanges` 는 reducer 안에서 계속 쓴다 |
| 되돌리기 | 복구 비용 | revert 한 번. 저장된 것 없음 |

## 건드리는 것

| 파일 | 변경 |
|---|---|
| `lib/notes/proposals/timeline.ts`·`timeline.test.ts`·`components/notes/proposal-coverage-row.tsx` | 삭제 |
| `lib/notes/proposals/reducer.ts` | `CoverageGap`·`findCoverageGaps` 와 머리말 4항 삭제 |
| `components/notes/transcript-view.tsx` | `renderRows`·`coverageKey` 삭제, `rows` 를 바로 그린다 |
| `components/notes/note-archive.tsx` | `renderRows`·`useNoteRealtime` 삭제, `rows` 를 바로 그린다 |
| `reducer.test.ts`·`synthetic-ledger-snapshot.test.ts` | 구멍 케이스 삭제 |

## 순서

1. 파일 셋 삭제 → typecheck 가 빨갛게 가리키는 자리를 따라 위 표대로 지운다.
2. `pnpm test:run && pnpm verify`.
3. 로컬 squash → dev → main.
