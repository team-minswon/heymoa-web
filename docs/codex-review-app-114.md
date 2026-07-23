# APP-114 codex 게이트 기록

`codex exec review --base dev`. 지적은 전부 실재해 전부 반영했다.

## R1 — 2건 P2

### 1. 승인 대기 중 스트림이 비정상 종료하면 만료 카드가 안 뜬다 (use-tool-approval.ts)

spec은 "만료(응답 없음)면 무효화 카드가 남는다"를 약속했는데, 구현이 `pending`이 살아 있을
때만 카드를 그려 스트림이 stall/error로 `pending`을 지우면 카드가 통째로 사라졌다.

**반영:** 훅이 **직전 승인을 붙잡아** 카드를 소유한다(`stream.pendingApproval`이 아니라 훅의
`card`를 그린다). `pending`이 비정상 종료(failed/stalled/aborted)로 소실되면 만료 무효화 카드로
남기고, 새 턴(streaming)이 시작되면 접는다. effect 대신 **렌더 중 상태 조정**(React 공식 패턴)으로
`set-state-in-effect` 규칙을 피했다.

### 2. 종료 오류가 인라인 + 전역 토스트 두 곳에 겹친다 (use-tool-approval.ts)

403/404/409를 인라인 무효화 카드로 그리면서 mutation의 전역 토스트도 떠 같은 실패가 두 곳에
겹쳤다(오류 경계 규칙 위반).

**반영:** resolve mutation에 `meta.suppressErrorToast`를 걸어 전역 토스트를 끄고, **재시도 가능한
실패만** 훅이 명시적으로 토스트한다(인라인이 없는 경우이므로).

## R2 — 1건 P2

### 확정 뒤 늦게 온 종료 오류가 죽은 카드를 되살린다 (use-tool-approval.ts)

만료가 스트림에서 REJECTED로 확정돼 `pending`이 지워진 뒤, in-flight였던 승인 요청이 늦게
`APPROVAL_NOT_FOUND`를 돌려주면 `onError`가 캡처한 `target`으로 무효화 카드를 부활시켜, 기록
아래에 죽은 승인 카드가 다시 떴다.

**반영:** `pendingRef`(effect로 최신 pending 미러)로 콜백 시점에 **같은 승인이 아직 pending인지**
확인하고, 아니면 오류를 통째로 무시한다(무효화·헛토스트 방지).

## R3 — 통과

"internally consistent and covered by tests." 2라운드 / 지적 3건(전부 P2) 전부 반영.
