# 녹음 클라이언트 재부착·이어 보내기 이관 (web) — 구현 순서

- 이슈: [APP-704](https://linear.app/minswon/issue/APP-704) (PRO-51-I09)
- 문서: docs `main:projects/PRO-51-실시간-전사-끊김-복구/docs/issues/PRO-51-I09-web-redesign-base.md`
- 프로젝트 브랜치: `pro-51/realtime-transcript-resilience` ← `origin/dev` (98369b9)
- APP 브랜치: `feature/app-704/redesign-reattach-carryover` ← 프로젝트 브랜치
- 병합: 로컬 squash → 프로젝트 브랜치 push. dev·main 은 건드리지 않는다
- 검증: `pnpm test:run && pnpm verify`

## 옮기는 것

`실험/전사-재설계` 의 커밋 여섯(dc306e8 → fbbe766)을 순서대로 cherry-pick 한다.

| 충돌 후보 | dev 쪽 | 합치는 방식 |
|---|---|---|
| `realtime-session.ts` completed 처리 | d313497: completed 면 세션을 닫아 마이크를 끈다 | 재설계의 「ACK 된 것만 지움·저장 덜 끝나면 다시 붙어 stop」은 유지하고, 녹음 중에 온 completed(남이 종료)는 마이크를 바로 끄고 정체 실패를 내지 않는다 |
| `note-panel.tsx`·`meeting-controls` | APP-695: 녹음 중엔 종료 버튼을 막는다 | dev 동작 유지. 재설계의 저장 대기 표시는 그 위에 얹는다 |

## 하지 않는 것

30초 창·알림 화면 정리·최신 3초·디스크 저장 제거·콘솔 로그 — APP-705/706 이후.

## 순서

1. cherry-pick 여섯, 충돌마다 위 표대로 푼다.
2. 주변을 다시 읽고 실험 흔적·설명 주석을 걷어 낸다. 동작은 바꾸지 않는다.
3. 재부착·durableThroughSeq 다음부터 재전송·reattach/superseded·completed 뒤 ACK 된 것만 지움·폴링이 끊김으로 녹음을 끝내지 않음 — 빠진 테스트를 기대 동작부터 쓴다.
4. `pnpm test:run && pnpm verify`.
5. 로컬 squash → 프로젝트 브랜치 push.
