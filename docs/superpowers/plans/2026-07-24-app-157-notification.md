# APP-157 알림 표면 재배치 계획

## Task 1: 드롭다운 표면 정합

**Files:** `components/notification/notification-bell.tsx`

- `DropdownMenuContent` className에 `overflow-hidden rounded-panel border border-[var(--el-hairline)] bg-[var(--el-surface-card)] shadow-e3 ring-0` 추가(불투명 흰 + e3, base의 canvas·shadow-md·ring 무력화).
- 헤더/행/버튼/Alert 동작·마크업은 유지("모두 읽음으로" 추가 안 함).

## Task 2: 검증

- shadow-e3가 base shadow-md를 이기는지 Playwright 육안 확인(안 이기면 명시 override).
- 열림·빈·해결 상태 실측 대조(sPg4o·e71yPK·M5pzv).
- 기존 `notification-bell.test.tsx` 통과(동작 불변).

## Task 3: 게이트·머지

- `pnpm test:run && lint && typecheck && build && test:e2e`.
- `codex exec review --base dev` P1 없음 → dev squash merge, Linear Done.

## Self-Review
- 동작 0 변경 — 배치·표면만. 계약 불변, 벌크 읽음 안 그림.
- 벨 위치는 154 계승(재작업 없음).
